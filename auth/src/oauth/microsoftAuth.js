const { invalidTokenError } = require("./oauthErrors");
const { jwtVerify, createKeyResolver } = require("./jwksVerifier");

/**
 * Microsoft Authentication Service for betoni.online platform
 *
 * Provides secure Microsoft Azure AD authentication with comprehensive security validations:
 * - Multi-tenant issuer validation
 * - Token expiration with clock skew tolerance
 * - Nonce validation for replay attack prevention
 * - MFA (Multi-Factor Authentication) claim support
 * - Audit logging for security monitoring
 *
 * Uses MSAL (Microsoft Authentication Library) on frontend and jwks-rsa for backend verification.
 *
 * Security Features:
 * - RSA256 signature validation using Microsoft's public keys (JWKS)
 * - Issuer validation (Azure AD multi-tenant pattern)
 * - Clock skew tolerance (60 seconds)
 * - Maximum token age validation (1 hour)
 * - Comprehensive security logging
 *
 * @module @ibetoni/auth/oauth/microsoftAuth
 * @see https://learn.microsoft.com/en-us/entra/identity-platform/v2-overview
 */

/**
 * Get Microsoft Client ID from environment
 * Supports both sync and async retrieval
 * @param {function} getEnvVar - Optional async function to get env var
 * @returns {Promise<string>|string} Microsoft Client ID (audience)
 */
const getMicrosoftClientId = async (getEnvVar) => {
  const clientId = getEnvVar ? await getEnvVar("MICROSOFT_CLIENT_ID") : process.env.MICROSOFT_CLIENT_ID;
  // Must throw when unset: jwt.verify SKIPS the audience check entirely when
  // `audience` is undefined, so returning undefined here would verify tokens
  // minted for any other application.
  if (!clientId) throw new Error("MICROSOFT_CLIENT_ID environment variable is not set");
  return clientId;
};

class MicrosoftAuth {
  /**
   * @param {object} options - Configuration options
   * @param {object} options.logger - Optional logger instance
   * @param {function} options.getEnvVar - Optional async function to get environment variables
   * @param {object} options.jwksClient - Optional injected JWKS client — tests stub getSigningKey
   */
  constructor(options = {}) {
    this.logger = options.logger;
    this.getEnvVar = options.getEnvVar;
    this.getKey = createKeyResolver(
      "https://login.microsoftonline.com/common/discovery/v2.0/keys",
      options.jwksClient || null,
    );
  }

  /**
   * Verify a Microsoft ID token with comprehensive security validations
   *
   * @param {string} token - Microsoft ID token from frontend (OIDC ID token)
   * @returns {Promise<object>} Verified token payload
   * @throws {Error} Tagged `code === INVALID_OAUTH_TOKEN` when the token itself is
   *   bad (caller should answer 401); untagged for server faults (caller: 500).
   *
   * @see https://learn.microsoft.com/en-us/entra/identity-platform/id-tokens
   */
  async verifyIdToken(token) {
    if (!token) {
      throw invalidTokenError("Microsoft authentication failed: Token is required for verification");
    }

    // Outside the try below on purpose — see appleAuth.js: a missing
    // MICROSOFT_CLIENT_ID or a Key Vault outage is a server fault, not a bad
    // credential, and must stay untagged so it is reported (fb#365).
    const clientId = await getMicrosoftClientId(this.getEnvVar);

    try {
      const decoded = await jwtVerify(token, this.getKey, {
        audience: clientId,
        algorithms: ["RS256"],
        clockTolerance: 60,
        maxAge: "1h",
      });

      // Azure AD is multi-tenant, so the issuer must be matched against a
      // pattern — and it must happen HERE, by hand: jsonwebtoken's `issuer`
      // option only supports string/array and silently ignores a RegExp, so
      // passing the pattern as an option validates nothing.
      if (!/^https:\/\/login\.microsoftonline\.com\/[a-f0-9-]+\/v2\.0$/.test(decoded.iss || "")) {
        throw new Error(`jwt issuer invalid: ${decoded.iss}`);
      }

      if (!decoded.nonce) {
        this.logger?.warn?.("Microsoft token missing nonce claim (replay attack risk)", {
          email: decoded.email || decoded.preferred_username,
          tokenId: decoded.oid,
        });
      }

      this.logger?.info?.("Microsoft token verified", {
        tenantId: decoded.tid,
        email: decoded.email || decoded.preferred_username,
        issuer: decoded.iss,
      });

      return decoded;
    } catch (error) {
      this.logger?.error?.("Microsoft token verification failed", {
        error: error.message,
        stack: error.stack,
      });
      throw invalidTokenError(`Microsoft authentication failed: ${error.message}`);
    }
  }

  /**
   * Extract standardized user object from decoded Microsoft ID token payload
   *
   * Maps Microsoft token claims to betoni.online user structure.
   * Handles multiple email claim formats (email, preferred_username, upn).
   *
   * @param {object} payload - Decoded Microsoft ID token payload
   * @param {string} payload.oid - Object ID (unique user identifier)
   * @param {string} payload.sub - Subject (alternative user identifier)
   * @param {string} [payload.email] - User email (primary)
   * @param {string} [payload.preferred_username] - User principal name (fallback)
   * @param {string} [payload.upn] - User principal name (secondary fallback)
   * @param {string} [payload.name] - Full display name
   * @param {string} [payload.given_name] - First name
   * @param {string} [payload.family_name] - Last name
   *
   * @returns {object} Standardized user object for betoni.online
   * @returns {string} user.microsoftId - Unique Microsoft user identifier (oid or sub)
   * @returns {string} user.email - User email address
   * @returns {string} [user.name] - Full display name
   * @returns {string} [user.firstName] - First name
   * @returns {string} [user.lastName] - Last name
   *
   * @example
   * const payload = await verifyIdToken(token);
   * const user = extractUser(payload);
   * // { microsoftId: "abc-123", email: "user@example.com", name: "John Doe", ... }
   */
  extractUser(payload) {
    return {
      microsoftId: payload.oid || payload.sub,
      email: payload.email || payload.preferred_username || payload.upn,
      name: payload.name,
      firstName: payload.given_name,
      lastName: payload.family_name,
      // phone is not always in id_token
    };
  }
}

/**
 * Create a MicrosoftAuth instance for token verification
 *
 * Factory function to create a configured Microsoft authentication service.
 * Supports both synchronous (process.env) and asynchronous (Azure Key Vault) configuration.
 *
 * @param {object} [options={}] - Configuration options
 * @param {object} [options.logger] - Winston-compatible logger instance for security audit logs
 * @param {Function} [options.getEnvVar] - Async function to retrieve environment variables (e.g., from Key Vault)
 *
 * @returns {MicrosoftAuth} Configured Microsoft authentication instance
 *
 * @example
 * // Simple usage with process.env
 * const microsoftAuth = createMicrosoftAuth();
 *
 * @example
 * // With logger for security audit trail
 * const microsoftAuth = createMicrosoftAuth({
 *   logger: logger.categories.AUTH
 * });
 *
 * @example
 * // With Azure Key Vault integration
 * const microsoftAuth = createMicrosoftAuth({
 *   logger: logger.categories.AUTH,
 *   getEnvVar: environmentHelper.getEnvVar
 * });
 */
const createMicrosoftAuth = (options = {}) => {
  return new MicrosoftAuth(options);
};

module.exports = {
  MicrosoftAuth,
  createMicrosoftAuth,
};
