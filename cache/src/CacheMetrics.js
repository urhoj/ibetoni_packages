/**
 * Cache Metrics Collector - Simplified Stub Version
 *
 * Minimal implementation for the shared package.
 * Projects can provide their own full implementation via constructor options.
 */

const INITIAL_METRICS = () => ({
  global: {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
    errors: 0,
    startTime: Date.now(),
  },
  byEntity: {},
  byOperation: {},
  locks: {
    acquisitionAttempts: 0,
    acquisitionSuccesses: 0,
    acquisitionFailures: 0,
    releases: 0,
    releaseFailures: 0,
    totalHoldDuration: 0,
    maxHoldDuration: 0,
    byResource: {},
  },
  invalidations: {
    totalCount: 0,
    totalKeys: 0,
    totalDuration: 0,
    totalKeysScanned: 0,
    byEntityType: {},
    byPattern: {},
  },
});

class CacheMetrics {
  constructor() {
    this.metrics = INITIAL_METRICS();
  }

  /**
   * Ensure entity tracking object exists
   * @private
   */
  _ensureEntity(entityType) {
    if (!this.metrics.byEntity[entityType]) {
      this.metrics.byEntity[entityType] = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
    }
    return this.metrics.byEntity[entityType];
  }

  recordHit(entityType) {
    this.metrics.global.hits++;
    this._ensureEntity(entityType).hits++;
  }

  recordMiss(entityType) {
    this.metrics.global.misses++;
    this._ensureEntity(entityType).misses++;
  }

  recordSet(entityType) {
    this.metrics.global.sets++;
    this._ensureEntity(entityType).sets++;
  }

  /**
   * Record a cache invalidation with performance metrics
   * @param {string} entityType - Entity type being invalidated
   * @param {string} pattern - Redis pattern used for invalidation
   * @param {number} keysInvalidated - Number of keys actually deleted
   * @param {number} durationMs - Time taken for invalidation operation
   * @param {number} keysScanned - Number of keys scanned during SCAN operations
   */
  recordInvalidation(entityType, pattern, keysInvalidated = 0, durationMs = 0, keysScanned = 0) {
    this.metrics.global.invalidations++;
    this._ensureEntity(entityType).invalidations++;

    // Track detailed invalidation metrics
    const inv = this.metrics.invalidations;
    inv.totalCount++;
    inv.totalKeys += keysInvalidated;
    inv.totalDuration += durationMs;
    inv.totalKeysScanned += keysScanned;

    // Track by entity type (compute averages on read, not write)
    if (!inv.byEntityType[entityType]) {
      inv.byEntityType[entityType] = {
        count: 0,
        totalKeys: 0,
        totalDuration: 0,
        totalKeysScanned: 0,
      };
    }
    const entityMetrics = inv.byEntityType[entityType];
    entityMetrics.count++;
    entityMetrics.totalKeys += keysInvalidated;
    entityMetrics.totalDuration += durationMs;
    entityMetrics.totalKeysScanned += keysScanned;

    // Track by pattern (limited to prevent memory bloat)
    if (Object.keys(inv.byPattern).length < 100) {
      if (!inv.byPattern[pattern]) {
        inv.byPattern[pattern] = { count: 0, totalKeys: 0, lastUsed: Date.now() };
      }
      inv.byPattern[pattern].count++;
      inv.byPattern[pattern].totalKeys += keysInvalidated;
      inv.byPattern[pattern].lastUsed = Date.now();
    }
  }

  recordOperation(operationType, duration) {
    if (!this.metrics.byOperation[operationType]) {
      this.metrics.byOperation[operationType] = { count: 0, totalDuration: 0 };
    }
    this.metrics.byOperation[operationType].count++;
    this.metrics.byOperation[operationType].totalDuration += duration;
  }

  recordError() {
    this.metrics.global.errors++;
  }

  getSummary() {
    const runtime = Date.now() - this.metrics.global.startTime;
    const totalRequests = this.metrics.global.hits + this.metrics.global.misses;
    const hitRate = totalRequests > 0 ? (this.metrics.global.hits / totalRequests * 100).toFixed(2) : 0;

    return {
      hits: this.metrics.global.hits,
      misses: this.metrics.global.misses,
      sets: this.metrics.global.sets,
      invalidations: this.metrics.global.invalidations,
      errors: this.metrics.global.errors,
      hitRate: `${hitRate}%`,
      totalRequests,
      runtime: `${Math.floor(runtime / 1000)}s`,
    };
  }

  /**
   * Record a distributed lock acquisition attempt
   * @param {string} resource - Lock resource identifier
   * @param {boolean} acquired - Whether lock was successfully acquired
   * @param {number} durationMs - Time taken to attempt acquisition
   */
  recordLockAcquisition(resource, acquired, _durationMs) {
    this.metrics.locks.acquisitionAttempts++;

    if (acquired) {
      this.metrics.locks.acquisitionSuccesses++;
    } else {
      this.metrics.locks.acquisitionFailures++;
    }

    if (!this.metrics.locks.byResource[resource]) {
      this.metrics.locks.byResource[resource] = {
        attempts: 0,
        successes: 0,
        failures: 0,
      };
    }
    const rm = this.metrics.locks.byResource[resource];
    rm.attempts++;
    if (acquired) {
      rm.successes++;
    } else {
      rm.failures++;
    }
  }

  /**
   * Record a distributed lock release
   * @param {string} lockKey - Lock key that was released
   * @param {boolean} success - Whether release was successful
   * @param {number} holdDurationMs - How long the lock was held
   */
  recordLockRelease(lockKey, success, holdDurationMs) {
    this.metrics.locks.releases++;
    if (!success) {
      this.metrics.locks.releaseFailures++;
    }
    this.metrics.locks.totalHoldDuration += holdDurationMs;
    if (holdDurationMs > this.metrics.locks.maxHoldDuration) {
      this.metrics.locks.maxHoldDuration = holdDurationMs;
    }
  }

  /**
   * Get lock metrics summary
   */
  getLockMetrics() {
    const { acquisitionAttempts, acquisitionSuccesses, acquisitionFailures, releases } = this.metrics.locks;

    const successRate = acquisitionAttempts > 0
      ? ((acquisitionSuccesses / acquisitionAttempts) * 100).toFixed(2)
      : 0;

    const avgHoldDuration = releases > 0
      ? (this.metrics.locks.totalHoldDuration / releases).toFixed(2)
      : 0;

    return {
      acquisitionAttempts,
      acquisitionSuccesses,
      acquisitionFailures,
      successRate: `${successRate}%`,
      releases,
      releaseFailures: this.metrics.locks.releaseFailures,
      avgHoldDurationMs: avgHoldDuration,
      maxHoldDurationMs: this.metrics.locks.maxHoldDuration,
      byResource: this.metrics.locks.byResource,
    };
  }

  reset() {
    this.metrics = INITIAL_METRICS();
  }
}

module.exports = CacheMetrics;
