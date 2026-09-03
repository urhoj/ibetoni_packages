// errors.js ships TWICE: `import` resolves to src/errors.js, `require` goes
// index.js -> src/errors.cjs (package.json exports). Editing one half survives
// commit, sync, deploy and restart in total silence, because whichever half the
// reader happens to load still looks correct on its own. This file pins the
// require() half (what the backends read) AND asserts the two halves agree.
import { describe, test, expect } from "vitest";
import cjs from "../../index.js";
import { isUniqueViolation as esmCopy } from "../errors.js";

const { isUniqueViolation: requiredCopy } = cjs;

describe("isUniqueViolation", () => {
  test.each([
    ["2601 (CREATE UNIQUE INDEX)", { number: 2601 }, true],
    ["2627 (named UNIQUE/PRIMARY KEY constraint)", { number: 2627 }, true],
    ["an unrelated SQL error number", { number: 547 }, false],
    ["no number property", {}, false],
    ["null", null, false],
    ["undefined", undefined, false],
  ])("%s -> %s", (_label, err, expected) => {
    expect(requiredCopy(err)).toBe(expected);
    expect(esmCopy(err)).toBe(expected);
  });
});
