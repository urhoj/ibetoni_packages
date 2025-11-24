/**
 * Cache Metrics Collector - Simplified Stub Version
 *
 * This is a minimal implementation for the shared package.
 * Projects can provide their own full implementation via constructor options.
 *
 * Tracks cache performance metrics including:
 * - Hit/miss ratios per entity type
 * - Response time improvements
 * - Cache operation counts
 * - Invalidation frequency
 */

class CacheMetrics {
  constructor() {
    this.metrics = {
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
    };
  }

  /**
   * Record a cache hit
   */
  recordHit(entityType, responseTime) {
    this.metrics.global.hits++;
    if (!this.metrics.byEntity[entityType]) {
      this.metrics.byEntity[entityType] = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
    }
    this.metrics.byEntity[entityType].hits++;
  }

  /**
   * Record a cache miss
   */
  recordMiss(entityType, responseTime) {
    this.metrics.global.misses++;
    if (!this.metrics.byEntity[entityType]) {
      this.metrics.byEntity[entityType] = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
    }
    this.metrics.byEntity[entityType].misses++;
  }

  /**
   * Record a cache set operation
   */
  recordSet(entityType, key) {
    this.metrics.global.sets++;
    if (!this.metrics.byEntity[entityType]) {
      this.metrics.byEntity[entityType] = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
    }
    this.metrics.byEntity[entityType].sets++;
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
    if (!this.metrics.byEntity[entityType]) {
      this.metrics.byEntity[entityType] = { hits: 0, misses: 0, sets: 0, invalidations: 0 };
    }
    this.metrics.byEntity[entityType].invalidations++;

    // Track detailed invalidation metrics
    this.metrics.invalidations.totalCount++;
    this.metrics.invalidations.totalKeys += keysInvalidated;
    this.metrics.invalidations.totalDuration += durationMs;
    this.metrics.invalidations.totalKeysScanned += keysScanned;

    // Track by entity type
    if (!this.metrics.invalidations.byEntityType[entityType]) {
      this.metrics.invalidations.byEntityType[entityType] = {
        count: 0,
        totalKeys: 0,
        totalDuration: 0,
        totalKeysScanned: 0,
        avgKeysPerInvalidation: 0,
        avgDurationMs: 0,
        efficiency: 0, // keysInvalidated / keysScanned ratio
      };
    }
    const entityMetrics = this.metrics.invalidations.byEntityType[entityType];
    entityMetrics.count++;
    entityMetrics.totalKeys += keysInvalidated;
    entityMetrics.totalDuration += durationMs;
    entityMetrics.totalKeysScanned += keysScanned;
    entityMetrics.avgKeysPerInvalidation = (entityMetrics.totalKeys / entityMetrics.count).toFixed(2);
    entityMetrics.avgDurationMs = (entityMetrics.totalDuration / entityMetrics.count).toFixed(2);
    entityMetrics.efficiency = entityMetrics.totalKeysScanned > 0
      ? ((entityMetrics.totalKeys / entityMetrics.totalKeysScanned) * 100).toFixed(2)
      : 100;

    // Track by pattern (limited to prevent memory bloat)
    if (Object.keys(this.metrics.invalidations.byPattern).length < 100) {
      if (!this.metrics.invalidations.byPattern[pattern]) {
        this.metrics.invalidations.byPattern[pattern] = {
          count: 0,
          totalKeys: 0,
          lastUsed: Date.now(),
        };
      }
      this.metrics.invalidations.byPattern[pattern].count++;
      this.metrics.invalidations.byPattern[pattern].totalKeys += keysInvalidated;
      this.metrics.invalidations.byPattern[pattern].lastUsed = Date.now();
    }
  }

  /**
   * Record an operation
   */
  recordOperation(operationType, duration) {
    if (!this.metrics.byOperation[operationType]) {
      this.metrics.byOperation[operationType] = { count: 0, totalDuration: 0 };
    }
    this.metrics.byOperation[operationType].count++;
    this.metrics.byOperation[operationType].totalDuration += duration;
  }

  /**
   * Record an error
   */
  recordError(operationType, errorType, error) {
    this.metrics.global.errors++;
  }

