/**
 * @ibetoni/betoni-utils - Betoni String Builder
 *
 * Core functions for building standardized betoni (concrete) description strings.
 * Handles various betoni object formats from database, frontend classes, and APIs.
 *
 * @module betoniStringBuilder
 */

const { WEATHER_RESISTANT_CLASSES } = require("./constants.js");

/**
 * Helper function to remove "Ei tietoa" (No information) text from betoni strings
 * @param {string} betoniString - The betoni string to clean
 * @returns {string} Cleaned string with no "Ei tietoa" text or undefined
 */
function removeEiTietoaFromBetoniString(betoniString) {
  if (!betoniString) return "";

  // Use a single regex pattern for better performance
  const cleanString = betoniString
    .replace(/(?:Ei tietoa|ei tietoa|undefined)/g, "")
    // Handle multiple spaces that might result from removed text
    .replace(/\s+/g, " ")
    .trim();

  return cleanString;
}

/**
 * The one place rasitusluokat are read (fb#2848). Sources differ: nested
 * `rasitus.rasitusluokat` (frontend class) or flat `rasitusluokat` (DB row),
 * each a comma string, an array, or `{rasitusluokat}`. Takes the first NON-EMPTY
 * source, so an empty nested array does not hide a flat "XC3".
 *
 * Käyttöikä is printed only when this is non-empty (X0 counts). Every line
 * carries one (50v is the default), so on its own it says nothing: an order
 * with no concrete info read just "50v" on /oma.
 * @param {Object} betoni
 * @returns {string[]} trimmed, sorted classes without empty/null/"Ei tietoa"
 */
function getRasitusArray(betoni) {
  const toArray = (v) => {
    if (v?.rasitusluokat) v = v.rasitusluokat;
    if (typeof v === "string") v = v.split(",");
    if (!Array.isArray(v)) return [];
    return v
      .map((r) => (typeof r === "string" ? r.trim() : ""))
      .filter((r) => r && !/ei tietoa/i.test(r));
  };
  const nested = toArray(betoni.rasitus?.rasitusluokat);
  return (nested.length ? nested : toArray(betoni.rasitusluokat)).sort();
}

/** @param {string[]} rasitusArray - from getRasitusArray */
function isWeatherResistant(rasitusArray) {
  return rasitusArray.some((r) => WEATHER_RESISTANT_CLASSES.includes(r.toUpperCase()));
}

/**
 * Get an array of all betoni string components including attributes
 * @param {Object} betoni - Betoni object
 * @param {Object} options - Optional settings
 * @param {boolean} options.includeWeatherResistant - If true, prepends "Säänkestävä" when applicable
 * @returns {string[]} Array of string components
 */
function betoni_getStrings(betoni, options = {}) {
  if (!betoni) return null;
  const { includeWeatherResistant = false } = options;
  const betoniStrings = [];

  const weatherPrefix =
    includeWeatherResistant && isWeatherResistant(getRasitusArray(betoni)) ? "Säänkestävä " : "";

  betoniStrings.push(weatherPrefix + betoni_getString_noAttr(betoni));
  if (betoni.betoniComment) betoniStrings.push(betoni.betoniComment);
  const attrs = betoni.attr?.attr || [];
  attrs.forEach((attr) => {
    const attrString =
      attr.attrNimike + (attr.keikkaBetoniAttrComment ? ": " + attr.keikkaBetoniAttrComment : "");
    if (attrString) betoniStrings.push(attrString);
  });
  return betoniStrings;
}

/**
 * Main betoni string formatting function
 * Returns a formatted string for one or more betoni items.
 * If an array is passed, returns a comprehensive string for all items joined by ' + '.
 *
 * @param {Object|Object[]} betoni - A betoni object or array of betoni objects
 * @param {boolean} noAttr - If true, excludes attributes from the string
 * @param {boolean} comprehensive - If true, uses comprehensive format with volume and additional details
 * @returns {string} Formatted betoni string
 */
