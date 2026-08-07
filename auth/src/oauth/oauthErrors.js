/**
 * Shared discriminator for OAuth verification failures.
 *
 * Every provider wrapper here signals failure by THROWING, which loses the one
 * distinction the caller needs: was the CREDENTIAL bad, or did WE fail?
 *
 * - bad credential (expired / forged / malformed token, wrong audience) is a
 *   CLIENT error → 401, no Sentry report, ordinary and constant.
 * - missing client id, Key Vault outage, JWKS fetch failure is a SERVER fault
 *   → 500 AND a Sentry report. Reporting one of these as "your login is
 *   invalid" tells the user the wrong thing and hides the outage entirely.
 *
 * Collapsing the two cost real incidents in both directions: fb#361 (every
 * expired Google token logged as a 500, burying real faults on the busiest
 * auth path) and fb#365 (the Apple/LinkedIn adapters answering 401 to a
 * config outage that then appeared nowhere in telemetry).
 *
 * Branch on the CODE, never on the message — the message text is the upstream
 * library's and moves between versions.
 *
 * @module @ibetoni/auth/oauth/oauthErrors
 */

const INVALID_OAUTH_TOKEN = "INVALID_OAUTH_TOKEN";

/** Build an Error tagged as an unverifiable-credential (401) failure. */
const invalidTokenError = (message) => {
  const error = new Error(message);
  error.code = INVALID_OAUTH_TOKEN;
  return error;
};

/** True when `error` says the caller's token was bad, rather than that we broke. */
const isInvalidTokenError = (error) => error?.code === INVALID_OAUTH_TOKEN;

module.exports = { INVALID_OAUTH_TOKEN, invalidTokenError, isInvalidTokenError };