  /**
   * Get metrics summary
   */
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
  recordLockAcquisition(resource, acquired, durationMs) {
    this.metrics.locks.acquisitionAttempts++;

    if (acquired) {
      this.metrics.locks.acquisitionSuccesses++;
    } else {
      this.metrics.locks.acquisitionFailures++;
    }

    // Track per-resource metrics
    if (!this.metrics.locks.byResource[resource]) {
      this.metrics.locks.byResource[resource] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        contentionRate: 0,
      };
    }
    this.metrics.locks.byResource[resource].attempts++;
    if (acquired) {
      this.metrics.locks.byResource[resource].successes++;
    } else {
      this.metrics.locks.byResource[resource].failures++;
    }

    // Calculate contention rate
    const resourceMetrics = this.metrics.locks.byResource[resource];
    resourceMetrics.contentionRate = resourceMetrics.attempts > 0
      ? ((resourceMetrics.failures / resourceMetrics.attempts) * 100).toFixed(2)
      : 0;
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

    // Track hold duration
    this.metrics.locks.totalHoldDuration += holdDurationMs;
    if (holdDurationMs > this.metrics.locks.maxHoldDuration) {
      this.metrics.locks.maxHoldDuration = holdDurationMs;
    }
  }

  /**
   * Record a failed lock release
   * @param {string} lockKey - Lock key that failed to release
   * @param {number} holdDurationMs - How long the lock was held
   */
  recordLockReleaseFailure(lockKey, holdDurationMs) {
    this.metrics.locks.releaseFailures++;
    this.metrics.locks.totalHoldDuration += holdDurationMs;
  }

  /**
   * Get lock metrics summary
   * @returns {Object} Lock metrics summary
   */
  getLockMetrics() {
    const attempts = this.metrics.locks.acquisitionAttempts;
    const successes = this.metrics.locks.acquisitionSuccesses;
    const failures = this.metrics.locks.acquisitionFailures;
    const releases = this.metrics.locks.releases;

    const successRate = attempts > 0
      ? ((successes / attempts) * 100).toFixed(2)
      : 0;

    const avgHoldDuration = releases > 0
      ? (this.metrics.locks.totalHoldDuration / releases).toFixed(2)
      : 0;

    return {
      acquisitionAttempts: attempts,
      acquisitionSuccesses: successes,
      acquisitionFailures: failures,
      successRate: `${successRate}%`,
      releases: releases,
      releaseFailures: this.metrics.locks.releaseFailures,
      avgHoldDurationMs: avgHoldDuration,
      maxHoldDurationMs: this.metrics.locks.maxHoldDuration,
      byResource: this.metrics.locks.byResource,
    };
  }

  /**
   * Get invalidation performance metrics
   * @returns {Object} Invalidation metrics summary
   */
  getInvalidationMetrics() {
    const totalCount = this.metrics.invalidations.totalCount;
    const totalKeys = this.metrics.invalidations.totalKeys;
    const totalDuration = this.metrics.invalidations.totalDuration;
    const totalKeysScanned = this.metrics.invalidations.totalKeysScanned;

    const avgKeysPerInvalidation = totalCount > 0
      ? (totalKeys / totalCount).toFixed(2)
      : 0;

    const avgDurationMs = totalCount > 0
      ? (totalDuration / totalCount).toFixed(2)
      : 0;

    const overallEfficiency = totalKeysScanned > 0
      ? ((totalKeys / totalKeysScanned) * 100).toFixed(2)
      : 100;

    return {
      totalCount,
      totalKeysInvalidated: totalKeys,
      totalDurationMs: totalDuration,
      totalKeysScanned,
      avgKeysPerInvalidation,
      avgDurationMs,
      overallEfficiency: `${overallEfficiency}%`,
      byEntityType: this.metrics.invalidations.byEntityType,
      topPatterns: this._getTopPatterns(10),
    };
  }

  /**
   * Get top N most used invalidation patterns
   * @private
   */
  _getTopPatterns(limit = 10) {
    return Object.entries(this.metrics.invalidations.byPattern)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([pattern, data]) => ({
        pattern,
        count: data.count,
        totalKeys: data.totalKeys,
        avgKeys: (data.totalKeys / data.count).toFixed(2),
      }));
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
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
    };
  }
}

module.exports = CacheMetrics;
