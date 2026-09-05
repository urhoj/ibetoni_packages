import { describe, it, expect } from "vitest";
import { parseHelsinkiLocal, helsinkiOffsetMinutes } from "../helsinkiTime.js";

const iso = (d) => (d ? d.toISOString() : d);

describe("helsinkiOffsetMinutes", () => {
  it("is +180 in summer and +120 in winter", () => {
    expect(helsinkiOffsetMinutes(Date.UTC(2026, 6, 1, 12))).toBe(180);
    expect(helsinkiOffsetMinutes(Date.UTC(2026, 0, 15, 12))).toBe(120);
  });
});

describe("parseHelsinkiLocal", () => {
  it("honours an explicit colon-less offset (the Ecofleet `at` shape)", () => {
    expect(iso(parseHelsinkiLocal("2026-08-28 09:00:41+0300"))).toBe("2026-08-28T06:00:41.000Z");
  });
  it("honours a colon offset and Z", () => {
    expect(iso(parseHelsinkiLocal("2026-08-28T09:00:41+03:00"))).toBe("2026-08-28T06:00:41.000Z");
    expect(iso(parseHelsinkiLocal("2026-08-28T06:00:41Z"))).toBe("2026-08-28T06:00:41.000Z");
  });
  it("reads an offset-less string as Helsinki wall clock, summer (+3)", () => {
    expect(iso(parseHelsinkiLocal("2026-08-28 09:00:41"))).toBe("2026-08-28T06:00:41.000Z");
  });
  it("reads an offset-less string as Helsinki wall clock, winter (+2)", () => {
    expect(iso(parseHelsinkiLocal("2026-01-15 09:00:41"))).toBe("2026-01-15T07:00:41.000Z");
  });
  it("is right on both sides of the spring DST change (2026-03-29 03:00 -> 04:00)", () => {
    expect(iso(parseHelsinkiLocal("2026-03-28 12:00:00"))).toBe("2026-03-28T10:00:00.000Z");
    expect(iso(parseHelsinkiLocal("2026-03-29 12:00:00"))).toBe("2026-03-29T09:00:00.000Z");
  });
  it("does not throw inside the DST gap and returns a Date", () => {
    expect(parseHelsinkiLocal("2026-03-29 03:30:00")).toBeInstanceOf(Date);
  });
  it("returns null for null, empty and garbage", () => {
    expect(parseHelsinkiLocal(null)).toBeNull();
    expect(parseHelsinkiLocal("")).toBeNull();
    expect(parseHelsinkiLocal("yesterday")).toBeNull();
    expect(parseHelsinkiLocal("2026-13-40 99:99:99")).toBeNull();
  });
});
