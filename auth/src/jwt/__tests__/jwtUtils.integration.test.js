import { describe, it, expect, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import {
  createToken,
  getTokenData,
} from "../jwtUtils.js";

const TEST_KEY = "test-jwt-key-for-integration-tests-only";

const sampleClaims = () => ({
  ownerAsiakasId: 100,
  tenantAsiakasId: 100,
  globalRoles: {
    isDeveloper: false,
    isRoleManager: true,
    isSystemAdmin: false,
    isGlobalSijaintiAdmin: false,
  },
  asiakasesWithTypes: [
    {
      asiakasId: 101,
      isTyomaaAsiakas: false,
      isPumppuToimittaja: true,
      isBetoniToimittaja: false,
      roles: ["asiakasAdmin", "keikkaHandler"],
    },
  ],
});

describe("createToken + getTokenData integration", () => {
  beforeEach(() => {
    process.env.JWT_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.JWT_SHORT_KEYS;
  });

  describe("legacy shape (JWT_SHORT_KEYS unset/false)", () => {
    beforeEach(() => {
      delete process.env.JWT_SHORT_KEYS;
    });

    it("signs canonical payload and returns canonical on decode", async () => {
      const token = await createToken("u@x.fi", 12345, sampleClaims());
      const decoded = await getTokenData(token);

      expect(decoded.email).toBe("u@x.fi");
      expect(decoded.personId).toBe(12345);
      expect(decoded.ownerAsiakasId).toBe(100);
      expect(decoded.tenantAsiakasId).toBe(100);
      expect(decoded.globalRoles).toEqual(sampleClaims().globalRoles);
      expect(decoded.asiakasesWithTypes).toEqual(sampleClaims().asiakasesWithTypes);
    });

    it("emits iat in legacy shape (jsonwebtoken default)", async () => {
      const token = await createToken("u@x.fi", 1, sampleClaims());
      const raw = jwt.verify(token, TEST_KEY);
      expect(raw.iat).toBeTypeOf("number");
      expect(raw.exp).toBeTypeOf("number");
    });

    it("uses canonical field names on the wire", async () => {
      const token = await createToken("u@x.fi", 1, sampleClaims());
      const raw = jwt.verify(token, TEST_KEY);
      expect(raw.personId).toBe(1);
      expect(raw.ownerAsiakasId).toBe(100);
      expect(raw.asiakasesWithTypes).toBeDefined();
      expect(raw.v).toBeUndefined();
    });
  });

  describe("v2 short shape (JWT_SHORT_KEYS=true)", () => {
    beforeEach(() => {
      process.env.JWT_SHORT_KEYS = "true";
    });

    it("signs short payload, getTokenData returns canonical", async () => {
      const token = await createToken("u@x.fi", 12345, sampleClaims());
      const decoded = await getTokenData(token);

      // Caller sees canonical shape — boundary translation is invisible
      expect(decoded.email).toBe("u@x.fi");
      expect(decoded.personId).toBe(12345);
      expect(decoded.ownerAsiakasId).toBe(100);
      expect(decoded.tenantAsiakasId).toBe(100);
      expect(decoded.globalRoles).toEqual(sampleClaims().globalRoles);
      expect(decoded.asiakasesWithTypes).toEqual(sampleClaims().asiakasesWithTypes);
    });

    it("uses short field names on the wire", async () => {
      const token = await createToken("u@x.fi", 1, sampleClaims());
      const raw = jwt.verify(token, TEST_KEY);
      expect(raw.v).toBe(2);
      expect(raw.sub).toBe("1");
      expect(raw.o).toBe(100);
      expect(raw.t).toBe(100);
      expect(raw.g).toBe(2); // isRoleManager bit
      expect(raw.a).toEqual([[101, 2, [2, 11]]]);
      // Canonical names absent on the wire
      expect(raw.personId).toBeUndefined();
      expect(raw.ownerAsiakasId).toBeUndefined();
      expect(raw.asiakasesWithTypes).toBeUndefined();
    });

    it("drops iat from the wire (noTimestamp:true)", async () => {
      const token = await createToken("u@x.fi", 1, sampleClaims());
      const raw = jwt.verify(token, TEST_KEY);
      expect(raw.iat).toBeUndefined();
      expect(raw.exp).toBeTypeOf("number");
    });

    it("respects expiresIn override even with noTimestamp:true", async () => {
      const before = Math.floor(Date.now() / 1000);
      const token = await createToken("u@x.fi", 1, sampleClaims(), {
        expiresIn: "1h",
      });
      const raw = jwt.verify(token, TEST_KEY);
      // exp should be roughly now + 3600s
      expect(raw.exp - before).toBeGreaterThanOrEqual(3590);
      expect(raw.exp - before).toBeLessThanOrEqual(3610);
    });

    it("rejects on decode when token contains unknown role typeId (fail-closed)", async () => {
      // Manually craft a token with an unknown typeId in the role array
      const malicious = jwt.sign(
        {
          v: 2,
          sub: "1",
          email: "u@x.fi",
          a: [[101, 0, [2, 999]]],
        },
        TEST_KEY,
        { algorithm: "HS256", expiresIn: "1h" },
      );
      await expect(getTokenData(malicious)).rejects.toThrow(/Unknown role typeId/);
    });

    it("produces a strictly smaller token than legacy for the same claims", async () => {
      delete process.env.JWT_SHORT_KEYS;
      const legacyToken = await createToken("u@x.fi", 12345, sampleClaims());

      process.env.JWT_SHORT_KEYS = "true";
      const shortToken = await createToken("u@x.fi", 12345, sampleClaims());

      expect(shortToken.length).toBeLessThan(legacyToken.length);
    });
  });

  describe("verify accepts both shapes regardless of sign-side flag", () => {
    it("legacy verify can decode short tokens", async () => {
      process.env.JWT_SHORT_KEYS = "true";
      const shortToken = await createToken("u@x.fi", 1, sampleClaims());

      delete process.env.JWT_SHORT_KEYS;
      const decoded = await getTokenData(shortToken);
      expect(decoded.personId).toBe(1);
      expect(decoded.ownerAsiakasId).toBe(100);
    });

    it("short verify can decode legacy tokens", async () => {
      delete process.env.JWT_SHORT_KEYS;
      const legacyToken = await createToken("u@x.fi", 1, sampleClaims());

      process.env.JWT_SHORT_KEYS = "true";
      const decoded = await getTokenData(legacyToken);
      expect(decoded.personId).toBe(1);
      expect(decoded.ownerAsiakasId).toBe(100);
    });
  });

  describe("HS256 algorithm enforcement", () => {
    beforeEach(() => {
      delete process.env.JWT_SHORT_KEYS;
    });

    it("rejects token signed with a different algorithm", async () => {
      const noneToken = jwt.sign({ personId: 1, email: "u@x.fi" }, "", {
        algorithm: "none",
      });
      await expect(getTokenData(noneToken)).rejects.toThrow();
    });
  });
});
