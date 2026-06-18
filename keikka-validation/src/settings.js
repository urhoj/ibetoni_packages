import { getDefaultValidationRulesSettings } from "./validationRuleDefinitions.js";

/**
 * Merge saved validation-rule overrides over the default rule set.
 * Union of keys: every default rule plus every saved rule. Saved values win per rule;
 * saved-only rules are preserved (never dropped).
 */
export function mergeValidationRules(defaultRules, savedRules) {
  const merged = { ...(defaultRules || {}) };
  Object.keys(savedRules || {}).forEach((ruleId) => {
    merged[ruleId] = { ...(defaultRules?.[ruleId] || {}), ...savedRules[ruleId] };
  });
  return merged;
}

/** Single source of truth: the rule registry defaults. */
export function getDefaultValidationRules() {
  return getDefaultValidationRulesSettings();
}
