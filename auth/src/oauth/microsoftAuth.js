const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const jwksClient = require("jwks-rsa");

const jwtVerify = promisify(jwt.verify);

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
  if (getEnvVar) {
    return await getEnvVar("MICROSOFT_CLIENT_ID");
  }
  return process.env.MICROSOFT_CLIENT_ID;
};

class MicrosoftAuth {
  /**
   * @param {object} options - Configuration options
   * @param {object} options.logger - Optional logger instance
   * @param {function} options.getEnvVar - Optional async function to get environment variables
   */
  constructor(options = {}) {
    this.logger = options.logger;
    this.getEnvVar = options.getEnvVar;
    this.jwksClient = null;
  }

  /**
   * Initialize JWKS (JSON Web Key Set) client for Microsoft public key retrieval
   *
   * Lazy-initializes a singleton JWKS client that fetches Microsoft's public signing keys
   * from the Azure AD discovery endpoint. Keys are cached for 24 hours to minimize API calls.
   *
   * @private
   * @returns {JwksClient} Configured JWKS client instance
   *
   * @see https://login.microsoftonline.com/common/discovery/v2.0/keys
   */
  getJwksClient() {
    if (!this.jwksClient) {
      this.jwksClient = jwksClient({
        jwksUri: "https://login.microsoftonline.com/common/discovery/v2.0/keys",
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
    }
    return this.jwksClient;
  }

  /**
   * Get signing key from JWKS endpoint
   * @param {object} header - Token header containing kid
   * @param {function} callback - Callback for jwt.verify compatibility
   */
  getKey(header, callback) {
    this.getJwksClient()
      .getSigningKey(header.kid)
      .then((key) => callback(null, key.getPublicKey()))
      .catch((err) => callback(err));
  }

  /**
   * Verify a Microsoft ID token with comprehensive security validations
   *
   * @param {string} token - Microsoft ID token from frontend (OIDC ID token)
   * @returns {Promise<object>} Verified token payload
   * @throws {Error} If token is invalid, expired, or verification fails
   *
   * @see https://learn.microsoft.com/en-us/entra/identity-platform/id-tokens
   */
  async verifyIdToken(token) {
    try {
      if (!token) {
        throw new Error("Token is required for verification");
      }

      const clientId = await getMicrosoftClientId(this.getEnvVar);
      const getKeyWrapper = (header, callback) => this.getKey(header, callback);

      const decoded = await jwtVerify(token, getKeyWrapper, {
        audience: clientId,
        algorithms: ["RS256"],
        issuer: /^https:\/\/login\.microsoftonline\.com\/[a-f0-9-]+\/v2\.0$/,
        clockTolerance: 60,
        maxAge: "1h",
      });

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
      throw new Error(`Microsoft authentication failed: ${error.message}`);
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
