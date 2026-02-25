/**
 * Role Mapping Constants (CommonJS version)
 * See roles.js for full documentation
 */

const COMPANY_ROLE_TO_TYPE_ID = {
  isLaskupohjaAdmin: 1,
  isAsiakasAdmin: 2,
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

module.exports = {
  COMPANY_ROLE_TO_TYPE_ID,
  ROLE_NAME_TO_KEY_MAP,
  TYPE_ID_TO_ROLE_NAME,
};
