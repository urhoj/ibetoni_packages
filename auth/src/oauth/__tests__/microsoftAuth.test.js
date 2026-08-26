import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";
import { createMicrosoftAuth } from "../microsoftAuth.js";
import { INVALID_OAUTH_TOKEN, isInvalidTokenError } from "../oauthErrors.js";

const TENANT_ISSUER = "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0";

// Helper: generate an RSA key pair and a signed Microsoft-shaped ID token
function buildTestToken({
  audience = "betoni-ms-client-id",
  issuer = TENANT_ISSUER,
  claims = {},
  expiresIn = "10m",
} = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const token = jwt.sign(
    {
      oid: "0000-oid-1234",
      tid: "9188040d-6c67-4c5b-b112-36a304b66dad",
      email: "user@example.com",
      preferred_username: "user@example.com",
      nonce: "test-nonce",
      ...claims,
    },
    privateKey,
    {
      algorithm: "RS256",
      audience,
      issuer,
      expiresIn,
      header: { kid: "test-kid", alg: "RS256" },
    }
  );
  return { token, publicKey };
}

// Build a MicrosoftAuth with an injected stub JWKS client that returns the
// given public key for any kid. Mirrors the shape of a real jwks-rsa client.
function buildAuthWithStubJwks(publicKey) {
  const mockGetSigningKey = vi.fn().mockResolvedValue({
    getPublicKey: () => publicKey,
  });
  const auth = createMicrosoftAuth({
    jwksClient: { getSigningKey: mockGetSigningKey },
  });
  return { auth, mockGetSigningKey };
}

beforeEach(() => {
  process.env.MICROSOFT_CLIENT_ID = "betoni-ms-client-id";
});

describe("MicrosoftAuth.verifyIdToken", () => {
  it("verifies a valid Microsoft ID token and returns the decoded payload", async () => {
    const { token, publicKey } = buildTestToken();
    const { auth, mockGetSigningKey } = buildAuthWithStubJwks(publicKey);

    const payload = await auth.verifyIdToken(token);

    expect(mockGetSigningKey).toHaveBeenCalledWith("test-kid");
    expect(payload.oid).toBe("0000-oid-1234");
    expect(payload.email).toBe("user@example.com");
    expect(payload.aud).toBe("betoni-ms-client-id");
    expect(payload.iss).toBe(TENANT_ISSUER);
  });

  it("rejects a token with the wrong audience", async () => {
    const { token, publicKey } = buildTestToken({ audience: "some.other.id" });
    const { auth } = buildAuthWithStubJwks(publicKey);

    await expect(auth.verifyIdToken(token)).rejects.toThrow(/Microsoft authentication failed/);
  });

  it("rejects a token whose issuer does not match the Azure AD v2 pattern", async () => {
    const { token, publicKey } = buildTestToken({ issuer: "https://evil.example.com" });
    const { auth } = buildAuthWithStubJwks(publicKey);

    await expect(auth.verifyIdToken(token)).rejects.toThrow(/Microsoft authentication failed/);
  });

  it("rejects an expired token", async () => {
    const { token, publicKey } = buildTestToken({ expiresIn: "-1m" });
    const { auth } = buildAuthWithStubJwks(publicKey);

    await expect(auth.verifyIdToken(token)).rejects.toThrow(/Microsoft authentication failed/);
  });

  it("rejects when no token is provided", async () => {
    // No stub JWKS client needed — the empty-token guard fires before key resolution.
    const auth = createMicrosoftAuth();
    await expect(auth.verifyIdToken("")).rejects.toThrow(/Token is required/);
  });

  it("throws a clear error when MICROSOFT_CLIENT_ID is not set", async () => {
    const original = process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_ID;
    try {
      const { token, publicKey } = buildTestToken();
      const { auth } = buildAuthWithStubJwks(publicKey);
      await expect(auth.verifyIdToken(token)).rejects.toThrow(
        /MICROSOFT_CLIENT_ID environment variable is not set/
      );
    } finally {
      if (original !== undefined) process.env.MICROSOFT_CLIENT_ID = original;
    }
  });
});

// fb#365 pattern, applied to Microsoft last of the four providers: the
// puminet5api microsoft.js adapter can only distinguish "bad credential"
// (401, no Sentry) from "we broke" (500 + Sentry) if this module tags
// accurately. These assert the tagging contract.
describe("MicrosoftAuth.verifyIdToken error classification", () => {
  it("tags a bad credential so the caller answers 401", async () => {
    const { token, publicKey } = buildTestToken({ audience: "someone.else" });
    const { auth } = buildAuthWithStubJwks(publicKey);

    await expect(auth.verifyIdToken(token)).rejects.toMatchObject({
      code: INVALID_OAUTH_TOKEN,
    });
  });

  it("tags a missing token", async () => {
    await expect(createMicrosoftAuth().verifyIdToken("")).rejects.toMatchObject({
      code: INVALID_OAUTH_TOKEN,
    });
  });

  it("leaves a missing MICROSOFT_CLIENT_ID untagged, so it stays a reported 500", async () => {
    const original = process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_ID;
    try {
      const { token, publicKey } = buildTestToken();
      const { auth } = buildAuthWithStubJwks(publicKey);
      const error = await auth.verifyIdToken(token).catch((e) => e);

      expect(error.code).not.toBe(INVALID_OAUTH_TOKEN);
      expect(isInvalidTokenError(error)).toBe(false);
    } finally {
      if (original !== undefined) process.env.MICROSOFT_CLIENT_ID = original;
    }
  });

  it("leaves a Key Vault failure untagged", async () => {
    const auth = createMicrosoftAuth({
      getEnvVar: async () => {
        throw new Error("Key Vault unavailable");
      },
    });
    const { token } = buildTestToken();
    const error = await auth.verifyIdToken(token).catch((e) => e);

    expect(error.message).toContain("Key Vault unavailable");
    expect(isInvalidTokenError(error)).toBe(false);
  });
});

describe("MicrosoftAuth.extractUser", () => {
  it("maps Microsoft claims to the betoni user shape", () => {
    const auth = createMicrosoftAuth();

    const user = auth.extractUser({
      oid: "0000-oid-1234",
      sub: "sub-fallback",
      email: "user@example.com",
      name: "Test User",
      given_name: "Test",
      family_name: "User",
    });

    expect(user).toEqual({
      microsoftId: "0000-oid-1234",
      email: "user@example.com",
      name: "Test User",
      firstName: "Test",
      lastName: "User",
    });
  });

  it("falls back to sub and preferred_username/upn", () => {
    const auth = createMicrosoftAuth();

    const user = auth.extractUser({
      sub: "sub-only",
      preferred_username: "upn@example.com",
    });

    expect(user.microsoftId).toBe("sub-only");
    expect(user.email).toBe("upn@example.com");
  });
});
