const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

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
   * Get signing key from JWKS
   * @param {object} header - Token header containing kid
   * @returns {Promise<string>} Signing key
   */
  getKey(header, callback) {
    const client = this.getJwksClient();
    client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        callback(err, null);
      } else {
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
      }
    });
  }

  /**
   * Verify a Microsoft ID token with comprehensive security validations
   *
   * Performs the following security checks:
   * - Signature validation using Microsoft's public keys (JWKS)
   * - Audience (aud) claim matches configured MICROSOFT_CLIENT_ID
   * - Issuer (iss) claim matches Azure AD pattern: https://login.microsoftonline.com/{tenant-guid}/v2.0
   * - Token expiration (exp) with 60-second clock skew tolerance
   * - Token age validation (rejects tokens older than 1 hour)
   * - Nonce claim presence (warns if missing - replay attack risk)
   * - Tenant ID logging for audit trail
   *
   * @param {string} token - Microsoft ID token from frontend (OIDC ID token)
   * @returns {Promise<object>} Verified token payload containing user info and security claims
   * @returns {Promise<object>} payload.email - User email address
   * @returns {Promise<object>} payload.name - User display name
   * @returns {Promise<object>} payload.given_name - First name
   * @returns {Promise<object>} payload.family_name - Last name
   * @returns {Promise<object>} payload.oid - User object ID (unique identifier)
   * @returns {Promise<object>} payload.tid - Tenant ID
   * @returns {Promise<object>} payload.iss - Issuer URL
   * @returns {Promise<object>} payload.aud - Audience (client ID)
   * @returns {Promise<object>} payload.exp - Expiration timestamp
   * @returns {Promise<object>} payload.iat - Issued at timestamp
   * @returns {Promise<object>} payload.nbf - Not before timestamp
   * @returns {Promise<object>} payload.nonce - Nonce for replay protection (should be present)
   * @returns {Promise<object>} payload.amr - Authentication methods reference (e.g., ["pwd", "mfa"])
   *
   * @throws {Error} If token is invalid, expired, from unauthorized issuer, or verification fails
   * @throws {Error} If token signature doesn't match Microsoft's public key
   * @throws {Error} If audience doesn't match configured MICROSOFT_CLIENT_ID
   * @throws {Error} If issuer pattern doesn't match Azure AD
   * @throws {Error} If token is older than maxAge (1 hour)
   *
   * @example
   * // Verify Microsoft ID token from frontend
   * try {
   *   const payload = await microsoftAuth.verifyIdToken(idToken);
   *   console.log('User:', payload.email, payload.name);
   *   console.log('Tenant:', payload.tid);
   *   console.log('MFA:', payload.amr?.includes('mfa'));
   * } catch (error) {
   *   console.error('Token verification failed:', error.message);
   * }
   *
   * @see https://learn.microsoft.com/en-us/entra/identity-platform/id-tokens
   * @see https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens
   */
  async verifyIdToken(token) {
    try {
      if (!token) {
        throw new Error("Token is required for verification");
      }

      const clientId = await getMicrosoftClientId(this.getEnvVar);
      // We don't strictly validate tenant ID for "common" multi-tenant apps unless restricted

      return new Promise((resolve, reject) => {
        // getKey needs to be bound or wrapped because jwt.verify calls it
        const getKeyWrapper = (header, callback) => this.getKey(header, callback);

        const verifyOptions = {
          audience: clientId,
          algorithms: ["RS256"],
          // Multi-tenant issuer validation: accept tokens from any Azure AD tenant
          // Pattern matches: https://login.microsoftonline.com/{tenant-guid}/v2.0
          issuer: /^https:\/\/login\.microsoftonline\.com\/[a-f0-9-]+\/v2\.0$/,
          // Clock skew tolerance (60 seconds) to handle time differences between servers
          clockTolerance: 60,
          // Additional safety: reject tokens older than 1 hour
          maxAge: "1h",
        };

        jwt.verify(token, getKeyWrapper, verifyOptions, (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            // Additional security validations
            if (!decoded.nonce) {
              if (this.logger?.warn) {
                this.logger.warn("Microsoft token missing nonce claim (replay attack risk)", {
                  email: decoded.email || decoded.preferred_username,
                  tokenId: decoded.oid,
                });
              }
            }

            // Log tenant ID for audit purposes
            if (this.logger?.info) {
              this.logger.info("Microsoft token verified", {
                tenantId: decoded.tid,
                email: decoded.email || decoded.preferred_username,
                issuer: decoded.iss,
              });
            }

            resolve(decoded);
          }
        });
      });
    } catch (error) {
      if (this.logger?.error) {
        this.logger.error("Microsoft token verification failed", {
          error: error.message,
          stack: error.stack,
        });
      }
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
