/**
 * Role Mapping Constants
 *
 * Maps JWT companyRoles boolean flags to asiakasPersonSettingTypeId values
 * used in the database asiakasPersonSettingType table.
 *
 * @constant {Object.<string, number>} COMPANY_ROLE_TO_TYPE_ID
 *
 * @example
 * // Backend usage
 * import { COMPANY_ROLE_TO_TYPE_ID } from '@ibetoni/constants/roles';
 *
 * @example
 * // Frontend usage
 * import { COMPANY_ROLE_TO_TYPE_ID } from '@ibetoni/constants';
 */
export const COMPANY_ROLE_TO_TYPE_ID = {
  /**
   * Laskupohja Admin (typeId 1). The JWT/code flag is `isLaskupohjaAdmin`, but
   * `dbo.asiakasPersonSettingTypes` describes typeId 1 as `isTarjousAdmin`
   * ("saa luoda, muokata ja lähettää tarjouksia"). Same grant; **use
   * `isLaskupohjaAdmin` in code**. Treated as edit-tier by hasCompanyRole
   * (see puminet5api authUtils).
   *
   * ⚠ "TarjousAdmin" NAMES TWO DIFFERENT ROLES (fb#418). Do not reach for this
   * one just because the word matches — check which consumer you are writing
   * for:
   *   - typeId 1 (here) — what the DB calls isTarjousAdmin, what the FE
   *     `auth.page.jerry` gate reads, and what jerryRecipients falls back to
   *     via ASIAKAS_ANY_ADMIN_ROLE_TYPE_IDS [22,6,11,2,1].
   *   - typeId 5 `isLaskuAdmin` — what the BetoniJerry module means by
   *     "TarjousAdmin": jerryAdminSql's tarjousAdminCount and the `jerry`
   *     validation profile's people.tarjousAdmin check both key on 5, and 5 is
   *     what live provider companies actually hold.
   * Granting the one this comment used to point at left Jerry validation red
   * with a message saying nothing had been granted.
   */
  isLaskupohjaAdmin: 1,

  /** Asiakas Admin - Customer administrator */
  isAsiakasAdmin: 2,

  /** Asiakas Editor - Customer editor */
  isAsiakasEditor: 6,

  /**
   * Lasku Admin - Invoice administrator (typeId 5). ALSO what the BetoniJerry
   * module means by "TarjousAdmin" — jerryAdminSql's tarjousAdminCount and the
   * `jerry` validation profile key on this id, NOT on typeId 1 (fb#418).
   */
  isLaskuAdmin: 5,

  /** Pumppari - Concrete pump driver */
  isPumppari: 8,

  /** Työsuhteessa - Employee status */
  isTyösuhteessa: 9,

  /** Attachment Handler - Can manage attachments */
  isAttachmentHandler: 10,

  /** Keikka Handler - Can manage deliveries */
  isKeikkaHandler: 11,

  /** Sijainti Handler - Can manage locations */
  isSijaintiHandler: 12,

  /** Vehicle Handler - Can manage vehicles */
  isVehicleHandler: 13,

  /** Tuote Handler - Can manage products */
  isTuoteHandler: 14,

  /** Lomaseurannassa - Vacation tracking enabled */
  isLomaseurannassa: 15,

  /** Assignee - Can be assigned to tasks */
  isAssignee: 16,

  /** Keikka Viewer - Read-only access to deliveries */
  isKeikkaViewer: 17,

  /** Betoni Handler - Can manage concrete specifications */
  isBetoniHandler: 18,

  /** Betoni Viewer - Read-only access to concrete data */
  isBetoniViewer: 19,

  /** @deprecated OBSOLETE - Use keikkaHandler/keikkaViewer with isPumppuToimittaja company flag */
  isPumppuHandler: 20,

  /** @deprecated OBSOLETE - Use keikkaHandler/keikkaViewer with isPumppuToimittaja company flag */
  isPumppuViewer: 21,

  /** Asiakas Owner - Company owner */
  isAsiakasOwner: 22,

  /** HR Admin - Human Resources administrator */
  isHRAdmin: 24,
};

