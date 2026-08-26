/**
 * @ibetoni/constants - CommonJS Entry Point
 *
 * This file provides CommonJS (require) support for Node.js backend.
 * Frontend (Vite) uses ES modules from src/ directory via alias.
 *
 * Note: Constants are duplicated here for CommonJS compatibility.
 * Source of truth is in src/ directory (ES modules).
 */

const { allowedOrigins } = require("./src/domains.cjs");
const { ERROR_CODES } = require("./src/errors.cjs");
const {
  CACHE_TTL,
  DEFAULT_KEIKKA_TTL,
  DEFAULT_TYOMAA_TTL,
  DEFAULT_PERSON_TTL,
  DEFAULT_VEHICLE_TTL,
  DEFAULT_WEATHER_TTL,
} = require("./src/cache.cjs");
const { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION } = require("./src/security.cjs");
const { STEP_LOG_TYPE } = require("./src/steplog.cjs");
const {
  ADMIN_COMPANY_ROLE_TYPE_IDS,
  ASIAKAS_EDITOR_ROLE_TYPE_ID,
  ASIAKAS_WORKING_HOURS_ROLE_TYPE_ID,
  KALLE_URHO_OY_ASIAKAS_ID,
  MAXBE_OY_ASIAKAS_ID,
  ASIAKAS_ANY_ADMIN_ROLE_TYPE_IDS,
  ASIAKAS_ANY_VIEWER_ROLE_TYPE_IDS,
  ASIAKAS_ANY_WORKER_ROLE_TYPE_IDS,
  ASIAKAS_LASKU_READ_ROLE_TYPE_IDS,
  ASIAKAS_REQUEST_OFFER_ROLE_TYPE_IDS,
  COMPANY_ROLE_TO_TYPE_ID,
  PERSON_ANY_ADMIN_SETTING_TYPE_IDS,
  PERSON_SETTING_TYPE_IDS,
  ASIAKAS_SETTING_TYPE_IDS,
  ROLE_NAME_TO_KEY_MAP,
  TYPE_ID_TO_ROLE_NAME,
  ROLE_NAME_BY_TYPEID,
  ROLE_TYPEID_BY_NAME,
  KNOWN_ROLE_TYPEIDS,
  rolesNamesToTypeIds,
  roleTypeIdsToNames,
  buildCompanyRoles,
} = require("./src/roles.cjs");
const { FENNOA_PAYMENT_STATUS, INVOICE_STATUS, INVOICE_STATUS_LABELS_FI } = require("./src/fennoa.cjs");
const { SENTRY_REDACT_FIELDS, SENTRY_REDACTED_PLACEHOLDER } = require("./src/sentry.cjs");
const { BETONIJERRY, BETONIJERRY_CITIES } = require("./src/betonijerry.cjs");
const { PUMINET } = require("./src/puminet.cjs");
const { DASHBOARD_CLOSE_RADIUS_M } = require("./src/geo.cjs");
const { PERSON_LOG_TYPES } = require("./src/personLogTypes.cjs");

module.exports = {
  // Step log type constants
  STEP_LOG_TYPE,

  // PersonLog type constants
  PERSON_LOG_TYPES,

  // Domain constants
  allowedOrigins,

  // Error codes
  ERROR_CODES,

  // Cache TTL values
  CACHE_TTL,
  DEFAULT_KEIKKA_TTL,
  DEFAULT_TYOMAA_TTL,
  DEFAULT_PERSON_TTL,
  DEFAULT_VEHICLE_TTL,
  DEFAULT_WEATHER_TTL,

  // Security constants
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION,

  // Role mapping constants
  COMPANY_ROLE_TO_TYPE_ID,
  ROLE_NAME_TO_KEY_MAP,
  TYPE_ID_TO_ROLE_NAME,
  ROLE_NAME_BY_TYPEID,
  ROLE_TYPEID_BY_NAME,
  KNOWN_ROLE_TYPEIDS,
  rolesNamesToTypeIds,
  roleTypeIdsToNames,
  buildCompanyRoles,
  ADMIN_COMPANY_ROLE_TYPE_IDS,
  ASIAKAS_EDITOR_ROLE_TYPE_ID,
  ASIAKAS_WORKING_HOURS_ROLE_TYPE_ID,
  KALLE_URHO_OY_ASIAKAS_ID,
  MAXBE_OY_ASIAKAS_ID,
  ASIAKAS_ANY_ADMIN_ROLE_TYPE_IDS,
  ASIAKAS_ANY_WORKER_ROLE_TYPE_IDS,
  ASIAKAS_ANY_VIEWER_ROLE_TYPE_IDS,
  ASIAKAS_LASKU_READ_ROLE_TYPE_IDS,
  ASIAKAS_REQUEST_OFFER_ROLE_TYPE_IDS,
  PERSON_ANY_ADMIN_SETTING_TYPE_IDS,
  PERSON_SETTING_TYPE_IDS,
  ASIAKAS_SETTING_TYPE_IDS,

  // Fennoa constants
  FENNOA_PAYMENT_STATUS,
  INVOICE_STATUS,
  INVOICE_STATUS_LABELS_FI,

  // Sentry constants
  SENTRY_REDACT_FIELDS,
  SENTRY_REDACTED_PLACEHOLDER,

  // BetoniJerry umbrella tenant
  BETONIJERRY,
  BETONIJERRY_CITIES,

  // PumiNet Oy (app operator)
  PUMINET,

  // Geo / proximity constants
  DASHBOARD_CLOSE_RADIUS_M,
};
