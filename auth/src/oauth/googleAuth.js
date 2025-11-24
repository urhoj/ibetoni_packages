const { OAuth2Client } = require("google-auth-library");

/**
 * Google Authentication Service for betoni.online platform
 *
 * Handles verification of Google ID tokens for user authentication
 * Compatible with both sync (process.env) and async (Key Vault) configurations
 */

/**
 * Get Google Client ID from environment
 * Supports both sync and async retrieval
 * @param {function} getEnvVar - Optional async function to get env var
 * @returns {Promise<string>|string} Google Client ID
 */
const getGoogleClientId = async (getEnvVar) => {
  if (getEnvVar) {
    // Async retrieval (Key Vault)
    return await getEnvVar("GOOGLE_CLIENT_ID");
  }
  // Sync retrieval (process.env)
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID environment variable is not set");
  }
  return googleClientId;
};

/**
 * Google Authentication Service Class
 * Create instance with optional configuration for logger and environment helpers
 */
class GoogleAuth {
  /**
   * @param {object} options - Configuration options
   * @param {object} options.logger - Optional logger instance (Winston, Bunyan, etc.)
   * @param {function} options.getEnvVar - Optional async function to get environment variables
   */
  constructor(options = {}) {
    this.logger = options.logger;
    this.getEnvVar = options.getEnvVar;
    this.client = null;
  }

  /**
   * Initialize OAuth2Client lazily
   * @returns {Promise<OAuth2Client>} Google OAuth2 client
   */
  async initializeClient() {
    if (!this.client) {
      const googleClientId = await getGoogleClientId(this.getEnvVar);

      if (!googleClientId) {
        const error = new Error("GOOGLE_CLIENT_ID is not set or returned undefined");
        if (this.logger?.error) {
          this.logger.error("Failed to initialize Google OAuth2 client", {
            error: error.message
          });
        }
        throw error;
      }

      this.client = new OAuth2Client(googleClientId);

      if (this.logger?.info) {
        this.logger.info("Google OAuth2 client initialized", {
          clientIdLength: googleClientId.length
        });
      }
    }
    return this.client;
  }

  /**
   * Verify a Google ID token
   * @param {string} token - Google ID token from frontend
   * @returns {Promise<object>} Verified token payload containing user info
   * @throws {Error} If token is invalid or verification fails
   */
  async verifyGoogleToken(token) {
    try {
      if (!token) {
        throw new Error("Token is required for verification");
      }

      const oauthClient = await this.initializeClient();

      if (!oauthClient) {
        throw new Error("OAuth2Client failed to initialize");
      }

      const googleClientId = await getGoogleClientId(this.getEnvVar);

      if (this.logger?.info) {
        this.logger.info("Verifying Google ID token", {
          tokenLength: token.length,
          hasClient: !!oauthClient
        });
      }

      const ticket = await oauthClient.verifyIdToken({
        idToken: token,
        audience: googleClientId,
      });

      const payload = ticket.getPayload();

      // Payload structure:
      // {
      //   sub: "google user ID",
      //   email: "user@example.com",
      //   email_verified: true,
      //   name: "Full Name",
      //   given_name: "First",
      //   family_name: "Last",
      //   picture: "https://...",
      //   iat: 1234567890,
      //   exp: 1234567890
      // }

      if (this.logger?.info) {
        this.logger.info("Google token verified successfully", {
          email: payload.email,
          emailVerified: payload.email_verified,
        });
      }

      return payload;
    } catch (error) {
      if (this.logger?.error) {
        this.logger.error("Google token verification failed", {
          error: error.message,
          stack: error.stack,
        });
      } else {
        console.error("Google token verification failed:", error.message);
      }
      throw new Error(`Google authentication failed: ${error.message}`);
    }
  }
}

/**
 * Create a GoogleAuth instance with options
 * @param {object} options - Configuration options
 * @param {object} options.logger - Optional logger instance
 * @param {function} options.getEnvVar - Optional async function to get env vars
 * @returns {GoogleAuth} Configured GoogleAuth instance
 */
const createGoogleAuth = (options = {}) => {
  return new GoogleAuth(options);
};

// Export both the class and a factory function
module.exports = {
  GoogleAuth,
  createGoogleAuth,
};
