/**
 * JWT Payload Codec — v2 short-shape compression for betoni.online (CJS)
 *
 * CommonJS build of jwtPayloadCodec.js. Kept in lockstep with the ESM source.
 * Backend Node `require()` callers resolve here via package.json "exports"
 * `./codec.require`; FE/Vite resolves the ESM `.js` sibling via `./codec.import`.
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

function isShortShape(decoded) {
  return Boolean(decoded) && decoded.v === PAYLOAD_VERSION;
}

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
  if (canonical.imp !== undefined && canonical.imp !== null) short.i = canonical.imp;
  if (canonical.imp_sid !== undefined && canonical.imp_sid !== null) short.s = canonical.imp_sid;

  return short;
}

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
  if (decoded.i !== undefined && decoded.i !== null) out.imp = decoded.i;
  if (decoded.s !== undefined && decoded.s !== null) out.imp_sid = decoded.s;

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
