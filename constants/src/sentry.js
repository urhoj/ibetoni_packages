/**
 * Sentry Constants
 *
 * Shared configuration for Sentry error reporting across frontend, backend,
 * and functions-app. Keeps PII redaction behavior consistent in all three.
 *
 * @module @ibetoni/constants/sentry
 */

/**
 * Field names whose values must be scrubbed from Sentry events before send.
 *
 * Matching is case-insensitive and substring-based — e.g. `refreshToken`,
 * `accessToken`, and `id_token` all match because they contain `token`.
 *
 * Apply in `beforeSend` when walking `event.request.data`, `event.extra`,
 * `event.contexts`, and any captured form/body payloads.
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

export { SENTRY_REDACT_FIELDS, SENTRY_REDACTED_PLACEHOLDER };
