const PERSON_LOG_TYPES = Object.freeze({
  LOGIN: 1,
  SESSION_REFRESH: 8,
  PAGE_VISIT: 7,
  IMPERSONATION_START: 30,
  IMPERSONATION_END: 31,
  IMPERSONATION_EXTEND: 32,
});

const PERSON_LOG_TYPE_NAMES = Object.freeze({
  1: "login",
  8: "session_refresh",
  7: "page_visit",
  30: "impersonation_start",
  31: "impersonation_end",
  32: "impersonation_extend",
});

module.exports = { PERSON_LOG_TYPES, PERSON_LOG_TYPE_NAMES };
