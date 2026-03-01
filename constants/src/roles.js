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
  /** Laskupohja Admin - Invoice template administrator */
  isLaskupohjaAdmin: 1,

  /** Asiakas Admin - Customer administrator */
  isAsiakasAdmin: 2,

  /** Asiakas Editor - Customer editor */
  isAsiakasEditor: 6,

  /** Lasku Admin - Invoice administrator */
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
 * Used by deriveCompanyRoles to convert role arrays to boolean flags.
 *
 * @constant {Object.<string, string>} ROLE_NAME_TO_KEY_MAP
 */
export const ROLE_NAME_TO_KEY_MAP = {
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
