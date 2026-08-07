const { OAuth2Client } = require("google-auth-library");

/**
 * Google Authentication Service for betoni.online platform
 *
 * Handles verification of Google ID tokens for user authentication
 * Compatible with both sync (process.env) and async (Key Vault) configurations
 */

/**
 * Marks an error as "the CALLER supplied a credential we could not verify" —
 * an expired/forged/malformed ID token. Callers branch on this to answer 401
 * instead of 500. Errors WITHOUT this code are genuine server faults (missing
 * GOOGLE_CLIENT_ID, Key Vault outage) and must keep returning 500.
 *
 * Branch on the code, never on the message: the message is Google's and moves
 * between library versions.
 */
const INVALID_OAUTH_TOKEN = "INVALID_OAUTH_TOKEN";

/** Build an Error tagged as an unverifiable-credential (401) failure. */
const invalidTokenError = (message) => {
  const error = new Error(message);
  error.code = INVALID_OAUTH_TOKEN;
  return error;
};

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
   * @param {object} options.client - Optional pre-built OAuth2Client. Injected by tests so the
   *   federated-cert fetch can be stubbed and the real library verification path still runs
   *   offline (mirrors the `jwksClient` injection on AppleAuth).
   */
  constructor(options = {}) {
    this.logger = options.logger;
    this.getEnvVar = options.getEnvVar;
    this.client = options.client || null;
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
          console.error("Failed to initialize Google OAuth2 client", {
            error: error.message
          });
        }
        throw error;
      }

      this.client = new OAuth2Client(googleClientId);
    }
    return this.client;
  }

  /**
   * Verify a Google ID token
   * @param {string} token - Google ID token from frontend
   * @returns {Promise<object>} Verified token payload containing user info
   * @throws {Error} Tagged `code === INVALID_OAUTH_TOKEN` when the token itself is
   *   bad (caller should answer 401); untagged for server faults (caller: 500).
   */
  async verifyGoogleToken(token) {
    if (!token) {
      throw invalidTokenError("Google authentication failed: Token is required for verification");
    }

    // Client construction and client-id resolution sit OUTSIDE the try below on
    // purpose: a missing GOOGLE_CLIENT_ID or a Key Vault outage is a server
    // fault, and tagging it as a bad credential would report an outage to the
    // user as "your login is invalid" and hide it from Sentry.
    const oauthClient = await this.initializeClient();

    if (!oauthClient) {
      throw new Error("OAuth2Client failed to initialize");
    }

    const googleClientId = await getGoogleClientId(this.getEnvVar);

    try {
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

      return payload;
    } catch (error) {
      if (this.logger?.error) {
        console.error("Google token verification failed", {
          error: error.message,
          stack: error.stack,
        });
      } else {
        console.error("Google token verification failed:", error.message);
      }
      throw invalidTokenError(`Google authentication failed: ${error.message}`);
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
  INVALID_OAUTH_TOKEN,
};
