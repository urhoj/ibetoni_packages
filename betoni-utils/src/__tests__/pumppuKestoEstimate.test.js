import { describe, it, expect } from "vitest";
import { estimatePumppuKesto, PUMPPU_KESTO_FIT } from "../pumppuKestoEstimate.js";

describe("estimatePumppuKesto", () => {
  it.each([
    [1, 75],
    [10, 180],
    [30, 285],
    [60, 375],
    [100, 465],
  ])("%s m3 → %s min", (m3, minutes) => {
    expect(estimatePumppuKesto(m3)).toBe(minutes);
  });

  it("snaps to the 15-minute slider step", () => {
    for (const m3 of [2.5, 7, 13.3, 47, 88.8]) {
      expect(estimatePumppuKesto(m3) % PUMPPU_KESTO_FIT.stepMin).toBe(0);
    }
  });

  it("never returns less than the 60-minute floor", () => {
    expect(estimatePumppuKesto(0.1)).toBe(60);
    expect(estimatePumppuKesto(0.5)).toBe(60);
  });

  it("returns null when m3 is unknown or not positive", () => {
    for (const m3 of [0, -5, null, undefined, NaN, "abc"]) {
      expect(estimatePumppuKesto(m3)).toBeNull();
    }
  });

  it("accepts numeric strings", () => {
    expect(estimatePumppuKesto("30")).toBe(285);
  });
});
