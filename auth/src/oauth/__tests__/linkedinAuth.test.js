import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { generateKeyPairSync } from "crypto";
import { createLinkedInAuth } from "../linkedinAuth.js";
import { isInvalidTokenError } from "../oauthErrors.js";

// Capture fetch calls for token exchange
const originalFetch = globalThis.fetch;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.LINKEDIN_CLIENT_ID = "77fakeclientid";
  process.env.LINKEDIN_CLIENT_SECRET = "fakesecret";
});

function buildTestToken({
  audience = "77fakeclientid",
  issuer = "https://www.linkedin.com",
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
      sub: "ABC123",
      email: "user@example.com",
      email_verified: true,
      given_name: "Mikko",
      family_name: "Meikäläinen",
      name: "Mikko Meikäläinen",
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

// Build a LinkedInAuth with an injected stub JWKS client that returns the given
// public key for any kid. Mirrors the shape of a real jwks-rsa client.
// Apple test note applies here too: vitest 4.x cannot intercept CJS require() of
// jwks-rsa via vi.mock, so we inject the stub through the constructor option.
function buildAuthWithStubJwks(publicKey) {
  const mockGetSigningKey = vi.fn().mockResolvedValue({
    getPublicKey: () => publicKey,
  });
  const auth = createLinkedInAuth({
    jwksClient: { getSigningKey: mockGetSigningKey },
  });
  return { auth, mockGetSigningKey };
}

describe("LinkedInAuth.verifyIdToken", () => {
  it("verifies a valid LinkedIn ID token and returns the decoded payload", async () => {
    const { token, publicKey } = buildTestToken();
    const { auth, mockGetSigningKey } = buildAuthWithStubJwks(publicKey);

    const payload = await auth.verifyIdToken(token);

    expect(mockGetSigningKey).toHaveBeenCalledWith("test-kid");
    expect(payload.sub).toBe("ABC123");
    expect(payload.email).toBe("user@example.com");
    expect(payload.aud).toBe("77fakeclientid");
    expect(payload.iss).toBe("https://www.linkedin.com");
  });

  it("rejects a token with the wrong audience", async () => {
    const { token, publicKey } = buildTestToken({ audience: "some.other.id" });
    const { auth } = buildAuthWithStubJwks(publicKey);

    await expect(auth.verifyIdToken(token)).rejects.toThrow(/LinkedIn authentication failed/);
  });

  it("rejects a token with the wrong issuer", async () => {
    const { token, publicKey } = buildTestToken({ issuer: "https://evil.example.com" });
    const { auth } = buildAuthWithStubJwks(publicKey);

    await expect(auth.verifyIdToken(token)).rejects.toThrow(/LinkedIn authentication failed/);
  });

  it("rejects an expired token", async () => {
    const { token, publicKey } = buildTestToken({ expiresIn: "-1m" });
    const { auth } = buildAuthWithStubJwks(publicKey);

    await expect(auth.verifyIdToken(token)).rejects.toThrow(/LinkedIn authentication failed/);
  });

  it("rejects when no token is provided", async () => {
    // No stub JWKS client needed — the empty-token guard fires before key resolution.
    const auth = createLinkedInAuth();
    await expect(auth.verifyIdToken("")).rejects.toThrow(/Token is required/);
  });
});

describe("LinkedInAuth.extractUser", () => {
  it("maps OIDC claims to the standardized user object", () => {
    const auth = createLinkedInAuth();

    const user = auth.extractUser({
      sub: "ABC123",
      email: "user@example.com",
      email_verified: true,
      given_name: "Mikko",
      family_name: "Meikäläinen",
      name: "Mikko Meikäläinen",
      picture: "https://media.licdn.com/dms/image/abc",
    });

    expect(user).toEqual({
      linkedinId: "ABC123",
      email: "user@example.com",
      emailVerified: true,
      firstName: "Mikko",
      lastName: "Meikäläinen",
      name: "Mikko Meikäläinen",
      picture: "https://media.licdn.com/dms/image/abc",
    });
  });

  it("returns email=null and empty names when payload has no profile claims", () => {
    const auth = createLinkedInAuth();

    const user = auth.extractUser({ sub: "ABC123" });
    expect(user).toEqual({
      linkedinId: "ABC123",
      email: null,
      emailVerified: false,
      firstName: "",
      lastName: "",
      name: "",
      picture: null,
    });
  });
});

describe("LinkedInAuth.exchangeCodeForTokens", () => {
  it("POSTs to the token endpoint and returns the parsed body on 2xx", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          access_token: "AAA",
          id_token: "BBB",
          expires_in: 3600,
          scope: "openid profile email",
        };
      },
    }));
    globalThis.fetch = fetchMock;

    const auth = createLinkedInAuth();
    const out = await auth.exchangeCodeForTokens({
      code: "thecode",
      codeVerifier: "theverifier",
      redirectUri: "http://localhost:5173/oauth/linkedin/callback",
    });

    expect(out.id_token).toBe("BBB");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.linkedin.com/oauth/v2/accessToken");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(opts.body.toString()).toContain("grant_type=authorization_code");
    expect(opts.body.toString()).toContain("code=thecode");
    expect(opts.body.toString()).toContain("code_verifier=theverifier");
    expect(opts.body.toString()).toContain("client_id=77fakeclientid");
    expect(opts.body.toString()).toContain("client_secret=fakesecret");

    globalThis.fetch = originalFetch;
  });

  it("throws when the token endpoint returns 4xx", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      async text() {
        return '{"error":"invalid_grant"}';
      },
    }));

    const auth = createLinkedInAuth();
    await expect(
      auth.exchangeCodeForTokens({
        code: "bad",
        codeVerifier: "v",
        redirectUri: "u",
      })
    ).rejects.toThrow(/LinkedIn token exchange failed: 400/);

    globalThis.fetch = originalFetch;
  });
});

