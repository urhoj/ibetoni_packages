const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const jwksClient = require("jwks-rsa");

const jwtVerify = promisify(jwt.verify);

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
    // Optional injected JWKS client — used by tests to stub getSigningKey.
    // In production, leave undefined and we lazy-create a real jwks-rsa client.
    this.jwksClient = options.jwksClient || null;
  }

  getJwksClient() {
    if (!this.jwksClient) {
      this.jwksClient = jwksClient({
        jwksUri: "https://appleid.apple.com/auth/keys",
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 24 * 60 * 60 * 1000,
      });
    }
    return this.jwksClient;
  }

  getKey(header, callback) {
    this.getJwksClient()
      .getSigningKey(header.kid)
      .then((key) => callback(null, key.getPublicKey()))
      .catch((err) => callback(err));
  }

  async verifyIdToken(token) {
    try {
      if (!token) throw new Error("Token is required for verification");

      const clientId = await getAppleClientId(this.getEnvVar);
      const getKeyWrapper = (header, callback) => this.getKey(header, callback);

      const decoded = await jwtVerify(token, getKeyWrapper, {
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
      throw new Error(`Apple authentication failed: ${error.message}`);
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
