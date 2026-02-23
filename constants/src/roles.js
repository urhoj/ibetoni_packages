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
 * Reverse mapping: Type ID to role name
 * Useful for debugging and display purposes
 *
 * @constant {Object.<number, string>} TYPE_ID_TO_ROLE_NAME
 */
export const TYPE_ID_TO_ROLE_NAME = {
  1: 'Laskupohja Admin',
  2: 'Asiakas Admin',
  5: 'Lasku Admin',
  8: 'Pumppari',
  9: 'Työsuhteessa',
  10: 'Attachment Handler',
  11: 'Keikka Handler',
  12: 'Sijainti Handler',
  13: 'Vehicle Handler',
  14: 'Tuote Handler',
  15: 'Lomaseurannassa',
  16: 'Assignee',
  17: 'Keikka Viewer',
  18: 'Betoni Handler',
  19: 'Betoni Viewer',
  20: 'Pumppu Handler (OBSOLETE)',
  21: 'Pumppu Viewer (OBSOLETE)',
  22: 'Asiakas Owner',
  24: 'HR Admin',
};
