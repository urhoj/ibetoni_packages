import { describe, it, expect } from "vitest";
import { createRequire } from "module";
const nodeRequire = createRequire(import.meta.url);

const { asyncHandler } = nodeRequire("../validation.js");

// fb#1566: the wrapper used to discard the inner promise, so a unit test doing
// `await handler(req, res)` resolved BEFORE the async body ran and asserted on
// mocks nothing had touched yet — green with false confidence.
describe("asyncHandler", () => {
    it("returns a promise that settles only after the handler body has run", async () => {
        let ran = false;
        const handler = asyncHandler(async () => {
            await new Promise((r) => setTimeout(r, 5));
            ran = true;
        });
        await handler({}, {}, () => {});
        expect(ran).toBe(true);
    });

    it("routes a rejection to next() and still settles the returned promise", async () => {
        const boom = new Error("boom");
        const handler = asyncHandler(async () => { throw boom; });
        let passed = null;
        await handler({}, {}, (e) => { passed = e; });
        expect(passed).toBe(boom);
    });
});
