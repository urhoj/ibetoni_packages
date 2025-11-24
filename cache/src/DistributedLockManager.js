/**
 * Distributed Lock Manager
 *
 * Provides Redis-based distributed locking to prevent duplicate operations
 * across multiple application instances (e.g., different deployment slots).
 *
 * Use Cases:
 * - Prevent duplicate weather API calls from multiple scheduler instances
 * - Coordinate expensive operations across distributed systems
 * - Ensure only one instance processes critical tasks
 *
 * Features:
 * - Atomic lock acquisition using Redis SET NX
 * - TTL-based auto-expiration (no deadlocks)
 * - Safe lock release using Lua scripts
 * - Handles process crashes gracefully
 * - Metrics integration for monitoring
 *
 * Example:
 * ```javascript
 * const lockManager = new DistributedLockManager(redisClient, logger);
 *
 * const lock = await lockManager.acquireLock('weather:keikka:12345', 30000);
 * if (!lock) {
 *   console.log('Another instance is processing this');
 *   return;
 * }
 *
 * try {
 *   await doExpensiveOperation();
 * } finally {
 *   await lock.release();
 * }
 * ```
 */

/**
 * DistributedLockManager
 *
 * Manages acquisition and coordination of distributed locks across Redis.
 */
class DistributedLockManager {
  /**
   * Create a new DistributedLockManager
   *
   * @param {Object} redisClient - ioredis client instance
   * @param {Object} logger - Logger instance with info/warn/error methods
   * @param {Object} metrics - Optional CacheMetrics instance for monitoring
   */
  constructor(redisClient, logger, metrics = null) {
    this.redis = redisClient;
    this.logger = logger;
    this.metrics = metrics;
    this.lockPrefix = "lock:";
  }

  /**
   * Attempt to acquire a distributed lock
   *
   * Uses Redis SET NX (SET if Not eXists) for atomic lock acquisition.
   * The lock will automatically expire after TTL to prevent deadlocks.
   *
   * @param {string} resource - Resource identifier (e.g., 'weather:keikka:12345')
   * @param {number} ttlMs - Lock TTL in milliseconds (default: 30000 = 30 seconds)
   * @returns {Promise<DistributedLock|null>} Lock instance if acquired, null if failed
   *
   * @example
   * const lock = await lockManager.acquireLock('my-resource', 30000);
   * if (!lock) {
   *   console.log('Resource is locked by another process');
   *   return;
   * }
   */
  async acquireLock(resource, ttlMs = 30000) {
    const lockKey = `${this.lockPrefix}${resource}`;
    const lockValue = this.generateLockValue();
    const startTime = Date.now();

    try {
      // Redis SET NX PX: Set if Not exists with TTL in milliseconds
      // Returns 'OK' if lock acquired, null if already exists
      const result = await this.redis.set(lockKey, lockValue, "PX", ttlMs, "NX");

      const duration = Date.now() - startTime;
      const acquired = result === "OK";

      // Record metrics
      if (this.metrics) {
        this.metrics.recordLockAcquisition(resource, acquired, duration);
      }

      if (acquired) {
        this.logger.info("Distributed lock acquired", {
          resource,
          lockKey,
          ttlMs,
          durationMs: duration,
        });

        return new DistributedLock(this.redis, lockKey, lockValue, this.logger, this.metrics);
      } else {
        this.logger.info("Lock acquisition failed - already held by another process", {
          resource,
          lockKey,
          durationMs: duration,
        });

        return null;
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failure metrics
      if (this.metrics) {
        this.metrics.recordLockAcquisition(resource, false, duration);
      }

      this.logger.error("Lock acquisition error", {
        error: error.message,
        resource,
        lockKey,
        durationMs: duration,
      });

      // Return null on error (fail-open: allow operation without lock)
      return null;
    }
  }

  /**
   * Generate unique lock value
   *
   * Lock value format: {processId}:{timestamp}:{random}
   * This ensures each lock holder can be identified and only the
   * lock owner can release it.
   *
   * @returns {string} Unique lock value
   * @private
   */
  generateLockValue() {
    const processId = process.pid;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);

    return `${processId}:${timestamp}:${random}`;
  }
}

/**
 * DistributedLock
 *
 * Represents an acquired distributed lock.
 * Must be released when operation is complete.
 */
class DistributedLock {
  /**
   * Create a new DistributedLock instance
   *
   * @param {Object} redis - ioredis client instance
   * @param {string} lockKey - Redis key for this lock
   * @param {string} lockValue - Unique value identifying this lock holder
   * @param {Object} logger - Logger instance
   * @param {Object} metrics - Optional CacheMetrics instance
   * @private
   */
  constructor(redis, lockKey, lockValue, logger, metrics = null) {
    this.redis = redis;
    this.lockKey = lockKey;
    this.lockValue = lockValue;
    this.logger = logger;
    this.metrics = metrics;
    this.released = false;
    this.acquiredAt = Date.now();
  }

  /**
   * Release the distributed lock
   *
   * Uses Lua script to atomically check lock ownership and delete.
   * This prevents releasing a lock that was acquired by another process
   * (e.g., after TTL expiration and re-acquisition).
   *
   * Safe to call multiple times (idempotent).
   *
   * @returns {Promise<boolean>} True if lock was released, false if already released or not owner
   *
   * @example
   * try {
   *   await doWork();
   * } finally {
   *   await lock.release(); // Always release in finally block
   * }
   */
  async release() {
    if (this.released) {
      this.logger.warn("Lock already released", { lockKey: this.lockKey });
      return false;
    }

    const holdDuration = Date.now() - this.acquiredAt;

    try {
      // Lua script ensures atomic check-and-delete
      // Only delete if current value matches our lock value (we own it)
      const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

      // eval(script, numKeys, key1, ..., arg1, ...)
      const result = await this.redis.eval(luaScript, 1, this.lockKey, this.lockValue);

      const wasOwner = result === 1;
      this.released = true;

      // Record metrics
      if (this.metrics) {
        this.metrics.recordLockRelease(this.lockKey, wasOwner, holdDuration);
      }

      if (wasOwner) {
        this.logger.info("Distributed lock released", {
          lockKey: this.lockKey,
          holdDurationMs: holdDuration,
        });
      } else {
        this.logger.warn("Lock release failed - no longer owner (likely TTL expired)", {
          lockKey: this.lockKey,
          holdDurationMs: holdDuration,
        });
      }

      return wasOwner;
    } catch (error) {
      // Record failure metrics
      if (this.metrics) {
        this.metrics.recordLockReleaseFailure(this.lockKey, holdDuration);
      }

      this.logger.error("Lock release error", {
        error: error.message,
        lockKey: this.lockKey,
        holdDurationMs: holdDuration,
      });

      // Mark as released to prevent retry attempts
      this.released = true;
      return false;
    }
  }

  /**
   * Get lock hold duration in milliseconds
   *
   * @returns {number} Milliseconds since lock was acquired
   */
  getHoldDuration() {
    return Date.now() - this.acquiredAt;
  }

  /**
   * Check if lock is still held (not released)
   *
   * Note: This only checks local state, not Redis state.
   * Lock may have expired in Redis even if not locally released.
   *
   * @returns {boolean} True if lock has not been released
   */
  isHeld() {
    return !this.released;
  }
}

module.exports = {
  DistributedLockManager,
  DistributedLock,
};
