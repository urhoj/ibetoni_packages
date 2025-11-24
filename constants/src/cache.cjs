/**
 * Cache TTL Constants
 *
 * Default Time-To-Live (TTL) values for cached entities across all applications.
 * All values are in seconds.
 *
 * @module @ibetoni/constants/cache
 */

/**
 * Default TTL values for entity caching
 *
 * Usage:
 * ```javascript
 * const { CACHE_TTL } = require('@ibetoni/constants');
 *
 * await setCachedData('keikka', customerId, data, CACHE_TTL.KEIKKA);
 * ```
 *
 * @constant {Object} CACHE_TTL
 * @property {number} KEIKKA - Keikka/Order cache TTL (10 minutes)
 * @property {number} TYOMAA - Tyomaa/Worksite cache TTL (20 minutes)
 * @property {number} PERSON - Person/User cache TTL (30 minutes)
 * @property {number} VEHICLE - Vehicle/Equipment cache TTL (30 minutes)
 * @property {number} WEATHER - Weather data cache TTL (15 minutes)
 */
const CACHE_TTL = {
  KEIKKA: 600,    // 10 minutes - Orders change frequently
  TYOMAA: 1200,   // 20 minutes - Worksites change moderately
  PERSON: 1800,   // 30 minutes - Person data relatively stable
  VEHICLE: 1800,  // 30 minutes - Vehicle data relatively stable
  WEATHER: 900,   // 15 minutes - Weather data changes frequently
};

/**
 * Legacy constant names for backward compatibility
 * @deprecated Use CACHE_TTL object instead
 */
const DEFAULT_KEIKKA_TTL = CACHE_TTL.KEIKKA;
const DEFAULT_TYOMAA_TTL = CACHE_TTL.TYOMAA;
const DEFAULT_PERSON_TTL = CACHE_TTL.PERSON;
const DEFAULT_VEHICLE_TTL = CACHE_TTL.VEHICLE;
const DEFAULT_WEATHER_TTL = CACHE_TTL.WEATHER;

module.exports = {
  CACHE_TTL,
  // Legacy exports for backward compatibility
  DEFAULT_KEIKKA_TTL,
  DEFAULT_TYOMAA_TTL,
  DEFAULT_PERSON_TTL,
  DEFAULT_VEHICLE_TTL,
  DEFAULT_WEATHER_TTL,
};