// fb#365: puminet5api's linkedin.js adapter turned EVERY throw from this module
// into {success:false} → 401, so a missing client secret or LinkedIn being down
// told the user their login was invalid and left no Sentry trace at all. The
// adapter now rethrows anything untagged, which only works if the tagging here
// is accurate.
describe("LinkedInAuth error classification", () => {
  const exchange = () =>
    createLinkedInAuth().exchangeCodeForTokens({ code: "c", codeVerifier: "v", redirectUri: "u" });

  const stubFetch = (status) => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status,
      async text() {
        return "{}";
      },
    }));
  };

  it("tags a 4xx token exchange — a spent or invalid authorization code is the caller's problem", async () => {
    stubFetch(400);
    const error = await exchange().catch((e) => e);
    globalThis.fetch = originalFetch;

    expect(isInvalidTokenError(error)).toBe(true);
  });

  it("leaves a 5xx token exchange untagged — LinkedIn being down deserves a Sentry report", async () => {
    stubFetch(503);
    const error = await exchange().catch((e) => e);
    globalThis.fetch = originalFetch;

    expect(isInvalidTokenError(error)).toBe(false);
  });

  it("leaves missing client credentials untagged", async () => {
    delete process.env.LINKEDIN_CLIENT_SECRET;
    const error = await exchange().catch((e) => e);

    expect(error.message).toMatch(/not configured/);
    expect(isInvalidTokenError(error)).toBe(false);
  });

  it("tags a bad id_token", async () => {
    const { token, publicKey } = buildTestToken({ audience: "someone-else" });
    const { auth } = buildAuthWithStubJwks(publicKey);

    expect(isInvalidTokenError(await auth.verifyIdToken(token).catch((e) => e))).toBe(true);
  });

  it("leaves a Key Vault failure during id_token verification untagged", async () => {
    const auth = createLinkedInAuth({
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
