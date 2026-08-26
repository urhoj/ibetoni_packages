const { invalidTokenError } = require("./oauthErrors");
const { jwtVerify, createKeyResolver } = require("./jwksVerifier");

/**
 * Apple Authentication Service for betoni.online platform
 *
 * Verifies Sign in with Apple ID tokens via JWKS at https://appleid.apple.com/auth/keys.
 * Mirrors microsoftAuth.js — Apple is single-tenant, so the issuer is the exact
 * string "https://appleid.apple.com" (not a regex).
 *
 * Notes vs Microsoft:
 * - email_verified and is_private_email arrive as the STRING "true"/"false" per
 *   Apple spec — coerced to boolean in extractUser.
 * - Name (firstName/lastName) is NOT in the ID token — Apple delivers it once,
 *   in the popup response body, on the very first authorization. The controller
 *   reads it from the request body alongside the token.
 *
 * Dependency injection: pass options.jwksClient to supply a stub for tests
 * (vitest 4.x cannot intercept CJS require() of jwks-rsa via vi.mock).
 *
 * @module @ibetoni/auth/oauth/appleAuth
 * @see https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/authenticating_users_with_sign_in_with_apple
 */

const getAppleClientId = async (getEnvVar) => {
  if (getEnvVar) {
    const clientId = await getEnvVar("APPLE_CLIENT_ID");
    if (!clientId) throw new Error("APPLE_CLIENT_ID environment variable is not set");
    return clientId;
  }
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) throw new Error("APPLE_CLIENT_ID environment variable is not set");
  return clientId;
};

class AppleAuth {
  constructor(options = {}) {
    this.logger = options.logger;
    this.getEnvVar = options.getEnvVar;
    // options.jwksClient: optional injected JWKS client — tests stub getSigningKey.
    this.getKey = createKeyResolver("https://appleid.apple.com/auth/keys", options.jwksClient || null);
  }

  async verifyIdToken(token) {
    if (!token) {
      throw invalidTokenError("Apple authentication failed: Token is required for verification");
    }

    // Client-id resolution sits OUTSIDE the try below on purpose: a missing
    // APPLE_CLIENT_ID or a Key Vault outage is a SERVER fault, and tagging it
    // as a bad credential would tell the user their login is invalid while the
    // outage produced no telemetry at all (fb#365).
    const clientId = await getAppleClientId(this.getEnvVar);

    try {
      const decoded = await jwtVerify(token, this.getKey, {
        audience: clientId,
        algorithms: ["RS256"],
        issuer: "https://appleid.apple.com",
        clockTolerance: 60,
        maxAge: "1h",
      });

      this.logger?.info?.("Apple token verified", {
        email: decoded.email,
        sub: decoded.sub,
      });

      return decoded;
    } catch (error) {
      this.logger?.error?.("Apple token verification failed", {
        error: error.message,
        stack: error.stack,
      });
      throw invalidTokenError(`Apple authentication failed: ${error.message}`);
    }
  }

  /**
   * Extract a standardized user object from a decoded Apple ID token.
   * Apple ID tokens do NOT include name claims — those arrive separately in
   * the popup response body on the first sign-in. The controller handles them.
   */
  extractUser(payload) {
    return {
      appleId: payload.sub,
      email: payload.email || null,
      emailVerified: payload.email_verified === "true" || payload.email_verified === true,
      isPrivateEmail: payload.is_private_email === "true" || payload.is_private_email === true,
    };
  }
}

const createAppleAuth = (options = {}) => new AppleAuth(options);

module.exports = { AppleAuth, createAppleAuth };
