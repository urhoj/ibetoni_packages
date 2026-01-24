/**
 * Universal Cache Manager for betoni.online
 *
 * Single unified cache system replacing all specialized cache strategies.
 * Handles all entity types with consistent patterns and minimal code duplication.
 *
 * **Database Allocation**:
 * - DB 1: Socket.io sessions (managed by redisSessionClient.js)
 * - DB 3: API cache (production)
 * - DB 4: API cache (development)
 *
 * **Runtime Database Switching** (January 2026):
 * - `currentDb` property tracks current database (3 or 4)
 * - `selectDatabase(db)` switches at runtime via Redis SELECT command
 * - `getCurrentDb()` returns current database number
 * - Default: DB 3 for production (`NODE_ENV=production`), DB 4 otherwise
 *
 * Shared package version - logger and metrics are injectable.
 */

const crypto = require("crypto");
const Redis = require("ioredis");

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
]);

/**
 * Maximum TTL cap in seconds (7 days) to prevent excessively long cache times
 * Even with high multipliers, TTLs won't exceed this value.
 */
const MAX_TTL_SECONDS = 604800; // 7 days

class UniversalCacheManager {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Winston logger instance with categories.CACHE
   * @param {Object} options.cacheMetrics - Optional cache metrics instance
   * @param {Object} options.redisConfig - Optional Redis configuration override
   * @param {number} options.ttlMultiplier - Override TTL multiplier (default: env or 4.0)
   */
  constructor(options = {}) {
    this.logger = options.logger || this._createDefaultLogger();
    this.cacheMetrics = options.cacheMetrics || this._createDefaultMetrics();
    this.redisConfigOverride = options.redisConfig;
    this.ttlMultiplier = options.ttlMultiplier || TTL_MULTIPLIER;

    this.client = null;
    this.isConnected = false;
    this.isShuttingDown = false;
    this.connectionPromise = null; // Prevent multiple connection attempts

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
      stat: 7200, // 2 hours - statistics updated by cronjobs
      stepLog: 3600, // 1 hour - keikka activity logs (same as keikka)
      grid: 3600, // 1 hour - grid keikka lists (same as keikka)
      help: 43200, // 12 hours - help content, changes very rarely
      legalDocument: 86400, // 24 hours - legal documents, changes rarely
      weather: 3600, // 1 hour - weather module status and forecasts
      ecofleet: 60, // 1 minute - external fleet tracking API (real-time, excluded from multiplier)
      lasku: 3600, // 1 hour - invoice data
      holiday: 86400, // 24 hours - national holidays, changes rarely (weekly sync)
      notifications: 120, // 2 minutes - time-sensitive push notifications
      default: 3600, // 1 hour fallback (same as keikka tier)
    };

    // Apply TTL multiplier to generate effective TTLs
    this.TTL = this._applyTtlMultiplier(this.BASE_TTL);

    this.logger.info("TTL multiplier applied", {
      multiplier: this.ttlMultiplier,
      excluded: Array.from(TTL_MULTIPLIER_EXCLUDED),
      maxTtl: MAX_TTL_SECONDS,
      sampleTtls: {
        keikka: this.TTL.keikka,
        grid: this.TTL.grid,
        ecofleet: this.TTL.ecofleet,
      },
    });

    // Production-safe batch limits
    this.BATCH_SIZE = 2000;
    this.SCAN_COUNT = 500; // Increased from 100 to reduce Redis round-trips (5× fewer iterations)
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
   * Get current TTL multiplier value
   * @returns {number} The active TTL multiplier
   */
  getTtlMultiplier() {
    return this.ttlMultiplier;
  }

  /**
   * Get TTL configuration summary for monitoring/debugging
   * @returns {Object} TTL configuration including multiplier and effective values
   */
  getTtlConfig() {
    return {
      multiplier: this.ttlMultiplier,
      maxTtl: MAX_TTL_SECONDS,
      excluded: Array.from(TTL_MULTIPLIER_EXCLUDED),
      effectiveTtls: { ...this.TTL },
      baseTtls: { ...this.BASE_TTL },
    };
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
      connectTimeout: 10000,
      retryStrategy: (times) => Math.min(times * 1000, 5000),
    };

    // Environment-based DB selection for cache isolation:
    // Production: DB 3, Development: DB 4
    // Socket.io sessions remain on DB 1 (shared) - see redisSessionClient.js
    const isProduction = process.env.NODE_ENV === "production";
    const cacheDb = isProduction ? 3 : 4;

