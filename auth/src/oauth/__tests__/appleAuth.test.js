import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";
import { createAppleAuth } from "../appleAuth.js";

// Helper: generate an RSA key pair and a signed Apple-shaped ID token
function buildTestToken({
  audience = "online.betoni.signin",
  issuer = "https://appleid.apple.com",
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
      sub: "001234.abcd.5678",
      email: "user@example.com",
      email_verified: "true",
      is_private_email: "false",
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

// Build an AppleAuth with an injected stub JWKS client that returns the given
// public key for any kid. Mirrors the shape of a real jwks-rsa client.
function buildAuthWithStubJwks(publicKey) {
  const mockGetSigningKey = vi.fn().mockResolvedValue({
    getPublicKey: () => publicKey,
  });
  const auth = createAppleAuth({
    jwksClient: { getSigningKey: mockGetSigningKey },
  });
  return { auth, mockGetSigningKey };
}

beforeEach(() => {
  process.env.APPLE_CLIENT_ID = "online.betoni.signin";
});

describe("AppleAuth.verifyIdToken", () => {
  it("verifies a valid Apple ID token and returns the decoded payload", async () => {
    const { token, publicKey } = buildTestToken();
    const { auth, mockGetSigningKey } = buildAuthWithStubJwks(publicKey);

    const payload = await auth.verifyIdToken(token);

    expect(mockGetSigningKey).toHaveBeenCalledWith("test-kid");
    expect(payload.sub).toBe("001234.abcd.5678");
    expect(payload.email).toBe("user@example.com");
    expect(payload.aud).toBe("online.betoni.signin");
    expect(payload.iss).toBe("https://appleid.apple.com");
  });

  it("rejects a token with the wrong audience", async () => {
    const { token, publicKey } = buildTestToken({ audience: "some.other.id" });
    const { auth } = buildAuthWithStubJwks(publicKey);

    await expect(auth.verifyIdToken(token)).rejects.toThrow(/Apple authentication failed/);
  });

  it("rejects a token with the wrong issuer", async () => {
    const { token, publicKey } = buildTestToken({ issuer: "https://evil.example.com" });
    const { auth } = buildAuthWithStubJwks(publicKey);

    await expect(auth.verifyIdToken(token)).rejects.toThrow(/Apple authentication failed/);
  });

  it("rejects an expired token", async () => {
    const { token, publicKey } = buildTestToken({ expiresIn: "-1m" });
    const { auth } = buildAuthWithStubJwks(publicKey);

    await expect(auth.verifyIdToken(token)).rejects.toThrow(/Apple authentication failed/);
  });

  it("rejects when no token is provided", async () => {
    const auth = createAppleAuth();
    await expect(auth.verifyIdToken("")).rejects.toThrow(/Token is required/);
  });
});

describe("AppleAuth.extractUser", () => {
  it("coerces email_verified and is_private_email string values to booleans", () => {
    const auth = createAppleAuth();

    const user = auth.extractUser({
      sub: "001234.abcd",
      email: "xyz@privaterelay.appleid.com",
      email_verified: "true",
      is_private_email: "true",
    });

    expect(user).toEqual({
      appleId: "001234.abcd",
      email: "xyz@privaterelay.appleid.com",
      emailVerified: true,
      isPrivateEmail: true,
    });
  });

  it("returns email=null when payload has no email claim", () => {
    const auth = createAppleAuth();

    const user = auth.extractUser({ sub: "001234.abcd" });
    expect(user.email).toBeNull();
    expect(user.appleId).toBe("001234.abcd");
  });
});
