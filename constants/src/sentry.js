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

/**
 * Sentry v11 `dataCollection` baseline equal to v10's `sendDefaultPii: false`.
 *
 * v11 replaced `sendDefaultPii` with per-category `dataCollection` whose
 * defaults collect MORE (user info, cookies, bodies, DB query data, genAI I/O).
 * Leaving it unset silently widens collection, so every app that ran with PII
 * off passes this explicitly. Values are Sentry's own migration-guide baseline.
 */
const SENTRY_IP_HEADER_DENY = ["forwarded", "-ip", "remote-", "via", "-user"];
const SENTRY_RESTRICTIVE_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { deny: SENTRY_IP_HEADER_DENY }, response: { deny: SENTRY_IP_HEADER_DENY } },
  httpBodies: [],
  urlQueryParams: { deny: SENTRY_IP_HEADER_DENY },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  graphQL: { document: false, variables: false },
};

export { SENTRY_REDACT_FIELDS, SENTRY_REDACTED_PLACEHOLDER, SENTRY_RESTRICTIVE_DATA_COLLECTION };
