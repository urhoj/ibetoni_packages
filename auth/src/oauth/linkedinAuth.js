const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const jwksClient = require("jwks-rsa");

const jwtVerify = promisify(jwt.verify);

/**
 * LinkedIn Authentication Service for betoni.online platform
 *
 * Verifies "Sign In with LinkedIn using OpenID Connect" id_tokens via JWKS at
 * https://www.linkedin.com/oauth/openid/jwks. LinkedIn is single-issuer
 * ("https://www.linkedin.com" — literal, not regex). The FE never sees a
 * token in this flow: it receives a `code` from the authorization redirect
 * and the backend exchanges it via /oauth/v2/accessToken with client_secret
 * + PKCE verifier. The returned id_token is what we verify.
 *
 * Notes vs Apple / Microsoft:
 *  - Includes an `exchangeCodeForTokens` step before verifyIdToken; the other
 *    providers' FEs hand us a token directly.
 *  - email_verified is a real boolean (unlike Apple's stringified "true").
 *  - given_name / family_name / name / picture are in the id_token — no
 *    first-sign-in name dance.
 *
 * Constructor accepts `options.jwksClient` for tests to inject a stub
 * getSigningKey (vitest 4.x cannot intercept CJS require() of jwks-rsa
 * via vi.mock — mirrors the AppleAuth precedent). Production callers omit
 * it; a real jwks-rsa client is lazy-created on first verify.
 *
 * @module @ibetoni/auth/oauth/linkedinAuth
 * @see https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
 */

const getEnv = async (getEnvVar, name) => {
  if (getEnvVar) return await getEnvVar(name);
  return process.env[name];
};

class LinkedInAuth {
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
        jwksUri: "https://www.linkedin.com/oauth/openid/jwks",
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

  async exchangeCodeForTokens({ code, codeVerifier, redirectUri }) {
    const clientId = await getEnv(this.getEnvVar, "LINKEDIN_CLIENT_ID");
    const clientSecret = await getEnv(this.getEnvVar, "LINKEDIN_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET not configured");
    }
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LinkedIn token exchange failed: ${res.status} ${text}`);
    }
    return res.json();
  }

  async verifyIdToken(token) {
    try {
      if (!token) throw new Error("Token is required for verification");

      const clientId = await getEnv(this.getEnvVar, "LINKEDIN_CLIENT_ID");
      const getKeyWrapper = (header, callback) => this.getKey(header, callback);

      const decoded = await jwtVerify(token, getKeyWrapper, {
        audience: clientId,
        algorithms: ["RS256"],
        issuer: "https://www.linkedin.com",
        clockTolerance: 60,
        maxAge: "1h",
      });

      this.logger?.info?.("LinkedIn token verified", {
        email: decoded.email,
        sub: decoded.sub,
      });

      return decoded;
    } catch (error) {
      this.logger?.error?.("LinkedIn token verification failed", {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`LinkedIn authentication failed: ${error.message}`);
    }
  }

  extractUser(payload) {
    return {
      linkedinId: payload.sub,
      email: payload.email || null,
      emailVerified: payload.email_verified === true,
      firstName: payload.given_name || "",
      lastName: payload.family_name || "",
      name: payload.name || "",
      picture: payload.picture || null,
    };
  }
}

const createLinkedInAuth = (options = {}) => new LinkedInAuth(options);

module.exports = { LinkedInAuth, createLinkedInAuth };