function betoni_getString(betoni, noAttr = false, comprehensive = false) {
  if (!betoni) return "";

  // If array, join all items
  if (Array.isArray(betoni)) {
    return betoni
      .map((b) => betoni_getString(b, noAttr, comprehensive))
      .filter((s) => s && s !== "")
      .join(" + ");
  }

  // Use comprehensive format if requested
  if (comprehensive) {
    return noAttr
      ? betoni_getComprehensiveString_noAttr(betoni)
      : betoni_getComprehensiveString(betoni);
  }

  // Get the base concrete string
  const baseString = betoni_getString_noAttr(betoni);
  // Attributes: named ones only, joined by position (unsaved quick-edit attrs
  // have no keikkaBetoniAttrId to compare, fb#2856)
  const attrString = noAttr
    ? ""
    : (betoni.attr?.attr || [])
        .filter((attr) => attr.attrNimike?.trim() && !attr.attrNimike.includes("Ei tietoa"))
        .map(
          (attr) =>
            attr.attrNimike.trim() +
            (attr.keikkaBetoniAttrComment ? ": " + attr.keikkaBetoniAttrComment : "")
        )
        .join(", ");

  // Combine strings and clean up. No minimum length: a lone "S3" or "16mm" is
  // real information, and a bare käyttöikä can no longer occur (see getRasitusArray).
  return removeEiTietoaFromBetoniString([baseString, attrString].filter((s) => s).join(" "));
}

/**
 * Get standard betoni string without attributes
 * Format: "Laatutyyppi isNopea raeKoko lujuus notkeus rasitusluokat käyttöikä"
 * (käyttöikä only alongside a rasitusluokka, see getRasitusArray)
 * Example: "Lattiabetoni hieno 16mm C25/30 S2", "Rakennebetoni 16mm C30/37 S3 XC3,XF1 50v"
 *
 * @param {Object} betoni - Betoni object with various format support
 * @returns {string} Formatted betoni string without attributes
 */
function betoni_getString_noAttr(betoni) {
  if (!betoni) return "";

  const notkeus =
    (
      betoni.notkeus?.notkeusSelite ||
      betoni.notkeus?.notkeusString ||
      betoni.notkeusSelite
    )?.trim() || "";
  const kayttoIka =
    (
      betoni.kayttoIka?.kayttoIkaSelite ||
      betoni.kayttoIka?.kayttoIkaString ||
      betoni.kayttoIkaSelite
    )?.trim() || "";
  const raeKoko =
    (
      betoni.raeKoko?.raeKokoSelite ||
      betoni.raeKoko?.raeKokoString ||
      betoni.raeKokoSelite
    )?.trim() || "";

  const rasitus = getRasitusArray(betoni).join(",");
  // Define properties to extract and join
  const parts = [
    (betoni.laatu?.laatuNimike || betoni.laatu?.nimike || betoni.laatuNimike)?.trim() || "",
    betoni.isNopea ? "nopea" : "",
    raeKoko,
    (betoni.lujuus?.lujuusSelite || betoni.lujuus?.lujuusString || betoni.lujuusSelite)?.trim() ||
      "",
    notkeus,
    rasitus,
    rasitus ? kayttoIka : "",
  ];

  // Join non-empty parts with a single space
  const result = parts.filter((part) => part).join(" ");

  return removeEiTietoaFromBetoniString(result);
}

/**
 * Get comprehensive betoni string with volume, weather resistance, and attributes
 * Format: "Säänkestävä 2m³ Nopea Lattiabetoni hieno 16mm C25/30 S2 XF1,XC3 50v Lisä1,Lisä2 Comment"
 * (käyttöikä only alongside a rasitusluokka, see getRasitusArray)
 *
 * @param {Object} betoni - Betoni object
 * @returns {string} Comprehensive formatted betoni string with all details
 */
