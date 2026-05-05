/**
 * personLog.personLogTypeId values. Single source of truth shared by BE/FE.
 * Type 7 = page visit (legacy, defined here for reference).
 * Types 30/31/32 = impersonation session events (added 2026-05-05).
 */
export const PERSON_LOG_TYPES = Object.freeze({
  PAGE_VISIT: 7,
  IMPERSONATION_START: 30,
  IMPERSONATION_END: 31,
  IMPERSONATION_EXTEND: 32,
});

export const PERSON_LOG_TYPE_NAMES = Object.freeze({
  7: "page_visit",
  30: "impersonation_start",
  31: "impersonation_end",
  32: "impersonation_extend",
});
