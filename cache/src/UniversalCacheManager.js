/**
 * Universal Cache Manager for betoni.online
 *
 * Two-tier cache system: L1 in-memory LRU (30min TTL) → Redis.
 * L1 caches only static reference data (entity types in L1_ENTITY_TYPES).
 * All other entity types use Redis only.
 *
 * **Database Allocation**:
 * - DB 1: Socket.io sessions (managed by redisSessionClient.js)
 * - DB 3: API cache (production)
 * - DB 4: API cache (development)
 *
 * Default: DB 3 for production (`NODE_ENV=production`), DB 4 otherwise.
 * Shared package version - logger and metrics are injectable.
 */

const crypto = require("crypto");
const Redis = require("ioredis");
const { LRUCache } = require("lru-cache");
const { captureError } = require("@ibetoni/sentry");

/**
 * TTL Multiplier - Global scaling factor for all cache TTL values
 *
 * Adjusts all TTL values proportionally. With 4% Redis memory usage,
 * higher multipliers improve cache hit rates without memory concerns.
 *
 * Recommended values:
 * - 1.0: Original TTLs (conservative, for high-write scenarios)
 * - 2.0: Double TTLs (balanced)
 * - 4.0: 4x TTLs (recommended for low memory usage)
 * - 5.0: 5x TTLs (aggressive, maximizes cache hits)
 *
 * Can be overridden via environment variable: CACHE_TTL_MULTIPLIER
 */
const TTL_MULTIPLIER = parseFloat(process.env.CACHE_TTL_MULTIPLIER) || 4.0;

/**
 * Entity types excluded from TTL multiplier (require real-time or near-real-time data)
 * These maintain their base TTL regardless of the multiplier setting.
 */
const TTL_MULTIPLIER_EXCLUDED = new Set([
  "ecofleet", // Real-time vehicle GPS positions - must stay at 1 minute
  "ecofleet-daily", // Keikka presence check - must stay at 4h
  "ecofleet-daily-today", // Today's timeline data - must stay at 10min
]);

/**
 * Maximum TTL cap in seconds (7 days) to prevent excessively long cache times
 * Even with high multipliers, TTLs won't exceed this value.
 */
const MAX_TTL_SECONDS = 604800; // 7 days