/**
 * Maps JWT role name strings (from asiakasesWithTypes.roles) to companyRoles boolean keys.
 * Used by buildCompanyRoles to convert role arrays to boolean flags.
 *
 * @constant {Object.<string, string>} ROLE_NAME_TO_KEY_MAP
 */
export const ROLE_NAME_TO_KEY_MAP = {
  laskupohjaAdmin: "isLaskupohjaAdmin", // typeId 1; DB calls it isTarjousAdmin — but Jerry's "TarjousAdmin" is typeId 5 (fb#418)
  asiakasAdmin: "isAsiakasAdmin",
  laskuAdmin: "isLaskuAdmin",
  asiakasEditor: "isAsiakasEditor",
  pumppari: "isPumppari",
  tyosuhteessa: "isTyösuhteessa",
  // Backward-compat alias for legacy v1 JWTs that still carry the typo
  // "typisSuhteessa" string in their roles[] array. Safe to drop once all
  // pre-2026-05-13 tokens have expired (i.e., 7 days after production
  // production cycles to v2 short-shape — reminder routine 2026-06-13).
  typisSuhteessa: "isTyösuhteessa",
  attachmentHandler: "isAttachmentHandler",
  keikkaHandler: "isKeikkaHandler",
  sijaintiHandler: "isSijaintiHandler",
  vehicleHandler: "isVehicleHandler",
  tuoteHandler: "isTuoteHandler",
  lomaseurannassa: "isLomaseurannassa",
  assignee: "isAssignee",
  keikkaViewer: "isKeikkaViewer",
  betoniHandler: "isBetoniHandler",
  betoniViewer: "isBetoniViewer",
  asiakasOwner: "isAsiakasOwner",
  hrAdmin: "isHRAdmin",
};

const ALL_FALSE_ROLES = Object.freeze(
  Object.fromEntries(Object.values(ROLE_NAME_TO_KEY_MAP).map((k) => [k, false])),
);

/**
 * Build a fresh `companyRoles` flag object from a list of role name strings.
 *
 * Pure function. Driven entirely by ROLE_NAME_TO_KEY_MAP so adding a role to
 * the map immediately wires it through to all consumers (FE + BE).
 * Unknown role names are silently ignored.
 *
 * @param {string[]|null|undefined} roles - Role names (e.g. ["asiakasAdmin", "keikkaHandler"])
 * @returns {Object.<string, boolean>} Flag object: { isAsiakasAdmin: bool, isKeikkaHandler: bool, ... }
 */
export function buildCompanyRoles(roles) {
  const out = { ...ALL_FALSE_ROLES };
  if (!Array.isArray(roles)) return out;
  for (const name of roles) {
    const key = ROLE_NAME_TO_KEY_MAP[name];
    if (key) out[key] = true;
  }
  return out;
}

/**
 * Canonical mapping: asiakasPersonSettingTypeId → JWT codec role name string.
 *
 * This is the single source of truth for the role-name strings that appear
 * in the JWT `asiakasesWithTypes[].roles` array (legacy shape) and that the
 * v2 short-shape codec encodes/decodes via `roles.r` typeId arrays.
 *
 * Note: typeId 9 is `tyosuhteessa` (Finnish: työsuhteessa, "in employment").
 * Renamed from the typo `typisSuhteessa` on 2026-05-13. The typo lives on
 * as a backward-compat alias in ROLE_NAME_TO_KEY_MAP for legacy v1 JWTs
 * still in flight; can be dropped after token TTL drain (~2026-06-20).
 * TypeIds 20/21 (pumppu*) are OBSOLETE but kept for legacy data round-trip.
 *
 * @constant {Object.<number, string>}
 */
