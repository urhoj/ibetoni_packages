/**
 * JWT Payload Codec — v2 short-shape compression for betoni.online
 *
 * Translates between the canonical claim shape used everywhere in the app
 * and a compact wire shape used for signing/verifying. Keeps the rest of
 * the codebase ignorant of the wire format: sign-side calls compressPayload,
 * verify-side calls expandPayload, consumers see canonical req.user.
 *
 * Wire shape (v: 2):
 *   {
 *     v: 2,
 *     sub: "12345",            // personId (string per JWT spec)
 *     email: "user@x.fi",
 *     o:  100,                 // ownerAsiakasId
 *     t:  100,                 // tenantAsiakasId (load-bearing for subscriptions)
 *     g:  2,                   // globalRoles bitflags
 *     a:  [                    // asiakasesWithTypes (tuple rows)
 *       [asiakasId, companyFlags, roleTypeIds[]],
 *     ],
 *     exp: 1770000000,
 *     scope: "peli",           // optional, peli passthrough
 *   }
 *
 * Global role flags (g):
 *   1 = isDeveloper
 *   2 = isRoleManager
 *   4 = isSystemAdmin
 *   8 = isGlobalSijaintiAdmin
 *
 * Company tuple slot 1 (companyFlags):
 *   1 = isTyomaaAsiakas
 *   2 = isPumppuToimittaja
 *   4 = isBetoniToimittaja
 *
 * Notes:
 *   - `companyType` is dropped entirely (zero runtime callers; was derived
 *     from pT/bT anyway). Not restored on expand.
 *   - `iat` is dropped on sign (use noTimestamp:true) and not restored.
 *   - Tokens without `v: 2` (legacy app tokens, peli scope tokens) pass
 *     through expand unchanged. Compress emits v:2 unconditionally.
 *   - Unknown role typeIds: BE callers pass {onUnknownRole:"throw"} (default,
 *     fail-closed). FE callers pass {onUnknownRole:"skip"} (forgiving).
 */

const {
  rolesNamesToTypeIds,
  roleTypeIdsToNames,
} = require("@ibetoni/constants");

const PAYLOAD_VERSION = 2;

const GLOBAL_ROLE_FLAGS = Object.freeze({
  isDeveloper: 1,
  isRoleManager: 2,
  isSystemAdmin: 4,
  isGlobalSijaintiAdmin: 8,
});

const COMPANY_FLAGS = Object.freeze({
  isTyomaaAsiakas: 1,
  isPumppuToimittaja: 2,
  isBetoniToimittaja: 4,
});

function encodeGlobalRoles(g) {
  if (!g) return 0;
  let n = 0;
  if (g.isDeveloper) n |= GLOBAL_ROLE_FLAGS.isDeveloper;
  if (g.isRoleManager) n |= GLOBAL_ROLE_FLAGS.isRoleManager;
  if (g.isSystemAdmin) n |= GLOBAL_ROLE_FLAGS.isSystemAdmin;
  if (g.isGlobalSijaintiAdmin) n |= GLOBAL_ROLE_FLAGS.isGlobalSijaintiAdmin;
  return n;
}

function decodeGlobalRoles(n) {
  const v = Number(n) || 0;
  return {
    isDeveloper: Boolean(v & GLOBAL_ROLE_FLAGS.isDeveloper),
    isRoleManager: Boolean(v & GLOBAL_ROLE_FLAGS.isRoleManager),
    isSystemAdmin: Boolean(v & GLOBAL_ROLE_FLAGS.isSystemAdmin),
    isGlobalSijaintiAdmin: Boolean(v & GLOBAL_ROLE_FLAGS.isGlobalSijaintiAdmin),
  };
}

function compressCompanyRow(row) {
  let flags = 0;
  if (row.isTyomaaAsiakas) flags |= COMPANY_FLAGS.isTyomaaAsiakas;
  if (row.isPumppuToimittaja) flags |= COMPANY_FLAGS.isPumppuToimittaja;
  if (row.isBetoniToimittaja) flags |= COMPANY_FLAGS.isBetoniToimittaja;
  return [row.asiakasId, flags, rolesNamesToTypeIds(row.roles)];
}

