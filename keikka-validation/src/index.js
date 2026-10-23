const validator = require("./keikkaValidator.js");
const defs = require("./validationRuleDefinitions.js");
const settings = require("./settings.js");
const thresholds = require("./weatherThresholds.js");
const dismissal = require("./dismissal.js");

module.exports = {
  validateKeikka: validator.validateKeikka,
  isMissingAsiakas: validator.isMissingAsiakas,
  UNKNOWN_ASIAKAS_ID: validator.UNKNOWN_ASIAKAS_ID,
  HARKKO_PATTERN: validator.HARKKO_PATTERN,
  VALIDATION_DISMISSED_STEP_LOG_TYPE: dismissal.VALIDATION_DISMISSED_STEP_LOG_TYPE,
  DISMISS_WINDOW_DAYS: dismissal.DISMISS_WINDOW_DAYS,
  getIssueFingerprint: dismissal.getIssueFingerprint,
  buildDismissalData: dismissal.buildDismissalData,
  parseDismissal: dismissal.parseDismissal,
  isOutsideDismissWindow: dismissal.isOutsideDismissWindow,
  PRIORITY_LEVELS: validator.PRIORITY_LEVELS,
  CATEGORIES: validator.CATEGORIES,
  getPriorityName: validator.getPriorityName,
  getPriorityColor: validator.getPriorityColor,
  getCategoryName: validator.getCategoryName,
  VALIDATION_RULE_DEFINITIONS: defs.VALIDATION_RULE_DEFINITIONS,
  PRIORITY_LABELS: defs.PRIORITY_LABELS,
  CATEGORY_LABELS: defs.CATEGORY_LABELS,
  getValidationRulesByCategory: defs.getValidationRulesByCategory,
  getDefaultValidationRulesSettings: defs.getDefaultValidationRulesSettings,
  mergeValidationRules: settings.mergeValidationRules,
  getDefaultValidationRules: settings.getDefaultValidationRules,
  isSevereCold: thresholds.isSevereCold,
  isSevereHot: thresholds.isSevereHot,
  SEVERE_COLD_THRESHOLD: thresholds.SEVERE_COLD_THRESHOLD,
  SEVERE_HOT_THRESHOLD: thresholds.SEVERE_HOT_THRESHOLD,
};
