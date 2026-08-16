/**
 * @ibetoni/cache - Shared Redis Cache and Invalidation System
 *
 * Unified cache system for betoni.online API server and functions server.
 * Provides consistent cache invalidation across all services.
 *
 * Usage:
 *   const { getSingletonCacheManager } = require('@ibetoni/cache');
 *   const cacheManager = getSingletonCacheManager({ logger: myLogger });
 *   await cacheManager.invalidateCrossEntity('KEIKKA_BULK_UPDATE', {...});
 */

const UniversalCacheManager = require('./UniversalCacheManager');
const CacheMetrics = require('./CacheMetrics');
const { DistributedLockManager, releaseAllLocks } = require('./DistributedLockManager');

/**
 * Create a configured cache manager instance
 * @param {Object} options - Configuration options
 * @param {Object} [options.logger] - Logger instance
 * @param {Object} [options.cacheMetrics] - Optional custom cache metrics instance
 * @param {Object} [options.redisConfig] - Optional Redis configuration override
 * @param {string} [options.keyNamespace] - Optional per-build key-namespace override
 * @returns {UniversalCacheManager} Configured cache manager instance
 */
function createCacheManager(options = {}) {
  const metrics = options.cacheMetrics || new CacheMetrics();

  return new UniversalCacheManager({
    logger: options.logger,
    cacheMetrics: metrics,
    redisConfig: options.redisConfig,
    onError: options.onError,
    keyNamespace: options.keyNamespace,
  });
}

/** Singleton cache manager instance */
let singletonInstance = null;

function getSingletonCacheManager(options = {}) {
  if (!singletonInstance) {
    singletonInstance = createCacheManager(options);
  }
  return singletonInstance;
}

module.exports = {
  UniversalCacheManager,
  CacheMetrics,
  createCacheManager,
  getSingletonCacheManager,
  getCacheManager: getSingletonCacheManager, // Legacy alias
  DistributedLockManager,
  releaseAllLocks,
};