function expandCompanyRow(tuple, { onUnknownRole }) {
  if (!Array.isArray(tuple) || tuple.length < 3) {
    throw new Error("Malformed company tuple in JWT payload");
  }
  const [asiakasId, flags, typeIds] = tuple;
  const f = Number(flags) || 0;
  return {
    asiakasId,
    isTyomaaAsiakas: Boolean(f & COMPANY_FLAGS.isTyomaaAsiakas),
    isPumppuToimittaja: Boolean(f & COMPANY_FLAGS.isPumppuToimittaja),
    isBetoniToimittaja: Boolean(f & COMPANY_FLAGS.isBetoniToimittaja),
    roles: roleTypeIdsToNames(typeIds, { onUnknown: onUnknownRole }),
  };
}

/**
 * Detect whether a decoded JWT payload is in v2 short shape.
 * @param {object} decoded
 * @returns {boolean}
 */
function isShortShape(decoded) {
  return Boolean(decoded) && decoded.v === PAYLOAD_VERSION;
}

/**
 * Compress canonical payload → v2 short wire shape.
 *
 * Drops: companyType (everywhere), iat (caller signs with noTimestamp:true).
 * Preserves: scope (peli), email, exp.
 * Sub claim: personId is serialised as string per JWT RFC 7519 §4.1.2.
 *
 * Side-effect free.
 *
 * @param {object} canonical
 * @returns {object} short shape
 */
function compressPayload(canonical) {
  if (!canonical || typeof canonical !== "object") {
    throw new Error("compressPayload: canonical payload must be an object");
  }

  const short = { v: PAYLOAD_VERSION };

  if (canonical.email !== undefined) short.email = canonical.email;
  if (canonical.personId !== undefined && canonical.personId !== null) {
    short.sub = String(canonical.personId);
  }
  if (canonical.exp !== undefined) short.exp = canonical.exp;
  if (canonical.ownerAsiakasId !== undefined) short.o = canonical.ownerAsiakasId;
  if (canonical.tenantAsiakasId !== undefined) short.t = canonical.tenantAsiakasId;
  if (canonical.globalRoles !== undefined) {
    short.g = encodeGlobalRoles(canonical.globalRoles);
  }
  if (Array.isArray(canonical.asiakasesWithTypes)) {
    short.a = canonical.asiakasesWithTypes.map(compressCompanyRow);
  }
  if (canonical.scope !== undefined) short.scope = canonical.scope;

  return short;
}

/**
 * Expand v2 short shape → canonical payload.
 *
 * Tokens without v:2 (legacy app tokens, peli scope tokens currently signed
 * via the legacy path) pass through unchanged so consumers keep working
 * during rollout and for non-app token types.
 *
 * @param {object} decoded - jwt.verify result
 * @param {object} [options]
 * @param {"throw"|"skip"} [options.onUnknownRole="throw"] - fail-closed (BE)
 *   vs forgiving (FE). On "throw", an unknown typeId rejects the entire
 *   payload — caller should treat this as INVALID_TOKEN and 401.
 * @returns {object} canonical shape
 */
function expandPayload(decoded, { onUnknownRole = "throw" } = {}) {
  if (!isShortShape(decoded)) return decoded;

  const out = {};

  if (decoded.email !== undefined) out.email = decoded.email;
  if (decoded.sub !== undefined && decoded.sub !== null) {
    const n = Number(decoded.sub);
    out.personId = Number.isFinite(n) ? n : decoded.sub;
  }
  if (decoded.exp !== undefined) out.exp = decoded.exp;
  if (decoded.iat !== undefined) out.iat = decoded.iat;
  if (decoded.o !== undefined) out.ownerAsiakasId = decoded.o;
  if (decoded.t !== undefined) out.tenantAsiakasId = decoded.t;
  if (decoded.g !== undefined) out.globalRoles = decodeGlobalRoles(decoded.g);
  if (Array.isArray(decoded.a)) {
    out.asiakasesWithTypes = decoded.a.map((row) =>
      expandCompanyRow(row, { onUnknownRole }),
    );
  }
  if (decoded.scope !== undefined) out.scope = decoded.scope;

  return out;
}

module.exports = {
  PAYLOAD_VERSION,
  GLOBAL_ROLE_FLAGS,
  COMPANY_FLAGS,
  compressPayload,
  expandPayload,
  isShortShape,
};
