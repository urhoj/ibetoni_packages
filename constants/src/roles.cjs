/**
 * Role Mapping Constants (CommonJS version)
 * See roles.js for full documentation
 */

const COMPANY_ROLE_TO_TYPE_ID = {
  isLaskupohjaAdmin: 1,
  isAsiakasAdmin: 2,
  isAsiakasEditor: 6,
  isLaskuAdmin: 5,
  isPumppari: 8,
  isTyösuhteessa: 9,
  isAttachmentHandler: 10,
  isKeikkaHandler: 11,
  isSijaintiHandler: 12,
  isVehicleHandler: 13,
  isTuoteHandler: 14,
  isLomaseurannassa: 15,
  isAssignee: 16,
  isKeikkaViewer: 17,
  isBetoniHandler: 18,
  isBetoniViewer: 19,
  isPumppuHandler: 20, // OBSOLETE
  isPumppuViewer: 21, // OBSOLETE
  isAsiakasOwner: 22,
  isHRAdmin: 24,
};

const ROLE_NAME_TO_KEY_MAP = {
  laskupohjaAdmin: "isLaskupohjaAdmin",
  asiakasAdmin: "isAsiakasAdmin",
  laskuAdmin: "isLaskuAdmin",
  asiakasEditor: "isAsiakasEditor",
  pumppari: "isPumppari",
  tyosuhteessa: "isTyösuhteessa",
  // Backward-compat alias for legacy v1 JWTs with the old typo. Drop after
  // token TTL drain (~2026-06-20). See roles.js comment for details.
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

function buildCompanyRoles(roles) {
  const out = { ...ALL_FALSE_ROLES };
  if (!Array.isArray(roles)) return out;
  for (const name of roles) {
    const key = ROLE_NAME_TO_KEY_MAP[name];
    if (key) out[key] = true;
  }
  return out;
}

const ROLE_NAME_BY_TYPEID = Object.freeze({
  1: "laskupohjaAdmin",
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

const ROLE_TYPEID_BY_NAME = Object.freeze(
  Object.fromEntries(
    Object.entries(ROLE_NAME_BY_TYPEID).map(([id, name]) => [name, Number(id)]),
  ),
);

const KNOWN_ROLE_TYPEIDS = Object.freeze(
  Object.keys(ROLE_NAME_BY_TYPEID).map(Number).sort((a, b) => a - b),
);

function rolesNamesToTypeIds(names) {
  if (!Array.isArray(names)) return [];
  const ids = [];
  for (const name of names) {
    const id = ROLE_TYPEID_BY_NAME[name];
    if (id !== undefined) ids.push(id);
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

function roleTypeIdsToNames(typeIds, { onUnknown = "throw" } = {}) {
  if (!Array.isArray(typeIds)) return [];
  const names = [];
  for (const id of typeIds) {
    const name = ROLE_NAME_BY_TYPEID[id];
    if (name !== undefined) {
      names.push(name);
    } else if (onUnknown === "throw") {
      throw new Error(`Unknown role typeId: ${id}`);
    }
  }
  return names;
}

const TYPE_ID_TO_ROLE_NAME = {
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

const ADMIN_COMPANY_ROLE_TYPE_IDS = [1, 2, 6, 8, 11, 12, 13];
const ASIAKAS_EDITOR_ROLE_TYPE_ID = 6;
const ASIAKAS_WORKING_HOURS_ROLE_TYPE_ID = 23;
const KALLE_URHO_OY_ASIAKAS_ID = 8;
const MAXBE_OY_ASIAKAS_ID = 62;
const ASIAKAS_ANY_ADMIN_ROLE_TYPE_IDS = [22, 6, 11, 2, 1];
const ASIAKAS_ANY_WORKER_ROLE_TYPE_IDS = [8, 6, 11, 9, 16, 2, 1];
const ASIAKAS_ANY_VIEWER_ROLE_TYPE_IDS = [3, 4, 7, 17, 19, 21];
const ASIAKAS_LASKU_READ_ROLE_TYPE_IDS = [5, 7];
const ASIAKAS_REQUEST_OFFER_ROLE_TYPE_IDS = [1, 2, 3, 4, 5, 6, 7, 11, 22, 24];
const PERSON_ANY_ADMIN_SETTING_TYPE_IDS = [11, 8, 12, 13];
const PERSON_SETTING_TYPE_IDS = {
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
};

const ASIAKAS_SETTING_TYPE_IDS = {
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

module.exports = {
  COMPANY_ROLE_TO_TYPE_ID,
  ROLE_NAME_TO_KEY_MAP,
  TYPE_ID_TO_ROLE_NAME,
  ROLE_NAME_BY_TYPEID,
  ROLE_TYPEID_BY_NAME,
  KNOWN_ROLE_TYPEIDS,
  rolesNamesToTypeIds,
  roleTypeIdsToNames,
  buildCompanyRoles,
  ADMIN_COMPANY_ROLE_TYPE_IDS,
  ASIAKAS_EDITOR_ROLE_TYPE_ID,
  ASIAKAS_WORKING_HOURS_ROLE_TYPE_ID,
  KALLE_URHO_OY_ASIAKAS_ID,
  MAXBE_OY_ASIAKAS_ID,
  ASIAKAS_ANY_ADMIN_ROLE_TYPE_IDS,
  ASIAKAS_ANY_WORKER_ROLE_TYPE_IDS,
  ASIAKAS_ANY_VIEWER_ROLE_TYPE_IDS,
  ASIAKAS_LASKU_READ_ROLE_TYPE_IDS,
  ASIAKAS_REQUEST_OFFER_ROLE_TYPE_IDS,
  PERSON_ANY_ADMIN_SETTING_TYPE_IDS,
  PERSON_SETTING_TYPE_IDS,
  ASIAKAS_SETTING_TYPE_IDS,
};
