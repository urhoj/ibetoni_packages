/**
 * @ibetoni/cache - Shared Redis Cache and Invalidation System
 *
 * Unified cache system for betoni.online API server and functions server.
 * Provides consistent cache invalidation across all services.
 *
 * Usage:
 *   const { getSingletonCacheManager } = require('@ibetoni/cache');
 *   const cacheManager = getSingletonCacheManager();
 *   await cacheManager.invalidateCrossEntity('KEIKKA_BULK_UPDATE', {...});
 */

const UniversalCacheManager = require('./UniversalCacheManager');
const CacheMetrics = require('./CacheMetrics');
const { DistributedLockManager } = require('./DistributedLockManager');

/** Singleton cache manager instance */
let singletonInstance = null;

/**
 * @param {Object} options - Configuration options (first call only)
 * @param {Object} [options.cacheMetrics] - Optional custom cache metrics instance
 * @param {Object} [options.redisConfig] - Optional Redis configuration override
 * @param {Function} [options.onError] - Optional error hook (see setErrorHandler)
 * @param {string} [options.keyNamespace] - Optional per-build key-namespace override
 * @returns {UniversalCacheManager} Singleton cache manager instance
 */
function getSingletonCacheManager(options = {}) {
  if (!singletonInstance) {
    singletonInstance = new UniversalCacheManager({
      cacheMetrics: options.cacheMetrics || new CacheMetrics(),
      redisConfig: options.redisConfig,
      onError: options.onError,
      keyNamespace: options.keyNamespace,
    });
  }
  return singletonInstance;
}

module.exports = {
  UniversalCacheManager,
  getSingletonCacheManager,
  getCacheManager: getSingletonCacheManager, // Legacy alias
  DistributedLockManager,
};
