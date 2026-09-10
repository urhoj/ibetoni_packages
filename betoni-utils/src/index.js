/**
 * @ibetoni/betoni-utils
 *
 * Shared betoni (concrete) utilities for betoni.online
 * Provides string formatting, validation, and utility functions for betoni specifications
 *
 * @module @ibetoni/betoni-utils
 */

const { betoni_getString, betoni_getString_noAttr, betoni_getStrings, betoni_getComprehensiveString, betoni_getComprehensiveString_noAttr, removeEiTietoaFromBetoniString } = require("./betoniStringBuilder.js");
const { betoni_isComplete } = require("./betoniValidator.js");
const { RasitusLuokatArr, WEATHER_RESISTANT_CLASSES } = require("./constants.js");
const { formatPersonName } = require("./personUtils.js");
const { isEmail, parseMultipleEmails, validateMultipleEmails } = require("./emailUtils.js");
const { getText, HAVERSINE_DISTANCE_M } = require("./ecofleetUtils.js");
const { parseHelsinkiLocal, helsinkiOffsetMinutes } = require("./helsinkiTime.js");
const { FLEET_PROVIDERS, DEFAULT_FLEET_PROVIDER, MAPON_STATE_TO_ENGINESTATE, normalizeProvider, prefixObjectId, maponUnitToNode, isEngineOn } = require("./fleetProviders.js");

module.exports = {
  betoni_getString,
  betoni_getString_noAttr,
  betoni_getStrings,
  betoni_getComprehensiveString,
  betoni_getComprehensiveString_noAttr,
  removeEiTietoaFromBetoniString,
  betoni_isComplete,
  RasitusLuokatArr,
  WEATHER_RESISTANT_CLASSES,
  formatPersonName,
  isEmail,
  parseMultipleEmails,
  validateMultipleEmails,
  getText,
  HAVERSINE_DISTANCE_M,
  parseHelsinkiLocal,
  helsinkiOffsetMinutes,
  FLEET_PROVIDERS,
  DEFAULT_FLEET_PROVIDER,
  MAPON_STATE_TO_ENGINESTATE,
  normalizeProvider,
  prefixObjectId,
  maponUnitToNode,
  isEngineOn,
};
