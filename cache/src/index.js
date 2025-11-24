/**
 * @ibetoni/cache - Shared Redis Cache and Invalidation System
 *
 * Unified cache system for betoni.online API server and functions server.
 * Provides consistent cache invalidation across all services.
 *
 * Usage:
 *   const { createCacheManager } = require('@ibetoni/cache');
 *   const cacheManager = createCacheManager({ logger: myLogger });
 *   await cacheManager.invalidateCrossEntity('KEIKKA_BULK_UPDATE', {...});
 */

const UniversalCacheManager = require('./UniversalCacheManager');
const CacheMetrics = require('./CacheMetrics');
const { DistributedLockManager, DistributedLock } = require('./DistributedLockManager');

/**
 * Create a configured cache manager instance
 * @param {Object} options - Configuration options
 * @param {Object} options.logger - Winston logger instance (required)
 * @param {Object} options.cacheMetrics - Optional custom cache metrics instance
 * @param {Object} options.redisConfig - Optional Redis configuration override
 * @returns {UniversalCacheManager} Configured cache manager instance
 */
function createCacheManager(options = {}) {
  const metrics = options.cacheMetrics || new CacheMetrics();

  return new UniversalCacheManager({
    logger: options.logger,
    cacheMetrics: metrics,
    redisConfig: options.redisConfig,
  });
}

/**
 * Create a singleton cache manager instance
 * Useful for importing across multiple files without recreating
 */
let singletonInstance = null;

function getSingletonCacheManager(options = {}) {
  if (!singletonInstance) {
    singletonInstance = createCacheManager(options);
  }
  return singletonInstance;
}

/**
 * Get cache manager singleton (legacy alias for backward compatibility)
 * @deprecated Use getSingletonCacheManager() instead
 * @returns {UniversalCacheManager} Singleton cache manager instance
 */
function getCacheManager(options = {}) {
  return getSingletonCacheManager(options);
}

module.exports = {
  // Primary exports
  UniversalCacheManager,
  CacheMetrics,
  createCacheManager,
  getSingletonCacheManager,
  getCacheManager, // Backward compatibility

  // Distributed locking exports
  DistributedLockManager,
  DistributedLock,

  // Direct class export for advanced use cases
  UniversalCacheManager: UniversalCacheManager,
};
