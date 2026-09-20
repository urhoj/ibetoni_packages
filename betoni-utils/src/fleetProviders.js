/**
 * Fleet-tracking provider normalization — the ONE copy of the field semantics.
 *
 * betoni.online reads GPS from a per-tenant fleet-tracking vendor. Historically
 * that was always Ecofleet, so its wire shape leaked everywhere: the XML field
 * names, and above all the `enginestate` literal "1"/"0", are read by ~70 call
 * sites across puminet4, puminet5api and puminet7-functions-app, and are stored
 * verbatim in vehicle_location_snapshots.
 *
 * Rather than teach all of those about a second vendor, every provider is
 * normalized HERE to the Ecofleet-shaped node. Downstream code — the snapshot
 * cron, the live map layer, /kentta, /tilanne, dayBoard, kenttaBoard — is
 * provider-blind by construction.
 *
 * This module is deliberately PURE (no axios, no db): puminet5api and
 * puminet7-functions-app each own their own HTTP call, but neither owns a
 * second copy of the field mapping. The previous duplication of the fetch loop
 * across those two repos is exactly what carries the "keep both in sync"
 * warnings in ecofleetRecalc.js and jobExecutors.js.
 *
 * @module @ibetoni/betoni-utils/fleetProviders
 */
const { getText } = require("./ecofleetUtils.js");

/** Provider tokens as stored in asiakasSettings.asiakasSettingString (type 15). */
const FLEET_PROVIDERS = {
  ECOFLEET: "ecofleet",
  MAPON: "mapon",
};

/** apiKeySources.apiKeySourceId per provider — the other hardcoded copies of
 * these ids (maponApi.js, ecoFleetApi.js, the cron's PROVIDER_CONFIG) should
 * read from here instead of repeating the literal. The historical migration
 * that first inserted these apiKeySources rows is NOT updated to use this —
 * migrations are frozen once applied. */
const FLEET_PROVIDER_SOURCE_ID = {
  [FLEET_PROVIDERS.ECOFLEET]: 14,
  [FLEET_PROVIDERS.MAPON]: 18,
};

/**
 * Provider used when a tenant has the GPS module on but no explicit provider.
 * Ecofleet predates the provider column, so every pre-existing row means Ecofleet.
 */
const DEFAULT_FLEET_PROVIDER = FLEET_PROVIDERS.ECOFLEET;

/**
 * Normalize whatever is stored in asiakasSettingString into a known provider.
 * Unknown/blank/NULL falls back to Ecofleet — a tenant is never locked out of
 * GPS because of a typo in a settings row.
 * @param {string|null|undefined} raw
 * @returns {"ecofleet"|"mapon"}
 */
function normalizeProvider(raw) {
  const token = String(raw ?? "").trim().toLowerCase();
  return Object.values(FLEET_PROVIDERS).includes(token) ? token : DEFAULT_FLEET_PROVIDER;
}

/**
 * Mapon `state` → Ecofleet's `enginestate` literal.
 *
 * ⚠ Ecofleet reports "1"/"0" and NOTHING else (verified against the live API and
 * all 5044 stored snapshot rows, fb#1065 — an inline `=== "on"` check there was
 * dead for months and pinned the whole cron to its idle cadence). Any Mapon
 * mapping MUST therefore land on those exact two strings; returning "driving"
 * or a boolean silently disables engine-aware cadence AND the /kentta staleness
 * split.
 *
 * Only "driving" counts as engine-on. "standing" is a live tracker reporting a
 * stationary vehicle; "nodata"/"nogps"/"service" are absence of signal, which is
 * not evidence of a running engine.
 *
 * Verified against Betomik's live key on 2026-09-16: `state` is an OBJECT,
 * `{name, start, duration}` — NOT the bare string the first cut read. That
 * `String(object)` never matched, so every Mapon unit reported "0" (a truck at
 * 10 km/h showed engine-off). Read `state.name`; unknown values fail closed to "0".
 */
const MAPON_STATE_TO_ENGINESTATE = {
  driving: "1",
  standing: "0",
  nodata: "0",
  nogps: "0",
  service: "0",
};

/**
 * Prefix a provider's native object id so ids from different vendors can never
 * collide in vehicle_location_snapshots.
 *
 * The table's uniqueness guard UX_vehicle_location_snapshots_object_vehicleTimestamp
 * is unique on (objectId, vehicleTimestamp) with NO tenant and NO provider column,
 * and the cron's INSERT is guarded by `WHERE NOT EXISTS` on that same pair. So a
 * Mapon unit_id numerically equal to an Ecofleet objectId at the same second would
 * be SILENTLY DROPPED as "already seen" rather than erroring. Prefixing sidesteps
 * that with no schema change.
 *
 * Ecofleet ids stay bare — they are already in the table unprefixed, and
 * rewriting 5k+ historical rows to gain symmetry would break every stored id.
 *
 * @param {string} provider
 * @param {string|number|null|undefined} nativeId
 * @returns {string|null} prefixed id, or null when there is no id to prefix
 */
function prefixObjectId(provider, nativeId) {
  if (nativeId === null || nativeId === undefined || nativeId === "") return null;
  const id = String(nativeId);
  return provider === FLEET_PROVIDERS.ECOFLEET ? id : `${provider}:${id}`;
}

/**
 * Inverse of prefixObjectId: which vendor WROTE a stored objectId (fb#1587).
 *
 * A bare id is Ecofleet BY CONSTRUCTION (prefixObjectId leaves only Ecofleet ids
 * bare), so this never needs the tenant's current provider — and must not use
 * it: history has to route to the vendor that produced it, or a vendor switch
 * sends every pre-switch id to the wrong API. An unknown prefix falls back to
 * Ecofleet the same way normalizeProvider does.
 *
 * @param {string|number|null|undefined} objectId - stored objectId
 * @returns {"ecofleet"|"mapon"}
 */
