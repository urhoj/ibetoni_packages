import { describe, it, expect, vi } from "vitest";

// responses.js reaches Sentry through `require("@ibetoni/sentry")`. Resolve the
// same CJS module object here so the spy lands on the function it actually
// calls — an ESM `import` binding or a vi.mock specifier does not intercept it.
import { createRequire } from "module";
const nodeRequire = createRequire(import.meta.url);
const sentry = nodeRequire("@ibetoni/sentry");

const { sendError, sendNotFound, handleRouteError } = nodeRequire("../responses.js");

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
