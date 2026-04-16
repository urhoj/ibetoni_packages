/**
 * Distributed Lock Manager
 *
 * Redis-based distributed locking to prevent duplicate operations
 * across multiple application instances.
 *
 * Features:
 * - Atomic lock acquisition using Redis SET NX
 * - TTL-based auto-expiration (no deadlocks)
 * - Safe lock release using Lua scripts
 * - Graceful shutdown: releases all locks on SIGTERM/SIGINT
 * - Metrics integration for monitoring
 *
 * Example:
 * ```javascript
 * const lockManager = new DistributedLockManager(redisClient, logger);
 * const lock = await lockManager.acquireLock('weather:keikka:12345', 30000);
 * if (!lock) return; // Another instance is processing this
 * try {
 *   await doExpensiveOperation();
 * } finally {
 *   await lock.release();
 * }
 * ```
 */

/** @type {Set<DistributedLock>} Track all active locks for graceful shutdown */
const activeLocks = new Set();

/**
 * Lua script for atomic check-and-delete lock release.
 * Only deletes if current value matches our lock value (we own it).
 */
const RELEASE_LOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`;

/**
 * Release all active locks (call during graceful shutdown)
 * @returns {Promise<void>}
 */
async function releaseAllLocks() {
  if (activeLocks.size === 0) return;

  console.log(
    `[LOCK] Releasing ${activeLocks.size} active lock(s) on shutdown...`,
  );
  await Promise.allSettled([...activeLocks].map((lock) => lock.release()));
  activeLocks.clear();
}

// Register shutdown handlers
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, async () => {
    console.log(`\n[SHUTDOWN] Received ${signal}, releasing locks...`);
    await releaseAllLocks();
  });
}

class DistributedLockManager {
  /**
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
   * @param {string} resource - Resource identifier (e.g., 'weather:keikka:12345')
   * @param {number} ttlMs - Lock TTL in milliseconds (default: 30000 = 30 seconds)
   * @returns {Promise<DistributedLock|null>} Lock instance if acquired, null if failed
   */
  async acquireLock(resource, ttlMs = 30000) {
    const lockKey = `${this.lockPrefix}${resource}`;
    const lockValue = this.generateLockValue();
    const startTime = Date.now();

    try {
      const result = await this.redis.set(
        lockKey,
        lockValue,
        "PX",
        ttlMs,
        "NX",
      );
      const duration = Date.now() - startTime;
      const acquired = result === "OK";

      if (this.metrics) {
        this.metrics.recordLockAcquisition(resource, acquired, duration);
      }

      if (acquired) {
        const lock = new DistributedLock(
          this.redis,
          lockKey,
          lockValue,
          this.logger,
          this.metrics,
        );
        activeLocks.add(lock);
        return lock;
      }

      return null;
    } catch (error) {
      const duration = Date.now() - startTime;
      if (this.metrics) {
        this.metrics.recordLockAcquisition(resource, false, duration);
      }
      console.error("Lock acquisition error", {
        error: error.message,
        resource,
        lockKey,
        durationMs: duration,
      });
      return null;
    }
  }

  /** @private */
  generateLockValue() {
    return `${process.pid}:${Date.now()}:${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Represents an acquired distributed lock.
 * Must be released when operation is complete.
 * @internal Created by DistributedLockManager.acquireLock()
 */
class DistributedLock {
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
   * Release the distributed lock.
   * Safe to call multiple times (idempotent).
   * @returns {Promise<boolean>} True if lock was released, false if already released or not owner
   */
  async release() {
    if (this.released) {
      console.log("Lock already released", { lockKey: this.lockKey });
      return false;
    }

    const holdDuration = Date.now() - this.acquiredAt;

    try {
      const result = await this.redis.eval(
        RELEASE_LOCK_SCRIPT,
        1,
        this.lockKey,
        this.lockValue,
      );
      const wasOwner = result === 1;
      this.released = true;
      activeLocks.delete(this);

      if (this.metrics) {
        this.metrics.recordLockRelease(this.lockKey, wasOwner, holdDuration);
      }

      if (!wasOwner) {
        console.log(
          "Lock release failed - no longer owner (likely TTL expired)",
          {
            lockKey: this.lockKey,
            holdDurationMs: holdDuration,
          },
        );
      }

      return wasOwner;
    } catch (error) {
      if (this.metrics) {
        this.metrics.recordLockRelease(this.lockKey, false, holdDuration);
      }
      console.error("Lock release error", {
        error: error.message,
        lockKey: this.lockKey,
        holdDurationMs: holdDuration,
      });
      this.released = true;
      return false;
    }
  }
}

module.exports = {
  DistributedLockManager,
  releaseAllLocks,
};