export const ROLE_NAME_BY_TYPEID = Object.freeze({
  1: "laskupohjaAdmin", // DB describes it as isTarjousAdmin; Jerry's "TarjousAdmin" is 5, not this (fb#418)
  2: "asiakasAdmin",
  5: "laskuAdmin",
  6: "asiakasEditor",
  8: "pumppari",
  9: "tyosuhteessa",
  10: "attachmentHandler",
  11: "keikkaHandler",
  12: "sijaintiHandler",
  13: "vehicleHandler",
  14: "tuoteHandler",
  15: "lomaseurannassa",
  16: "assignee",
  17: "keikkaViewer",
  18: "betoniHandler",
  19: "betoniViewer",
  20: "pumppuHandler",
  21: "pumppuViewer",
  22: "asiakasOwner",
  24: "hrAdmin",
});

/**
 * Inverse of ROLE_NAME_BY_TYPEID, auto-derived to prevent drift.
 * @constant {Object.<string, number>}
 */
export const ROLE_TYPEID_BY_NAME = Object.freeze(
  Object.fromEntries(
    Object.entries(ROLE_NAME_BY_TYPEID).map(([id, name]) => [name, Number(id)]),
  ),
);

/**
 * All known role typeIds, ascending. Used by the JWT codec to fail-closed
 * on tokens containing unrecognised typeIds. Frozen array (not Set) so
 * cross-realm equality holds for the ESM/CJS parity test.
 * @constant {readonly number[]}
 */
export const KNOWN_ROLE_TYPEIDS = Object.freeze(
  Object.keys(ROLE_NAME_BY_TYPEID).map(Number).sort((a, b) => a - b),
);

/**
 * Convert role-name strings → typeIds for compact JWT encoding.
 * Unknown names are dropped silently (compress side trusts the producer).
 *
 * @param {string[]|null|undefined} names
 * @returns {number[]} typeIds, deduped and ascending
 */
