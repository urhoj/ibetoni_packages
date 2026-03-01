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
  typisSuhteessa: "isTyösuhteessa",
  attachmentHandler: "isAttachmentHandler",
  keikkaHandler: "isKeikkaHandler",
  sijaintiHandler: "isSijaintiHandler",
  vehicleHandler: "isVehicleHandler",
  tuoteHandler: "isTuoteHandler",
  lomaseurannassa: "isLomaseurannassa",
  assignee: "isAssignee",
  keikkaViewer: "isKeikkaViewer",
  asiakasOwner: "isAsiakasOwner",
  hrAdmin: "isHRAdmin",
};

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
const PERSON_ANY_ADMIN_SETTING_TYPE_IDS = [11, 8, 12, 13];
const PERSON_SETTING_TYPE_IDS = {
  DISABLE_ORDER_INFO_SEND: 1,
  ENABLE_MARKETING_EMAIL: 2,
  ALLOW_SHARING: 3,
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
  IS_TUOTE_ADMIN: 17,
  IS_HINNASTO_ADMIN: 18,
  IS_DEVELOPER: 19,
  DEFAULT_PERSON_PVM_STATUS_ID: 20,
  IS_EXTENDED_VIEW: 21,
  NOTIFY_KEIKKA_ADD_REMOVE: 25,
  NOTIFY_KEIKKA_CHANGES: 26,
  NOTIFY_KEIKKA_STATUS: 27,
  NOTIFY_KEIKKA_COMMENTS: 28,
  NOTIFY_KEIKKA_MASTER: 29,
  NOTIFY_ADMIN_ORDER_CREATED: 30,
  NOTIFY_ADMIN_CUSTOMER_CREATED: 31,
  NOTIFY_ADMIN_WORKSITE_CREATED: 32,
  NOTIFY_ADMIN_ORDER_CANCELLED: 33,
  HAPTIC_FEEDBACK: 38,
  GLOBAL_USER_CONSENT: 44,
  DEFAULT_URL: 45,
};

module.exports = {
  COMPANY_ROLE_TO_TYPE_ID,
  ROLE_NAME_TO_KEY_MAP,
  TYPE_ID_TO_ROLE_NAME,
  ADMIN_COMPANY_ROLE_TYPE_IDS,
  ASIAKAS_EDITOR_ROLE_TYPE_ID,
  ASIAKAS_WORKING_HOURS_ROLE_TYPE_ID,
  KALLE_URHO_OY_ASIAKAS_ID,
  MAXBE_OY_ASIAKAS_ID,
  ASIAKAS_ANY_ADMIN_ROLE_TYPE_IDS,
  ASIAKAS_ANY_WORKER_ROLE_TYPE_IDS,
  ASIAKAS_ANY_VIEWER_ROLE_TYPE_IDS,
  ASIAKAS_LASKU_READ_ROLE_TYPE_IDS,
  PERSON_ANY_ADMIN_SETTING_TYPE_IDS,
  PERSON_SETTING_TYPE_IDS,
};
