/**
 * Per-order dismissal of validation warnings (fb#2802).
 *
 * A dismissal is a dbo.stepLog row of type VALIDATION_DISMISSED_STEP_LOG_TYPE whose
 * `data2` holds JSON `{ issueId, fingerprint[, reason] }`. It silences ONE issue on ONE
 * keikka while the issue's fingerprint still matches: the fingerprint is the issue's
 * message (so a changed vehicle, concrete or amount brings the warning back) unless the
 * rule sets `dismissKey` (weather: matched on the rule alone, owner ruling 2026-10-23).
 *
 * Orders whose date is more than DISMISS_WINDOW_DAYS in the past show no warnings at all,
 * and the nightly SQL cleanup (cleanup_validationDismissals) purges their dismissal rows
 * with the same number — so a purge can never bring a warning back.
 */

const VALIDATION_DISMISSED_STEP_LOG_TYPE = 34;
const DISMISS_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** @param {{ message: string, dismissKey?: string }} issue */
function getIssueFingerprint(issue) {
  return issue.dismissKey ?? issue.message;
}

/**
 * @param {{ issueId: string, fingerprint: string, reason?: string }} dismissal
 * @returns {string} JSON stored in stepLog.data2; `reason` is audit-only, never matched
 */
function buildDismissalData({ issueId, fingerprint, reason }) {
  return JSON.stringify(reason ? { issueId, fingerprint, reason } : { issueId, fingerprint });
}

/**
 * @param {{ stepLogTypeId?: number, data2?: string|null }} row - a stepLog row
 * @returns {{ issueId: string, fingerprint: string } | null} null for any other type or a
 *   malformed payload (a hand-edited row must not crash the drawer, it just stops matching)
 */
function parseDismissal(row) {
  if (!row || Number(row.stepLogTypeId) !== VALIDATION_DISMISSED_STEP_LOG_TYPE) return null;
  try {
    const parsed = JSON.parse(row.data2);
    if (typeof parsed?.issueId !== "string" || typeof parsed?.fingerprint !== "string") return null;
    return { issueId: parsed.issueId, fingerprint: parsed.fingerprint };
  } catch {
    return null;
  }
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
  isOutsideDismissWindow,
};
