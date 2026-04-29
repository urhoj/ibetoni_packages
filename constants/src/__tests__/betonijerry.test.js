const { BETONIJERRY } = require("../../index.js");

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
