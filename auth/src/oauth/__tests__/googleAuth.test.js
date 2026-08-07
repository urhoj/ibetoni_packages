// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
// The pragma above is load-bearing: google-auth-library's createCrypto() picks
// a BROWSER implementation whenever `window` exists and routes verification
// through SubtleCrypto.importKey, which rejects the PEM public key the stubbed
// cert fetch below serves. Production is always node. (Keep the pragma's own
// spelling out of prose — vitest scans leading comments for it and will happily
// read the next word of a sentence as the environment name.)
import jwt from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { createGoogleAuth, INVALID_OAUTH_TOKEN } from "../googleAuth.js";

// Google is the highest-traffic sign-in path, and a break here does NOT fail a
// deploy or a health check — it fails only when a real user tries to log in,
// after the pre-swap gate has already passed. These tests therefore drive the
// REAL google-auth-library verification path (verifySignedJwtWithCertsAsync),
// stubbing only the federated-cert HTTP fetch, so a major-version bump that
// moves the library's API surface fails here instead of in production.

const CLIENT_ID = "test-client-id.apps.googleusercontent.com";
const ISSUER = "https://accounts.google.com";

function newKeyPair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

/** Sign a Google-shaped ID token with the given private key. */
function buildToken({
  privateKey,
  kid = "test-kid",
  audience = CLIENT_ID,
  issuer = ISSUER,
  expiresIn = "10m",
  claims = {},
} = {}) {
  return jwt.sign(
    {
      sub: "1234567890",
      email: "user@example.com",
      email_verified: true,
      given_name: "Test",
      family_name: "User",
      ...claims,
    },
    privateKey,
    { algorithm: "RS256", audience, issuer, expiresIn, header: { kid, alg: "RS256" } }
  );
}

/**
 * A real OAuth2Client with ONLY the network cert fetch stubbed. Everything
 * downstream — segment parsing, kid lookup, signature check, aud/iss/exp
 * validation, getPayload() — is the library's own code.
 */
function authWithCerts(certs, { getEnvVar } = {}) {
  const client = new OAuth2Client(CLIENT_ID);
  vi.spyOn(client, "getFederatedSignonCertsAsync").mockResolvedValue({ certs, res: null });
  return createGoogleAuth({ client, getEnvVar: getEnvVar || (async () => CLIENT_ID) });
}

// A library API break (renamed/removed method) surfaces as one of these rather
// than as a token rejection. Asserting their ABSENCE is what distinguishes
// "the token was bad" (correct) from "the library moved" (a break).
const API_BREAK = /is not a function|is not a constructor|cannot read propert/i;

describe("googleAuth", () => {
  describe("google-auth-library API surface", () => {
    it("exposes OAuth2Client as a constructor with verifyIdToken", () => {
      expect(typeof OAuth2Client).toBe("function");
      const client = new OAuth2Client(CLIENT_ID);
      expect(typeof client.verifyIdToken).toBe("function");
      expect(typeof client.getFederatedSignonCertsAsync).toBe("function");
    });
  });

  describe("valid token", () => {
    it("verifies a correctly signed token and returns the payload", async () => {
      const { publicKey, privateKey } = newKeyPair();
      const auth = authWithCerts({ "test-kid": publicKey });

      const payload = await auth.verifyGoogleToken(buildToken({ privateKey }));

      expect(payload.email).toBe("user@example.com");
      expect(payload.given_name).toBe("Test");
      expect(payload.family_name).toBe("User");
      expect(payload.aud).toBe(CLIENT_ID);
    });
  });

  describe("rejects bad credentials with a 401-able error", () => {
    it("rejects a missing token", async () => {
      const auth = authWithCerts({});
      await expect(auth.verifyGoogleToken("")).rejects.toMatchObject({
        code: INVALID_OAUTH_TOKEN,
        message: expect.stringContaining("Token is required for verification"),
      });
    });

    it("rejects a malformed token", async () => {
      const auth = authWithCerts({});
      const error = await auth.verifyGoogleToken("not-a-jwt").catch((e) => e);

      expect(error.code).toBe(INVALID_OAUTH_TOKEN);
      expect(error.message).not.toMatch(API_BREAK);
    });

    it("rejects an unsigned token whose kid is unknown to Google", async () => {
      // The exact production failure from fb#361: a well-formed token whose
      // key id is absent from the federated certs.
      const { privateKey } = newKeyPair();
      const auth = authWithCerts({ "some-other-kid": newKeyPair().publicKey });
      const error = await auth
        .verifyGoogleToken(buildToken({ privateKey }))
        .catch((e) => e);

      expect(error.code).toBe(INVALID_OAUTH_TOKEN);
      expect(error.message).toContain("No pem found for envelope");
      expect(error.message).not.toMatch(API_BREAK);
    });

    it("never verifies a token forged with the wrong key", async () => {
      // Standing security assertion: the kid matches a served cert, but the
      // signature was produced by a different key.
      const served = newKeyPair();
      const forger = newKeyPair();
      const auth = authWithCerts({ "test-kid": served.publicKey });
      const error = await auth
        .verifyGoogleToken(buildToken({ privateKey: forger.privateKey }))
        .catch((e) => e);

      expect(error.code).toBe(INVALID_OAUTH_TOKEN);
      expect(error.message).not.toMatch(API_BREAK);
    });

    it("rejects a token minted for a different audience", async () => {
      const { publicKey, privateKey } = newKeyPair();
      const auth = authWithCerts({ "test-kid": publicKey });
      const error = await auth
        .verifyGoogleToken(buildToken({ privateKey, audience: "someone-elses-client-id" }))
        .catch((e) => e);

      expect(error.code).toBe(INVALID_OAUTH_TOKEN);
      expect(error.message).not.toMatch(API_BREAK);
    });

    it("rejects an expired token", async () => {
      const { publicKey, privateKey } = newKeyPair();
      const auth = authWithCerts({ "test-kid": publicKey });
      const error = await auth
        .verifyGoogleToken(buildToken({ privateKey, expiresIn: "-1h" }))
        .catch((e) => e);

      expect(error.code).toBe(INVALID_OAUTH_TOKEN);
      expect(error.message).not.toMatch(API_BREAK);
    });
  });

  describe("server faults stay 500-able", () => {
    // Regression guard for fb#361: the 401 branch must key off the tag, and a
    // config/Key Vault failure must NOT carry it — otherwise an outage is
    // reported to the user as "your login is invalid" and hidden from Sentry.
    it("does not tag a Key Vault / config failure as a bad credential", async () => {
      const auth = createGoogleAuth({
        getEnvVar: async () => {
          throw new Error("Key Vault unavailable");
        },
      });
      const { privateKey } = newKeyPair();
      const error = await auth.verifyGoogleToken(buildToken({ privateKey })).catch((e) => e);

      expect(error.message).toContain("Key Vault unavailable");
      expect(error.code).not.toBe(INVALID_OAUTH_TOKEN);
    });

    it("does not tag a missing GOOGLE_CLIENT_ID as a bad credential", async () => {
      const auth = createGoogleAuth({ getEnvVar: async () => undefined });
      const { privateKey } = newKeyPair();
      const error = await auth.verifyGoogleToken(buildToken({ privateKey })).catch((e) => e);

      expect(error.code).not.toBe(INVALID_OAUTH_TOKEN);
    });
  });
});
