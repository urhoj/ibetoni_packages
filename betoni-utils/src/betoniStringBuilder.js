/**
 * @ibetoni/betoni-utils - Betoni String Builder
 *
 * Core functions for building standardized betoni (concrete) description strings.
 * Handles various betoni object formats from database, frontend classes, and APIs.
 *
 * @module betoniStringBuilder
 */

import { WEATHER_RESISTANT_CLASSES } from "./constants.js";

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

  // Check weather resistance if requested
  let weatherPrefix = "";
  if (includeWeatherResistant) {
    const rasitusLuokat = betoni.rasitus?.rasitusluokat || betoni.rasitusluokat;
    if (rasitusLuokat) {
      let rasitusArray = [];
      if (typeof rasitusLuokat === "string") {
        rasitusArray = rasitusLuokat.split(",").map((r) => r.trim().toUpperCase());
      } else if (Array.isArray(rasitusLuokat)) {
        rasitusArray = rasitusLuokat.map((r) => r.trim().toUpperCase());
      }
      if (rasitusArray.some((r) => WEATHER_RESISTANT_CLASSES.includes(r))) {
        weatherPrefix = "Säänkestävä ";
      }
    }
  }

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
  // Extract attributes using standardized nested structure
  const attrs = betoni.attr?.attr || [];
  let attrString = "";
  if (!noAttr) {
    try {
      attrs.forEach((attr) => {
        if (attr.attrNimike) attrString += attr.attrNimike;
        if (attr.keikkaBetoniAttrComment) attrString += ": " + attr.keikkaBetoniAttrComment;
        // add comma if not last
        if (attr.keikkaBetoniAttrId !== attrs[attrs.length - 1].keikkaBetoniAttrId)
          attrString += ", ";
      });
    } catch (e) {
      console.error("Error processing betoni attributes:", e);
    }
  }

  // Combine strings, clean up, and validate length
  const combinedString = removeEiTietoaFromBetoniString(
    [baseString, attrString].filter((s) => s).join(" ")
  );
  const a = combinedString.length > 4 ? combinedString : "";
  return a;
}

/**
 * Get standard betoni string without attributes
 * Format: "Laatutyyppi isNopea raeKoko lujuus notkeus rasitusluokat käyttöikä"
 * Example: "Lattiabetoni hieno 16mm C25/30 S2"
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

  let rasitusLuokat = betoni.rasitus?.rasitusluokat || betoni.rasitusluokat || [];
  // if rasitusluokat is string, convert to array and sort
  if (typeof rasitusLuokat === "string") {
    rasitusLuokat = rasitusLuokat.split(",").map((r) => r.trim());
    rasitusLuokat.sort();
  } else if (Array.isArray(rasitusLuokat)) {
    rasitusLuokat = rasitusLuokat.map((r) => r.trim());
    rasitusLuokat.sort();
  } else if (rasitusLuokat.rasitusluokat) {
    rasitusLuokat = rasitusLuokat.rasitusluokat.map((r) => r.trim());
    rasitusLuokat.sort();
  } else {
    rasitusLuokat = [];
  }
  // Define properties to extract and join
  const parts = [
    (betoni.laatu?.laatuNimike || betoni.laatu?.nimike || betoni.laatuNimike)?.trim() || "",
    betoni.isNopea ? "nopea" : "",
    raeKoko,
    (betoni.lujuus?.lujuusSelite || betoni.lujuus?.lujuusString || betoni.lujuusSelite)?.trim() ||
      "",
    notkeus,
    (
      rasitusLuokat.join(",") ||
      betoni.rasitus?.rasitusluokatString ||
      betoni.rasitusluokat
    )?.trim() || "",
    kayttoIka,
  ];

  // Join non-empty parts with a single space
  const result = parts.filter((part) => part).join(" ");

  return removeEiTietoaFromBetoniString(result);
}

/**
 * Get comprehensive betoni string with volume, weather resistance, and attributes
 * Format: "Säänkestävä 2m³ Nopea Lattiabetoni hieno 16mm C25/30 S2 XF1,XC3 50 vuotta Lisä1,Lisä2 Comment"
 *
 * @param {Object} betoni - Betoni object
 * @returns {string} Comprehensive formatted betoni string with all details
 */
