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

  describe("palkkis (fb#2723)", () => {
    // Backend grid_palkit row shape and the grid item shape of the same palkki.
    const api = { grid_palkki_Id: 7742, vehicleId: 480, starttime: "2026-10-21T04:00:00.000Z", grid_palkkiTypeId: 18, text: "Tulee klo 8.00 töihin" };
    const grid = { palkkiId: 7742, keikkaId: "p7742", vehicleId: 480, timeStart: new Date("2026-10-21T04:00:00.000Z"), grid_palkkiTypeId: 18, keikkaComment: "Tulee klo 8.00 töihin", keikkaTilaId: -100 };

    it("a palkki-only day has a fingerprint, the same from both shapes and both twins", () => {
      const sig = driverDaySignature([], DAY, [api]);
      expect(sig).toMatch(/^[0-9a-f]{8}$/);
      expect(driverDaySignature([], DAY, [grid])).toBe(sig);
      expect(cjs.driverDaySignature([], DAY, [api])).toBe(sig);
    });

    it("a keikka-only day keeps its pre-palkki fingerprint", () => {
      expect(driverDaySignature(rows, DAY, [])).toBe("a1398a09");
      expect(driverDaySignature(rows, DAY, [{ ...api, vehicleId: 999 }])).toBe("a1398a09");
    });

    it("text, start, type, an added palkki: each changes it", () => {
      const sig = driverDaySignature(rows, DAY, [api]);
      expect(sig).not.toBe("a1398a09");
      expect(driverDaySignature(rows, DAY, [{ ...api, text: "Tulee klo 9.00 töihin" }])).not.toBe(sig);
      expect(driverDaySignature(rows, DAY, [{ ...api, starttime: "2026-10-21T05:00:00.000Z" }])).not.toBe(sig);
      expect(driverDaySignature(rows, DAY, [{ ...api, grid_palkkiTypeId: 21 }])).not.toBe(sig);
      expect(driverDaySignature(rows, DAY, [api, { ...api, grid_palkki_Id: 7743 }])).not.toBe(sig);
    });

    it("palkki order and null vs empty text do not matter; other days and temp ids do not count", () => {
      const b = { ...api, grid_palkki_Id: 7743, text: null };
      expect(driverDaySignature([], DAY, [api, b])).toBe(driverDaySignature([], DAY, [{ ...b, text: "" }, api]));
      expect(driverDaySignature([], DAY, [{ ...api, starttime: "2026-10-21T22:30:00.000Z" }])).toBeNull();
      expect(driverDaySignature([], DAY, [{ ...grid, palkkiId: "temp_1" }])).toBeNull();
    });
  });

  it("DRIVER_DAY_TILA_IDS is the statuses the grid shows", () => {
    expect([...DRIVER_DAY_TILA_IDS].sort((a, b) => a - b)).toEqual([-100, -1, 0, 1, 2, 3, 4, 5, 8, 9, 12, 13, 100]);
  });
});
