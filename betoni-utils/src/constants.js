/**
 * @ibetoni/betoni-utils - Constants
 *
 * Shared constants for betoni (concrete) specifications
 */

/**
 * Exposure classes for concrete (Rasitusluokat)
 * According to European standard EN 206
 *
 * X0 - No risk of corrosion or attack
 * XC - Corrosion induced by carbonation
 * XD - Corrosion induced by chlorides other than from sea water
 * XF - Freeze/thaw attack
 * XS - Corrosion induced by chlorides from sea water
 * XA - Chemical attack
 */
const RasitusLuokatArr = [
  "X0",
  "XC1",
  "XC2",
  "XC3",
  "XC4",
  "XD1",
  "XD2",
  "XD3",
  "XF1",
  "XF2",
  "XF3",
  "XF4",
  "XS1",
  "XS2",
  "XS3",
  "XA1",
  "XA2",
  "XA3",
];

/**
 * Exposure classes that indicate weather-resistant concrete
 */
const WEATHER_RESISTANT_CLASSES = ["XF1", "XF3"];

export { RasitusLuokatArr, WEATHER_RESISTANT_CLASSES };