    return process.env.REDIS_HOSTNAME
      ? {
          ...base,
          host: process.env.REDIS_HOSTNAME,
          port: parseInt(process.env.REDIS_PORT || "6380"),
          password: process.env.REDIS_ACCESS_KEY,
          tls: { servername: process.env.REDIS_HOSTNAME },
          db: cacheDb, // DB 3 for production, DB 4 for development
        }
      : {
          ...base,
          host: process.env.SIMPLIFIED_REDIS_HOST || "localhost",
          port: parseInt(process.env.SIMPLIFIED_REDIS_PORT || "6379"),
          db: cacheDb, // DB 3 for production, DB 4 for development
        };
  }

  /**
   * Initialize and get Redis client with proper connection management
   */
  async getClient() {
    // Check if Redis cache is disabled via environment variable
    if (
      process.env.REDIS_CACHE_ENABLED === "false" ||
      (process.env.NODE_ENV === "production" && process.env.REDIS_CACHE_ENABLED !== "true")
    ) {
      this.logger.info("Redis cache disabled via environment configuration");
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
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 2000));
        const pingPromise = this.client
          .ping()
          .then(() => this.client)
          .catch(() => null);
        return await Promise.race([pingPromise, timeoutPromise]);
      }

      return this.client;
    } catch (error) {
      this.logger.error("Client initialization failed", {
        error: error.message,
        stack: error.stack,
      });
      this.connectionPromise = null;
      return null;
    }
  }

  /**
   * Create Redis connection with proper event handling
   */
  async _createConnection() {
    const config = this.getRedisConfig();
    const client = new Redis(config);

    // Set up event handlers to prevent memory leaks
    const onReady = () => {
      this.isConnected = true;
      this.logger.info("Redis connected", {
        host: config.host,
        port: config.port,
      });
    };

    const onError = (err) => {
      this.isConnected = false;
      this.logger.error("Redis error", {
        error: err.message,
      });
      // Don't recreate client on every error to prevent connection storms
    };

    const onClose = () => {
      this.isConnected = false;
      this.logger.info("Redis disconnected");
      if (!this.isShuttingDown) {
        // Auto-reconnect will be handled by ioredis
        this.logger.debug("Auto-reconnect will attempt");
      }
    };

    const onEnd = () => {
      this.isConnected = false;
      this.logger.info("Redis connection ended");
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
      const { onReady, onError, onClose, onEnd } = client._universalCacheListeners;
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
  async withRedis(
    operation,
    fallback = null,
    _logPrefix = "[UniversalCache]",
    operationType = "operation"
  ) {
    const startTime = Date.now();

    try {
      const redis = await this.getClient();
      if (!redis) {
        this.logger.debug("Redis unavailable, skipping operation", {
          operationType,
        });
        return fallback;
      }

      const result = await operation(redis);

      // Record operation performance
      const duration = Date.now() - startTime;
      this.cacheMetrics.recordOperation(operationType, duration);

      return result;
    } catch (error) {
      this.logger.error("Operation failed", {
        operationType,
        error: error.message,
      });
      this.cacheMetrics.recordError(operationType, "unknown", error);
      return fallback;
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
   * Generate MD5 hash for cache keys (consistent short hashes)
   */
  generateHash(input, length = 8) {
    if (!input || typeof input !== "string") {
      throw new Error("Input must be a non-empty string");
    }

    return crypto
      .createHash("md5")
      .update(input.toLowerCase().trim())
      .digest("hex")
      .substring(0, length);
  }

  /**
   * Format dates for Redis-safe cache keys
   */
  formatDateForRedis(dateInput) {
    if (dateInput === null || dateInput === undefined) return "null";

    // Handle timestamp format (20250827120000)
    if (typeof dateInput === "number" && dateInput > 10000000000000) {
      return String(dateInput);
    }

    // Handle simple yyyymmdd format (20250827)
    if (typeof dateInput === "number" && dateInput >= 20000101 && dateInput <= 99991231) {
      return String(dateInput * 1000000 + 120000);
    }

    // Handle string formats like "20250827"
    if (typeof dateInput === "string" && /^\d{8}$/.test(dateInput)) {
      return dateInput + "120000";
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

    try {
      // Parse and format date using native JavaScript
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return null;

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}${month}${day}`;
    } catch (error) {
      this.logger.error("Grid date parsing error", {
        error: error.message,
        dateInput,
      });
      return null;
    }
  }

  /**
   * Extract yyyymmdd from params for v6role invalidation
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
   * Cache data with appropriate TTL
   */
  async cache(key, data, entityType = "default") {
    return await this.withRedis(
      async (redis) => {
        const baseTtl = this.TTL[entityType] || this.TTL.default;
        // Add ±5% jitter to prevent synchronized cache expiration (cache stampede prevention)
        const jitter = Math.floor(baseTtl * 0.05 * (Math.random() * 2 - 1));
        const ttl = baseTtl + jitter;
        await redis.setex(key, ttl, JSON.stringify(data));
        this.logger.debug("Cache set successful", {
          entityType,
          key,
          baseTtl,
          ttl,
        });

        // Record cache set metric
        this.cacheMetrics.recordSet(entityType, key);

        return true;
      },
      false,
      "[UniversalCache]",
      `cache ${entityType}`
    );
  }

  /**
   * Retrieve cached data
   */
  async get(key, entityType = "data") {
    const startTime = Date.now();

    return await this.withRedis(
      async (redis) => {
        const data = await redis.get(key);
        const responseTime = Date.now() - startTime;

        if (data) {
          this.logger.debug("Cache hit", { entityType, key });
          this.cacheMetrics.recordHit(entityType, responseTime);
          return JSON.parse(data);
        }

        this.logger.debug("Cache miss", { entityType, key });
        this.cacheMetrics.recordMiss(entityType, responseTime);
        return null;
      },
      null,
      "[UniversalCache]",
      `get ${entityType}`
    );
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
            const result = await redis.scan(cursor, "MATCH", pattern, "COUNT", scanCount);
            cursor = result[0];
            keys.push(...result[1]);
            iterations++;

            // Circuit breaker for runaway scans
            if (iterations > maxIterations) {
              this.logger.warn("Scan iteration limit reached", {
                pattern,
                maxIterations,
              });
              break;
            }
          } catch (scanError) {
            this.logger.error("Scan error", {
              pattern,
              iteration: iterations,
              error: scanError.message,
            });
            // Continue with partial results rather than failing completely
            break;
          }
        } while (cursor !== "0");

        this.logger.debug("Scan completed", {
          pattern,
          keysFound: keys.length,
          iterations,
        });
        return keys;
      },
      [],
      "[UniversalCache]",
      "scan keys"
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
            this.logger.error("Batch delete error", {
              error: deleteError.message,
              batchSize: batch.length,
            });
            // Continue with remaining batches rather than failing completely
            continue;
          }
        }

        this.logger.debug("Batch delete completed", {
          deletedCount,
          batches: Math.ceil(keys.length / batchSize),
        });
        return deletedCount;
      },
      0,
      "[UniversalCache]",
      "batch delete"
    );
  }

  /**
   * Invalidate cache keys by pattern using scan and delete
   */
  async invalidateByPattern(pattern) {
    const keys = await this.scanKeys(pattern);
    if (keys.length > 0) {
      const deletedCount = await this.batchDelete(keys);
      this.logger.info("Pattern invalidation completed", {
        pattern,
        keysDeleted: deletedCount,
      });

      // Record invalidation metric
      const entityType = pattern.split(":")[0] || "unknown";
      this.cacheMetrics.recordInvalidation(entityType, pattern, deletedCount);

      return deletedCount;
    }
    return 0;
  }

  /**
   * Universal cache invalidation for all entity types.
   *
   * Entity-specific behaviors:
   * - keikka: Targets individual keikka + list caches by date/personId
   * - asiakas: Pattern-based by asiakasId
   * - grid: Invalidates BOTH v6role format (grid:v6role:{dateKey}:*) AND
   *         legacy format (grid:personId:*:pumppuAika:{dateKey})
   * - stat: Clears all stat caches (varying segment counts)
   * - attachment: Multiple patterns for different attachment key formats
   *
   * @param {string} operation - Operation type (KEIKKA_UPDATE, PALKKI_UPDATE, etc.)
   * @param {string} entityType - Entity type (keikka, grid, asiakas, etc.)
   * @param {Object} params - Parameters for invalidation
   * @param {string} [params.asiakasId] - Customer ID for scoping
   * @param {string} [params.personId] - Person ID
   * @param {string} [params.pumppuAika] - Date for date-scoped invalidation (ISO format)
   * @returns {Promise<number>} Number of cache keys invalidated
   */
  async invalidate(operation, entityType, params = {}) {
    // Safely extract parameters
    const asiakasId = params.asiakasId;
    const personId = params.personId;
    const pumppuAika = params.pumppuAika;

    // Generate invalidation pattern
    let pattern = "";
    switch (entityType) {
      case "keikka": {
        const newDateValue = params.body?.newDate || params.newDate;
        const pumppuAikaValue = params.body?.pumppuAika || params.pumppuAika || params.date;
        const targetDate = newDateValue || pumppuAikaValue;
        const personIdValue = params.body?.personId || params.personId;
        const yyyymmddValue = params.yyyymmdd;
        const keikkaIdValue = params.body?.keikkaId || params.keikkaId || params.entityId;

        // Individual keikka keys: if we have keikkaId, target it specifically
        // Key format: keikka:get:{keikkaId}:{personId} (see keikkaQueryRunner.js:45)
        let individualKeysPattern;
        if (keikkaIdValue) {
          // Targeted: Only clear this specific keikka's cache (matches any personId)
          individualKeysPattern = `keikka:get:${keikkaIdValue}:*`;
        } else {
          // Fallback: Clear all keikka caches
          individualKeysPattern = `keikka:get:*`;
        }

        // Key format: keikka:list:asiakasId:personId:yyyymmdd[:deleted]
        // Match yyyymmdd at position 5 (trailing wildcard for optional :deleted suffix)
        if (yyyymmddValue) {
          return await Promise.all([
            this.invalidateByPattern(individualKeysPattern),
            this.invalidateByPattern(`keikka:list:*:*:${yyyymmddValue}*`), // yyyymmdd at position 5
          ]).then((results) => results.reduce((sum, count) => sum + count, 0));
        } else if (targetDate) {
          const yyyymmdd = targetDate.substring(0, 10).replace(/-/g, "");
          return await Promise.all([
            this.invalidateByPattern(individualKeysPattern),
            this.invalidateByPattern(`keikka:list:*:*:${yyyymmdd}*`), // yyyymmdd at position 5
          ]).then((results) => results.reduce((sum, count) => sum + count, 0));
        } else if (personIdValue) {
          return await Promise.all([
            this.invalidateByPattern(individualKeysPattern),
            this.invalidateByPattern(`keikka:list:*:${personIdValue}:*`), // personId at position 4
          ]).then((results) => results.reduce((sum, count) => sum + count, 0));
        } else {
          return await Promise.all([
            this.invalidateByPattern(individualKeysPattern),
            this.invalidateByPattern(`keikka:list:*`), // fallback: all keikka lists
          ]).then((results) => results.reduce((sum, count) => sum + count, 0));
        }
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
        // Grid has multiple key formats that need invalidation:
        // 1. v6role format: grid:v6role:{dateKey}:{sortedCompanies} (used by list_v6role)
        // 2. v7tenant format: grid:v7tenant:{dateKey}:{sortedAsiakasIds}:{outputMode} (used by list_v7tenant)
        // 3. Legacy format: grid:personId:{personId}:pumppuAika:{dateKey}
        const dateKey = pumppuAika ? this.formatGridDate(pumppuAika) : null;

        const patterns = [];

        // v6role format - primary format used by list_v6role endpoint
        if (dateKey) {
          patterns.push(`grid:v6role:${dateKey}:*`);
        } else {
          patterns.push(`grid:v6role:*`);
        }

        // v7tenant format - used by list_v7tenant endpoint
        if (dateKey) {
          patterns.push(`grid:v7tenant:${dateKey}:*`);
        } else {
          patterns.push(`grid:v7tenant:*`);
        }

        // Legacy format for backwards compatibility
        if (personId && dateKey) {
          patterns.push(`grid:personId:${personId}:pumppuAika:${dateKey}`);
        } else if (dateKey) {
          patterns.push(`grid:personId:*:pumppuAika:${dateKey}`);
        } else if (personId) {
          patterns.push(`grid:personId:${personId}:pumppuAika:*`);
        } else {
          patterns.push(`grid:personId:*:pumppuAika:*`);
        }

        // Invalidate all patterns and return combined count
        const results = await Promise.all(
          patterns.map(async (p) => {
            console.log("🔍 [DEBUG invalidate] Pattern:", p, "for entityType:", entityType);
            const keys = await this.scanKeys(p);
            console.log("🔍 [DEBUG invalidate] Keys found:", keys.length, keys.slice(0, 3));
            if (keys.length > 0) {
              return await this.batchDelete(keys);
            }
            return 0;
          })
        );

        const totalDeleted = results.reduce((sum, count) => sum + count, 0);
        if (totalDeleted > 0) {
          this.logger.info("Grid cache invalidated", {
            entityType,
            operation,
            keysDeleted: totalDeleted,
            patterns,
          });
        }
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

        return await Promise.all(patterns.map((p) => this.invalidateByPattern(p))).then((results) =>
          results.reduce((sum, count) => sum + count, 0)
        );
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

    console.log("🔍 [DEBUG invalidate] Pattern:", pattern, "for entityType:", entityType);
    const keys = await this.scanKeys(pattern);
    console.log("🔍 [DEBUG invalidate] Keys found:", keys.length, keys.slice(0, 3));

    if (keys.length > 0) {
      const deletedCount = await this.batchDelete(keys);
      this.logger.info("Entity cache invalidated", {
        entityType,
        operation,
        keysDeleted: deletedCount,
      });
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
    const { pumppuAika, personId, creatorPersonId, newDate } = body;
    const effectivePersonId = personId || creatorPersonId;
    const asiakasId = params.asiakasId;

    this.logger.debug("Grid smart invalidation", {
      operation,
      pumppuAika,
      newDate,
      effectivePersonId,
      asiakasId,
    });

    switch (operation) {
      case "KEIKKA_UPDATE": {
        let totalInvalidated = 0;

        if (newDate) {
          this.logger.debug("Copy operation detected - invalidating ONLY target date", {
            newDate,
            asiakasId,
          });
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
          this.logger.debug("KEIKKA_COPY - invalidating target date only", {
            newDate,
            asiakasId,
          });
          return await this.invalidate(operation, "grid", {
            asiakasId,
            pumppuAika: newDate,
          });
        } else {
          this.logger.warn("KEIKKA_COPY without newDate - no invalidation", {
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
          pumppuAika || body?.pvm || body?.yyyymmdd || params?.pvm || params?.yyyymmdd;

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
          this.logger.debug("PALKKI operation - date-specific grid invalidation", {
            operation,
            palkkiDate,
            dateKey,
            asiakasId,
          });
          return await this.invalidate(operation, "grid", {
            asiakasId,
            pumppuAika: dateKey,
          });
        }

        // Fallback: no date available
        this.logger.warn("PALKKI operation without date - broad invalidation", {
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
          body?.yyyymmdd || body?.pumppuAika || params?.yyyymmdd || params?.pumppuAika;

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
        this.logger.warn("Unknown grid operation, using broad invalidation", {
          operation,
          asiakasId,
        });
        return await this.invalidate(operation, "grid", { asiakasId });
    }
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
        // Parallelize independent invalidations for better performance
        const [
          keikkaCount,
          keikkaPersonCount,
          keikkaBetoniCount,
          stepLogCount,
          attachmentCount,
          gridCount,
          v6roleCount,
          v7tenantCount,
          listByAsiakasesCount,
        ] = await Promise.all([
          this.invalidate(operation, "keikka", params),
          this.invalidate(operation, "keikkaPerson", params),
          this.invalidate(operation, "keikkaBetoni", params),
          this.invalidate(operation, "stepLog", params),
          this.invalidate(operation, "attachment", params),
          this.invalidateGridSmart(operation, params.body || {}, params),
          this.invalidateByPattern(`grid:v6role:${this._extractYYYYMMDD(params)}:*`),
          this.invalidateByPattern(`grid:v7tenant:${this._extractYYYYMMDD(params)}:*`),
          this.invalidateByPattern("keikka:listByAsiakases:*"),
        ]);
        totalInvalidated +=
          keikkaCount +
          keikkaPersonCount +
          keikkaBetoniCount +
          stepLogCount +
          attachmentCount +
          gridCount +
          v6roleCount +
          v7tenantCount +
          listByAsiakasesCount;
        break;
      }

      case "KEIKKA_BULK_UPDATE":
        totalInvalidated += await this.invalidate(operation, "keikka", params);
        totalInvalidated += await this.invalidateGridSmart(operation, params.body || {}, params);
        totalInvalidated += await this.invalidate(operation, "asiakas", params);
        this.logger.debug("KEIKKA_BULK_UPDATE completed", {
          keysInvalidated: totalInvalidated,
        });
        break;

      case "PALKKI_UPDATE":
      case "PALKKI_DELETE":
      case "PALKKI_CREATE": {
        // Palkki operations affect grid cache, keikka list cache, v6role cache, v7tenant cache, AND palkki list cache
        const palkkiGridCount = await this.invalidateGridSmart(
          operation,
          params.body || {},
          params
        );

        // Invalidate keikka list cache (grid uses keikka:list:* for data)
        const keikkaListCount = await this.invalidate(operation, "keikka", {
          asiakasId: params.asiakasId,
          pumppuAika: params.pumppuAika || params.body?.pumppuAika,
        });

        // Invalidate v6role cache (date-scoped) - palkki changes affect grid visibility
        const v6roleCount = await this.invalidateByPattern(
          `grid:v6role:${this._extractYYYYMMDD(params)}:*`
        );

        // Invalidate v7tenant cache (date-scoped) - palkki changes affect grid visibility
        const v7tenantCount = await this.invalidateByPattern(
          `grid:v7tenant:${this._extractYYYYMMDD(params)}:*`
        );

        // Invalidate palkki list cache - DATE-SPECIFIC when frontend provides data
        const cacheInvalidation = params.cacheInvalidation;
        let palkkiListCount = 0;

        if (cacheInvalidation?.yyyymmdd?.length && cacheInvalidation?.visibleAsiakasIds?.length) {
          // Precise invalidation: specific dates for each visible customer
          const customersToInvalidate = new Set(cacheInvalidation.visibleAsiakasIds);
          // Ensure owner is always included (may not be in visibility list)
          if (params.asiakasId) {
            customersToInvalidate.add(params.asiakasId);
          }

          for (const customerId of customersToInvalidate) {
            for (const yyyymmdd of cacheInvalidation.yyyymmdd) {
              palkkiListCount += await this.invalidateByPattern(
                `grid:palkki:list:${customerId}:${yyyymmdd}:*`
              );
            }
          }
          this.logger.debug("PALKKI date-specific invalidation", {
            yyyymmdd: cacheInvalidation.yyyymmdd,
            customerCount: customersToInvalidate.size,
            keysInvalidated: palkkiListCount,
          });
        } else {
          // Fallback: broad invalidation if no invalidation data provided
          const asiakasId = params.asiakasId;
          palkkiListCount = asiakasId
            ? await this.invalidateByPattern(`grid:palkki:list:${asiakasId}:*`)
            : 0;
        }

        // If vehicle changed, also invalidate vehicle cache
        const palkkiVehicleCount =
          params.vehicleId || params.body?.vehicleId
            ? await this.invalidate(operation, "vehicle", params)
            : 0;

        totalInvalidated +=
          palkkiGridCount + keikkaListCount + v6roleCount + v7tenantCount + palkkiListCount + palkkiVehicleCount;
        this.logger.debug("PALKKI operation completed", {
          operation,
          keysInvalidated: totalInvalidated,
          palkkiListCount,
          v6roleCount,
          v7tenantCount,
        });
        break;
      }

      case "GRID_UPDATE":
        // Simple grid-only invalidation for visibility changes
        totalInvalidated += await this.invalidateGridSmart(operation, params.body || {}, params);
        this.logger.debug("GRID_UPDATE completed", {
          keysInvalidated: totalInvalidated,
        });
        break;

      case "VEHICLE_DATE_DISMISS":
      case "VEHICLE_DATE_UNDISMISS":
      case "VEHICLE_DATE_UPDATE":
      case "VEHICLE_DATE_CREATE":
      case "VEHICLE_DATE_DELETE": {
        console.log("🔍 [DEBUG] VEHICLE_DATE operation START", {
          operation,
          params,
        });

        // Show what keys exist in Redis before invalidation
        const allVehicleKeys = await this.scanKeys("vehicle:*");
        const allVehicleReqKeys = await this.scanKeys("vehicleRequiredDateType:*");
        console.log("🔍 [DEBUG] Existing vehicle keys sample:", allVehicleKeys.slice(0, 3));
        console.log(
          "🔍 [DEBUG] Existing vehicleRequiredDateType keys sample:",
          allVehicleReqKeys.slice(0, 3)
        );

        // Parallelize independent invalidations for better performance
        const [vehicleDateCount, vehicleCount, vehicleReqCount, vehicleGridCount] =
          await Promise.all([
            this.invalidate(operation, "vehicleDate", params),
            this.invalidate(operation, "vehicle", params),
            this.invalidate(operation, "vehicleRequiredDateType", params),
            this.invalidateGridSmart(operation, params.body || {}, params),
          ]);

        console.log("🔍 [DEBUG] vehicleDate invalidated:", vehicleDateCount);
        console.log("🔍 [DEBUG] vehicle invalidated:", vehicleCount);
        console.log("🔍 [DEBUG] vehicleRequiredDateType invalidated:", vehicleReqCount);
        console.log("🔍 [DEBUG] grid invalidated:", vehicleGridCount);

        totalInvalidated += vehicleDateCount + vehicleCount + vehicleReqCount + vehicleGridCount;
        console.log("🔍 [DEBUG] VEHICLE_DATE operation TOTAL:", totalInvalidated);
        break;
      }

      case "PERSON_DATE_DISMISS":
      case "PERSON_DATE_UNDISMISS":
      case "PERSON_DATE_UPDATE":
      case "PERSON_DATE_CREATE":
      case "PERSON_DATE_DELETE": {
        console.log("🔍 [DEBUG] PERSON_DATE operation START", {
          operation,
          params,
        });

        // Parallelize independent invalidations for better performance
        // CRITICAL: keikka cache must be invalidated because order views show person compliance status
        const [personDateCount, personCount, personReqCount, personGridCount, personKeikkaCount] =
          await Promise.all([
            this.invalidate(operation, "personDate", params),
            this.invalidate(operation, "person", params),
            this.invalidate(operation, "personRequiredDateType", params),
            this.invalidateGridSmart(operation, params.body || {}, params),
            this.invalidate(operation, "keikka", params),
          ]);

        console.log("🔍 [DEBUG] personDate invalidated:", personDateCount);
        console.log("🔍 [DEBUG] person invalidated:", personCount);
        console.log("🔍 [DEBUG] personRequiredDateType invalidated:", personReqCount);
        console.log("🔍 [DEBUG] grid invalidated:", personGridCount);
        console.log("🔍 [DEBUG] keikka invalidated:", personKeikkaCount);

        totalInvalidated +=
          personDateCount + personCount + personReqCount + personGridCount + personKeikkaCount;
        console.log("🔍 [DEBUG] PERSON_DATE operation TOTAL:", totalInvalidated);
        break;
      }

      case "TYOMAA_DATE_DISMISS":
      case "TYOMAA_DATE_UNDISMISS":
      case "TYOMAA_DATE_UPDATE":
      case "TYOMAA_DATE_CREATE":
      case "TYOMAA_DATE_DELETE": {
        console.log("🔍 [DEBUG] TYOMAA_DATE operation START", {
          operation,
          params,
        });

        // Parallelize independent invalidations for better performance
        // CRITICAL: keikka cache must be invalidated because order views show tyomaa compliance status
        const [tyomaaDateCount, tyomaaCount, tyomaaReqCount, tyomaaGridCount, tyomaaKeikkaCount] =
          await Promise.all([
            this.invalidate(operation, "tyomaaDate", params),
            this.invalidate(operation, "tyomaa", params),
            this.invalidate(operation, "tyomaaRequiredDateType", params),
            this.invalidateGridSmart(operation, params.body || {}, params),
            this.invalidate(operation, "keikka", params),
          ]);

        console.log("🔍 [DEBUG] tyomaaDate invalidated:", tyomaaDateCount);
        console.log("🔍 [DEBUG] tyomaa invalidated:", tyomaaCount);
        console.log("🔍 [DEBUG] tyomaaRequiredDateType invalidated:", tyomaaReqCount);
        console.log("🔍 [DEBUG] grid invalidated:", tyomaaGridCount);
        console.log("🔍 [DEBUG] keikka invalidated:", tyomaaKeikkaCount);

        totalInvalidated +=
          tyomaaDateCount + tyomaaCount + tyomaaReqCount + tyomaaGridCount + tyomaaKeikkaCount;
        console.log("🔍 [DEBUG] TYOMAA_DATE operation TOTAL:", totalInvalidated);
        break;
      }

      case "ASIAKAS_DATE_DISMISS":
      case "ASIAKAS_DATE_UNDISMISS":
      case "ASIAKAS_DATE_UPDATE":
      case "ASIAKAS_DATE_CREATE":
      case "ASIAKAS_DATE_DELETE": {
        console.log("🔍 [DEBUG] ASIAKAS_DATE operation START", {
          operation,
          params,
        });

        // Parallelize independent invalidations for better performance
        const [asiakasDateCount, asiakasCount, asiakasReqCount, asiakasGridCount] =
          await Promise.all([
            this.invalidate(operation, "asiakasDate", params),
            this.invalidate(operation, "asiakas", params),
            this.invalidate(operation, "asiakasRequiredDateType", params),
            this.invalidateGridSmart(operation, params.body || {}, params),
          ]);

        console.log("🔍 [DEBUG] asiakasDate invalidated:", asiakasDateCount);
        console.log("🔍 [DEBUG] asiakas invalidated:", asiakasCount);
        console.log("🔍 [DEBUG] asiakasRequiredDateType invalidated:", asiakasReqCount);
        console.log("🔍 [DEBUG] grid invalidated:", asiakasGridCount);

        totalInvalidated += asiakasDateCount + asiakasCount + asiakasReqCount + asiakasGridCount;
        console.log("🔍 [DEBUG] ASIAKAS_DATE operation TOTAL:", totalInvalidated);
        break;
      }

      // Asiakas CRUD operations - invalidate asiakas and related entity caches
      case "ASIAKAS_UPDATE":
      case "ASIAKAS_CREATE":
      case "ASIAKAS_DELETE": {
        this.logger.debug("ASIAKAS operation starting", {
          operation,
          params,
        });

        // Basic asiakas cache invalidation
        const asiakasOpCount = await this.invalidate(operation, "asiakas", params);
        totalInvalidated += asiakasOpCount;

        // If keikkaId is provided, also invalidate keikka cache
        // This handles cases where keikkaAsiakas table is updated
        if (params.keikkaId) {
          const keikkaOpCount = await this.invalidate(operation, "keikka", params);
          totalInvalidated += keikkaOpCount;
        }

        // If linkedAsiakasId is provided (for asiakasLinks), invalidate both customers
        if (params.linkedAsiakasId) {
          const linkedAsiakasCount = await this.invalidate(operation, "asiakas", {
            ...params,
            asiakasId: params.linkedAsiakasId,
          });
          totalInvalidated += linkedAsiakasCount;
        }

        this.logger.debug("ASIAKAS operation completed", {
          operation,
          keysInvalidated: totalInvalidated,
        });
        break;
      }

      case "PERSON_PVM_UPDATE":
      case "PERSON_PVM_DELETE":
      case "PERSON_PVM_CREATE": {
        console.log("🔍 [DEBUG] PERSON_PVM operation START", {
          operation,
          params,
        });

        // Parallelize independent invalidations for better performance
        const [
          personPvmCount,
          personPvmGridCount,
          personPvmPersonCount,
          personPvmVehicleCount,
          personPvmV6roleCount,
        ] = await Promise.all([
          this.invalidate(operation, "personpvm", params),
          this.invalidateGridSmart(operation, params.body || {}, params),
          this.invalidate(operation, "person", params),
          params.vehicleId ? this.invalidate(operation, "vehicle", params) : Promise.resolve(0),
          this.invalidateByPattern(`grid:v6role:${this._extractYYYYMMDD(params)}:*`),
        ]);

        console.log("🔍 [DEBUG] personpvm invalidated:", personPvmCount);
        console.log("🔍 [DEBUG] grid invalidated:", personPvmGridCount);
        console.log("🔍 [DEBUG] person invalidated:", personPvmPersonCount);
        console.log("🔍 [DEBUG] vehicle invalidated:", personPvmVehicleCount);
        console.log("🔍 [DEBUG] v6role invalidated:", personPvmV6roleCount);

        totalInvalidated +=
          personPvmCount +
          personPvmGridCount +
          personPvmPersonCount +
          personPvmVehicleCount +
          personPvmV6roleCount;
        console.log("🔍 [DEBUG] PERSON_PVM operation TOTAL:", totalInvalidated);
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

        const counts = await Promise.all(patterns.map((p) => this.invalidateByPattern(p)));
        totalInvalidated = counts.reduce((sum, count) => sum + count, 0);

        // Cross-entity invalidations for grid display consistency
        // Keikka attachments affect grid views (attachment indicators)
        if (entityType === "keikka" && entityId) {
          const gridCount = await this.invalidateGridSmart(operation, params.body || {}, params);
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

        this.logger.debug("Targeted attachment invalidation", {
          entityType,
          entityId,
          asiakasId,
          keysInvalidated: totalInvalidated,
        });
        break;
      }

      // Azure Functions background job operations
      case "LASKU_SYNC":
        // Fennoa invoice sync - invalidate invoice-related caches
        totalInvalidated += await this.invalidate(operation, "keikka", params);
        totalInvalidated += await this.invalidate(operation, "lasku", params);
        totalInvalidated += await this.invalidate(operation, "stat", params);
        this.logger.info("LASKU_SYNC invalidation completed", {
          keysInvalidated: totalInvalidated,
        });
        break;

      case "HOLIDAY_SYNC":
        // National holiday sync - invalidate holiday and schedule caches
        totalInvalidated += await this.invalidate(operation, "holiday", params);
        totalInvalidated += await this.invalidate(operation, "personpvm", params);
        totalInvalidated += await this.invalidate(operation, "grid", params);
        this.logger.info("HOLIDAY_SYNC invalidation completed", {
          keysInvalidated: totalInvalidated,
        });
        break;

      case "CLEANUP_ALL":
        // SQL cleanup job - invalidate stat and log caches
        totalInvalidated += await this.invalidate(operation, "stat", params);
        totalInvalidated += await this.invalidate(operation, "stepLog", params);
        this.logger.info("CLEANUP_ALL invalidation completed", {
          keysInvalidated: totalInvalidated,
        });
        break;

      // Betoni operations - keys use 'betoni:' prefix, NOT 'betoniLaatu:'
      case "BETONI_LAATU_UPDATE":
      case "BETONI_LAATU_CREATE": {
        // CRITICAL: Cache keys are generated as 'betoni:laatu:list:X' and 'betoni:laatu:filter:X'
        // where X is betoniToimittajaAsiakasId (supplier ID), NOT ownerAsiakasId
        // Default pattern would incorrectly use 'betoniLaatu:*' which never matches
        const betoniToimittajaAsiakasId = params.betoniToimittajaAsiakasId || params.asiakasId;
        const [betoniLaatuListCount, betoniLaatuFilterCount, betoniListCount] = await Promise.all([
          this.invalidateByPattern(`betoni:laatu:list:${betoniToimittajaAsiakasId || "*"}`),
          this.invalidateByPattern(`betoni:laatu:filter:${betoniToimittajaAsiakasId || "*"}`),
          this.invalidateByPattern(`betoni:list:filter:*`), // Also invalidate search results
        ]);
        totalInvalidated += betoniLaatuListCount + betoniLaatuFilterCount + betoniListCount;
        this.logger.info("BETONI_LAATU invalidation completed", {
          operation,
          betoniToimittajaAsiakasId,
          keysInvalidated: totalInvalidated,
        });
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
        this.logger.info("BETONI_SHORTCUT invalidation completed", {
          pattern: shortcutPattern,
          keysInvalidated: shortcutCount,
        });
        break;
      }

      // Person operations - cross-entity invalidation for person data changes
      case "PERSON_MERGE": {
        // Person merge affects 34 tables - comprehensive invalidation required
        // SQL: person_combinator_merge.sql modifies keikkaPerson, personPvm,
        // tyomaaPerson, vehicleDriverDays, asiakas, tyomaa, keikka, and 27 more
        this.logger.info("PERSON_MERGE invalidation starting", {
          params,
        });

        const [
          personMergeCount,
          keikkaMergeCount,
          keikkaPersonMergeCount,
          gridMergeCount,
          asiakasMergeCount,
          tyomaaMergeCount,
          tyomaaPersonMergeCount,
          vehicleMergeCount,
          personpvmMergeCount,
          attachmentMergeCount,
          statMergeCount,
          betoniMergeCount,
          laskuMergeCount,
          authMergeCount,
        ] = await Promise.all([
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

        totalInvalidated =
          personMergeCount +
          keikkaMergeCount +
          keikkaPersonMergeCount +
          gridMergeCount +
          asiakasMergeCount +
          tyomaaMergeCount +
          tyomaaPersonMergeCount +
          vehicleMergeCount +
          personpvmMergeCount +
          attachmentMergeCount +
          statMergeCount +
          betoniMergeCount +
          laskuMergeCount +
          authMergeCount;

        this.logger.info("PERSON_MERGE invalidation completed", {
          keysInvalidated: totalInvalidated,
        });
        break;
      }

      case "PERSON_TENANT_UPDATE": {
        // Lightweight person update (e.g. tenant selection change)
        // Does not affect grid, keikkas, or other entities
        this.logger.debug("PERSON_TENANT_UPDATE - lightweight invalidation", {
          params,
        });
        totalInvalidated += await this.invalidate(operation, "person", params);
        break;
      }

      case "PERSON_UPDATE": {
        // Person updates affect contact displays across modules
        // SQL: person_save.sql modifies person table (name, phone, email, etc.)
        this.logger.debug("PERSON_UPDATE invalidation starting", {
          params,
        });

        const personEntityId = params.entityId || params.personId;
        const [
          personUpdateCount,
          keikkaUpdateCount,
          asiakasUpdateCount,
          tyomaaUpdateCount,
          gridUpdateCount,
          authUpdateCount,
          v6roleCount,
          v7tenantCount,
        ] = await Promise.all([
          this.invalidate(operation, "person", params),
          this.invalidate(operation, "keikka", params),
          this.invalidate(operation, "asiakas", params),
          this.invalidate(operation, "tyomaa", params),
          this.invalidate(operation, "grid", params),
          personEntityId
            ? this.invalidateByPattern(`auth:*:${personEntityId}*`)
            : Promise.resolve(0),
          this.invalidateByPattern("grid:v6role:*"),
          this.invalidateByPattern("grid:v7tenant:*"),
        ]);

        totalInvalidated =
          personUpdateCount +
          keikkaUpdateCount +
          asiakasUpdateCount +
          tyomaaUpdateCount +
          gridUpdateCount +
          authUpdateCount +
          v6roleCount +
          v7tenantCount;

        this.logger.debug("PERSON_UPDATE invalidation completed", {
          keysInvalidated: totalInvalidated,
        });
        break;
      }

      case "PERSON_DELETE": {
        // Person deletion must remove from all listings and assignments
        // SQL: person_save.sql sets deletedTime (soft delete)
        this.logger.debug("PERSON_DELETE invalidation starting", {
          params,
        });

        const deletedPersonId = params.entityId || params.personId;
        const [
          personDeleteCount,
          keikkaDeleteCount,
          asiakasDeleteCount,
          tyomaaDeleteCount,
          gridDeleteCount,
          authDeleteCount,
          v6roleDeleteCount,
        ] = await Promise.all([
          this.invalidate(operation, "person", params),
          this.invalidate(operation, "keikka", params),
          this.invalidate(operation, "asiakas", params),
          this.invalidate(operation, "tyomaa", params),
          this.invalidate(operation, "grid", params),
          deletedPersonId
            ? this.invalidateByPattern(`auth:*:${deletedPersonId}*`)
            : Promise.resolve(0),
          this.invalidateByPattern("grid:v6role:*"),
        ]);

        totalInvalidated =
          personDeleteCount +
          keikkaDeleteCount +
          asiakasDeleteCount +
          tyomaaDeleteCount +
          gridDeleteCount +
          authDeleteCount +
          v6roleDeleteCount;

        this.logger.debug("PERSON_DELETE invalidation completed", {
          keysInvalidated: totalInvalidated,
        });
        break;
      }

      // Sijainti operations - cross-entity invalidation
      // Sijainti (location) changes affect tyomaa lookups, keikka deliveries, and grid displays
      case "SIJAINTI_UPDATE":
      case "SIJAINTI_CREATE":
      case "SIJAINTI_DELETE": {
        this.logger.debug("SIJAINTI operation invalidation starting", {
          operation,
          params,
        });

        const [sijaintiGeocodeCount, sijaintiTyomaaCount, sijaintiKeikkaCount, sijaintiGridCount] =
          await Promise.all([
            this.invalidate(operation, "geocode", params),
            this.invalidate(operation, "tyomaa", params),
            this.invalidate(operation, "keikka", params),
            this.invalidateGridSmart("TYOMAA_UPDATE", params.body || {}, params),
          ]);

        totalInvalidated +=
          sijaintiGeocodeCount + sijaintiTyomaaCount + sijaintiKeikkaCount + sijaintiGridCount;

        this.logger.info("SIJAINTI operation invalidation completed", {
          operation,
          keysInvalidated: totalInvalidated,
        });
        break;
      }

      // Tyomaa operations - cross-entity invalidation
      case "TYOMAA_UPDATE":
      case "TYOMAA_CREATE":
      case "TYOMAA_DELETE": {
        // Tyomaa changes affect: tyomaa, keikka (keikkaTyomaa), tyomaaPerson, person, grid
        const [
          tyomaaEntityCount,
          keikkaEntityCount,
          tyomaaPersonEntityCount,
          personEntityCount,
          gridEntityCount,
        ] = await Promise.all([
          this.invalidate(operation, "tyomaa", params),
          this.invalidate(operation, "keikka", params),
          this.invalidate(operation, "tyomaaPerson", params),
          this.invalidate(operation, "person", params),
          this.invalidateGridSmart(operation, params.body || {}, params),
        ]);

        totalInvalidated +=
          tyomaaEntityCount +
          keikkaEntityCount +
          tyomaaPersonEntityCount +
          personEntityCount +
          gridEntityCount;

        this.logger.info("TYOMAA operation invalidation completed", {
          operation,
          keysInvalidated: totalInvalidated,
        });
        break;
      }

      // Vehicle operations - cross-entity invalidation
      // Vehicle changes affect: vehicle lists, keikka (vehicle display), grid (vehicle columns), person (assigned drivers)
      case "VEHICLE_UPDATE":
      case "VEHICLE_CREATE":
      case "VEHICLE_DELETE": {
        this.logger.debug("VEHICLE operation invalidation starting", {
          operation,
          params,
        });

        const [
          vehicleEntityCount,
          keikkaVehicleCount,
          gridVehicleCount,
          personVehicleCount,
          v6roleVehicleCount,
        ] = await Promise.all([
          this.invalidate(operation, "vehicle", params),
          this.invalidate(operation, "keikka", params),
          this.invalidateGridSmart(operation, params.body || {}, params),
          this.invalidate(operation, "person", params),
          this.invalidateByPattern(`grid:v6role:${this._extractYYYYMMDD(params)}:*`),
        ]);

        totalInvalidated +=
          vehicleEntityCount +
          keikkaVehicleCount +
          gridVehicleCount +
          personVehicleCount +
          v6roleVehicleCount;

        this.logger.info("VEHICLE operation invalidation completed", {
          operation,
          keysInvalidated: totalInvalidated,
        });
        break;
      }

      // Vehicle visibility operations - cross-tenant visibility grants
      // Modifies vehicleAsiakasVisibility table, affects vehicle lists for both owner and target companies
      case "VEHICLE_VISIBILITY_TOGGLE":
      case "VEHICLE_VISIBILITY_APPLY_DEFAULTS":
      case "VEHICLE_VISIBILITY_CLEAR": {
        this.logger.debug("VEHICLE_VISIBILITY operation invalidation starting", {
          operation,
          params,
        });

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

        // Invalidate v6role cache - visibility changes affect which vehicles companies can see
        const v6roleVisibilityCount = await this.invalidateByPattern(
          `grid:v6role:${yyyymmdd || "*"}:*`
        );

        totalInvalidated +=
          ownerVehicleCount + targetVehicleCount + gridVisibilityCount + v6roleVisibilityCount;

        this.logger.info("VEHICLE_VISIBILITY operation invalidation completed", {
          operation,
          ownerAsiakasId,
          targetAsiakasId,
          yyyymmdd,
          keysInvalidated: totalInvalidated,
        });
        break;
      }

      // Tuote (Product) operations - cross-entity invalidation
      // CRITICAL: tuotteet_delete SQL procedure modifies keikkaLaskuRivit (invoice line items)
      // Product changes affect: tuote lists, lasku (invoices with product names/prices), keikka (embedded pricing)
      case "TUOTE_UPDATE":
      case "TUOTE_CREATE":
      case "TUOTE_DELETE": {
        this.logger.debug("TUOTE operation invalidation starting", {
          operation,
          params,
        });

        // Parallelize independent invalidations for better performance
        const [tuoteCount, laskuCount, keikkaCount] = await Promise.all([
          this.invalidate(operation, "tuote", params),
          this.invalidate(operation, "lasku", params), // CRITICAL: Invoice cache - products affect invoice line items
          this.invalidate(operation, "keikka", params), // Keikka may embed pricing data
        ]);

        totalInvalidated += tuoteCount + laskuCount + keikkaCount;

        this.logger.info("TUOTE operation invalidation completed", {
          operation,
          keysInvalidated: totalInvalidated,
        });
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
            `notifications:history:${asiakasId}:${personId}:*`
          );
        }
        this.logger.debug("NOTIFICATION operation completed", {
          operation,
          asiakasId,
          personId,
          keysInvalidated: totalInvalidated,
        });
        break;
      }

      // Notification broadcast - invalidate all notification caches for asiakasId
      case "NOTIFICATION_BROADCAST": {
        const { asiakasId } = params;
        if (asiakasId) {
          totalInvalidated += await this.invalidateByPattern(
            `notifications:history:${asiakasId}:*`
          );
        }
        this.logger.debug("NOTIFICATION_BROADCAST completed", {
          operation,
          asiakasId,
          keysInvalidated: totalInvalidated,
        });
        break;
      }

      // Auth cache invalidation for role/permission changes
      case "ASIAKAS_PERSON_SETTING_CREATE":
      case "ASIAKAS_PERSON_SETTING_UPDATE":
      case "ASIAKAS_PERSON_SETTING_DELETE": {
        const personId = params.personId;

        // Invalidate asiakasPersonSetting cache
        totalInvalidated += await this.invalidate(operation, "asiakasPersonSetting", params);

        // Invalidate auth cache for this person (login cache)
        if (personId) {
          totalInvalidated += await this.invalidateByPattern(`auth:permissions:${personId}:*`);
          this.logger.debug("Auth cache invalidated for role change", {
            operation,
            personId,
          });
        }

        this.logger.debug("ASIAKAS_PERSON_SETTING invalidation completed", {
          operation,
          personId,
          keysInvalidated: totalInvalidated,
        });
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
        const { laskupohjaId, laskupohjaRiviId, targetLaskupohjaId, sourceLaskupohjaId } = params;
        const patterns = [];

        // Targeted invalidation when we have specific IDs
        if (laskupohjaId) {
          patterns.push(`laskupohja:get:${laskupohjaId}`);
          patterns.push(`laskupohjaRivi:get:*`); // Rows for this template
        }
        if (laskupohjaRiviId) {
          patterns.push(`laskupohjaRivi:get:${laskupohjaRiviId}`);
        }

        // For copy operations, invalidate both source and target
        if (targetLaskupohjaId) {
          patterns.push(`laskupohja:get:${targetLaskupohjaId}`);
        }
        if (sourceLaskupohjaId) {
          patterns.push(`laskupohja:get:${sourceLaskupohjaId}`);
        }

        // Fallback: if no specific IDs, invalidate all
        if (patterns.length === 0) {
          patterns.push(`laskupohja:get:*`);
          patterns.push(`laskupohjaRivi:get:*`);
        }

        const counts = await Promise.all(patterns.map((p) => this.invalidateByPattern(p)));
        totalInvalidated = counts.reduce((sum, count) => sum + count, 0);

        this.logger.info("LASKUPOHJA operation invalidation completed", {
          operation,
          laskupohjaId,
          laskupohjaRiviId,
          keysInvalidated: totalInvalidated,
        });
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

        this.logger.info("LASKU operation invalidation completed", {
          operation,
          keysInvalidated: totalInvalidated,
        });
        break;
      }

      default: {
        const entityType = params.entityType || "default";
        totalInvalidated += await this.invalidate(operation, entityType, params);
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
        this.logger.info("Connection closed gracefully");
      } catch (error) {
        this.logger.warn("Close warning", {
          error: error.message,
        });
        try {
          this.client.disconnect();
        } catch (disconnectError) {
          this.logger.warn("Force disconnect warning", {
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
   * Switch Redis database at runtime
   * @param {number} dbNumber - Database number (3 = production, 4 = development)
   * @returns {Promise<number>} The new database number
   */
  async selectDatabase(dbNumber) {
    if (![3, 4].includes(dbNumber)) {
      throw new Error("Invalid database number. Must be 3 (production) or 4 (development)");
    }

    const redis = await this.getClient();
    if (!redis) {
      throw new Error("Redis client not available");
    }

    await redis.select(dbNumber);
    this.currentDb = dbNumber;
    this.logger.info("Redis database switched", { db: dbNumber });
    return dbNumber;
  }

  /**
   * Get current Redis database number
   * @returns {number} Current database (3 = production, 4 = development)
   */
  getCurrentDb() {
    return this.currentDb;
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
