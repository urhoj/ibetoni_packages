// Imports the CJS entry deliberately: this package ships the same constants twice
// (`import` -> src/*.js, `require` -> index.js -> src/*.cjs, per package.json exports),
// and the backends load the require() half. Asserting against index.js keeps the copy
// that production actually reads under test.
import { describe, test, expect } from "vitest";
import pkg from "../../index.js";

const { BETONIJERRY } = pkg;

describe("BETONIJERRY constants", () => {
  test("OWNER_ASIAKAS_ID is 1349", () => {
    expect(BETONIJERRY.OWNER_ASIAKAS_ID).toBe(1349);
  });

  test("OWNER_PERSON_ID is 6233", () => {
    expect(BETONIJERRY.OWNER_PERSON_ID).toBe(6233);
  });

  test("BETONIJERRY is frozen (no accidental mutation)", () => {
    expect(Object.isFrozen(BETONIJERRY)).toBe(true);
  });
});
