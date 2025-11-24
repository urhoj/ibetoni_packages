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
const { HTTP_STATUS } = require("./src/http.cjs");
const { ERROR_CODES } = require("./src/errors.cjs");
const {
  CACHE_TTL,
  DEFAULT_KEIKKA_TTL,
  DEFAULT_TYOMAA_TTL,
  DEFAULT_PERSON_TTL,
  DEFAULT_VEHICLE_TTL,
  DEFAULT_WEATHER_TTL,
} = require("./src/cache.cjs");
const {
  SECURITY,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION,
  RATE_LIMIT_WINDOW,
  MAX_REQUESTS_PER_WINDOW,
} = require("./src/security.cjs");

module.exports = {
  // Domain constants
  allowedOrigins,

  // HTTP status codes
  HTTP_STATUS,

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
  SECURITY,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION,
  RATE_LIMIT_WINDOW,
  MAX_REQUESTS_PER_WINDOW,
};
