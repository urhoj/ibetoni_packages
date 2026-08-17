// PUMINET ships TWICE: `import` resolves to src/puminet.js, `require` goes
// index.js -> src/puminet.cjs (package.json exports). Editing one half survives
// commit, sync, deploy and restart in total silence, because whichever half the
// reader happens to load still looks correct on its own. The betonijerry suite
// pins the require() half because that is what the backends read; this file does
// that too AND asserts the two halves agree, which is the failure that half-copy
// actually produces.
import { describe, test, expect } from "vitest";
import cjs from "../../index.js";
import { PUMINET as esmCopy } from "../puminet.js";

const { PUMINET: requiredCopy } = cjs;

describe("PUMINET constants", () => {
  test("OWNER_ASIAKAS_ID is 26", () => {
    expect(requiredCopy.OWNER_ASIAKAS_ID).toBe(26);
  });

  // personId 10 = the maintainer who receives the CLI-feedback digest and new
  // support escalations. Previously declared as a private NOTIFY_PERSON_ID in
  // both feedbackEmail.js and supportEmail.js.
  test("MAINTAINER_PERSON_ID is 10", () => {
    expect(requiredCopy.MAINTAINER_PERSON_ID).toBe(10);
  });

  test("the ESM and CJS copies agree", () => {
    expect(esmCopy).toEqual(requiredCopy);
  });

  test("PUMINET is frozen (no accidental mutation)", () => {
    expect(Object.isFrozen(requiredCopy)).toBe(true);
    expect(Object.isFrozen(esmCopy)).toBe(true);
  });
});
