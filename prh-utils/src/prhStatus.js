/**
 * PRH business-registry status classification (shared).
 *
 * Single source of truth for mapping PRH v3 open data (avoindata.prh.fi) →
 * {ok,dead,caution,unknown}. Consumed by BOTH the nightly dead-customer sweep
 * (puminet7-functions-app prhSweep) and the on-demand "PRH-tarkistus" button
 * check (puminet5api asiakas prh-check route), so the two can never diverge.
 *
 * PRH records "dead" in TWO places, both needed:
 *  1. companySituations[].type — an ACTIVE proceeding. Codes are short uppercase
 *     abbreviations; KONK = konkurssi is verified live (Savcor Technologies Oy,
 *     Ahtium Oyj). During the proceeding the trade register still reads "Rekisterissä".
 *  2. registeredEntries — once a company has CEASED, companySituations empties and the
 *     CURRENT (endDate=null) trade-register entry (register "1") flips from
 *     "Rekisterissä" (type "1") to "Lakannut" (type "4"). Verified: Cafe Mido Oy /
 *     Botnia Weld Oy / Puijosompa Oy.
 *
 * Top-level `status` is "2" for healthy AND dead companies — never use it here.
 */
const PRH_STATUS = Object.freeze({
  OK: "ok",
  DEAD: "dead",
  CAUTION: "caution",
  UNKNOWN: "unknown",
  NO_YTUNNUS: "no-ytunnus",
});

// companySituations[].type — PRH short uppercase codes. KONK verified live; the rest
// mapped by prefix. Any unrecognised special-situation code fails safe to CAUTION.
const SITUATION_DEAD_LABEL = { KONK: "konkurssi", SELV: "selvitystila", PURK: "purettu", LAKK: "lakannut", SULA: "sulautunut" };
const SITUATION_DEAD_PREFIXES = ["KONK", "SELV", "PURK", "LAKK", "SULA", "JAKA", "LOPE"];
const SITUATION_CAUTION_PREFIXES = ["SANE", "YSAN", "YRSA"]; // yrityssaneeraus

// register "1" = kaupparekisteri (trade register); match the Finnish description of
// its CURRENT (endDate=null) entry.
const REG_ACTIVE_RE = /rekisteriss/;                                        // "Rekisterissä"
const REG_DEAD_RE = /(lakann|purett|poistett|konkurss|selvitys|sulautun|jakautun|lopett)/;
const REG_CAUTION_RE = /saneeraus/;

function finnishDescription(entry) {
  const ds = Array.isArray(entry?.descriptions) ? entry.descriptions : [];
  const fi = ds.find((x) => String(x?.languageCode) === "1");
  return String((fi || ds[0])?.description || "").trim();
}

function truncateSituation(s) {
  const v = String(s || "").trim();
  return v.length > 64 ? v.slice(0, 64) : v;
}

/**
 * @param {{ companySituations?: Array<{type?:string}>, registeredEntries?: Array<object> }} company
 * @returns {{ status: string, situation: string|null }}
 */
function classifyPrhStatus(company) {
  const situations = Array.isArray(company?.companySituations) ? company.companySituations : [];
  const entries = Array.isArray(company?.registeredEntries) ? company.registeredEntries : [];

  let dead = null;
  let caution = null;
  let activeSeen = false;

  // 1) Active special proceedings.
  for (const s of situations) {
    const code = String(s?.type || "").trim().toUpperCase();
    if (!code) continue;
    if (SITUATION_DEAD_LABEL[code]) { dead = dead || SITUATION_DEAD_LABEL[code]; continue; }
    if (SITUATION_DEAD_PREFIXES.some((p) => code.startsWith(p))) { dead = dead || code.toLowerCase(); continue; }
    if (SITUATION_CAUTION_PREFIXES.some((p) => code.startsWith(p))) { caution = caution || "yrityssaneeraus"; continue; }
    caution = caution || code.toLowerCase(); // unknown special situation -> fail-safe caution
  }

  // 2) Trade-register (register "1") CURRENT entry.
  for (const e of entries) {
    if (String(e?.register) !== "1") continue;
    if (e?.endDate != null) continue;
    const desc = finnishDescription(e).toLowerCase();
    if (!desc) continue;
    if (REG_ACTIVE_RE.test(desc)) { activeSeen = true; continue; }
    if (REG_DEAD_RE.test(desc)) { dead = dead || desc; continue; }
    if (REG_CAUTION_RE.test(desc)) { caution = caution || desc; continue; }
    caution = caution || desc; // non-active, unrecognised trade-register state -> fail-safe caution
  }

  if (dead) return { status: PRH_STATUS.DEAD, situation: truncateSituation(dead) };
  if (caution) return { status: PRH_STATUS.CAUTION, situation: truncateSituation(caution) };
  if (activeSeen) return { status: PRH_STATUS.OK, situation: null };
  return { status: PRH_STATUS.UNKNOWN, situation: null };
}

const PRH_API_BASE = "https://avoindata.prh.fi/opendata-ytj-api/v3";

/**
 * Minimal single-company fetch by business ID. Returns null on 404/not-found; throws
 * on network/other errors so the caller classifies the row as `unknown`. Returns
 * registeredEntries (needed for the ceased/"Lakannut" signal) alongside companySituations.
 */
async function fetchPrhCompany(businessId, { fetchImpl = fetch } = {}) {
  const url = `${PRH_API_BASE}/companies?businessId=${encodeURIComponent(businessId)}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PRH API ${res.status} ${res.statusText}`);
  const data = await res.json();
  const raw = Array.isArray(data?.companies) ? data.companies[0] : null;
  if (!raw) return null;
  return {
    businessId,
    status: raw.status,
    companySituations: raw.companySituations || [],
    registeredEntries: raw.registeredEntries || [],
  };
}

module.exports = { PRH_STATUS, classifyPrhStatus, fetchPrhCompany };