class UniversalCacheManager {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} [options.logger] - Logger instance (console-compatible), falls back to console
   * @param {Object} [options.cacheMetrics] - Optional cache metrics instance
   * @param {Object} [options.redisConfig] - Optional Redis configuration override
   * @param {number} [options.ttlMultiplier] - Override TTL multiplier (default: env or 4.0)
   */
  constructor(options = {}) {
    this.logger = options.logger || this._createDefaultLogger();
    this.cacheMetrics = options.cacheMetrics || this._createDefaultMetrics();
    this.redisConfigOverride = options.redisConfig;
    this.ttlMultiplier = options.ttlMultiplier || TTL_MULTIPLIER;
    this._onError = typeof options.onError === 'function' ? options.onError : null;

    /** @type {Map<string, Promise<any>>} In-process singleflight for getOrCompute */
    this._inflight = new Map();

    this.client = null;
    this.isConnected = false;
    this.isShuttingDown = false;
    this.connectionPromise = null; // Prevent multiple connection attempts

    // Throttle for ping-during-reconnect failure reporting. getClient() runs
    // on every cache op; during a Redis outage that's thousands of identical
    // pings/min — we report at most once per PING_REPORT_THROTTLE_MS.
    this._lastPingErrorReportAt = 0;
    // Throttle for the log breadcrumb (separate from the Sentry throttle so a
    // transient blip that never escalates still can't flood the log).
    this._lastPingLogAt = 0;
    // Start of the current Redis-unavailability streak (0 = writeable). Set on
    // the first failed ping, cleared in onReady. Only a SUSTAINED streak is
    // Sentry-worthy — a normal failover reconnect fast-fails for a few seconds.
    this._pingErrorStreakStartedAt = 0;

    // Track current Redis database (3 = production, 4 = development)
    const isProduction = process.env.NODE_ENV === "production";
    this.currentDb = isProduction ? 3 : 4;

    // Base TTL configuration for all entity types (seconds)
    // These are the foundation values before multiplier is applied
    this.BASE_TTL = {
      keikka: 3600, // 1 hour - delivery orders, change frequently
      asiakas: 7200, // 2 hours - customers, relatively stable
      tyomaa: 7200, // 2 hours - worksites, moderate changes
      person: 7200, // 2 hours - persons, moderate changes
      personpvm: 3600, // 1 hour - person schedules, change frequently
      personpvmStatus: 43200, // 12 hours - person schedule status types (static reference data)
      betoni: 3600, // 1 hour - concrete specs, reference data
      betoniReference: 7200, // 2 hours - static reference data
      betoniLaatu: 7200, // 2 hours - quality data scoped by supplier
      betoniShortcut: 7200, // 2 hours - user-configured concrete shortcuts
      betoniList: 3600, // 1 hour - betoni search/filter results
      betoniAttr: 3600, // 1 hour - betoni attributes (keikka-specific)
      betoniPrices: 300, // 5 minutes - betoni price lookups (SP-heavy, short TTL for price freshness)
      config: 43200, // 12 hours - static configuration
      vehicle: 7200, // 2 hours - vehicles, relatively stable
      vehicleDate: 7200, // 2 hours - vehicle dates, moderate changes
      vehicleDateType: 43200, // 12 hours - vehicle date types (reference data)
      vehicleRequiredDateType: 7200, // 2 hours - vehicle required date types
      personDate: 7200, // 2 hours - person dates, moderate changes
      personDateType: 43200, // 12 hours - person date types (reference data)
      personRequiredDateType: 43200, // 12 hours - person required date types
      tyomaaDate: 7200, // 2 hours - työmaa dates, moderate changes
      tyomaaDateType: 43200, // 12 hours - työmaa date types (reference data)
      asiakasDate: 7200, // 2 hours - asiakas dates, moderate changes
      asiakasDateType: 43200, // 12 hours - asiakas date types (reference data)
      complianceDashboard: 7200, // 2 hours - dashboard aggregations (matches date entities)
      sijainti: 7200, // 2 hours - locations, rarely changes
      geocode: 3600, // 1 hour - geocoding & driving distances
      attachment: 3600, // 1 hour - attachment lists (matches relationship entities)
      attachmentTypes: 43200, // 12 hours - attachment types (static reference data)
      tuote: 7200, // 2 hours - products, moderate changes
      productReference: 43200, // 12 hours - product types and categories
      barColor: 43200, // 12 hours - grid bar colors (static UI configuration)
      invoiceStatus: 43200, // 12 hours - invoice status lookup table
      tyomaaPerson: 3600, // 1 hour - worksite-person relationships
      asiakasPerson: 3600, // 1 hour - customer-person relationships
      keikkaPerson: 3600, // 1 hour - delivery-person assignments
      keikkaBetoni: 3600, // 1 hour - delivery concrete assignments
      dailyMessage: 7200, // 2 hours - daily messages, frequently updated
      dailyConfirmation: 7200, // 2 hours - daily confirmations, stable once set
      stat: 43200, // 12 hours - statistics updated by cronjobs, daily
      stepLog: 3600, // 1 hour - keikka activity logs (same as keikka)
      grid: 3600, // 1 hour - grid keikka lists (same as keikka)
      help: 43200, // 12 hours - help content, changes very rarely
      legalDocument: 86400, // 24 hours - legal documents, changes rarely
      weather: 3600, // 1 hour - weather module status and forecasts
      ecofleet: 60, // 1 minute - external fleet tracking API (real-time, excluded from multiplier)
      "ecofleet-daily": 14400, // 4 hours - daily keikka presence check for smart fetch skip
      "ecofleet-daily-today": 600, // 10 minutes - today's timeline data (actively changing, excluded from multiplier)
      lasku: 3600, // 1 hour - invoice data
      laskupohja: 7200, // 2 hours - invoice templates (more stable than invoices)
      laskuStatusType: 43200, // 12 hours - invoice status types (static reference data)
      holiday: 86400, // 24 hours - national holidays, changes rarely (weekly sync)
      notifications: 120, // 2 minutes - time-sensitive push notifications
      reminder: 7200, // 2 hours - reminder rules, infrequently changed
      keikkaTila: 43200, // 12 hours - delivery status types (static reference data)
      auth: 300, // 5 min base, multiplied to ~20 min effective; jitter via cache()
      default: 3600, // 1 hour fallback (same as keikka tier)
    };

    // Redis key prefixes that are real cache namespaces but are not tied to a
    // BASE_TTL entity (cached under entity 'default' or via raw redis.set).
    // Listed here so clearAllCache() can sweep them too.
    this.ORPHAN_PREFIXES = [
      "combinator:*", // person/asiakas/tyomaa duplicate-pair caches
      "news:*",       // RSS news article list
      "auth:*",       // permission cache (auth:permissions, auth:person)
      "toimitus:*",   // toimitus:get:{keikkaId}
    ];

    // Operational/non-cache key prefixes that clearAllCache() must NOT delete.
    // grid:last-update is a SUBPREFIX of grid:* (which is in BASE_TTL), so it
    // would otherwise be swept; the others sit outside BASE_TTL but are listed
    // here for documentation and to survive future BASE_TTL additions.
    this.EXCLUDE_PREFIXES = [
      "grid:last-update:", // socket smart-reconnect timestamps (24h EX, rebuilt on next mutation)
      "metrics:",          // baseline hit/miss + system metrics caches
      "lock:",             // distributed locks (DistributedLockManager)
      "api:perf:",         // per-day API perf metrics
    ];

    // Apply TTL multiplier to generate effective TTLs
    this.TTL = this._applyTtlMultiplier(this.BASE_TTL);

    // Production-safe batch limits
    this.BATCH_SIZE = 2000;
    this.SCAN_COUNT = 500; // Increased from 100 to reduce Redis round-trips (5× fewer iterations)

    // L1 in-memory cache for static reference data
    // Only entity types in this set get L1 caching (30-minute TTL)
    this.L1_ENTITY_TYPES = new Set([
      "config",
      "betoniReference",
      "personpvmStatus",
      "personDateType",
      "personRequiredDateType",
      "tyomaaDateType",
      "asiakasDateType",
      "vehicleDateType",
      "vehicleRequiredDateType",
      "attachmentTypes",
      "productReference",
      "barColor",
      "invoiceStatus",
      "laskuStatusType",
      "help",
      "holiday",
      "keikkaTila",
    ]);

    this.L1_TTL_MS = 30 * 60 * 1000; // 30 minutes

    this.l1Cache = new LRUCache({
      max: 500,
      ttl: this.L1_TTL_MS,
      updateAgeOnGet: false,
      allowStale: false,
    });
  }

  /** @returns {object} CacheMetrics instance for external integrations */
  get metrics() {
    return this.cacheMetrics;
  }

  /**
   * Create default logger if none provided
   */
  _createDefaultLogger() {
    return {
      info: (...args) => console.log("[CACHE]", ...args),
      warn: (...args) => console.warn("[CACHE]", ...args),
      error: (...args) => console.error("[CACHE]", ...args),
      debug: (...args) => console.log("[CACHE-DEBUG]", ...args),
    };
  }

  /**
   * Create default metrics tracker if none provided
   */
  _createDefaultMetrics() {
    return {
      recordHit: () => {},
      recordL1Hit: () => {},
      recordMiss: () => {},
      recordSet: () => {},
      recordInvalidation: () => {},
      recordOperation: () => {},
      recordError: () => {},
    };
  }

  /**
   * Apply TTL multiplier to base TTL values
   *
   * - Multiplies all TTLs by the configured multiplier
   * - Excludes real-time entities (ecofleet) from multiplication
   * - Caps maximum TTL at MAX_TTL_SECONDS (7 days)
   *
   * @param {Object} baseTtl - Base TTL configuration object
   * @returns {Object} Computed TTL values with multiplier applied
   */
  _applyTtlMultiplier(baseTtl) {
    const result = {};

    for (const [entityType, baseValue] of Object.entries(baseTtl)) {
      if (TTL_MULTIPLIER_EXCLUDED.has(entityType)) {
        // Real-time entities keep their base TTL
        result[entityType] = baseValue;
      } else {
        // Apply multiplier with max cap
        const multiplied = Math.floor(baseValue * this.ttlMultiplier);
        result[entityType] = Math.min(multiplied, MAX_TTL_SECONDS);
      }
    }

    return result;
  }

  /**
   * Get Redis configuration with Azure/local fallback
   */
  getRedisConfig() {
    if (this.redisConfigOverride) {
      return this.redisConfigOverride;
    }

    const base = {
      keyPrefix: "", // No prefix to avoid scan/invalidation mismatches
      connectTimeout: 2000, // Fail fast: a flapping Redis must not stall the request path
      // fb#160: fail-fast on a wedged/flapping Redis. Without these, a command
      // issued on a "ready" connection that then wedges QUEUES (enableOfflineQueue
      // default true) and hung 300-800s on 2026-06-26 -> Cloudflare 524 while
      // /health stayed green. enableOfflineQueue:false = don't queue when the
      // socket isn't writeable (commands reject in ~0ms); commandTimeout bounds a
      // ready-but-wedged command; a low maxRetriesPerRequest avoids the 20-retry
      // storm (MaxRetriesPerRequestError). Safe for both consumers: cache reads
      // fail OPEN to (healthy) SQL, and DistributedLockManager.acquireLock catches
      // the error and returns null = "not acquired" (callers only proceed if they
      // hold the lock), so a faster failure never means proceed-without-lock.
      enableOfflineQueue: false,
      commandTimeout: 2000,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 1000, 5000),
      db: this.currentDb, // DB 3 for production, DB 4 for development
      // ioredis 6 switched the default wire protocol to RESP3. Pin RESP2 (the v5
      // protocol): we use no RESP3 feature, so adopting it would be pure risk, and
      // it keeps the fail-fast tuning above behaving exactly as it was tested during
      // the fb#160 incident. Verified locally against Redis 6.0 (the version Azure
      // reports) that RESP3 does work for our access patterns — the unclosed gap is
      // Azure Cache for Redis' managed proxy, not the protocol itself. Drop this line
      // to adopt RESP3, but soak pub/sub broadcasting first.
      protocol: 2,
    };

    return process.env.REDIS_HOSTNAME
      ? {
          ...base,
          host: process.env.REDIS_HOSTNAME,
          port: parseInt(process.env.REDIS_PORT || "6380"),
          password: process.env.REDIS_ACCESS_KEY,
          tls: { servername: process.env.REDIS_HOSTNAME },
        }
      : {
          ...base,
          host: process.env.SIMPLIFIED_REDIS_HOST || "localhost",
          port: parseInt(process.env.SIMPLIFIED_REDIS_PORT || "6379"),
        };
  }

  /**
   * Initialize and get Redis client with proper connection management
   * @returns {Promise<import('ioredis').Redis | null>}
   */
  async getClient() {
    // Check if Redis cache is disabled via environment variable
    if (
      process.env.REDIS_CACHE_ENABLED === "false" ||
      (process.env.NODE_ENV === "production" &&
        process.env.REDIS_CACHE_ENABLED !== "true")
    ) {
      return null;
    }

    // Prevent multiple concurrent connection attempts
    if (this.connectionPromise) {
      return await this.connectionPromise;
    }

    if (this.isShuttingDown) {
      return null;
    }

    try {
      if (!this.client) {
        this.connectionPromise = this._createConnection();
        this.client = await this.connectionPromise;
        this.connectionPromise = null;
      }

      if (!this.isConnected && this.client) {
        let timer;
        const timeoutPromise = new Promise((resolve) => {
          // Cap the per-request ping race so a wedged Redis adds ~2s, not 10s.
          timer = setTimeout(() => resolve(null), 2000);
        });
        const pingPromise = this.client
          .ping()
          .then(() => this.client)
          .catch((pingError) => {
            this._reportPingError(pingError);
            return null;
          });
        const result = await Promise.race([pingPromise, timeoutPromise]);
        clearTimeout(timer);
        return result;
      }

      return this.client;
    } catch (error) {
      captureError(error, {
        tags: { feature: "cache", operation: "client-init" },
      });
      this.connectionPromise = null;
      return null;
    }
  }

  /**
   * Handle a ping-during-reconnect failure.
   *
   * This rejection ("Stream isn't writeable", enableOfflineQueue:false) is the
   * DESIGNED fast-fail from fb#160 — a normal Azure Redis failover/reconnect
   * produces it for a few seconds, and it is fully handled (cache fails open to
   * SQL). Reporting every blip to Sentry was self-defeating: the InstatusBot
   * health probe (GET /) tripped it on each reconnect window, burying real
   * signal under expected transients (NODE-EXPRESS-58).
   *
   * So: log a throttled breadcrumb for every blip, but only escalate to Sentry
   * once the unavailability streak is SUSTAINED past PING_SUSTAINED_MS — that's
   * a genuine Redis outage, not a routine reconnect. Both emissions are
   * throttled because getClient() is on every cache hot path (thousands of
   * pings/min during an outage). The streak resets in onReady on recovery.
   */
  _reportPingError(error) {
    const PING_SUSTAINED_MS = 30 * 1000;
    const PING_REPORT_THROTTLE_MS = 5 * 60 * 1000;
    const PING_LOG_THROTTLE_MS = 60 * 1000;
    const now = Date.now();

    if (this._pingErrorStreakStartedAt === 0) this._pingErrorStreakStartedAt = now;
    const streakMs = now - this._pingErrorStreakStartedAt;

    if (now - this._lastPingLogAt >= PING_LOG_THROTTLE_MS) {
      this._lastPingLogAt = now;
      console.warn(
        `[UniversalCache] Redis ping failed during reconnect ` +
          `(unavailable ~${Math.round(streakMs / 1000)}s): ${error && error.message}`
      );
    }

    // Transient reconnect — logged above, but not Sentry-worthy yet.
    if (streakMs < PING_SUSTAINED_MS) return;
    if (now - this._lastPingErrorReportAt < PING_REPORT_THROTTLE_MS) return;
    this._lastPingErrorReportAt = now;
    captureError(error, {
      tags: { feature: "cache", operation: "client-ping-during-reconnect" },
      extra: { unavailableMs: streakMs },
    });
  }

  /**
   * Create Redis connection with proper event handling
   */
  async _createConnection() {
    const config = this.getRedisConfig();
    // @ts-ignore - ioredis CommonJS interop: `new Redis()` works at runtime
    const client = new Redis(config);

    // Set up event handlers to prevent memory leaks
    const onReady = () => {
      this.isConnected = true;
      // Recovered — end any Redis-unavailability streak so the next outage is
      // measured fresh (and a brief flap never accrues toward "sustained").
      this._pingErrorStreakStartedAt = 0;
    };

    const onError = (err) => {
      this.isConnected = false;
      console.error("Redis error", {
        error: err.message,
        stack: err.stack,
      });
      // Don't recreate client on every error to prevent connection storms
    };

    const onClose = () => {
      this.isConnected = false;
      if (!this.isShuttingDown) {
        // Auto-reconnect will be handled by ioredis
      }
    };

    const onEnd = () => {
      this.isConnected = false;
      // Clean up event listeners to prevent memory leaks
      this._removeEventListeners(client);
    };

    client.on("ready", onReady);
    client.on("error", onError);
    client.on("close", onClose);
    client.on("end", onEnd);

    // Store references for cleanup
    client._universalCacheListeners = {
      onReady,
      onError,
      onClose,
      onEnd,
    };

    return client;
  }

  /**
   * Remove event listeners to prevent memory leaks
   */
  _removeEventListeners(client) {
    if (client && client._universalCacheListeners) {
      const { onReady, onError, onClose, onEnd } =
        client._universalCacheListeners;
      client.removeListener("ready", onReady);
      client.removeListener("error", onError);
      client.removeListener("close", onClose);
      client.removeListener("end", onEnd);
      delete client._universalCacheListeners;
    }
  }

  /**
   * Execute Redis operation with consistent error handling
   */
  async withRedis(operation, fallback = null, operationType = "operation") {
    const startTime = Date.now();

    try {
      const redis = await this.getClient();
      if (!redis) {
        return fallback;
      }

      const result = await operation(redis);

      // Record operation performance
      const duration = Date.now() - startTime;
      this.cacheMetrics.recordOperation(operationType, duration);

      return result;
    } catch (error) {
      console.error("Operation failed", {
        operationType,
        error: error.message,
      });
      this.cacheMetrics.recordError(operationType, "unknown", error);
      this._emitError(error, { operationType });
      return fallback;
    }
  }

  /**
   * Register an error handler invoked on every swallowed Redis failure.
   * Callback signature: (error, { operationType, pattern? })
   * Handler exceptions are swallowed — never let reporting kill cache path.
   */
  setErrorHandler(fn) {
    this._onError = typeof fn === 'function' ? fn : null;
  }

  _emitError(error, context) {
    if (!this._onError) return;
    try {
      this._onError(error, context);
    } catch (_handlerError) {
      // Intentional: error-reporter must never throw back into cache path.
    }
  }

  /**
   * Generate consistent cache keys for any entity type
   */
  generateKey(entityType, operation, ...params) {
    const cleanParams = params.filter((p) => p != null).map((p) => String(p));
    return `${entityType}:${operation}:${cleanParams.join(":")}`;
  }

  /**
   * Generate SHA-256 hash for cache keys (consistent short hashes)
   */
  generateHash(input, length = 8) {
    if (!input || typeof input !== "string") {
      throw new Error("Input must be a non-empty string");
    }

    return crypto
      .createHash("sha256")
      .update(input.toLowerCase().trim())
      .digest("hex")
      .substring(0, length);
  }

  /**
   * Format dates for Redis-safe cache keys
   */
  formatDateForRedis(dateInput) {
    if (dateInput === null || dateInput === undefined) return "null";

    // Handle simple yyyymmdd format (20250827)
    if (
      typeof dateInput === "number" &&
      dateInput >= 20000101 &&
      dateInput <= 99991231
    ) {
      return String(dateInput);
    }

    // Handle string formats like "20250827"
    if (typeof dateInput === "string" && /^\d{8}$/.test(dateInput)) {
      return dateInput;
    }

    if (dateInput === 0) return "0";

    // Handle Date objects and ISO strings
    let date;
    if (typeof dateInput === "string") {
      date = new Date(dateInput);
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      return String(dateInput);
    }

    if (isNaN(date.getTime())) {
      return String(dateInput);
    }

    // Format as YYYYMMDDHHMMSS
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Format dates for grid cache keys (yyyymmdd only)
   * Used for personId + pumppuAika grid cache pattern
   */
  formatGridDate(dateInput) {
    if (!dateInput) return null;

    // If already in yyyymmdd format, return as is
    if (/^\d{8}$/.test(dateInput)) return dateInput;

    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}${month}${day}`;
  }

  /**
   * Extract yyyymmdd from params for grid cache invalidation
   * Returns "*" if no date available (fallback to full invalidation)
   *
   * @param {Object} params - Invalidation parameters
   * @returns {string} yyyymmdd format date or "*" for wildcard
   */
  _extractYYYYMMDD(params) {
    const date =
      params.yyyymmdd ||
      params.body?.yyyymmdd ||
      params.body?.pumppuAika ||
      params.body?.timeStart || // For palkki operations
      params.body?.newDate ||
      params.body?.pvm ||
      params.date;

    if (!date) return "*";

    // Handle yyyymmdd format (already correct)
    if (typeof date === "string" && /^\d{8}$/.test(date)) {
      return date;
    }

    // Handle ISO date format (2025-01-05 or 2025-01-05T12:00:00)
    if (typeof date === "string" && date.length >= 10) {
      return date.substring(0, 10).replace(/-/g, "");
    }

    return "*";
  }

  /**
   * Cache data in Redis with appropriate TTL. Also populates L1 for eligible entity types.
   */
  async cache(key, data, entityType = "default") {
    return await this.withRedis(
      async (redis) => {
        const baseTtl = this.TTL[entityType] || this.TTL.default;
        // Add ±5% jitter to prevent synchronized cache expiration (cache stampede prevention)
        const jitter = Math.floor(baseTtl * 0.05 * (Math.random() * 2 - 1));
        const ttl = baseTtl + jitter;
        await redis.setex(key, ttl, JSON.stringify(data));
        // Populate L1 cache for eligible entity types
        if (this.L1_ENTITY_TYPES.has(entityType)) {
          this.l1Cache.set(key, data);
        }

        // Record cache set metric
        this.cacheMetrics.recordSet(entityType, key);

        return true;
      },
      false,
      `cache ${entityType}`,
    );
  }

  /**
   * Persist a value under an EXPLICIT TTL (seconds), unlike cache() which derives
   * the TTL from entityType (+jitter). Falls back to the entity TTL when
   * ttlSeconds is omitted. This is the write primitive getOrCompute() relies on
   * (see line ~703). Populates L1 for eligible entity types, mirroring cache().
   *
   * @param {string} key
   * @param {*} value                 Serialized as JSON.
   * @param {number} [ttlSeconds]      Explicit TTL; falls back to TTL[entityType] || TTL.default.
   * @param {string} [entityType="default"]
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttlSeconds, entityType = "default") {
    return await this.withRedis(
      async (redis) => {
        const ttl = ttlSeconds || this.TTL[entityType] || this.TTL.default;
        await redis.setex(key, ttl, JSON.stringify(value));
        if (this.L1_ENTITY_TYPES.has(entityType)) {
          this.l1Cache.set(key, value);
        }
        this.cacheMetrics.recordSet(entityType, key);
        return true;
      },
      false,
      `set ${entityType}`,
    );
  }

  /**
   * Retrieve cached data. Checks L1 in-memory cache first for eligible entity types, then Redis.
   */
  async get(key, entityType = "data") {
    // Check L1 cache first for eligible entity types
    if (this.L1_ENTITY_TYPES.has(entityType)) {
      const l1Data = this.l1Cache.get(key);
      if (l1Data !== undefined) {
        this.cacheMetrics.recordL1Hit(entityType);
        return JSON.parse(JSON.stringify(l1Data));
      }
    }

    return await this.withRedis(
      async (redis) => {
        const data = await redis.get(key);

        if (data) {
          this.cacheMetrics.recordHit(entityType);
          try {
            const parsed = JSON.parse(data);
            // Populate L1 cache on Redis hit for eligible types
            if (this.L1_ENTITY_TYPES.has(entityType)) {
              this.l1Cache.set(key, parsed);
            }
            return parsed;
          } catch (parseError) {
            // Corrupt JSON in Redis is a real bug — write race, non-JSON write,
            // or stored value mutation. Recover by deleting the key, but surface
            // the failure so the underlying write path can be fixed.
            captureError(parseError, {
              tags: { feature: "cache", operation: "corrupt-json-on-read" },
              extra: { key, entityType, sample: typeof data === "string" ? data.slice(0, 200) : null },
            });
            await redis.del(key);
            return null;
          }
        }

        this.cacheMetrics.recordMiss(entityType);
        return null;
      },
      null,
      `get ${entityType}`,
    );
  }

  /**
   * Read-through with in-process singleflight. Concurrent callers for the same key
   * share a single producer call. On cache hit, producer is never invoked.
   *
   * @param {string} key           Full cache key (use generateKey to build)
   * @param {string} entityType    TTL/L1 classification (e.g. 'betoniPrices', 'auth')
   * @param {() => Promise<any>} producer   Async function to compute the value on miss
   * @param {number} [ttlSeconds]  Override TTL; falls back to this.TTL[entityType]
   * @returns {Promise<any>} cached or freshly computed value
   */
  async getOrCompute(key, entityType, producer, ttlSeconds) {
    const cached = await this.get(key, entityType);
    if (cached !== null && cached !== undefined) return cached;

    const existing = this._inflight.get(key);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const value = await producer();
        if (value !== null && value !== undefined) {
          const ttl = ttlSeconds || this.TTL[entityType] || this.TTL.default;
          await this.set(key, value, ttl, entityType);
        }
        return value;
      } finally {
        this._inflight.delete(key);
      }
    })();

    this._inflight.set(key, promise);
    return promise;
  }

  /**
   * Production-safe key scanning using SCAN instead of KEYS
   */
  async scanKeys(pattern, scanCount = this.SCAN_COUNT) {
    return await this.withRedis(
      async (redis) => {
        const keys = [];
        let cursor = "0";
        let iterations = 0;
        const maxIterations = 1000; // Prevent infinite loops

        do {
          // Add small delay to prevent Redis overload during large scans
          if (iterations > 0 && iterations % 10 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1));
          }

          try {
            const result = await redis.scan(
              cursor,
              "MATCH",
              pattern,
              "COUNT",
              scanCount,
            );
            cursor = result[0];
            keys.push(...result[1]);
            iterations++;

            // Circuit breaker for runaway scans
            if (iterations > maxIterations) {
              console.log("Scan iteration limit reached", {
                pattern,
                maxIterations,
              });
              break;
            }
          } catch (scanError) {
            console.error("Scan error", {
              pattern,
              iteration: iterations,
              error: scanError.message,
            });
            // Error swallowed here (not rethrown), so withRedis outer catch will not also emit.
            this._emitError(scanError, { operationType: 'scan keys', pattern });
            // Continue with partial results rather than failing completely
            break;
          }
        } while (cursor !== "0");

        return keys;
      },
      [],
      "scan keys",
    );
  }

  /**
   * Safe batch deletion of keys
   */
  async batchDelete(keys, batchSize = this.BATCH_SIZE) {
    if (!keys || keys.length === 0) return 0;

    return await this.withRedis(
      async (redis) => {
        let deletedCount = 0;

        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);

          try {
            await redis.del(...batch);
            deletedCount += batch.length;
          } catch (deleteError) {
            console.error("Batch delete error", {
              error: deleteError.message,
              batchSize: batch.length,
            });
            // Error swallowed here (not rethrown), so withRedis outer catch will not also emit.
            this._emitError(deleteError, { operationType: 'batch delete' });
            continue;
          }
        }

        return deletedCount;
      },
      0,
      "batch delete",
    );
  }

  /**
   * Invalidate cache keys by pattern. Clears matching L1 entries first, then Redis via scan+delete.
   */
  async invalidateByPattern(pattern) {
    // Clear matching L1 entries (isolated so a failure doesn't block Redis invalidation)
    try {
      if (pattern.includes("*")) {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
        for (const key of this.l1Cache.keys()) {
          if (regex.test(key)) {
            this.l1Cache.delete(key);
          }
        }
      } else {
        this.l1Cache.delete(pattern);
      }
    } catch (l1Error) {
      console.log("L1 cache pattern clear failed, continuing with Redis", {
        pattern,
        error: l1Error.message,
      });
    }

    const keys = await this.scanKeys(pattern);
    if (keys.length > 0) {
      const deletedCount = await this.batchDelete(keys);

      // Record invalidation metric
      const entityType = pattern.split(":")[0] || "unknown";
      this.cacheMetrics.recordInvalidation(entityType, pattern, deletedCount);

      return deletedCount;
    }
    return 0;
  }

  /**
   * Clear all L1 in-memory cache entries
   * Called by memoryManager during memory pressure cleanup
   */
  clearL1Cache() {
    this.l1Cache.clear();
  }

  /**
   * Clear all cached data (all Redis entity types + L1 in-memory).
   * Safer than flushdb — only clears cache keys, not socket sessions, metrics,
   * locks, or grid:last-update markers.
   *
   * Sweeps every BASE_TTL entity prefix plus the ORPHAN_PREFIXES list, then
   * filters out any key whose prefix matches EXCLUDE_PREFIXES before deleting.
   * Note that without the post-filter step, "grid:*" would sweep
   * "grid:last-update:*" too — those are reconnect-timestamp keys that must
   * survive an admin clear.
   *
   * Pattern SCANs run in parallel via Promise.all — Redis is single-threaded
   * but ioredis pipelines the SCAN cursor RTTs across patterns, cutting wall
   * time roughly proportional to the number of patterns.
   *
   * @returns {Promise<number>} Total Redis keys actually deleted (post-filter).
   */
  async clearAllCache() {
    const baseTtlPatterns = Object.keys(this.BASE_TTL)
      .filter((entityType) => entityType !== "default")
      .map((entityType) => `${entityType}:*`);
    const allPatterns = [...baseTtlPatterns, ...this.ORPHAN_PREFIXES];

    const keyArrays = await Promise.all(
      allPatterns.map((pattern) => this.scanKeys(pattern)),
    );

    // Union, then drop anything in an excluded namespace.
    const candidates = [...new Set(keyArrays.flat())];
    const survivors = candidates.filter(
      (key) => !this.EXCLUDE_PREFIXES.some((prefix) => key.startsWith(prefix)),
    );

    const deleted = survivors.length > 0 ? await this.batchDelete(survivors) : 0;

    if (deleted > 0) {
      this.cacheMetrics.recordInvalidation("all", "clearAllCache", deleted);
    }

    this.clearL1Cache();
    return deleted;
  }

  /**
   * Get L1 cache statistics for monitoring
   */
  getL1Stats() {
    return {
      size: this.l1Cache.size,
      maxSize: this.l1Cache.max,
      entityTypes: Array.from(this.L1_ENTITY_TYPES),
    };
  }

  /**
   * Universal cache invalidation for all entity types.
   * Clears both Redis keys and L1 in-memory cache entries (for entity types in L1_ENTITY_TYPES).
   *
   * Entity-specific behaviors:
   * - keikka: Targets individual keikka + list caches by date/personId
   * - asiakas: Pattern-based by asiakasId
   * - grid: Invalidates grid:v7tenant:{dateKey}:* (list_v7tenant endpoint)
   * - stat: Clears all stat caches (varying segment counts)
   * - attachment: Multiple patterns for different attachment key formats
   * - default: Pattern-based `{entityType}:*:{asiakasId}*` for all other types
   *
   * @param {string} operation - Operation type (KEIKKA_UPDATE, PALKKI_UPDATE, etc.)
   * @param {string} entityType - Entity type (keikka, grid, asiakas, etc.)
   * @param {Object} params - Parameters for invalidation
   * @param {string} [params.asiakasId] - Customer ID for scoping
   * @param {string} [params.personId] - Person ID
   * @param {string} [params.pumppuAika] - Date for date-scoped invalidation (ISO format)
   * @param {string} [params.betoniToimittajaAsiakasId] - Supplier ID for betoni laatu cache keys
   * @param {Object} [params.body] - Request body with nested date/entity fields
   * @param {string} [params.newDate] - New date for date-change operations
   * @param {string} [params.date] - Fallback date field
   * @param {string} [params.yyyymmdd] - Date in YYYYMMDD format
   * @param {string} [params.keikkaId] - Keikka ID for entity-specific invalidation
   * @param {string} [params.entityId] - Generic entity ID
   * @returns {Promise<number>} Number of cache keys invalidated
   */
  async invalidate(operation, entityType, params = {}) {
    // Safely extract parameters
    const asiakasId = params.asiakasId;
    const pumppuAika = params.pumppuAika;

    // Generate invalidation pattern
    let pattern = "";
    switch (entityType) {
      case "keikka": {
        const keikkaIdValue =
          params.body?.keikkaId || params.keikkaId || params.entityId;

        const individualPattern = keikkaIdValue
          ? `keikka:get:${keikkaIdValue}:*`
          : `keikka:get:*`;

        return await this.invalidateByPattern(individualPattern);
      }
      case "asiakas":
        pattern = `asiakas:*:${asiakasId || "*"}*`;
        break;
      case "vehicleRequiredDateType":
      case "personRequiredDateType":
      case "tyomaaRequiredDateType":
      case "asiakasRequiredDateType":
        // These keys have variable segments:
        // - 3 segments: entityType:operation:asiakasId (e.g., vehicleRequiredDateType:compliance:8)
        // - 5 segments: entityType:operation:asiakasId:ids:date (e.g., vehicleRequiredDateType:batchCompliance:8:1,51,52:20260109)
        // Trailing * matches both formats
        pattern = `${entityType}:*:${asiakasId || "*"}*`;
        break;
      case "stat":
        // Stat keys have varying segment counts (3-6 segments):
        // - stat:stat4:{ownerAsiakasId} (3 segments)
        // - stat:stat2:{pumppuAsiakasId}:{betoniAsiakasId} (4 segments)
        // - stat:stat1:{year}:{month}:{ownerAsiakasId} (5 segments)
        // - stat:count:{...4 params} (6 segments)
        // Use simple prefix pattern to catch all stat keys
        return await this.invalidateByPattern(`stat:*`);
      case "grid": {
        // Grid key format: grid:v7tenant:{dateKey}:{sortedAsiakasIds}:{outputMode}
        const dateKey = pumppuAika ? this.formatGridDate(pumppuAika) : null;
        const datePattern = dateKey || "*";

        const patterns = [`grid:v7tenant:${datePattern}:*`];

        // Invalidate all patterns and return combined count
        const results = await Promise.all(
          patterns.map((p) => this.invalidateByPattern(p)),
        );
        const totalDeleted = results.reduce((sum, c) => sum + c, 0);

        return totalDeleted;
      }
      case "attachment": {
        // Attachments have multiple key formats:
        // 1. Individual/list keys: attachment:list:keikka:123, attachment:list:vehicle:456, attachment:get:789
        // 2. Bulk keys: attachment:bulk:keikka:<hash>
        // 3. Search keys: attachment:search:asiakasId:<hash> (4 segments)
        // 4. Type keys: attachment:types:asiakasId (3 segments)
        // 5. Missing keys: attachment:listMissing:asiakasId (3 segments)

        // Invalidate ALL attachment-related keys to ensure consistency
        // This includes bulk keikka attachment lists that don't have asiakasId in the key
        const patterns = [
          `attachment:*:${asiakasId || "*"}:*`, // 4-segment asiakasId-based keys (search)
          `attachment:listMissing:${asiakasId || "*"}`, // 3-segment listMissing keys
          `attachment:types:${asiakasId || "*"}`, // 3-segment type keys
          `attachment:bulk:*:*`, // bulk keikka attachment lists
          `attachment:list:*:*`, // individual entity attachment lists
          `attachment:get:*`, // individual attachment gets
        ];

        const results = await Promise.all(
          patterns.map((p) => this.invalidateByPattern(p)),
        );
        return results.reduce((sum, c) => sum + c, 0);
      }
      case "personpvm":
        // PersonPVM keys: personpvm:list:asiakasId or personpvm:list:asiakasId:startDate:endDate
        // Use trailing wildcard to match both 3-segment and 5-segment keys
        pattern = `personpvm:*:${asiakasId || "*"}*`;
        break;
      case "keikkaBetoni":
        // keikkaBetoni keys: keikkaBetoni:list:asiakasId:keikkaId, keikkaBetoni:get:asiakasId:keikkaBetoniId
        pattern = `keikkaBetoni:*:${asiakasId || "*"}:*`;
        break;
      default:
        // Use trailing wildcard (no colon) to match 3+ segment keys like entity:list:asiakasId
        pattern = `${entityType}:*:${asiakasId || "*"}*`;
    }

    // Clear matching L1 entries (L1 uses same key format as Redis)
    if (this.L1_ENTITY_TYPES.has(entityType)) {
      try {
        if (pattern.includes("*")) {
          const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
          for (const key of this.l1Cache.keys()) {
            if (regex.test(key)) {
              this.l1Cache.delete(key);
            }
          }
        } else {
          this.l1Cache.delete(pattern);
        }
      } catch (l1Error) {
        console.log("L1 cache clear failed in invalidate", {
          pattern,
          error: l1Error.message,
        });
      }
    }

    const keys = await this.scanKeys(pattern);

    if (keys.length > 0) {
      const deletedCount = await this.batchDelete(keys);
      return deletedCount;
    }

    return 0;
  }

  /**
   * Smart grid invalidation based on operation type and request body.
   *
   * Date extraction priority for different operations:
   * - KEIKKA_UPDATE/COPY: Uses `pumppuAika` or `newDate` from body (ISO datetime format)
   * - PERSON_PVM_*: Uses `pvm` or `yyyymmdd` from body/params (YYYYMMDD format)
   * - PALKKI_*: Uses `pumppuAika`, `timeStart`, or `body.pumppuAika` (ISO datetime format)
   *
   * The `formatGridDate` method handles both YYYYMMDD and ISO datetime formats.
   *
   * @param {string} operation - Operation type (KEIKKA_UPDATE, KEIKKA_COPY, PERSON_PVM_*, PALKKI_*)
   * @param {Object} body - Request body containing date fields
   * @param {Object} params - Additional parameters including asiakasId
   * @returns {Promise<number>} Number of cache keys invalidated
   */
  async invalidateGridSmart(operation, body = {}, params = {}) {
    const { pumppuAika, newDate } = body;
    const asiakasId = params.asiakasId;

    switch (operation) {
      case "KEIKKA_UPDATE": {
        let totalInvalidated = 0;

        if (newDate) {
          totalInvalidated += await this.invalidate(operation, "grid", {
            asiakasId,
            pumppuAika: newDate,
          });
          return totalInvalidated;
        }

        if (pumppuAika) {
          totalInvalidated += await this.invalidate(operation, "grid", {
            asiakasId,
            pumppuAika,
          });
        } else {
          totalInvalidated += await this.invalidate(operation, "grid", {
            asiakasId,
          });
        }

        return totalInvalidated;
      }

      case "KEIKKA_COPY":
        if (newDate) {
          return await this.invalidate(operation, "grid", {
            asiakasId,
            pumppuAika: newDate,
          });
        } else {
          console.log("KEIKKA_COPY without newDate - no invalidation", {
            operation,
          });
          return 0;
        }

      case "PERSON_PVM_UPDATE":
      case "PERSON_PVM_DELETE":
      case "PERSON_PVM_CREATE": {
        // PersonPvm affects grid display - invalidate by date if available
        // PersonPvm uses 'pvm' (YYYYMMDD format), not 'pumppuAika' - check both
        const dateValue =
          pumppuAika ||
          body?.pvm ||
          body?.yyyymmdd ||
          params?.pvm ||
          params?.yyyymmdd;

        if (dateValue) {
          return await this.invalidate(operation, "grid", {
            asiakasId,
            pumppuAika: dateValue, // formatGridDate handles both YYYYMMDD and ISO formats
          });
        }

        return 0;
      }

      case "PALKKI_UPDATE":
      case "PALKKI_DELETE":
      case "PALKKI_CREATE": {
        // Palkki uses timeStart for date, params extractor maps it to pumppuAika
        const palkkiDate = pumppuAika || body?.timeStart || body?.pumppuAika;

        if (palkkiDate) {
          const dateKey = this.formatGridDate(palkkiDate);
          return await this.invalidate(operation, "grid", {
            asiakasId,
            pumppuAika: dateKey,
          });
        }

        // Fallback: no date available
        console.log("PALKKI operation without date - broad invalidation", {
          operation,
          asiakasId,
        });
        return await this.invalidate(operation, "grid", { asiakasId });
      }

      case "TYOMAA_UPDATE":
      case "TYOMAA_CREATE":
      case "TYOMAA_DELETE": {
        // Tyomaa changes affect grid display - invalidate by date if available
        const tyomaaDate =
          body?.yyyymmdd ||
          body?.pumppuAika ||
          params?.yyyymmdd ||
          params?.pumppuAika;

        if (tyomaaDate) {
          return await this.invalidate(operation, "grid", {
            asiakasId,
            pumppuAika: tyomaaDate,
          });
        }
        // No date available - return 0, caller handles broad invalidation
        return 0;
      }

      default:
        console.log("Unknown grid operation, using broad invalidation", {
          operation,
          asiakasId,
        });
        return await this.invalidate(operation, "grid", { asiakasId });
    }
  }

  /**
   * The `geocode:` read keys a sijainti-row write makes stale — the single
   * source of truth shared by SIJAINTI_* and SIJAINTI_LATLNG_UPDATE, so the two
   * can never drift apart (that drift is what left `ib sijainti list` uncleared;
   * see the `geocode:cli:*` note below).
   *
   * fb#93: these keys embed sijaintiId / typeId / tyomaaId as their 3rd segment
   * — never asiakasId — so the generic entity pattern (`geocode:*:<asiakasId>*`)
   * matched none of them and sijainti get/list reads stayed stale until TTL.
   * Target the real key shapes instead (generateGeocodeExtendedKey in
   * puminet5api/modules/cache/universal/universalCacheStrategy.js).
   *
   * fb#322: `geocode:cli:<owner>:<hash>` (GET /api/cli/sijainti/list, i.e.
   * `ib sijainti list`) WAS shaped to fall under that generic glob — it is the
   * one geocode key whose 3rd segment IS the tenant — so replacing the glob in
   * fb#93 silently dropped it. It must be swept explicitly.
   *
   * Driving-distance (`geocode:distance:*`) and `geocode:metrics` are
   * coordinate-/global-keyed and stay correct across a row write — left alone.
   *
   * @param {number|string|null|undefined} sijaintiId - falsy widens the
   *   per-row key to a wildcard (invalidate every cached sijainti).
   * @returns {string[]} Redis key globs to sweep.
   */
  _sijaintiGeocodeReadPatterns(sijaintiId) {
    return [
      `geocode:sijainti:${sijaintiId || "*"}`,
      "geocode:sijaintiList:*",
      "geocode:closest:*",
      "geocode:cli:*",
    ];
  }

  /**
   * Cross-entity invalidation for complex operations
   * CRITICAL: This is what tilaCron needs for KEIKKA_BULK_UPDATE
   */
  async invalidateCrossEntity(operation, params = {}) {
    let totalInvalidated = 0;

    switch (operation) {
      case "KEIKKA_UPDATE":
      case "KEIKKA_DELETE":
      case "KEIKKA_CREATE": {
        // invalidateGridSmart handles grid:v7tenant patterns
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const counts = await Promise.all([
          this.invalidate(operation, "keikka", params),
          this.invalidate(operation, "keikkaPerson", params),
          this.invalidate(operation, "keikkaBetoni", params),
          this.invalidate(operation, "stepLog", params),
          this.invalidate(operation, "attachment", params),
          this.invalidateGridSmart(operation, params.body || {}, params),
          this.invalidateByPattern("keikka:listByAsiakases:*"),
          this.invalidateByPattern(`ecofleet:keikka:*:${today}`),
        ]);
        totalInvalidated += counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      case "KEIKKA_BULK_UPDATE":
        totalInvalidated += await this.invalidate(operation, "keikka", params);
        totalInvalidated += await this.invalidateGridSmart(
          operation,
          params.body || {},
          params,
        );
        totalInvalidated += await this.invalidate(operation, "asiakas", params);
        break;

      case "PALKKI_UPDATE":
      case "PALKKI_DELETE":
      case "PALKKI_CREATE": {
        // Palkki operations affect grid cache, keikka list cache, grid role caches, AND palkki list cache
        const datePattern = this._extractYYYYMMDD(params);

        // Parallelize independent invalidations
        const [palkkiGridCount, keikkaListCount, gridRoleCount] =
          await Promise.all([
            this.invalidateGridSmart(operation, params.body || {}, params),
            this.invalidate(operation, "keikka", {
              asiakasId: params.asiakasId,
              pumppuAika: params.pumppuAika || params.body?.pumppuAika,
            }),
            this.invalidateByPattern(`grid:v7tenant:${datePattern}:*`),
          ]);

        // Invalidate palkki list cache - DATE-SPECIFIC when frontend provides data
        const cacheInvalidation = params.cacheInvalidation;
        let palkkiListCount = 0;

        if (
          cacheInvalidation?.yyyymmdd?.length &&
          cacheInvalidation?.visibleAsiakasIds?.length
        ) {
          // Precise invalidation: specific dates for each visible customer
          const customersToInvalidate = new Set(
            cacheInvalidation.visibleAsiakasIds,
          );
          // Ensure owner is always included (may not be in visibility list)
          if (params.asiakasId) {
            customersToInvalidate.add(params.asiakasId);
          }

          const palkkiPatterns = [];
          for (const customerId of customersToInvalidate) {
            for (const yyyymmdd of cacheInvalidation.yyyymmdd) {
              palkkiPatterns.push(
                `grid:palkki:list:${customerId}:${yyyymmdd}:*`,
              );
            }
          }
          const palkkiResults = await Promise.all(
            palkkiPatterns.map((p) => this.invalidateByPattern(p)),
          );
          palkkiListCount = palkkiResults.reduce((sum, c) => sum + c, 0);
        } else if (params.asiakasId) {
          // Fallback: broad invalidation if no invalidation data provided
          palkkiListCount = await this.invalidateByPattern(
            `grid:palkki:list:${params.asiakasId}:*`,
          );
        }

        // If vehicle changed, also invalidate vehicle cache
        const palkkiVehicleCount =
          params.vehicleId || params.body?.vehicleId
            ? await this.invalidate(operation, "vehicle", params)
            : 0;

        totalInvalidated +=
          palkkiGridCount +
          keikkaListCount +
          gridRoleCount +
          palkkiListCount +
          palkkiVehicleCount;
        break;
      }

      case "GRID_UPDATE":
        // Simple grid-only invalidation for visibility changes
        totalInvalidated += await this.invalidateGridSmart(
          operation,
          params.body || {},
          params,
        );
        break;

      case "VEHICLE_DATE_DISMISS":
      case "VEHICLE_DATE_UNDISMISS":
      case "VEHICLE_DATE_UPDATE":
      case "VEHICLE_DATE_CREATE":
      case "VEHICLE_DATE_DELETE": {
        const counts = await Promise.all([
          this.invalidate(operation, "vehicleDate", params),
          this.invalidate(operation, "vehicle", params),
          this.invalidate(operation, "vehicleRequiredDateType", params),
          this.invalidateGridSmart(operation, params.body || {}, params),
          // /api/compliance/dashboard-summary aggregates across all *_DATE entities.
          this.invalidateByPattern(`complianceDashboard:*`),
        ]);
        totalInvalidated += counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      case "PERSON_DATE_DISMISS":
      case "PERSON_DATE_UNDISMISS":
      case "PERSON_DATE_UPDATE":
      case "PERSON_DATE_CREATE":
      case "PERSON_DATE_DELETE": {
        // CRITICAL: keikka cache must be invalidated because order views show person compliance status
        const counts = await Promise.all([
          this.invalidate(operation, "personDate", params),
          this.invalidate(operation, "person", params),
          this.invalidate(operation, "personRequiredDateType", params),
          this.invalidateGridSmart(operation, params.body || {}, params),
          this.invalidate(operation, "keikka", params),
          this.invalidateByPattern(`complianceDashboard:*`),
        ]);
        totalInvalidated += counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      case "TYOMAA_DATE_DISMISS":
      case "TYOMAA_DATE_UNDISMISS":
      case "TYOMAA_DATE_UPDATE":
      case "TYOMAA_DATE_CREATE":
      case "TYOMAA_DATE_DELETE": {
        // CRITICAL: keikka cache must be invalidated because order views show tyomaa compliance status
        const counts = await Promise.all([
          this.invalidate(operation, "tyomaaDate", params),
          this.invalidate(operation, "tyomaa", params),
          this.invalidate(operation, "tyomaaRequiredDateType", params),
          this.invalidateGridSmart(operation, params.body || {}, params),
          this.invalidate(operation, "keikka", params),
          this.invalidateByPattern(`complianceDashboard:*`),
        ]);
        totalInvalidated += counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      case "ASIAKAS_DATE_DISMISS":
      case "ASIAKAS_DATE_UNDISMISS":
      case "ASIAKAS_DATE_UPDATE":
      case "ASIAKAS_DATE_CREATE":
      case "ASIAKAS_DATE_DELETE": {
        const counts = await Promise.all([
          this.invalidate(operation, "asiakasDate", params),
          this.invalidate(operation, "asiakas", params),
          this.invalidate(operation, "asiakasRequiredDateType", params),
          this.invalidateGridSmart(operation, params.body || {}, params),
          this.invalidateByPattern(`complianceDashboard:*`),
        ]);
        totalInvalidated += counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      // Asiakas CRUD operations - invalidate asiakas and related entity caches
      case "ASIAKAS_UPDATE":
      case "ASIAKAS_CREATE":
      case "ASIAKAS_DELETE": {
        // Basic asiakas cache invalidation
        const asiakasOpCount = await this.invalidate(
          operation,
          "asiakas",
          params,
        );
        totalInvalidated += asiakasOpCount;

        // If keikkaId is provided, also invalidate keikka cache
        // This handles cases where keikkaAsiakas table is updated
        if (params.keikkaId) {
          const keikkaOpCount = await this.invalidate(
            operation,
            "keikka",
            params,
          );
          totalInvalidated += keikkaOpCount;
        }

        // If linkedAsiakasId is provided (for asiakasLinks), invalidate both customers
        if (params.linkedAsiakasId) {
          const linkedAsiakasCount = await this.invalidate(
            operation,
            "asiakas",
            {
              ...params,
              asiakasId: params.linkedAsiakasId,
            },
          );
          totalInvalidated += linkedAsiakasCount;
        }

        // Invalidate grid cache - asiakas settings affect grid visibility
        // (e.g., setting 33 controls betoni manufacturer visibility)
        const gridCount = await this.invalidate(operation, "grid", params);
        totalInvalidated += gridCount;

        break;
      }

      case "ASIAKAS_MERGE": {
        // Customer merge rewrites FKs across ~100 columns and soft-deletes the
        // secondary customer. Every tenant-scoped cache that could reference
        // either customer must be cleared, so we invalidate broadly.
        const affectedEntities = params.affectedEntities || [
          "asiakas",
          "keikka",
          "tyomaa",
          "person",
          "sijainti",
          "grid",
          "stat",
          "lasku",
          "laskupohja",
          "attachment",
          "personpvm",
          "keikkaBetoni",
          "betoniLaatu",
          "asiakasDate",
          "tyomaaDate",
          "personDate",
          "vehicleDate",
        ];

        const counts = await Promise.all([
          ...affectedEntities.map((entityType) =>
            this.invalidate(operation, entityType, params),
          ),
          this.invalidateByPattern("keikka:listByAsiakases:*"),
          this.invalidateByPattern("asiakas:list:*"),
          this.invalidateByPattern("grid:v7tenant:*:*"),
          this.invalidateByPattern("grid:palkki:list:*"),
        ]);
        totalInvalidated += counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      case "PERSON_PVM_UPDATE":
      case "PERSON_PVM_DELETE":
      case "PERSON_PVM_CREATE": {
        const datePattern = this._extractYYYYMMDD(params);
        const counts = await Promise.all([
          this.invalidate(operation, "personpvm", params),
          this.invalidateGridSmart(operation, params.body || {}, params),
          this.invalidate(operation, "person", params),
          params.vehicleId
            ? this.invalidate(operation, "vehicle", params)
            : Promise.resolve(0),
          this.invalidateByPattern(`grid:v7tenant:${datePattern}:*`),
        ]);
        totalInvalidated += counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      case "ATTACHMENT_UPDATE": {
        // Targeted attachment invalidation based on entityType and entityId
        const { entityType, entityId, asiakasId } = params;

        const patterns = [];

        // Invalidate specific entity's attachment list
        if (entityType && entityId) {
          patterns.push(`attachment:list:${entityType}:${entityId}`);
        }

        // Invalidate asiakasId-based keys
        if (asiakasId) {
          patterns.push(`attachment:listMissing:${asiakasId}`);
          patterns.push(`attachment:types:${asiakasId}`);
          patterns.push(`attachment:*:${asiakasId}:*`);
        }

        // If keikka attachment, also invalidate bulk keikka queries
        if (entityType === "keikka" && entityId) {
          patterns.push(`attachment:bulk:keikka:*`);
        }

        // Tuote attachments affect the Varastosaldo list (primaryAttachmentId
        // column comes from EntityPrimaryAttachment join in tuotteet_varastoList SP).
        if (entityType === "tuote" && entityId) {
          patterns.push(`inventory:varastoList:*`);
        }

        const counts = await Promise.all(
          patterns.map((p) => this.invalidateByPattern(p)),
        );
        totalInvalidated = counts.reduce((sum, count) => sum + count, 0);

        // Cross-entity invalidations for grid display consistency
        // Keikka attachments affect grid views (attachment indicators)
        if (entityType === "keikka" && entityId) {
          const gridCount = await this.invalidateGridSmart(
            operation,
            params.body || {},
            params,
          );
          totalInvalidated += gridCount;
        }

        // Vehicle attachments affect keikka and grid views (vehicle attachment status)
        if (entityType === "vehicle" && entityId) {
          const [keikkaCount, gridCount] = await Promise.all([
            this.invalidate(operation, "keikka", params),
            this.invalidateGridSmart(operation, params.body || {}, params),
          ]);
          totalInvalidated += keikkaCount + gridCount;
        }

        break;
      }

      // Azure Functions background job operations
      case "LASKU_SYNC":
        // Fennoa invoice sync - invalidate invoice-related caches
        totalInvalidated += await this.invalidate(operation, "keikka", params);
        totalInvalidated += await this.invalidate(operation, "lasku", params);
        totalInvalidated += await this.invalidate(operation, "stat", params);
        break;

      case "HOLIDAY_SYNC":
        // National holiday sync - invalidate holiday and schedule caches
        totalInvalidated += await this.invalidate(operation, "holiday", params);
        totalInvalidated += await this.invalidate(
          operation,
          "personpvm",
          params,
        );
        totalInvalidated += await this.invalidate(operation, "grid", params);
        break;

      case "CLEANUP_ALL":
        // SQL cleanup job - invalidate stat and log caches
        totalInvalidated += await this.invalidate(operation, "stat", params);
        totalInvalidated += await this.invalidate(operation, "stepLog", params);
        break;

      // Betoni operations - keys use 'betoni:' prefix, NOT 'betoniLaatu:'
      case "BETONI_LAATU_UPDATE":
      case "BETONI_LAATU_CREATE": {
        // CRITICAL: Cache keys are generated as 'betoni:laatu:list:X' and 'betoni:laatu:filter:X'
        // where X is betoniToimittajaAsiakasId (supplier ID), NOT ownerAsiakasId
        // Default pattern would incorrectly use 'betoniLaatu:*' which never matches
        const betoniToimittajaAsiakasId =
          params.betoniToimittajaAsiakasId || params.asiakasId;
        const [
          betoniLaatuListCount,
          betoniLaatuFilterCount,
          betoniLaatuGetCount,
          betoniListCount,
        ] = await Promise.all([
          this.invalidateByPattern(
            `betoni:laatu:list:${betoniToimittajaAsiakasId || "*"}`,
          ),
          this.invalidateByPattern(
            `betoni:laatu:filter:${betoniToimittajaAsiakasId || "*"}`,
          ),
          this.invalidateByPattern(`betoni:laatu:get:*`),
          this.invalidateByPattern(`betoni:list:filter:*`), // Also invalidate search results
        ]);
        totalInvalidated +=
          betoniLaatuListCount +
          betoniLaatuFilterCount +
          betoniLaatuGetCount +
          betoniListCount;
        break;
      }

      case "BETONI_SHORTCUT_UPDATE": {
        // Keys are 3 segments: 'betoniShortcut:list:asiakasId'
        // Default pattern expects 4 segments which never matches
        const shortcutAsiakasId = params.asiakasId;
        const shortcutPattern = shortcutAsiakasId
          ? `betoniShortcut:list:${shortcutAsiakasId}`
          : `betoniShortcut:list:*`;
        const shortcutCount = await this.invalidateByPattern(shortcutPattern);
        totalInvalidated += shortcutCount;
        break;
      }

      // Person operations - cross-entity invalidation for person data changes
      case "PERSON_MERGE": {
        // Person merge affects 34 tables - comprehensive invalidation required

        const counts = await Promise.all([
          this.invalidate(operation, "person", params),
          this.invalidate(operation, "keikka", params),
          this.invalidate(operation, "keikkaPerson", params),
          this.invalidate(operation, "grid", params),
          this.invalidate(operation, "asiakas", params),
          this.invalidate(operation, "tyomaa", params),
          this.invalidate(operation, "tyomaaPerson", params),
          this.invalidate(operation, "vehicle", params),
          this.invalidate(operation, "personpvm", params),
          this.invalidate(operation, "attachment", params),
          this.invalidate(operation, "stat", params),
          this.invalidate(operation, "betoni", params),
          this.invalidate(operation, "lasku", params),
          this.invalidateByPattern("auth:*"),
        ]);
        totalInvalidated = counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      case "PERSON_TENANT_UPDATE": {
        // Lightweight person update (e.g. tenant selection change)
        // Does not affect grid, keikkas, or other entities
        totalInvalidated += await this.invalidate(operation, "person", params);
        break;
      }

      case "PERSON_UPDATE": {
        // Person updates affect contact displays across modules
        const personEntityId = params.entityId || params.personId;
        const counts = await Promise.all([
          this.invalidate(operation, "person", params),
          this.invalidate(operation, "keikka", params),
          this.invalidate(operation, "asiakas", params),
          this.invalidate(operation, "tyomaa", params),
          this.invalidate(operation, "grid", params),
          personEntityId
            ? this.invalidateByPattern(`auth:*:${personEntityId}*`)
            : Promise.resolve(0),
          // /profile Asiakkaat role chips read asiakas:myRoles:* — wildcard the
          // asiakas slot so cross-tenant cached entries for this person are cleared.
          personEntityId
            ? this.invalidateByPattern(`asiakas:myRoles:*:${personEntityId}`)
            : Promise.resolve(0),
          // person:forKeikka:get:{keikkaId}[:{personId}] has no asiakasId slot —
          // wildcard person:* won't match it. Sweep by keikkaId when known.
          params.keikkaId
            ? this.invalidateByPattern(`person:forKeikka:get:${params.keikkaId}*`)
            : Promise.resolve(0),
          this.invalidateByPattern("grid:v7tenant:*"),
        ]);
        totalInvalidated = counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      case "PERSON_DELETE": {
        // Person deletion must remove from all listings and assignments (soft delete)
        const deletedPersonId = params.entityId || params.personId;
        const counts = await Promise.all([
          this.invalidate(operation, "person", params),
          this.invalidate(operation, "keikka", params),
          this.invalidate(operation, "asiakas", params),
          this.invalidate(operation, "tyomaa", params),
          this.invalidate(operation, "grid", params),
          deletedPersonId
            ? this.invalidateByPattern(`auth:*:${deletedPersonId}*`)
            : Promise.resolve(0),
          deletedPersonId
            ? this.invalidateByPattern(`asiakas:myRoles:*:${deletedPersonId}`)
            : Promise.resolve(0),
          // Person removed from a keikka — sweep keyless person:forKeikka entries.
          params.keikkaId
            ? this.invalidateByPattern(`person:forKeikka:get:${params.keikkaId}*`)
            : Promise.resolve(0),
          this.invalidateByPattern("grid:v7tenant:*"),
        ]);
        totalInvalidated = counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      // Sijainti (location) changes affect tyomaa lookups, keikka deliveries, and grid displays
      case "SIJAINTI_UPDATE":
      case "SIJAINTI_CREATE":
      case "SIJAINTI_DELETE": {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const counts = await Promise.all([
          ...this._sijaintiGeocodeReadPatterns(
            params.sijaintiId || params.entityId,
          ).map((p) => this.invalidateByPattern(p)),
          this.invalidate(operation, "tyomaa", params),
          this.invalidate(operation, "keikka", params),
          this.invalidateGridSmart("TYOMAA_UPDATE", params.body || {}, params),
          this.invalidate(operation, "asiakas", params),
          this.invalidateByPattern(`ecofleet:vehicleDayTimeline:*:${today}`),
          this.invalidateByPattern(`ecofleet:vehicleDayRoute:*:${today}`),
          this.invalidateByPattern("inventory:dashboard:*"), // sijainti.isVarasto feeds the Varasto dashboard
        ]);
        totalInvalidated += counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      // Coordinate-only write (sijainti_LatLng_save). Deliberately NARROWER than
      // SIJAINTI_UPDATE: it sweeps the geocode read keys and nothing else.
      // fb#322 — the writer geoCodeSql.updateSijaintiLatLng() is called from
      // paths that never pass the route invalidation middleware (jerry enable →
      // geocodeEmptyVarikot, toimittaja find → updateEmptySijaintiLatLng), so it
      // must invalidate itself; but those callers run it in a LOOP and pass no
      // asiakasId, under which SIJAINTI_UPDATE's asiakas/keikka/grid fan-out
      // degrades to `asiakas:*:**` + `grid:v7tenant:*:*` — a cross-tenant cache
      // wipe per geocoded row. Coords change no keikka/grid/tyomaa payload, so
      // that fan-out is not needed here either.
      case "SIJAINTI_LATLNG_UPDATE": {
        const counts = await Promise.all(
          this._sijaintiGeocodeReadPatterns(
            params.sijaintiId || params.entityId,
          ).map((p) => this.invalidateByPattern(p)),
        );
        totalInvalidated += counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      case "TYOMAA_UPDATE":
      case "TYOMAA_CREATE":
      case "TYOMAA_DELETE": {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const counts = await Promise.all([
          this.invalidate(operation, "tyomaa", params),
          this.invalidate(operation, "keikka", params),
          this.invalidate(operation, "tyomaaPerson", params),
          this.invalidate(operation, "person", params),
          this.invalidateGridSmart(operation, params.body || {}, params),
          this.invalidateByPattern(`ecofleet:vehicleDayTimeline:*:${today}`),
          this.invalidateByPattern(`ecofleet:vehicleDayRoute:*:${today}`),
        ]);
        totalInvalidated += counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      // Vehicle changes affect: vehicle lists, keikka, grid, person (assigned drivers)
      case "VEHICLE_UPDATE":
      case "VEHICLE_CREATE":
      case "VEHICLE_DELETE": {
        const dateKey = this._extractYYYYMMDD(params);
        const counts = await Promise.all([
          this.invalidate(operation, "vehicle", params),
          this.invalidate(operation, "keikka", params),
          this.invalidateGridSmart(operation, params.body || {}, params),
          this.invalidate(operation, "person", params),
          this.invalidateByPattern(`grid:v7tenant:${dateKey}:*`),
        ]);
        totalInvalidated += counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      // Vehicle visibility operations - cross-tenant visibility grants
      // Modifies vehicleAsiakasVisibility table, affects vehicle lists for both owner and target companies
      case "VEHICLE_VISIBILITY_TOGGLE":
      case "VEHICLE_VISIBILITY_APPLY_DEFAULTS":
      case "VEHICLE_VISIBILITY_CLEAR": {
        // Extract asiakasIds from params - visibility affects both owner and target companies
        const ownerAsiakasId = params.ownerAsiakasId || params.asiakasId;
        const targetAsiakasId = params.targetAsiakasId;
        const yyyymmdd = params.yyyymmdd;

        // Invalidate vehicle cache for owner company
        const ownerVehicleCount = await this.invalidate(operation, "vehicle", {
          ...params,
          asiakasId: ownerAsiakasId,
        });

        // Invalidate vehicle cache for target company if specified
        const targetVehicleCount = targetAsiakasId
          ? await this.invalidate(operation, "vehicle", {
              ...params,
              asiakasId: targetAsiakasId,
            })
          : 0;

        // Invalidate grid cache for the affected date
        const gridVisibilityCount = yyyymmdd
          ? await this.invalidate(operation, "grid", {
              ...params,
              pumppuAika: yyyymmdd,
            })
          : await this.invalidate(operation, "grid", params);

        totalInvalidated +=
          ownerVehicleCount + targetVehicleCount + gridVisibilityCount;
        break;
      }

      // CRITICAL: tuotteet_delete modifies keikkaLaskuRivit - products affect invoices and keikka pricing
      case "TUOTE_UPDATE":
      case "TUOTE_CREATE":
      case "TUOTE_DELETE": {
        const counts = await Promise.all([
          this.invalidate(operation, "tuote", params),
          this.invalidate(operation, "lasku", params),
          this.invalidate(operation, "keikka", params),
          this.invalidateByPattern("inventory:dashboard:*"),
          this.invalidateByPattern("inventory:varastoList:*"),
        ]);
        totalInvalidated += counts.reduce((sum, c) => sum + c, 0);
        break;
      }

      // Notification operations - invalidate notification history cache
      case "NOTIFICATION_UPDATE":
      case "NOTIFICATION_CREATE":
      case "NOTIFICATION_READ": {
        const { asiakasId, personId } = params;
        if (asiakasId && personId) {
          // Invalidate specific person's notification cache
          totalInvalidated += await this.invalidateByPattern(
            `notifications:history:${asiakasId}:${personId}:*`,
          );
        }
        break;
      }

      // Notification broadcast - invalidate all notification caches for asiakasId
      case "NOTIFICATION_BROADCAST": {
        const { asiakasId } = params;
        if (asiakasId) {
          totalInvalidated += await this.invalidateByPattern(
            `notifications:history:${asiakasId}:*`,
          );
        }
        break;
      }

      // Auth cache invalidation for role/permission changes
      case "ASIAKAS_PERSON_SETTING_CREATE":
      case "ASIAKAS_PERSON_SETTING_UPDATE":
      case "ASIAKAS_PERSON_SETTING_DELETE": {
        const personId = params.personId;

        // Invalidate asiakasPersonSetting cache (actor-scoped fallback —
        // catches actor-tenant copies even when personId is unknown).
        totalInvalidated += await this.invalidate(
          operation,
          "asiakasPersonSetting",
          params,
        );

        // Invalidate auth cache for this person (login cache)
        if (personId) {
          totalInvalidated += await this.invalidateByPattern(
            `auth:permissions:${personId}:*`,
          );
          // /profile Asiakkaat role chips read asiakas:myRoles:* — must clear them on any role mutation.
          totalInvalidated += await this.invalidateByPattern(
            `asiakas:myRoles:*:${personId}`,
          );
          // asiakasPersonSetting reader keys are keyed by the VIEWER's
          // ownerAsiakasId, not the mutator's, so wildcard the viewer slot
          // to clear cross-tenant copies (same pattern as myRoles).
          totalInvalidated += await this.invalidateByPattern(
            `asiakasPersonSetting:asiakasList:*:*:${personId}`,
          );
          totalInvalidated += await this.invalidateByPattern(
            `asiakasPersonSetting:get:*:*:${personId}`,
          );
        }

        // EditAsiakas Henkilöt list reads asiakas:personList:{actor}:{target}:{settingType}
        // and asiakas:personLists:{actor}:{target}:{yyyymmdd}. Both embed person settings
        // recordsets, so any setting mutation must clear them. Wildcard target when the
        // mutation URL lacks it (DELETE /:asiakasPersonSettingId, PUT /saveDate/...).
        const targetAsiakasId = params.targetAsiakasId || "*";
        totalInvalidated += await this.invalidateByPattern(
          `asiakas:personList:*:${targetAsiakasId}:*`,
        );
        totalInvalidated += await this.invalidateByPattern(
          `asiakas:personLists:*:${targetAsiakasId}:*`,
        );
        break;
      }

      // Laskupohja (invoice template) operations - pricing template modifications
      // Cache keys: laskupohja:get:{id}, laskupohjaRivi:get:{id}
      case "LASKUPOHJA_UPDATE":
      case "LASKUPOHJA_CREATE":
      case "LASKUPOHJA_DELETE":
      case "LASKUPOHJA_RIVI_UPDATE":
      case "LASKUPOHJA_RIVI_CREATE":
      case "LASKUPOHJA_RIVI_DELETE":
      case "LASKUPOHJA_COPY": {
        const { laskupohjaId, laskupohjaRiviId } = params;
        const patterns = [];

        // Invalidate ALL laskupohja caches (includes get, list, listByAsiakas)
        // This ensures list caches are always invalidated when templates change
        patterns.push(`laskupohja:*`);

        // Targeted invalidation when we have specific IDs
        if (laskupohjaId) {
          patterns.push(`laskupohjaRivi:get:*`); // Rows for this template
        }
        if (laskupohjaRiviId) {
          patterns.push(`laskupohjaRivi:get:${laskupohjaRiviId}`);
        }

        // For copy operations, already covered by laskupohja:* pattern above

        const counts = await Promise.all(
          patterns.map((p) => this.invalidateByPattern(p)),
        );
        totalInvalidated = counts.reduce((sum, count) => sum + count, 0);
        break;
      }

      // Lasku (invoice) operations - invoice header and row modifications
      case "LASKU_UPDATE":
      case "LASKU_CREATE":
      case "LASKU_DELETE": {
        const [laskuCount, statCount] = await Promise.all([
          this.invalidate(operation, "lasku", params),
          this.invalidate(operation, "stat", params),
        ]);
        totalInvalidated = laskuCount + statCount;
        break;
      }

      // Legal document writes (save/activate/delete + type create/update).
      // Legal docs are cached under GLOBAL keys with NO asiakasId segment
      // (legalDocument:current:*, legalDocument:versions:*, legalDocument:types,
      // legalDocument:get:*). The default branch builds an asiakasId-scoped
      // pattern (legalDocument:*:<asiakasId>*) which matches none of them, so
      // writes would invalidate nothing and reads stay stale until the 24h TTL.
      // Sweep the whole legalDocument namespace instead.
      case "LEGAL_DOCUMENT_UPDATE":
      case "LEGAL_DOCUMENT_CREATE":
      case "LEGAL_DOCUMENT_DELETE":
        totalInvalidated += await this.invalidateByPattern("legalDocument:*");
        break;

      default: {
        const entityType = params.entityType || "default";
        totalInvalidated += await this.invalidate(
          operation,
          entityType,
          params,
        );
      }
    }

    return totalInvalidated;
  }

  /**
   * Close Redis connection with proper cleanup
   */
  async close() {
    this.isShuttingDown = true;

    if (this.client) {
      try {
        this._removeEventListeners(this.client);
        await this.client.quit();
      } catch (error) {
        console.log("Close warning", {
          error: error.message,
        });
        try {
          this.client.disconnect();
        } catch (disconnectError) {
          console.log("Force disconnect warning", {
            error: disconnectError.message,
          });
        }
      } finally {
        this.client = null;
        this.isConnected = false;
        this.connectionPromise = null;
        this.isShuttingDown = false;
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStatus() {
    return {
      connected: this.isConnected,
      client: this.client ? "initialized" : "not initialized",
      currentDb: this.currentDb,
    };
  }

  /**
   * Get cache metrics summary
   * @returns {Object} Cache metrics summary including hits, misses, and hit rate
   */
  getMetrics() {
    return this.cacheMetrics.getSummary();
  }

  /**
   * Get detailed cache metrics with entity and operation breakdown
   * @returns {Object} Comprehensive metrics including global stats, entity breakdown, operation breakdown, and lock metrics
   */
  getDetailedMetrics() {
    const summary = this.cacheMetrics.getSummary();
    const lockMetrics = this.cacheMetrics.getLockMetrics();

    return {
      global: summary,
      byEntity: this.cacheMetrics.metrics.byEntity,
      byOperation: this.cacheMetrics.metrics.byOperation,
      locks: lockMetrics,
      efficiency: {
        totalRequests: summary.totalRequests,
        hitRatio: parseFloat(summary.hitRate),
        efficiencyPercent: parseFloat(summary.hitRate),
      },
    };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics() {
    this.cacheMetrics.reset();
  }

  /**
   * Get Redis client for external usage (e.g., DistributedLockManager)
   * @returns {Object|null} Redis client instance or null if not initialized
   */
  get redis() {
    return this.client;
  }
}

module.exports = UniversalCacheManager;
