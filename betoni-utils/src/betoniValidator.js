/**
 * @ibetoni/betoni-utils - Betoni Validator
 *
 * Validation functions for betoni (concrete) specifications
 *
 * @module betoniValidator
 */

/**
 * Check if betoni specification is complete
 * Validates that all required betoni properties have been selected
 *
 * @param {Object} betoni - Betoni object to validate
 * @returns {{isComplete: boolean, reason: string}} Validation result with reason if incomplete
 *
 * @example
 * const result = betoni_isComplete(betoni);
 * if (!result.isComplete) {
 *   console.log("Incomplete:", result.reason);
 * }
 */
function betoni_isComplete(betoni) {
  if (!betoni) return { isComplete: false, reason: "Virhe: Betonia ei ole" };

  if (!betoni.laatuId && !betoni.laatu?.laatuId)
    return { isComplete: false, reason: "Laatua ei ole valittu" };

  if (!betoni.raeKokoId && !betoni.raeKoko?.raeKokoId)
    return { isComplete: false, reason: "Raekokoa ei ole valittu" };

  if (!betoni.lujuusId && !betoni.lujuus?.lujuusId)
    return { isComplete: false, reason: "Lujuutta ei ole valittu" };

  if (!betoni.notkeusId && !betoni.notkeus?.notkeusId)
    return { isComplete: false, reason: "Notkeutta ei ole valittu" };

  if (!betoni.kayttoIkaId && !betoni.kayttoIka?.kayttoIkaId)
    return { isComplete: false, reason: "Käyttöikää ei ole valittu" };

  return { isComplete: true, reason: "" };
}

export { betoni_isComplete };
