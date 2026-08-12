import { describe, it, expect } from "vitest";
import { sendError, sendNotFound } from "../responses.js";

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