function betoni_getComprehensiveString(betoni) {
  if (!betoni) return "";

  const parts = [];
  const rasitusArray = getRasitusArray(betoni);

  // Add weather resistance indicator first if applicable
  if (isWeatherResistant(rasitusArray)) {
    parts.push("Säänkestävä");
  }

  // Add volume with m³ unit
  if (betoni.m3) {
    parts.push(`${betoni.m3}m³`);
  }

  // Add speed indicator
  if (betoni.isNopea) {
    parts.push("Nopea");
  }

  // Add quality/type
  const laatu = betoni.laatu?.laatuNimike || betoni.laatu?.nimike || betoni.laatuNimike;
  if (laatu && laatu.trim() && !laatu.includes("Ei tietoa")) {
    parts.push(laatu.trim());
  }

  // Add aggregate size
  const raeKoko =
    betoni.raeKoko?.raeKokoSelite || betoni.raeKoko?.raeKokoString || betoni.raeKokoSelite;
  if (raeKoko && raeKoko.trim() && !raeKoko.includes("Ei tietoa")) {
    parts.push(raeKoko.trim());
  }

  // Add strength class
  const lujuus = betoni.lujuus?.lujuusSelite || betoni.lujuus?.lujuusString || betoni.lujuusSelite;
  if (lujuus && lujuus.trim() && !lujuus.includes("Ei tietoa")) {
    parts.push(lujuus.trim());
  }

  // Add workability/consistency
  const notkeus =
    betoni.notkeus?.notkeusSelite || betoni.notkeus?.notkeusString || betoni.notkeusSelite;
  if (notkeus && notkeus.trim() && !notkeus.includes("Ei tietoa")) {
    parts.push(notkeus.trim());
  }

  // Add exposure classes, and service life only alongside them (see getRasitusArray)
  if (rasitusArray.length) {
    parts.push(rasitusArray.join(","));
    const kayttoIka =
      betoni.kayttoIka?.kayttoIkaSelite ||
      betoni.kayttoIka?.kayttoIkaString ||
      betoni.kayttoIkaSelite;
    if (kayttoIka && kayttoIka.trim() && !kayttoIka.includes("Ei tietoa")) {
      parts.push(kayttoIka.trim());
    }
  }

  // Add additives (Lisät)
  const attrs = betoni.attr?.attr || [];
  const attrNames = attrs
    .map((attr) => attr.attrNimike)
    .filter((name) => name && name.trim() && !name.includes("Ei tietoa"));
  if (attrNames.length > 0) {
    parts.push(attrNames.join(","));
  }

  // Add additional comments
  if (
    betoni.betoniComment &&
    betoni.betoniComment.trim() &&
    !betoni.betoniComment.includes("Ei tietoa")
  ) {
    parts.push(betoni.betoniComment.trim());
  }

  return parts.filter((part) => part && part !== "").join(" ");
}

/**
 * Get comprehensive betoni string without attributes
 * Similar to betoni_getComprehensiveString but excludes attributes
 *
 * @param {Object} betoni - Betoni object
 * @param {boolean} excludeVolume - If true, excludes volume (m³) from the string
 * @returns {string} Comprehensive formatted betoni string without attributes
 */
function betoni_getComprehensiveString_noAttr(betoni, excludeVolume = false) {
  if (!betoni) return "";

  const parts = [];

  // Add volume with m³ unit first (unless excluded)
  if (!excludeVolume && betoni.m3) {
    parts.push(`${betoni.m3}m³`);
  }

  const rasitusArray = getRasitusArray(betoni);

  // Add weather resistance indicator if applicable
  if (isWeatherResistant(rasitusArray)) {
    parts.push("Säänkestävä");
  }

  // Add speed indicator
  if (betoni.isNopea) {
    parts.push("Nopea");
  }

  // Add quality/type
  const laatu = betoni.laatu?.laatuNimike || betoni.laatu?.nimike || betoni.laatuNimike;
  if (laatu && laatu.trim() && !laatu.includes("Ei tietoa")) {
    parts.push(laatu.trim());
  }

  // Add aggregate size
  const raeKoko =
    betoni.raeKoko?.raeKokoSelite || betoni.raeKoko?.raeKokoString || betoni.raeKokoSelite;
  if (raeKoko && raeKoko.trim() && !raeKoko.includes("Ei tietoa")) {
    parts.push(raeKoko.trim());
  }

  // Add strength class
  const lujuus = betoni.lujuus?.lujuusSelite || betoni.lujuus?.lujuusString || betoni.lujuusSelite;
  if (lujuus && lujuus.trim() && !lujuus.includes("Ei tietoa")) {
    parts.push(lujuus.trim());
  }

  // Add workability/consistency
  const notkeus =
    betoni.notkeus?.notkeusSelite || betoni.notkeus?.notkeusString || betoni.notkeusSelite;
  if (notkeus && notkeus.trim() && !notkeus.includes("Ei tietoa")) {
    parts.push(notkeus.trim());
  }

  // Add exposure classes, and service life only alongside them (see getRasitusArray)
  if (rasitusArray.length) {
    parts.push(rasitusArray.join(","));
    const kayttoIka =
      betoni.kayttoIka?.kayttoIkaSelite ||
      betoni.kayttoIka?.kayttoIkaString ||
      betoni.kayttoIkaSelite;
    if (kayttoIka && kayttoIka.trim() && !kayttoIka.includes("Ei tietoa")) {
      parts.push(kayttoIka.trim());
    }
  }

  return parts.filter((part) => part && part !== "").join(" ");
}

module.exports = {
  removeEiTietoaFromBetoniString,
  betoni_getStrings,
  betoni_getString,
  betoni_getString_noAttr,
  betoni_getComprehensiveString,
  betoni_getComprehensiveString_noAttr,
};
