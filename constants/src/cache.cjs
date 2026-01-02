/**
 * Cache TTL Constants
 *
 * Base Time-To-Live (TTL) values for cached entities across all applications.
 * All values are in seconds.
 *
 * IMPORTANT: These are BASE TTL values. The actual TTL is calculated as:
 *   effective_ttl = base_ttl × TTL_MULTIPLIER (default: 4.0)
 *
 * The TTL multiplier is configured via CACHE_TTL_MULTIPLIER environment variable.
 * See UniversalCacheManager in @ibetoni/cache for the authoritative TTL configuration.
 *
 * @module @ibetoni/constants/cache
 */

/**
 * Base TTL values for entity caching (before multiplier is applied)
 *
 * These values are multiplied by CACHE_TTL_MULTIPLIER (default: 4.0) in UniversalCacheManager.
 *
 * Usage:
 * ```javascript
 * const { CACHE_TTL } = require('@ibetoni/constants');
 *
 * // Note: These are base values. Actual TTL = base × multiplier
 * await setCachedData('keikka', customerId, data, CACHE_TTL.KEIKKA);
 * ```
 *
 * @constant {Object} CACHE_TTL
 * @property {number} KEIKKA - Keikka/Order cache base TTL (1 hour → 4 hours with 4× multiplier)
 * @property {number} TYOMAA - Tyomaa/Worksite cache base TTL (2 hours → 8 hours)
 * @property {number} PERSON - Person/User cache base TTL (2 hours → 8 hours)
 * @property {number} VEHICLE - Vehicle/Equipment cache base TTL (2 hours → 8 hours)
 * @property {number} WEATHER - Weather data cache base TTL (1 hour → 4 hours)
 */
const CACHE_TTL = {
  KEIKKA: 3600,   // 1 hour base - Orders, invalidated on changes
  TYOMAA: 7200,   // 2 hours base - Worksites, moderate changes
  PERSON: 7200,   // 2 hours base - Person data relatively stable
  VEHICLE: 7200,  // 2 hours base - Vehicle data relatively stable
  WEATHER: 3600,  // 1 hour base - Weather data from FMI
};

/**
 * Legacy constant names for backward compatibility
 * @deprecated Use CACHE_TTL object instead. Note: Values updated to match UniversalCacheManager BASE_TTL.
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
