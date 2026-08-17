import { describe, it, expect, vi } from "vitest";

// responses.js reaches Sentry through `require("@ibetoni/sentry")`. Resolve the
// same CJS module object here so the spy lands on the function it actually
// calls — an ESM `import` binding or a vi.mock specifier does not intercept it.
import { createRequire } from "module";
const nodeRequire = createRequire(import.meta.url);
const sentry = nodeRequire("@ibetoni/sentry");

const { sendError, sendNotFound, handleRouteError, classifySqlError } = nodeRequire("../responses.js");

function mockRes() {
    const res = { statusCode: null, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
}

describe("sendError", () => {
    it("is byte-identical to the legacy shape when no code is given", () => {
        const res = mockRes();
        sendError(res, "Tarjouspyyntöä ei löydy", 404);
        expect(res.body).toEqual({ success: false, message: "Tarjouspyyntöä ei löydy", error: "Tarjouspyyntöä ei löydy" });
        expect(Object.keys(res.body)).toEqual(["success", "message", "error"]);
    });

    it("adds a code when one is given", () => {
        const res = mockRes();
        sendError(res, "Tarjouspyyntö on jo lähetetty", 409, "REQUEST_ALREADY_SENT");
        expect(res.body.code).toBe("REQUEST_ALREADY_SENT");
        expect(res.statusCode).toBe(409);
    });

    it("omits the key entirely for an empty code rather than sending code: undefined", () => {
        const res = mockRes();
        sendError(res, "x", 400, "");
        expect("code" in res.body).toBe(false);
    });

    it("keeps the convenience wrappers unchanged", () => {
        const res = mockRes();
        sendNotFound(res, "nope");
        expect(res.body).toEqual({ success: false, message: "nope", error: "nope" });
    });

    // The eslint no-restricted-syntax rules push sendError(res, msg, 404, code)
    // callers onto sendNotFound. If the wrapper drops the 3rd arg, the migration
    // silently strips `code` from the body and betonijerry's src/i18n/errorCopy.js
    // falls back to raw Finnish with nothing logged anywhere.
    it("forwards a code through the status wrappers", () => {
        const res = mockRes();
        sendNotFound(res, "Tarjouspyyntöä ei löydy", "REQUEST_NOT_FOUND");
        expect(res.statusCode).toBe(404);
        expect(res.body.code).toBe("REQUEST_NOT_FOUND");
    });
});

describe("handleRouteError on a vanished row (fb#644)", () => {
    function rowDeleted() {
        const error = new Error("Keikka no longer exists (deleted); nothing was saved");
        error.code = "ROW_DELETED";
        error.statusCode = 409;
        return error;
    }

    it("answers 409 WITH the code, and books no Sentry event", () => {
        const spy = vi.spyOn(sentry, "captureException").mockImplementation(() => {});
        try {
            const res = mockRes();
            handleRouteError(res, rowDeleted(), "saveOtsikko", { _entity: "keikka" });
            expect(res.statusCode).toBe(409);
            expect(res.body.code).toBe("ROW_DELETED");
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });

    it("still reports and 500s anything that is not a vanished row", () => {
        const spy = vi.spyOn(sentry, "captureException").mockImplementation(() => {});
        try {
            const res = mockRes();
            handleRouteError(res, new Error("boom"), "saveOtsikko", { _entity: "keikka" });
            expect(res.statusCode).toBe(500);
            expect("code" in res.body).toBe(false);
            expect(spy).toHaveBeenCalledTimes(1);
        } finally {
            spy.mockRestore();
        }
    });
});

/**
 * SQL truncation (fb#444 → fb#483).
 *
 * fb#444 fixed this in legalDocument's own handler only, so every other module
 * kept answering 500 for an overlong input — the exact shape that reproduces on
 * both slots and reads as a deploy outage. These pin the classification itself;
 * the legalDocument wire format has its own jest suite in puminet5api.
 */
function sqlError(number, message) {
    const error = new Error(message);
    error.number = number;
    return error;
}

describe("classifySqlError", () => {
    it("names the offending column from a 2628", () => {
        const hit = classifySqlError(sqlError(
            2628,
            "String or binary data would be truncated in table 'puminet.dbo.legalDocuments', column 'version'. Truncated value: 'zz-probe'."
        ));
        expect(hit).toEqual({ code: "VALIDATION_ERROR", message: "Arvo on liian pitkä sarakkeeseen 'version'." });
    });

    it("falls back to a generic length message on the legacy 8152, which carries no column", () => {
        const hit = classifySqlError(sqlError(8152, "String or binary data would be truncated."));
        expect(hit.message).toBe("Arvo on liian pitkä tietokantasarakkeeseen.");
    });

    it("returns null for anything else, so callers keep their own handling", () => {
        expect(classifySqlError(new Error("boom"))).toBeNull();
        expect(classifySqlError(sqlError(547, "FK violation"))).toBeNull();
        expect(classifySqlError(undefined)).toBeNull();
    });
});

describe("handleRouteError on SQL truncation (fb#483)", () => {
    it("answers 400 naming the column instead of an opaque 500", () => {
        const spy = vi.spyOn(sentry, "captureException").mockImplementation(() => {});
        try {
            const res = mockRes();
            handleRouteError(
                res,
                sqlError(2628, "String or binary data would be truncated in table 'dbo.keikka', column 'otsikko'."),
                "saveKeikka",
                { _entity: "keikka" }
            );
            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe("VALIDATION_ERROR");
            expect(res.body.message).toContain("otsikko");
        } finally {
            spy.mockRestore();
        }
    });

    // Deliberately unlike ROW_DELETED, which returns before Sentry: a truncation
    // means a missing length guard upstream, and that is worth seeing.
    it("still books the Sentry event, because a truncation is a real upstream gap", () => {
        const spy = vi.spyOn(sentry, "captureException").mockImplementation(() => {});
        try {
            handleRouteError(mockRes(), sqlError(8152, "String or binary data would be truncated."), "saveKeikka");
            expect(spy).toHaveBeenCalledTimes(1);
        } finally {
            spy.mockRestore();
        }
    });

    it("lets an explicit statusCode win — a caller that decided is not guessing", () => {
        const spy = vi.spyOn(sentry, "captureException").mockImplementation(() => {});
        try {
            const error = sqlError(2628, "String or binary data would be truncated in table 't', column 'c'.");
            error.statusCode = 422;
            const res = mockRes();
            handleRouteError(res, error, "saveKeikka");
            expect(res.statusCode).toBe(422);
        } finally {
            spy.mockRestore();
        }
    });
});
