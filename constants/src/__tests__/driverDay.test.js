import { describe, it, expect } from "vitest";
import { createRequire } from "module";
import { driverDaySignature, helsinkiYyyymmdd, DRIVER_DAY_TILA_IDS } from "../driverDay.js";
const require = createRequire(import.meta.url);
const cjs = require("../driverDay.cjs");

const DAY = { pvm: 20261021, vehicleId: 480 };
// Frozen from the puminet4 driverDaySignature.js of 2026-10-21, before it moved here.
const rows = [
  { keikkaId: 12891, vehicleId: 480, pumppuAika: "2026-10-21T04:00:00.000Z", tyomaaId: 55, keikkaTilaId: 4 },
  { keikkaId: 12900, vehicleId: 480, pumppuAika: "2026-10-21T09:30:00.000Z", tyomaaId: 77, keikkaTilaId: 8 },
];

describe("driverDay", () => {
  it("known vector: the fingerprint the grid computed before the move", () => {
    expect(driverDaySignature(rows, DAY)).toBe("a1398a09");
  });

  it("cjs and esm give equal sig for the same rows", () => {
    expect(cjs.driverDaySignature(rows, DAY)).toBe(driverDaySignature(rows, DAY));
    expect(cjs.helsinkiYyyymmdd("2026-10-21T22:30:00.000Z")).toBe(helsinkiYyyymmdd("2026-10-21T22:30:00.000Z"));
    expect([...cjs.DRIVER_DAY_TILA_IDS]).toEqual([...DRIVER_DAY_TILA_IDS]);
  });

  it("22:30Z on 2026-10-21 counts as 20261022", () => {
    expect(helsinkiYyyymmdd("2026-10-21T22:30:00.000Z")).toBe(20261022);
    const late = [{ ...rows[0], pumppuAika: "2026-10-21T22:30:00.000Z" }];
    expect(driverDaySignature(late, DAY)).toBeNull();
    expect(driverDaySignature(late, { ...DAY, pvm: 20261022 })).toMatch(/^[0-9a-f]{8}$/);
  });

  it("helsinkiYyyymmdd takes a Date and rejects junk", () => {
    expect(helsinkiYyyymmdd(new Date("2026-10-21T04:00:00Z"))).toBe(20261021);
    expect(helsinkiYyyymmdd(null)).toBeNull();
    expect(helsinkiYyyymmdd("not a date")).toBeNull();
  });

  it("DRIVER_DAY_TILA_IDS is the statuses the grid shows", () => {
    expect([...DRIVER_DAY_TILA_IDS].sort((a, b) => a - b)).toEqual([-100, -1, 0, 1, 2, 3, 4, 5, 8, 9, 12, 13, 100]);
  });
});
