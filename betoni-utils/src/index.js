/**
 * @ibetoni/betoni-utils
 *
 * Shared betoni (concrete) utilities for betoni.online
 * Provides string formatting, validation, and utility functions for betoni specifications
 *
 * @module @ibetoni/betoni-utils
 */

// Export all string building functions
export {
  betoni_getString,
  betoni_getString_noAttr,
  betoni_getStrings,
  betoni_getComprehensiveString,
  betoni_getComprehensiveString_noAttr,
  removeEiTietoaFromBetoniString,
} from "./betoniStringBuilder.js";

// Export validation functions
export { betoni_isComplete } from "./betoniValidator.js";

// Export constants
export { RasitusLuokatArr, WEATHER_RESISTANT_CLASSES } from "./constants.js";
