import { describe, it, expect } from "vitest";
import {
  FLEET_PROVIDERS,
  DEFAULT_FLEET_PROVIDER,
  normalizeProvider,
  prefixObjectId,
  maponUnitToNode,
  isEngineOn,
} from "../fleetProviders.js";

describe("normalizeProvider", () => {
  it("keeps a known provider", () => {
    expect(normalizeProvider("mapon")).toBe("mapon");
    expect(normalizeProvider("ecofleet")).toBe("ecofleet");
  });

  it("is case- and whitespace-insensitive (settings rows are hand-entered)", () => {
    expect(normalizeProvider("  MapOn ")).toBe("mapon");
  });

  it("falls back to Ecofleet for NULL/blank/unknown — a pre-provider row means Ecofleet", () => {
    expect(normalizeProvider(null)).toBe(DEFAULT_FLEET_PROVIDER);
    expect(normalizeProvider(undefined)).toBe(DEFAULT_FLEET_PROVIDER);
    expect(normalizeProvider("")).toBe(DEFAULT_FLEET_PROVIDER);
    expect(normalizeProvider("typo")).toBe(DEFAULT_FLEET_PROVIDER);
    expect(DEFAULT_FLEET_PROVIDER).toBe(FLEET_PROVIDERS.ECOFLEET);
  });
});

describe("prefixObjectId", () => {
  it("leaves Ecofleet ids bare — historical rows are stored unprefixed", () => {
    expect(prefixObjectId("ecofleet", "12345")).toBe("12345");
    expect(prefixObjectId("ecofleet", 12345)).toBe("12345");
  });

  it("namespaces Mapon ids so they cannot collide on UX(objectId, vehicleTimestamp)", () => {
    expect(prefixObjectId("mapon", 12345)).toBe("mapon:12345");
    // The collision this exists to prevent: same native id, different vendor.
    expect(prefixObjectId("mapon", "12345")).not.toBe(prefixObjectId("ecofleet", "12345"));
  });

  it("returns null when there is no id (objectId is NOT NULL — caller must skip the row)", () => {
    expect(prefixObjectId("mapon", null)).toBeNull();
    expect(prefixObjectId("mapon", undefined)).toBeNull();
    expect(prefixObjectId("mapon", "")).toBeNull();
  });

  it("stays inside vehicle_location_snapshots.objectId nvarchar(50)", () => {
    expect(prefixObjectId("mapon", "9".repeat(20)).length).toBeLessThanOrEqual(50);
  });
});

describe("maponUnitToNode", () => {
  const unit = {
    unit_id: 4711,
    number: "ABC-123",
    label: "Pumppu 1",
    lat: 60.1699,
    lng: 24.9384,
    speed: 42,
    direction: 180,
    state: "driving",
    last_update: "2026-09-10T05:12:08Z",
  };

  it("maps a driving unit onto the canonical Ecofleet-shaped node", () => {
    expect(maponUnitToNode(unit)).toEqual({
      objectId: "mapon:4711",
      objectName: "Pumppu 1",
      plate: "ABC-123",
      latitude: 60.1699,
      longitude: 24.9384,
      speed: 42,
      direction: 180,
      enginestate: "1",
      lastEngineOnTime: null,
      address: null,
      timestamp: "2026-09-10T05:12:08Z",
    });
  });

  it('emits the "1"/"0" literal, never Mapon\'s own state word (fb#1065 class)', () => {
    // A boolean or a passthrough "driving" here silently kills the cron's
    // engine-aware cadence AND the /kentta staleness split.
    expect(maponUnitToNode({ ...unit, state: "driving" }).enginestate).toBe("1");
    for (const state of ["standing", "nodata", "nogps", "service"]) {
      expect(maponUnitToNode({ ...unit, state }).enginestate).toBe("0");
    }
  });

  it("fails closed to engine-off on an unknown or missing state", () => {
    expect(maponUnitToNode({ ...unit, state: "teleporting" }).enginestate).toBe("0");
    expect(maponUnitToNode({ ...unit, state: undefined }).enginestate).toBe("0");
  });

  it("is case-insensitive on state", () => {
    expect(maponUnitToNode({ ...unit, state: "Driving" }).enginestate).toBe("1");
  });

  it("falls back to the plate when a unit has no label", () => {
    expect(maponUnitToNode({ ...unit, label: undefined }).objectName).toBe("ABC-123");
  });

  it("returns null — never NaN — for absent or unparseable numerics", () => {
    const node = maponUnitToNode({ unit_id: 1, state: "standing", lat: "", lng: null, speed: "x" });
    expect(node.latitude).toBeNull();
    expect(node.longitude).toBeNull();
    expect(node.speed).toBeNull();
    expect(node.direction).toBeNull();
    // NaN would reach a Decimal bind and be stored as NULL-or-error depending on driver.
    expect(Object.values(node).some((v) => typeof v === "number" && Number.isNaN(v))).toBe(false);
  });

  it("coerces numeric strings (Mapon returns some numbers as strings)", () => {
    const node = maponUnitToNode({ ...unit, lat: "60.1699", speed: "0" });
    expect(node.latitude).toBe(60.1699);
    expect(node.speed).toBe(0);
  });

  it("leaves address and lastEngineOnTime null — no documented Mapon equivalent", () => {
    const node = maponUnitToNode(unit);
    expect(node.address).toBeNull();
    expect(node.lastEngineOnTime).toBeNull();
  });

  it("survives a garbage/empty unit without throwing", () => {
    expect(() => maponUnitToNode({})).not.toThrow();
    expect(maponUnitToNode({}).objectId).toBeNull();
  });
});

describe("isEngineOn", () => {
  it('accepts only the "1" literal', () => {
    expect(isEngineOn({ enginestate: "1" })).toBe(true);
    expect(isEngineOn({ enginestate: " 1 " })).toBe(true);
    expect(isEngineOn({ enginestate: "0" })).toBe(false);
    expect(isEngineOn({ enginestate: "on" })).toBe(false); // the fb#1065 bug, pinned
    expect(isEngineOn({})).toBe(false);
    expect(isEngineOn(null)).toBe(false);
  });

  it("agrees with the Mapon mapping end to end", () => {
    expect(isEngineOn(maponUnitToNode({ unit_id: 1, state: "driving" }))).toBe(true);
    expect(isEngineOn(maponUnitToNode({ unit_id: 1, state: "standing" }))).toBe(false);
  });
});
