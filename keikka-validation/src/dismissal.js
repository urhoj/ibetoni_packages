/**
 * Per-order dismissal of validation warnings (fb#2802).
 *
 * A dismissal is a dbo.stepLog row of type VALIDATION_DISMISSED_STEP_LOG_TYPE whose
 * `data2` holds JSON `{ issueId, fingerprint[, reason] }`. It silences ONE issue on ONE
 * keikka while the issue's fingerprint still matches: the fingerprint is the issue's
 * message (so a changed vehicle, concrete or amount brings the warning back) unless the
 * rule sets `dismissKey` (weather: matched on the rule alone, owner ruling 2026-10-23).
 * It also records the order's `vehicleId`: moving the order to another vehicle brings
 * every warning back except weather (fb#2820). Rows written before that carry no
 * vehicleId and match any vehicle.
 *
 * Orders whose date is more than DISMISS_WINDOW_DAYS in the past show no warnings at all,
 * and the nightly SQL cleanup (cleanup_validationDismissals) purges their dismissal rows
 * with the same number — so a purge can never bring a warning back.
 */

const VALIDATION_DISMISSED_STEP_LOG_TYPE = 34;
const DISMISS_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Weather depends on the day, not the truck: these stay dismissed across a vehicle change. */
const VEHICLE_INDEPENDENT_ISSUE_IDS = new Set(["SEVERE_COLD_WARNING", "SEVERE_HOT_WARNING"]);

/** @param {{ message: string, dismissKey?: string }} issue */
function getIssueFingerprint(issue) {
  return issue.dismissKey ?? issue.message;
}

/**
 * @param {{ issueId: string, fingerprint: string, vehicleId?: number|null, reason?: string }} dismissal
 * @returns {string} JSON stored in stepLog.data2; `reason` is audit-only, never matched
 */
function buildDismissalData({ issueId, fingerprint, vehicleId, reason }) {
  return JSON.stringify({
    issueId,
    fingerprint,
    ...(vehicleId != null && { vehicleId: Number(vehicleId) }),
    ...(reason && { reason }),
  });
}

/**
 * @param {{ stepLogTypeId?: number, data2?: string|null }} row - a stepLog row
 * @returns {{ issueId: string, fingerprint: string, vehicleId: number|null } | null} null for
 *   any other type or a malformed payload (a hand-edited row must not crash the drawer, it
 *   just stops matching)
 */
function parseDismissal(row) {
  if (!row || Number(row.stepLogTypeId) !== VALIDATION_DISMISSED_STEP_LOG_TYPE) return null;
  try {
    const parsed = JSON.parse(row.data2);
    if (typeof parsed?.issueId !== "string" || typeof parsed?.fingerprint !== "string") return null;
    const vehicleId = parsed.vehicleId == null ? null : Number(parsed.vehicleId);
    return { issueId: parsed.issueId, fingerprint: parsed.fingerprint, vehicleId };
  } catch {
    return null;
  }
}

/**
 * True when a parsed dismissal still applies on the order's current vehicle (fb#2820).
 * Two exceptions match any vehicle: weather (VEHICLE_INDEPENDENT_ISSUE_IDS) and rows
 * written before fb#2820, which carry no vehicleId. The backend reads dbo.keikka.vehicleId
 * (NOT NULL, 0 = no vehicle), so a row written for an existing order always carries one.
 *
 * @param {{ issueId: string, vehicleId: number|null }} parsed - from parseDismissal
 * @param {number|null|undefined} vehicleId - the order's current vehicle
 */
function isDismissalForVehicle(parsed, vehicleId) {
  if (parsed.vehicleId == null || VEHICLE_INDEPENDENT_ISSUE_IDS.has(parsed.issueId)) return true;
  return parsed.vehicleId === (vehicleId == null ? null : Number(vehicleId));
}

/**
 * True when the order's date falls before the (UTC) start of the day DISMISS_WINDOW_DAYS
 * ago. The date is `pumppuAika` (backend rows) or `timeStart` (grid keikka); an order
 * with neither is treated as inside the window.
 *
 * @param {{ pumppuAika?: string|Date, timeStart?: string|Date }} keikka
 * @param {Date} [now]
 */
function isOutsideDismissWindow(keikka, now = new Date()) {
  const raw = keikka?.pumppuAika ?? keikka?.timeStart;
  if (!raw) return false;
  const date = new Date(raw).getTime();
  if (Number.isNaN(date)) return false;
  const cutoff = new Date(now.getTime() - DISMISS_WINDOW_DAYS * DAY_MS);
  cutoff.setUTCHours(0, 0, 0, 0);
  return date < cutoff.getTime();
}

module.exports = {
  VALIDATION_DISMISSED_STEP_LOG_TYPE,
  DISMISS_WINDOW_DAYS,
  getIssueFingerprint,
  buildDismissalData,
  parseDismissal,
  isDismissalForVehicle,
  isOutsideDismissWindow,
};