function providerFromObjectId(objectId) {
  return normalizeProvider(/^([a-z]+):/.exec(String(objectId ?? ""))?.[1]);
}

/** Number, or null for absent/unparseable — never NaN (NaN poisons SQL binds). */
function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Trimmed string, or null for absent/blank. */
function str(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/**
 * Map one Mapon `unit/list.json` entry onto the canonical (Ecofleet-shaped) node.
 *
 * The returned keys are exactly what every consumer already reads — the cron's
 * INSERT, puminet4's createVehicleMarker, karttaDerive, the /kentta feed. Adding
 * or renaming a key here means auditing those; that is the point of the shape.
 *
 * Fields with NO documented Mapon equivalent come back null. Both are nullable
 * columns, so the row still lands and every snapshot-based read still works:
 *  - `address`   — Ecofleet reverse-geocodes server-side; Mapon does not appear
 *                  to on unit/list. Callers may backfill via the geocode module.
 *  - `lastEngineOnTime` — Mapon exposes `ignition_total_time` (a DURATION), not
 *                  the timestamp of the last ignition-on. Not derivable here.
 * ⚠ Both are docs-derived, not confirmed against a live key (2026-09-10).
 *
 * @param {object} unit - one entry from Mapon `unit/list.json` `data.units[]`
 * @returns {{objectId: string|null, objectName: string|null, plate: string|null,
 *   latitude: number|null, longitude: number|null, speed: number|null,
 *   direction: number|null, enginestate: string, lastEngineOnTime: null,
 *   address: string|null, timestamp: string|null}}
 */
function maponUnitToNode(unit) {
  const state = String(unit?.state?.name ?? unit?.state ?? "").trim().toLowerCase();
  return {
    objectId: prefixObjectId(FLEET_PROVIDERS.MAPON, unit?.unit_id),
    // `label` is the human name in Mapon; `number` is the plate. Ecofleet's
    // objectName is the human name, so label wins and falls back to the plate.
    objectName: str(unit?.label) ?? str(unit?.number),
    plate: str(unit?.number),
    latitude: num(unit?.lat),
    longitude: num(unit?.lng),
    speed: num(unit?.speed),
    direction: num(unit?.direction),
    enginestate: MAPON_STATE_TO_ENGINESTATE[state] ?? "0",
    lastEngineOnTime: null,
    address: str(unit?.address),
    // Mapon documents last_update as UTC ISO 8601 — the same thing Ecofleet's
    // `timestamp` carries and what gets stamped into vehicleTimestamp.
    timestamp: str(unit?.last_update),
  };
}

/**
 * Ecofleet's `enginestate` literal for a node that is ALREADY normalized.
 * Kept next to the mapping so the "1"/"0" contract has one definition.
 * @param {{enginestate?: string}} node
 * @returns {boolean}
 */
const isEngineOn = (node) => String(node?.enginestate ?? "").trim() === "1";

/**
 * Map one Ecofleet `getLastData` XML node onto the canonical shape. This is the
 * ORIGINAL vendor shape (all other providers normalize onto it), so every
 * field is a straight `getText` passthrough — no coercion here, matching how
 * both call sites already used it. Numeric coercion happens at the SQL bind,
 * same as before this function existed.
 * @param {object} node - one getLastData XML node (xml-js compact-mode)
 * @returns {{objectId: string|null, objectName: string|null, plate: string|null,
 *   timestamp: string|null, latitude: string|null, longitude: string|null,
 *   speed: string|null, enginestate: string|null, direction: string|null,
 *   lastEngineOnTime: string|null, address: string|null}}
 */
function ecofleetLastDataToNode(node) {
  return {
    objectId: getText(node.objectId),
    timestamp: getText(node.timestamp),
    latitude: getText(node.latitude),
    longitude: getText(node.longitude),
    speed: getText(node.speed),
    enginestate: getText(node.enginestate),
    direction: getText(node.direction),
    lastEngineOnTime: getText(node.lastEngineOnTime),
    address: getText(node.address),
    objectName: getText(node.objectName),
    plate: getText(node.plate),
  };
}

/**
 * Unwrap a Mapon `unit/list.json` response into canonical nodes, dropping units
 * with no usable id (objectId is NOT NULL on vehicle_location_snapshots).
 * ⚠ UNVERIFIED envelope (docs describe `data.units`); the fallbacks cover the
 * shapes a JSON fleet API plausibly returns rather than throwing on a wrapper
 * mismatch, which would look like "tenant has no vehicles".
 * @param {unknown} responseData - the raw `response.data` from axios
 * @param {number} [ownerAsiakasId] - only used for the console.error context on a shape miss
 * @returns {Array<object>}
 */
function maponUnitsFromPayload(responseData, ownerAsiakasId) {
  const units = responseData?.data?.units ?? responseData?.units ?? [];
  if (!Array.isArray(units)) {
    console.error("Unexpected Mapon unit/list payload shape", { asiakasId: ownerAsiakasId });
    return [];
  }
  if (units.length === 0) {
    console.error("Could not extract any vehicle data from Mapon response", { asiakasId: ownerAsiakasId });
  }
  return units.map(maponUnitToNode).filter((node) => node.objectId !== null);
}

module.exports = {
  FLEET_PROVIDERS,
  FLEET_PROVIDER_SOURCE_ID,
  DEFAULT_FLEET_PROVIDER,
  MAPON_STATE_TO_ENGINESTATE,
  normalizeProvider,
  prefixObjectId,
  providerFromObjectId,
  maponUnitToNode,
  maponUnitsFromPayload,
  ecofleetLastDataToNode,
  isEngineOn,
  toNumberOrNull: num,
};
