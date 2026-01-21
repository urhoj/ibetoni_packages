const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

/**
 * Microsoft Authentication Service for betoni.online platform
 *
 * Handles verification of Microsoft ID tokens (OIDC)
 * Uses jwks-rsa to retrieve signing keys from Microsoft discovery endpoint
 */

/**
 * Get Microsoft Client ID from environment
 * Supports both sync and async retrieval
 * @param {function} getEnvVar - Optional async function to get env var
 * @returns {Promise<string>|string} Microsoft Client ID (audience)
 */
const getMicrosoftClientId = async (getEnvVar) => {
  if (getEnvVar) {
    // Async retrieval (Key Vault)
    return await getEnvVar("MICROSOFT_CLIENT_ID");
  }
  // Sync retrieval (process.env)
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    // Fallback for development if not set (though it should be)
    if (process.env.NODE_ENV === "development") {
      console.warn("MICROSOFT_CLIENT_ID is not set in environment");
    }
  }
  return clientId;
};

/**
 * Get Microsoft Tenant ID from environment
 * @param {function} getEnvVar - Optional async function to get env var
 * @returns {Promise<string>|string} Microsoft Tenant ID
 */
const getMicrosoftTenantId = async (getEnvVar) => {
  if (getEnvVar) {
    return await getEnvVar("MICROSOFT_TENANT_ID");
  }
  return process.env.MICROSOFT_TENANT_ID || "common";
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
   * Initialize JWKS client
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
   * Verify a Microsoft ID token
   * @param {string} token - Microsoft ID token from frontend
   * @returns {Promise<object>} Verified token payload containing user info
   * @throws {Error} If token is invalid or verification fails
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
          // issuer validation can be tricky with "common" endpoint as issuer changes per tenant
          // For now we rely on signature and audience.
          // If strictly single tenant, we could validate issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`
        };

        jwt.verify(token, getKeyWrapper, verifyOptions, (err, decoded) => {
          if (err) {
            reject(err);
          } else {
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
   * Extract standardized user object from decoded token
   * @param {object} payload - Decoded token payload
   * @returns {object} Standardized user object
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
 * Create a MicrosoftAuth instance
 */
const createMicrosoftAuth = (options = {}) => {
  return new MicrosoftAuth(options);
};

module.exports = {
  MicrosoftAuth,
  createMicrosoftAuth,
};