export function rolesNamesToTypeIds(names) {
  if (!Array.isArray(names)) return [];
  const ids = [];
  for (const name of names) {
    const id = ROLE_TYPEID_BY_NAME[name];
    if (id !== undefined) ids.push(id);
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Convert typeIds → role-name strings during JWT decode.
 *
 * @param {number[]|null|undefined} typeIds
 * @param {object} [options]
 * @param {"throw"|"skip"} [options.onUnknown="throw"] - Behaviour when a typeId
 *   is not in KNOWN_ROLE_TYPEIDS. "throw" rejects the whole payload (BE/fail-closed).
 *   "skip" drops the unknown id and continues (FE/forgiving).
 * @returns {string[]} role names
 * @throws {Error} when onUnknown="throw" and an unknown typeId is encountered
 */
export function roleTypeIdsToNames(typeIds, { onUnknown = "throw" } = {}) {
  if (!Array.isArray(typeIds)) return [];
  const names = [];
  for (const id of typeIds) {
    const name = ROLE_NAME_BY_TYPEID[id];
    if (name !== undefined) {
      names.push(name);
    } else if (onUnknown === "throw") {
      throw new Error(`Unknown role typeId: ${id}`);
    }
    // onUnknown === "skip": silently drop
  }
  return names;
}

/**
 * Reverse mapping: Type ID to role name
 * Useful for debugging and display purposes
 *
 * @constant {Object.<number, string>} TYPE_ID_TO_ROLE_NAME
 */
export const TYPE_ID_TO_ROLE_NAME = {
  1: "Laskupohja Admin",
  2: "Asiakas Admin",
  6: "Asiakas Editor",
  5: "Lasku Admin",
  8: "Pumppari",
  9: "Työsuhteessa",
  10: "Attachment Handler",
  11: "Keikka Handler",
  12: "Sijainti Handler",
  13: "Vehicle Handler",
  14: "Tuote Handler",
  15: "Lomaseurannassa",
  16: "Assignee",
  17: "Keikka Viewer",
  18: "Betoni Handler",
  19: "Betoni Viewer",
  20: "Pumppu Handler (OBSOLETE)",
  21: "Pumppu Viewer (OBSOLETE)",
  22: "Asiakas Owner",
  24: "HR Admin",
};

/**
 * Company role type IDs considered admin-level for default company selection and admin access checks.
 *
 * @constant {number[]}
 */
export const ADMIN_COMPANY_ROLE_TYPE_IDS = [1, 2, 6, 8, 11, 12, 13];

/**
 * Company setting type ID for asiakas editor role.
 *
 * @constant {number}
 */
export const ASIAKAS_EDITOR_ROLE_TYPE_ID = 6;

/**
 * Company setting type ID for working-hours feature enablement.
 *
 * @constant {number}
 */
export const ASIAKAS_WORKING_HOURS_ROLE_TYPE_ID = 23;

/**
 * Special company IDs used by access checks.
 *
 * @constant {number}
 */
export const KALLE_URHO_OY_ASIAKAS_ID = 8;

/**
 * MaxBe Oy asiakasId used in shared cross-company access checks.
 *
 * @constant {number}
 */
export const MAXBE_OY_ASIAKAS_ID = 62;

/**
 * Company setting type IDs that grant any admin-level access in asiakasAuthClass.
 *
 * @constant {number[]}
 */
export const ASIAKAS_ANY_ADMIN_ROLE_TYPE_IDS = [22, 6, 11, 2, 1];

/**
 * Company setting type IDs that grant any worker-level access in asiakasAuthClass.
 *
 * @constant {number[]}
 */
export const ASIAKAS_ANY_WORKER_ROLE_TYPE_IDS = [8, 6, 11, 9, 16, 2, 1];

/**
 * Company setting type IDs that grant any viewer-level access in asiakasAuthClass.
 *
 * @constant {number[]}
 */
export const ASIAKAS_ANY_VIEWER_ROLE_TYPE_IDS = [3, 4, 7, 17, 19, 21];

/**
 * Company setting type IDs that grant invoice read access.
 *
 * @constant {number[]}
 */
export const ASIAKAS_LASKU_READ_ROLE_TYPE_IDS = [5, 7];

/**
 * Company setting type IDs that grant the right to issue a pumppaus quote
 * request (tarjouspyyntö) on behalf of a company asiakas. Used by
 * GET /api/me/asiakases to scope the Laskutus picker in the betonijerry
 * /tilaa wizard.
 *
 * Superset of admin/editor + invoice + keikka-handler + owner + HR. Includes
 * typeIds 3 and 4 (viewer-class roles present in asiakasPersonSettings data
 * but not yet named in ROLE_NAME_BY_TYPEID — see ASIAKAS_ANY_VIEWER_ROLE_TYPE_IDS).
 *
 * Spec: docs/superpowers/specs/2026-05-15-betonijerry-laskutus-permission-filter-design.md
 *
 * @constant {number[]}
 */
export const ASIAKAS_REQUEST_OFFER_ROLE_TYPE_IDS = [1, 2, 3, 4, 5, 6, 7, 11, 22, 24];

/**
 * Global person setting type IDs that indicate any admin rights in personSettingsClass.
 *
 * @constant {number[]}
 */
export const PERSON_ANY_ADMIN_SETTING_TYPE_IDS = [11, 8, 12, 13];

/**
 * Global person setting type IDs used by personSettingsClass.
 *
 * @constant {Object.<string, number>}
 */
export const PERSON_SETTING_TYPE_IDS = {
  DISABLE_ORDER_INFO_SEND: 1,
  ENABLE_MARKETING_EMAIL: 2,
  ALLOW_SHARING: 3,
  LAST_MINUTE_NOTIFICATIONS: 4,
  DEFAULT_PUMPPU_TOIMITTAJA_ASIAKAS_ID: 5,
  DEFAULT_BETONI_TOIMITTAJA_ASIAKAS_ID: 6,
  DEFAULT_LATTIA_TOIMITTAJA_ASIAKAS_ID: 7,
  IS_SYSTEM_ADMIN: 8,
  IS_ROLE_MANAGER: 9,
  IS_HELPER_EDITOR: 10,
  IS_PUMPPU_ADMIN: 11,
  IS_BETONI_ADMIN: 12,
  IS_LATTIA_ADMIN: 13,
  HAS_MULTIPLE_KEIKKAS: 14,
  OLETUS_ADMIN_YRITYS_ID: 15,
  PASSWORD_RESET_TOKEN: 16,
  IS_TUOTE_ADMIN: 17,
  IS_HINNASTO_ADMIN: 18,
  IS_DEVELOPER: 19,
  DEFAULT_PERSON_PVM_STATUS_ID: 20,
  IS_EXTENDED_VIEW: 21,
  REGISTRATION_SESSION: 22,
  NOTIFY_KEIKKA_ADD_REMOVE: 25,
  NOTIFY_KEIKKA_CHANGES: 26,
  NOTIFY_KEIKKA_STATUS: 27,
  NOTIFY_KEIKKA_COMMENTS: 28,
  NOTIFY_KEIKKA_MASTER: 29,
  NOTIFY_ADMIN_ORDER_CREATED: 30,
  NOTIFY_ADMIN_CUSTOMER_CREATED: 31,
  NOTIFY_ADMIN_WORKSITE_CREATED: 32,
  NOTIFY_ADMIN_ORDER_CANCELLED: 33,
  NOTIFY_DAILY_CONFIRMED: 34,
  NOTIFY_ONLY_UNDER_14H: 35,
  IS_GLOBAL_EDITOR: 36,
  NOTIFY_DAY_CONFIRMED: 37,
  HAPTIC_FEEDBACK: 38,
  EULA_ACCEPTANCE: 39,
  TOS_ACCEPTANCE: 40,
  PRIVACY_ACCEPTANCE: 41,
  COOKIES_ACCEPTANCE: 42,
  GLOBAL_USER_CONSENT_LEGACY: 43,
  GLOBAL_USER_CONSENT: 44,
  DEFAULT_URL: 45,
  IS_GLOBAL_SIJAINTI_ADMIN: 46,
  // 47 = Betonijerry TOS, 48 = Betonijerry Privacy (legal; DB-only, not enumerated here).
  IS_GLOBAL_VIEWER: 49,
};

/**
 * Company setting type IDs from the asiakasSettingType table.
 * Maps company-level feature flags and settings to their database IDs.
 *
 * @constant {Object.<string, number>}
 */
export const ASIAKAS_SETTING_TYPE_IDS = {
  HAS_NETVISOR: 2,
  HAS_HENKILOT: 4,
  HAS_SIJAINNIT: 5,
  HAS_AJONEUVOT: 6,
  HAS_TUOTTEET: 7,
  HAS_TOIMITUS: 8,
  HAS_LASKUTUS: 9,
  ALV: 10,
  HAS_TIEDOSTOT: 11,
  HAS_TYO: 12,
  DEFAULT_VEHICLE: 13,
  DEFAULT_DAILY_MESSAGES: 14,
  HAS_ECOFLEET: 15,
  KEIKKA_VALIDOINTI: 16,
  HAS_FENNOA: 17,
  HAS_WEATHER: 18,
  HAS_TRAFFIC: 19,
  USE_PERSON_DATES: 20,
  USE_VEHICLE_DATES: 21,
  USE_TYOMAA_DATES: 22,
  USE_ASIAKAS_DATES: 23,
  HAS_VARASTO: 24,
  MULTI_TENANT_VEHICLE_VISIBILITY: 25,
  BUG_REPORTING: 26,
  HAS_KELI_KAMERAT: 27,
  TUNTIKIRJAUS: 28,
  LOMASEURANTA: 29,
  HAS_OCR: 30,
  HAS_NEWS: 31,
  HAS_ILMOITUSTAULU: 32,
  SHARE_ORDERS_WITH_BETONI: 33,
  HAS_AI: 34,
  HAS_JERRY: 35,
  HAS_BETONI_STORE: 36,
};
