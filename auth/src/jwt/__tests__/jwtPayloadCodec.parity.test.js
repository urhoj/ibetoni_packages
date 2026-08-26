import { describe, it, expect } from "vitest";
import * as esm from "../jwtPayloadCodec.js";
import { createRequire } from "module";

// The codec ships as a dual ESM/CJS pair that MUST stay behaviorally mirrored:
// the backend signs with the .cjs half while the detailed suite
// (jwtPayloadCodec.test.js) exercises only the .js half. Because the codec is
// a whitelist, a claim added to one half and forgotten in the other is dropped
// SILENTLY at sign time. This suite pins the two halves to identical behavior,
// so that failure mode turns into a red test instead of lost claims.
const require = createRequire(import.meta.url);
const cjs = require("../jwtPayloadCodec.cjs");

const fullCanonical = {
  email: "user@example.com",
  personId: 12345,
  ownerAsiakasId: 100,
  tenantAsiakasId: 100,
  globalRoles: {
    isDeveloper: true,
    isRoleManager: true,
    isSystemAdmin: false,
    isGlobalSijaintiAdmin: false,
    isGlobalViewer: true,
  },
  asiakasesWithTypes: [
    {
      asiakasId: 101,
      isTyomaaAsiakas: false,
      isPumppuToimittaja: true,
      isBetoniToimittaja: false,
      roles: ["asiakasAdmin", "keikkaHandler", "attachmentHandler"],
    },
    {
      asiakasId: 102,
      isTyomaaAsiakas: true,
      isPumppuToimittaja: false,
      isBetoniToimittaja: true,
      roles: ["pumppari"],
    },
  ],
  exp: 1770000000,
};

const minimalCanonical = {
  email: "min@example.com",
  personId: 1,
};

describe("jwtPayloadCodec ESM/CJS parity", () => {
  it("exports the same API surface from both halves", () => {
    const esmKeys = Object.keys(esm).sort();
    const cjsKeys = Object.keys(cjs).sort();
    expect(cjsKeys).toEqual(esmKeys);
  });

  it("constants are identical", () => {
    expect(cjs.PAYLOAD_VERSION).toBe(esm.PAYLOAD_VERSION);
    expect(cjs.GLOBAL_ROLE_FLAGS).toEqual(esm.GLOBAL_ROLE_FLAGS);
    expect(cjs.COMPANY_FLAGS).toEqual(esm.COMPANY_FLAGS);
  });

  it.each([
    ["full payload", fullCanonical],
    ["minimal payload", minimalCanonical],
  ])("compressPayload produces identical output for %s", (_name, canonical) => {
    expect(cjs.compressPayload(canonical)).toEqual(esm.compressPayload(canonical));
  });

  it.each([
    ["full payload", fullCanonical],
    ["minimal payload", minimalCanonical],
  ])("round-trip through either half restores the same canonical for %s", (_name, canonical) => {
    const viaEsm = esm.expandPayload(esm.compressPayload(canonical));
    const viaCjs = cjs.expandPayload(cjs.compressPayload(canonical));
    const cross = cjs.expandPayload(esm.compressPayload(canonical));
    expect(viaCjs).toEqual(viaEsm);
    expect(cross).toEqual(viaEsm);
  });

  it("isShortShape agrees on short, long, and junk shapes", () => {
    const short = esm.compressPayload(fullCanonical);
    for (const candidate of [short, fullCanonical, {}, null, undefined, { v: 999 }]) {
      expect(cjs.isShortShape(candidate)).toBe(esm.isShortShape(candidate));
    }
  });

  it("every claim in the whitelist survives the CJS sign path (no silent drop)", () => {
    // The exact claims production mints (backend signs via the .cjs half).
    // expandPayload normalizes (defaults absent company flags, reorders roles
    // to whitelist order), so compare values, not deep-equality of the input.
    const restored = cjs.expandPayload(cjs.compressPayload(fullCanonical));
    expect(restored.email).toBe(fullCanonical.email);
    expect(restored.personId).toBe(fullCanonical.personId);
    expect(restored.ownerAsiakasId).toBe(fullCanonical.ownerAsiakasId);
    expect(restored.tenantAsiakasId).toBe(fullCanonical.tenantAsiakasId);
    expect(restored.globalRoles).toEqual(fullCanonical.globalRoles);
    expect(restored.exp).toBe(fullCanonical.exp);

    expect(restored.asiakasesWithTypes).toHaveLength(fullCanonical.asiakasesWithTypes.length);
    fullCanonical.asiakasesWithTypes.forEach((company, i) => {
      const restoredCompany = restored.asiakasesWithTypes[i];
      expect(restoredCompany.asiakasId).toBe(company.asiakasId);
      expect(restoredCompany.isTyomaaAsiakas).toBe(company.isTyomaaAsiakas);
      expect(restoredCompany.isPumppuToimittaja).toBe(company.isPumppuToimittaja);
      expect(restoredCompany.isBetoniToimittaja).toBe(company.isBetoniToimittaja);
      expect([...restoredCompany.roles].sort()).toEqual([...company.roles].sort());
    });
  });
});
