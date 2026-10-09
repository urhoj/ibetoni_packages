import { describe, it, expect } from "vitest";
import { createRequire } from "module";
import { KEIKKA_DONE_TILA_IDS } from "../index.js";
const require = createRequire(import.meta.url);

describe("KEIKKA_DONE_TILA_IDS", () => {
  it("lists Peruttu, Toimitettu x3, Poistettu, Valmis", () => {
    expect([...KEIKKA_DONE_TILA_IDS]).toEqual([8, 9, 10, 12, 13, 100]);
    expect(Object.isFrozen(KEIKKA_DONE_TILA_IDS)).toBe(true);
  });
  it("CJS twin is identical", () => {
    expect([...require("../../index.js").KEIKKA_DONE_TILA_IDS]).toEqual([...KEIKKA_DONE_TILA_IDS]);
  });
});