function betoni_getComprehensiveString(betoni) {
  if (!betoni) return "";

  const parts = [];

  // Check if concrete is weather-resistant (säänkestävä) based on exposure classes
  let rasitusLuokat = betoni.rasitus?.rasitusluokat || betoni.rasitusluokat;
  let isWeatherResistant = false;
  if (rasitusLuokat) {
    let rasitusArray = [];
    if (typeof rasitusLuokat === "string") {
      rasitusArray = rasitusLuokat.split(",").map((r) => r.trim().toUpperCase());
    } else if (Array.isArray(rasitusLuokat)) {
      rasitusArray = rasitusLuokat.map((r) => r.trim().toUpperCase());
    } else if (rasitusLuokat.rasitusluokat) {
      rasitusArray = rasitusLuokat.rasitusluokat.map((r) => r.trim().toUpperCase());
    }
    isWeatherResistant = rasitusArray.some((r) => WEATHER_RESISTANT_CLASSES.includes(r));
  }

  // Add weather resistance indicator first if applicable
  if (isWeatherResistant) {
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

  // Add exposure classes (rasitusluokat) - reuse the already parsed rasitusLuokat
  if (rasitusLuokat) {
    let rasitusString = "";
    if (typeof rasitusLuokat === "string") {
      rasitusString = rasitusLuokat.trim();
    } else if (Array.isArray(rasitusLuokat)) {
      rasitusString = rasitusLuokat.filter((r) => r && r.trim()).join(",");
    } else if (rasitusLuokat.rasitusluokat) {
      rasitusString = rasitusLuokat.rasitusluokat.filter((r) => r && r.trim()).join(",");
    }
    if (rasitusString && !rasitusString.includes("Ei tietoa")) {
      parts.push(rasitusString);
    }
  }

  // Add service life
  const kayttoIka =
    betoni.kayttoIka?.kayttoIkaSelite ||
    betoni.kayttoIka?.kayttoIkaString ||
    betoni.kayttoIkaSelite;
  if (kayttoIka && kayttoIka.trim() && !kayttoIka.includes("Ei tietoa")) {
    parts.push(kayttoIka.trim());
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

  // Check if concrete is weather-resistant (säänkestävä) based on exposure classes
  let rasitusLuokat = betoni.rasitus?.rasitusluokat || betoni.rasitusluokat;
  let isWeatherResistant = false;
  if (rasitusLuokat) {
    let rasitusArray = [];
    if (typeof rasitusLuokat === "string") {
      rasitusArray = rasitusLuokat.split(",").map((r) => r.trim().toUpperCase());
    } else if (Array.isArray(rasitusLuokat)) {
      rasitusArray = rasitusLuokat.map((r) => r.trim().toUpperCase());
    } else if (rasitusLuokat.rasitusluokat) {
      rasitusArray = rasitusLuokat.rasitusluokat.map((r) => r.trim().toUpperCase());
    }
    isWeatherResistant = rasitusArray.some((r) => WEATHER_RESISTANT_CLASSES.includes(r));
  }

  // Add weather resistance indicator if applicable
  if (isWeatherResistant) {
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

  // Add exposure classes (rasitusluokat)
  if (rasitusLuokat) {
    let rasitusString = "";
    if (typeof rasitusLuokat === "string") {
      rasitusString = rasitusLuokat.trim();
    } else if (Array.isArray(rasitusLuokat)) {
      rasitusString = rasitusLuokat.filter((r) => r && r.trim()).join(",");
    } else if (rasitusLuokat.rasitusluokat) {
      rasitusString = rasitusLuokat.rasitusluokat.filter((r) => r && r.trim()).join(",");
    }
    if (rasitusString && !rasitusString.includes("Ei tietoa")) {
      parts.push(rasitusString);
    }
  }

  // Add service life
  const kayttoIka =
    betoni.kayttoIka?.kayttoIkaSelite ||
    betoni.kayttoIka?.kayttoIkaString ||
    betoni.kayttoIkaSelite;
  if (kayttoIka && kayttoIka.trim() && !kayttoIka.includes("Ei tietoa")) {
    parts.push(kayttoIka.trim());
  }

  return parts.filter((part) => part && part !== "").join(" ");
}

export {
  removeEiTietoaFromBetoniString,
  betoni_getStrings,
  betoni_getString,
  betoni_getString_noAttr,
  betoni_getComprehensiveString,
  betoni_getComprehensiveString_noAttr,
};
