/**
 * Sentry Constants — CommonJS
 *
 * Source of truth is `sentry.js` (ESM). Keep both in sync.
 *
 * @module @ibetoni/constants/sentry
 */

const SENTRY_REDACT_FIELDS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "secret",
  "credential",
  "privatekey",
  "private_key",
  "sessionid",
  "session_id",
  "refreshtoken",
  "accesstoken",
  "auth",
];

const SENTRY_REDACTED_PLACEHOLDER = "[REDACTED]";

module.exports = { SENTRY_REDACT_FIELDS, SENTRY_REDACTED_PLACEHOLDER };
