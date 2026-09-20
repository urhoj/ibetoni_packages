import { describe, it, expect, vi, afterEach } from "vitest";
import {
  FLEET_PROVIDERS,
  FLEET_PROVIDER_SOURCE_ID,
  DEFAULT_FLEET_PROVIDER,
  normalizeProvider,
  prefixObjectId,
  providerFromObjectId,
  maponUnitToNode,
  maponUnitsFromPayload,
  ecofleetLastDataToNode,
  isEngineOn,
  toNumberOrNull,
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

describe("providerFromObjectId (fb#1587)", () => {
  it("reads the vendor off a prefixed id", () => {
    expect(providerFromObjectId("mapon:4711")).toBe("mapon");
  });

  it("treats a bare id as Ecofleet — the only vendor stored unprefixed", () => {
    expect(providerFromObjectId("42")).toBe("ecofleet");
    expect(providerFromObjectId(42)).toBe("ecofleet");
  });

  it("falls back to Ecofleet for empty and unknown-prefix ids rather than throwing", () => {
    expect(providerFromObjectId(null)).toBe("ecofleet");
    expect(providerFromObjectId(undefined)).toBe("ecofleet");
    expect(providerFromObjectId("")).toBe("ecofleet");
    expect(providerFromObjectId("acme:1")).toBe("ecofleet");
  });

  it("is the exact inverse of prefixObjectId for every provider", () => {
    for (const provider of Object.values(FLEET_PROVIDERS)) {
      expect(providerFromObjectId(prefixObjectId(provider, "12345"))).toBe(provider);
    }
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

  it("reads the live shape — state is an OBJECT {name,start,duration} (Betomik, 2026-09-16)", () => {
    // The docs-only first cut read `state` as a string; the real payload wraps it,
    // so String(object) matched nothing and every truck reported engine-off.
    expect(maponUnitToNode({ ...unit, state: { name: "driving", start: "2026-09-16 14:20:01", duration: 300 } }).enginestate).toBe("1");
    expect(maponUnitToNode({ ...unit, state: { name: "standing", start: "x", duration: 1 } }).enginestate).toBe("0");
    expect(maponUnitToNode({ ...unit, state: { name: "teleporting" } }).enginestate).toBe("0");
    expect(maponUnitToNode({ ...unit, state: {} }).enginestate).toBe("0");
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

describe("FLEET_PROVIDER_SOURCE_ID", () => {
  it("maps every provider to its apiKeySources.apiKeySourceId", () => {
    expect(FLEET_PROVIDER_SOURCE_ID[FLEET_PROVIDERS.ECOFLEET]).toBe(14);
    expect(FLEET_PROVIDER_SOURCE_ID[FLEET_PROVIDERS.MAPON]).toBe(18);
  });
});

describe("toNumberOrNull", () => {
  it("returns a finite number as-is", () => {
    expect(toNumberOrNull(42)).toBe(42);
    expect(toNumberOrNull("3.5")).toBe(3.5);
  });

  it("returns null — never NaN — for absent/unparseable input", () => {
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toNumberOrNull("")).toBeNull();
    expect(toNumberOrNull("not a number")).toBeNull();
  });
});

describe("ecofleetLastDataToNode", () => {
  it("passes every field through getText untouched (no numeric coercion)", () => {
    const node = {
      objectId: { _text: "42" },
      timestamp: { _text: "2026-09-10T05:12:08Z" },
      latitude: { _text: "60.1699" },
      longitude: { _text: "24.9384" },
      speed: { _text: "0" },
      enginestate: { _text: "1" },
      direction: { _text: "180" },
      lastEngineOnTime: { _text: "2026-09-10T05:00:00Z" },
      address: { _text: "Pekanraitti 14" },
      objectName: { _text: "Pumppu 1" },
      plate: { _text: "ABC-123" },
    };
    expect(ecofleetLastDataToNode(node)).toEqual({
      objectId: "42",
      timestamp: "2026-09-10T05:12:08Z",
      latitude: "60.1699",
      longitude: "24.9384",
      speed: "0",
      enginestate: "1",
      direction: "180",
      lastEngineOnTime: "2026-09-10T05:00:00Z",
      address: "Pekanraitti 14",
      objectName: "Pumppu 1",
      plate: "ABC-123",
    });
  });

  it("returns null fields for a node with no text content, without throwing", () => {
    expect(() => ecofleetLastDataToNode({})).not.toThrow();
    expect(ecofleetLastDataToNode({}).objectId).toBeNull();
  });
});

describe("maponUnitsFromPayload", () => {
  const unit = { unit_id: 1, number: "ABC-123", state: "driving", last_update: "2026-09-10T05:12:08Z" };

  afterEach(() => vi.restoreAllMocks());

  it("unwraps the documented data.units envelope", () => {
    const nodes = maponUnitsFromPayload({ data: { units: [unit] } });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].objectId).toBe("mapon:1");
  });

  it("falls back to a bare units envelope", () => {
    const nodes = maponUnitsFromPayload({ units: [unit] });
    expect(nodes).toHaveLength(1);
  });

  it("drops units with no usable id", () => {
    const nodes = maponUnitsFromPayload({ data: { units: [{ ...unit, unit_id: undefined }] } });
    expect(nodes).toHaveLength(0);
  });

  it("returns [] and logs rather than throwing on an unexpected envelope shape", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(maponUnitsFromPayload({ nothingRecognizable: true })).toEqual([]);
    expect(spy).toHaveBeenCalled();
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
