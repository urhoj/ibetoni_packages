import { describe, it, expect } from "vitest";
import {
  compressPayload,
  expandPayload,
  isShortShape,
  PAYLOAD_VERSION,
  GLOBAL_ROLE_FLAGS,
  COMPANY_FLAGS,
} from "../jwtPayloadCodec.js";

const sampleCanonical = () => ({
  email: "user@example.com",
  personId: 12345,
  ownerAsiakasId: 100,
  tenantAsiakasId: 100,
  globalRoles: {
    isDeveloper: false,
    isRoleManager: true,
    isSystemAdmin: false,
    isGlobalSijaintiAdmin: false,
    isGlobalViewer: false,
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
});

describe("compressPayload (canonical → short)", () => {
  it("emits version marker", () => {
    const short = compressPayload(sampleCanonical());
    expect(short.v).toBe(PAYLOAD_VERSION);
  });

  it("renames top-level fields to short keys", () => {
    const short = compressPayload(sampleCanonical());
    expect(short.email).toBe("user@example.com");
    expect(short.sub).toBe("12345");
    expect(short.o).toBe(100);
    expect(short.t).toBe(100);
    expect(short.exp).toBe(1770000000);
  });

  it("encodes globalRoles into a single bitflag integer", () => {
    const short = compressPayload(sampleCanonical());
    expect(short.g).toBe(GLOBAL_ROLE_FLAGS.isRoleManager);
  });

  it("encodes globalRoles with multiple flags set", () => {
    const short = compressPayload({
      ...sampleCanonical(),
      globalRoles: {
        isDeveloper: true,
        isRoleManager: false,
        isSystemAdmin: true,
        isGlobalSijaintiAdmin: true,
      },
    });
    const expected =
      GLOBAL_ROLE_FLAGS.isDeveloper |
      GLOBAL_ROLE_FLAGS.isSystemAdmin |
      GLOBAL_ROLE_FLAGS.isGlobalSijaintiAdmin;
    expect(short.g).toBe(expected);
  });

  it("encodes and round-trips isGlobalViewer (read-only cross-tenant flag)", () => {
    expect(GLOBAL_ROLE_FLAGS.isGlobalViewer).toBe(16);
    const canonical = {
      ...sampleCanonical(),
      globalRoles: {
        isDeveloper: false,
        isRoleManager: false,
        isSystemAdmin: false,
        isGlobalSijaintiAdmin: false,
        isGlobalViewer: true,
      },
    };
    const short = compressPayload(canonical);
    expect(short.g).toBe(GLOBAL_ROLE_FLAGS.isGlobalViewer);
    const expanded = expandPayload(short);
    expect(expanded.globalRoles.isGlobalViewer).toBe(true);
    // read-only flag must not imply any admin bit
    expect(expanded.globalRoles.isSystemAdmin).toBe(false);
  });

  it("encodes asiakasesWithTypes as tuple rows", () => {
    const short = compressPayload(sampleCanonical());
    expect(short.a).toEqual([
      [101, COMPANY_FLAGS.isPumppuToimittaja, [2, 10, 11]],
      [
        102,
        COMPANY_FLAGS.isTyomaaAsiakas | COMPANY_FLAGS.isBetoniToimittaja,
        [8],
      ],
    ]);
  });

  it("sorts and dedupes role typeIds", () => {
    const short = compressPayload({
      ...sampleCanonical(),
      asiakasesWithTypes: [
        {
          asiakasId: 200,
          roles: ["keikkaHandler", "asiakasAdmin", "keikkaHandler", "asiakasAdmin"],
        },
      ],
    });
    expect(short.a[0][2]).toEqual([2, 11]);
  });

  it("drops unknown role names silently on compress (producer-trust)", () => {
    const short = compressPayload({
      ...sampleCanonical(),
      asiakasesWithTypes: [
        { asiakasId: 1, roles: ["asiakasAdmin", "futureRole", "keikkaHandler"] },
      ],
    });
    expect(short.a[0][2]).toEqual([2, 11]);
  });

  it("drops companyType entirely (zero callers, derivable)", () => {
    const short = compressPayload({
      ...sampleCanonical(),
      asiakasesWithTypes: [
        {
          asiakasId: 1,
          companyType: "pumppu",
          isPumppuToimittaja: true,
          roles: [],
        },
      ],
    });
    // tuple has only [asiakasId, flags, roleTypeIds] — no companyType slot
    expect(short.a[0]).toHaveLength(3);
    expect(JSON.stringify(short)).not.toContain("companyType");
    expect(JSON.stringify(short)).not.toContain("pumppu");
  });

  it("does not emit iat (signed with noTimestamp:true)", () => {
    const short = compressPayload({ ...sampleCanonical(), iat: 1000 });
    expect(short.iat).toBeUndefined();
  });

  it("preserves scope claim for peli passthrough", () => {
    const short = compressPayload({
      personId: null,
      email: "peli_5@peli.betoni.online",
      scope: "peli",
      exp: 1770000000,
    });
    expect(short.scope).toBe("peli");
    expect(short.sub).toBeUndefined();
  });

  it("keeps empty roles array as []", () => {
    const short = compressPayload({
      ...sampleCanonical(),
      asiakasesWithTypes: [{ asiakasId: 1, roles: [] }],
    });
    expect(short.a[0][2]).toEqual([]);
  });

  it("keeps empty asiakasesWithTypes as []", () => {
    const short = compressPayload({
      ...sampleCanonical(),
      asiakasesWithTypes: [],
    });
    expect(short.a).toEqual([]);
  });

  it("omits absent claims rather than emitting undefined", () => {
    const short = compressPayload({ personId: 1 });
    expect(short).toEqual({ v: 2, sub: "1" });
  });

  it("estimates substantial byte savings on a 26-company token", () => {
    const canonical = {
      ...sampleCanonical(),
      asiakasesWithTypes: Array.from({ length: 26 }, (_, i) => ({
        asiakasId: 100 + i,
        isTyomaaAsiakas: i % 2 === 0,
        isPumppuToimittaja: i % 3 === 0,
        isBetoniToimittaja: false,
        companyType: "pumppu",
        roles: ["asiakasAdmin", "keikkaHandler", "pumppari"],
      })),
    };
    const canonicalSize = JSON.stringify(canonical).length;
    const shortSize = JSON.stringify(compressPayload(canonical)).length;
    // Sanity floor — if this regresses the codec is broken
    expect(shortSize).toBeLessThan(canonicalSize * 0.5);
  });

  it("throws on non-object input", () => {
    expect(() => compressPayload(null)).toThrow();
    expect(() => compressPayload("nope")).toThrow();
  });
});

describe("expandPayload (short → canonical)", () => {
  it("restores top-level field names", () => {
    const expanded = expandPayload({
      v: 2,
      email: "u@x.fi",
      sub: "9",
      o: 100,
      t: 200,
      exp: 1770000000,
    });
    expect(expanded.email).toBe("u@x.fi");
    expect(expanded.personId).toBe(9);
    expect(expanded.ownerAsiakasId).toBe(100);
    expect(expanded.tenantAsiakasId).toBe(200);
    expect(expanded.exp).toBe(1770000000);
  });

  it("converts sub back to numeric personId", () => {
    expect(expandPayload({ v: 2, sub: "12345" }).personId).toBe(12345);
  });

  it("decodes globalRoles from bitflag integer", () => {
    const expanded = expandPayload({
      v: 2,
      g:
        GLOBAL_ROLE_FLAGS.isDeveloper |
        GLOBAL_ROLE_FLAGS.isSystemAdmin,
    });
    expect(expanded.globalRoles).toEqual({
      isDeveloper: true,
      isRoleManager: false,
      isSystemAdmin: true,
      isGlobalSijaintiAdmin: false,
      isGlobalViewer: false,
    });
  });

  it("decodes asiakasesWithTypes tuples back to objects", () => {
    const expanded = expandPayload({
      v: 2,
      a: [
        [101, COMPANY_FLAGS.isPumppuToimittaja, [2, 11]],
        [
          102,
          COMPANY_FLAGS.isTyomaaAsiakas | COMPANY_FLAGS.isBetoniToimittaja,
          [8],
        ],
      ],
    });
    expect(expanded.asiakasesWithTypes).toEqual([
      {
        asiakasId: 101,
        isTyomaaAsiakas: false,
        isPumppuToimittaja: true,
        isBetoniToimittaja: false,
        isLattiaToimittaja: false,
        roles: ["asiakasAdmin", "keikkaHandler"],
      },
      {
        asiakasId: 102,
        isTyomaaAsiakas: true,
        isPumppuToimittaja: false,
        isBetoniToimittaja: true,
        isLattiaToimittaja: false,
        roles: ["pumppari"],
      },
    ]);
  });

  it("does not reintroduce dropped companyType field", () => {
    const expanded = expandPayload({
      v: 2,
      a: [[101, COMPANY_FLAGS.isPumppuToimittaja, [2]]],
    });
    expect(expanded.asiakasesWithTypes[0]).not.toHaveProperty("companyType");
  });

  it("fail-closed: throws on unknown role typeId by default", () => {
    expect(() =>
      expandPayload({ v: 2, a: [[101, 0, [2, 999]]] }),
    ).toThrow(/Unknown role typeId: 999/);
  });

  it("fail-closed: explicit onUnknownRole='throw' rejects", () => {
    expect(() =>
      expandPayload(
        { v: 2, a: [[101, 0, [999]]] },
        { onUnknownRole: "throw" },
      ),
    ).toThrow();
  });

  it("forgiving: onUnknownRole='skip' drops unknown ids", () => {
    const expanded = expandPayload(
      { v: 2, a: [[101, 0, [2, 999, 11]]] },
      { onUnknownRole: "skip" },
    );
    expect(expanded.asiakasesWithTypes[0].roles).toEqual([
      "asiakasAdmin",
      "keikkaHandler",
    ]);
  });

  it("rejects malformed tuple (length < 3)", () => {
    expect(() => expandPayload({ v: 2, a: [[101, 0]] })).toThrow(
      /Malformed company tuple/,
    );
  });

  it("preserves iat if present (jsonwebtoken may inject it)", () => {
    const expanded = expandPayload({ v: 2, sub: "1", iat: 1700000000 });
    expect(expanded.iat).toBe(1700000000);
  });

  it("preserves scope passthrough", () => {
    const expanded = expandPayload({ v: 2, scope: "peli", sub: "5" });
    expect(expanded.scope).toBe("peli");
  });

  it("passes legacy (non-v2) payloads through unchanged", () => {
    const legacy = {
      email: "u@x.fi",
      personId: 1,
      ownerAsiakasId: 100,
      asiakasesWithTypes: [{ asiakasId: 1, roles: ["asiakasAdmin"] }],
      iat: 1700000000,
      exp: 1770000000,
    };
    expect(expandPayload(legacy)).toBe(legacy);
  });

  it("passes peli-style legacy payloads through unchanged", () => {
    const peli = { personId: null, email: "peli_5@peli.betoni.online", scope: "peli" };
    expect(expandPayload(peli)).toBe(peli);
  });

  it("returns undefined/null inputs as-is (legacy passthrough)", () => {
    expect(expandPayload(null)).toBe(null);
    expect(expandPayload(undefined)).toBe(undefined);
  });
});

describe("isShortShape", () => {
  it("detects v2 shape", () => {
    expect(isShortShape({ v: 2, sub: "1" })).toBe(true);
  });

  it("rejects legacy shape", () => {
    expect(isShortShape({ personId: 1, email: "x" })).toBe(false);
  });

  it("rejects null/undefined/non-object", () => {
    expect(isShortShape(null)).toBe(false);
    expect(isShortShape(undefined)).toBe(false);
    expect(isShortShape("v: 2")).toBe(false);
    expect(isShortShape({ v: 1 })).toBe(false);
    expect(isShortShape({ v: 3 })).toBe(false);
  });
});

describe("round-trip (compress → expand)", () => {
  it("preserves canonical shape end-to-end", () => {
    const canonical = sampleCanonical();
    const round = expandPayload(compressPayload(canonical));
    // role lists are sorted ascending by typeId post round-trip
    expect(round).toEqual({
      email: "user@example.com",
      personId: 12345,
      ownerAsiakasId: 100,
      tenantAsiakasId: 100,
      exp: 1770000000,
      globalRoles: canonical.globalRoles,
      asiakasesWithTypes: [
        {
          asiakasId: 101,
          isTyomaaAsiakas: false,
          isPumppuToimittaja: true,
          isBetoniToimittaja: false,
          isLattiaToimittaja: false,
          // input was ["asiakasAdmin","keikkaHandler","attachmentHandler"]
          // → typeIds [2,11,10] sorted → [2,10,11] → names ["asiakasAdmin","attachmentHandler","keikkaHandler"]
          roles: ["asiakasAdmin", "attachmentHandler", "keikkaHandler"],
        },
        {
          asiakasId: 102,
          isTyomaaAsiakas: true,
          isPumppuToimittaja: false,
          isBetoniToimittaja: true,
          isLattiaToimittaja: false,
          roles: ["pumppari"],
        },
      ],
    });
  });

  it("round-trip is idempotent across all 32 globalRoles bitmasks", () => {
    for (let mask = 0; mask < 32; mask++) {
      const canonical = {
        personId: 1,
        globalRoles: {
          isDeveloper: Boolean(mask & 1),
          isRoleManager: Boolean(mask & 2),
          isSystemAdmin: Boolean(mask & 4),
          isGlobalSijaintiAdmin: Boolean(mask & 8),
          isGlobalViewer: Boolean(mask & 16),
        },
      };
      const round = expandPayload(compressPayload(canonical));
      expect(round.globalRoles).toEqual(canonical.globalRoles);
    }
  });

  it("round-trip is idempotent across all 16 company flag combinations", () => {
    for (let flags = 0; flags < 16; flags++) {
      const canonical = {
        personId: 1,
        asiakasesWithTypes: [
          {
            asiakasId: 1,
            isTyomaaAsiakas: Boolean(flags & 1),
            isPumppuToimittaja: Boolean(flags & 2),
            isBetoniToimittaja: Boolean(flags & 4),
            isLattiaToimittaja: Boolean(flags & 8),
            roles: [],
          },
        ],
      };
      const round = expandPayload(compressPayload(canonical));
      expect(round.asiakasesWithTypes[0].isTyomaaAsiakas).toBe(Boolean(flags & 1));
      expect(round.asiakasesWithTypes[0].isPumppuToimittaja).toBe(Boolean(flags & 2));
      expect(round.asiakasesWithTypes[0].isBetoniToimittaja).toBe(Boolean(flags & 4));
      expect(round.asiakasesWithTypes[0].isLattiaToimittaja).toBe(Boolean(flags & 8));
    }
  });

  it("legacy tuples without the isLattiaToimittaja bit expand it as false (backward compat)", () => {
    const decoded = {
      v: 2,
      sub: "1",
      a: [[101, COMPANY_FLAGS.isPumppuToimittaja, []]],
    };
    const out = expandPayload(decoded);
    expect(out.asiakasesWithTypes[0].isPumppuToimittaja).toBe(true);
    expect(out.asiakasesWithTypes[0].isLattiaToimittaja).toBe(false);
  });
});

describe("impersonation claims (imp / imp_sid)", () => {
  it("compress encodes imp and imp_sid into short keys i and s", () => {
    const canonical = {
      personId: 100,
      email: "target@x.fi",
      ownerAsiakasId: 8,
      tenantAsiakasId: 8,
      globalRoles: { isSystemAdmin: false, isRoleManager: false, isDeveloper: false, isGlobalSijaintiAdmin: false },
      asiakasesWithTypes: [],
      imp: 1,
      imp_sid: "abc-123",
      exp: 1770000000,
    };
    const short = compressPayload(canonical);
    expect(short.i).toBe(1);
    expect(short.s).toBe("abc-123");
    expect(short.imp).toBeUndefined();
    expect(short.imp_sid).toBeUndefined();
  });

  it("expand decodes i and s back into imp and imp_sid", () => {
    const short = {
      v: 2,
      sub: "100",
      email: "target@x.fi",
      o: 8,
      t: 8,
      g: 0,
      a: [],
      i: 1,
      s: "abc-123",
      exp: 1770000000,
    };
    const canonical = expandPayload(short);
    expect(canonical.imp).toBe(1);
    expect(canonical.imp_sid).toBe("abc-123");
  });

  it("payload without imp claims is preserved unchanged on round-trip", () => {
    const canonical = {
      personId: 100,
      email: "user@x.fi",
      ownerAsiakasId: 8,
      tenantAsiakasId: 8,
      globalRoles: { isSystemAdmin: false, isRoleManager: false, isDeveloper: false, isGlobalSijaintiAdmin: false },
      asiakasesWithTypes: [],
      exp: 1770000000,
    };
    const round = expandPayload(compressPayload(canonical));
    expect(round.imp).toBeUndefined();
    expect(round.imp_sid).toBeUndefined();
  });
});
