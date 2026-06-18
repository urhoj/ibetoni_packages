const validator = require("./keikkaValidator.js");
const defs = require("./validationRuleDefinitions.js");
const settings = require("./settings.js");
const thresholds = require("./weatherThresholds.js");

module.exports = {
  validateKeikka: validator.validateKeikka,
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
