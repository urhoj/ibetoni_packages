const { invalidTokenError } = require("./oauthErrors");
const { jwtVerify, createKeyResolver } = require("./jwksVerifier");

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
    // options.jwksClient: optional injected JWKS client — tests stub getSigningKey.
    this.getKey = createKeyResolver("https://www.linkedin.com/oauth/openid/jwks", options.jwksClient || null);
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
      // 4xx here means the authorization code the caller presented is bad or
      // spent — a client error, tagged so it stays a 401. 5xx is LinkedIn
      // being down, which is not our fault either but IS worth a Sentry
      // report, so it stays untagged and surfaces as a server error (fb#365).
      const message = `LinkedIn token exchange failed: ${res.status} ${text}`;
      throw res.status < 500 ? invalidTokenError(message) : new Error(message);
    }
    return res.json();
  }

  async verifyIdToken(token) {
    if (!token) {
      throw invalidTokenError("LinkedIn authentication failed: Token is required for verification");
    }

    // Outside the try below on purpose — see appleAuth.js: a missing
    // LINKEDIN_CLIENT_ID or a Key Vault outage is a server fault, not a bad
    // credential, and must stay untagged so it is reported (fb#365).
    const clientId = await getEnv(this.getEnvVar, "LINKEDIN_CLIENT_ID");

    try {
      const decoded = await jwtVerify(token, this.getKey, {
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
      throw invalidTokenError(`LinkedIn authentication failed: ${error.message}`);
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
