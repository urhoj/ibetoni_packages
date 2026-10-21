/**
 * Driver-day fingerprint — ONE implementation for the grid (FE, ESM) and the backend (CJS twin
 * driverDay.cjs; keep them identical). It answers "has the day driver seen the CURRENT schedule
 * of his truck?": the driver's /oma list and the day-message sender fingerprint what he was
 * shown, the grid fingerprints the truck's jobs from its live state, and a match means unchanged.
 * Only driver-relevant fields count — truck, start minute, worksite, cancelled (tila 8) — so a
 * comment or m³ edit keeps the match. Only the statuses the grid shows count
 * (DRIVER_DAY_TILA_IDS): a deleted (10) or failed (6, 7) job is out on both sides, so a failed
 * job revived later is a new job the driver has not seen. The fingerprint records WHAT he saw,
 * never WHEN things changed, so stale data can only hide a match, never fake one.
 * The calendar day is the HELSINKI day on both sides (the backend runs in UTC, a device may not
 * be in Helsinki), so a 22:30Z start belongs to the next day everywhere.
 */

const PERUTTU = 8;

/**
 * Keikka statuses shown in the grid (and so counted in the fingerprint). Always visible:
 * luonnos (0), cancelled (8). Excluded: 6, 7, 11, 200. Deleted (10) is the grid_showDeleted setting.
 */
export const DRIVER_DAY_TILA_IDS = new Set([-1, 0, 1, 2, 3, 4, 5, 8, 9, 12, 13, 100, -100]);

const HELSINKI_DAY = new Intl.DateTimeFormat("fi-FI", {
  timeZone: "Europe/Helsinki",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

// A zone-less ISO datetime ("2026-10-21T04:00:00") is read as UTC, like the grid's parseJSONDate.
const ZONELESS_ISO = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(typeof value === "string" && ZONELESS_ISO.test(value) ? `${value.replace(" ", "T")}Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Helsinki calendar day of an instant.
 * @param {Date|string} date - a Date or an ISO string (with Z)
 * @returns {number|null} yyyymmdd, or null when unparseable
 */
export function helsinkiYyyymmdd(date) {
  const d = toDate(date);
  if (!d) return null;
  const parts = Object.fromEntries(HELSINKI_DAY.formatToParts(d).map((p) => [p.type, p.value]));
  return Number(parts.year) * 10000 + Number(parts.month) * 100 + Number(parts.day);
}

/**
 * A job's start instant. pumppuAika first: a socket update refreshes it but not the
 * client-derived timeStart.
 * @returns {Date|null}
 */
export const driverDayStart = (k) => toDate(k.pumppuAika ?? k.timeStart);

/** Does this job count in the fingerprint (a status the grid shows)? */
export const driverDayCounts = (k) => DRIVER_DAY_TILA_IDS.has(k.keikkaTilaId);

/** FNV-1a 32-bit → 8 hex chars. */
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Fingerprint of the jobs on one vehicle on one (Helsinki) day.
 * @param {Array<Object>} keikat - keikka rows (grid `keikat` or upcomingForDriver rows; duplicate
 *   keikkaIds — one row per betoni line — count once)
 * @param {{pvm: number, vehicleId: number}} day - pvm is the Helsinki day, yyyymmdd
 * @returns {string|null} 8 hex chars, or null when no counted job starts on that day
 */
export function driverDaySignature(keikat, { pvm, vehicleId }) {
  const byId = new Map();
  for (const k of keikat || []) {
    if (k?.vehicleId !== vehicleId || !driverDayCounts(k)) continue; // cheap checks before the date parse
    const start = driverDayStart(k);
    if (!start || helsinkiYyyymmdd(start) !== pvm) continue;
    const minute = Math.floor(start.getTime() / 60000);
    byId.set(k.keikkaId, `${k.keikkaId}:${vehicleId}:${minute}:${k.tyomaaId || 0}:${k.keikkaTilaId === PERUTTU ? 1 : 0}`);
  }
  if (!byId.size) return null;
  const parts = [...byId.entries()].sort(([a], [b]) => a - b).map(([, part]) => part);
  return fnv1a(parts.join(";"));
}
