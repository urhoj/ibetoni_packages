import { describe, it, expect } from "vitest";
import { estimatePumppuKesto } from "../pumppuKestoEstimate.js";

describe("estimatePumppuKesto", () => {
  it.each([
    [0.1, 60], // floor
    [1, 75],
    [7, 150], // 156.4 snaps to the 15-min step
    [10, 180],
    [30, 285],
    ["30", 285],
    [60, 375],
    [100, 465],
  ])("%s m3 → %s min", (m3, minutes) => {
    expect(estimatePumppuKesto(m3)).toBe(minutes);
  });

  it("returns null when m3 is unknown or not positive", () => {
    for (const m3 of [0, -5, null, undefined, NaN, Infinity, "abc"]) {
      expect(estimatePumppuKesto(m3)).toBeNull();
    }
  });
});
