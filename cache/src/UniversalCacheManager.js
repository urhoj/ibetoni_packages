/**
 * Universal Cache Manager for betoni.online
 *
 * Single unified cache system replacing all specialized cache strategies.
 * Handles all entity types with consistent patterns and minimal code duplication.
 *
 * Shared package version - logger and metrics are injectable.
 */

const crypto = require("crypto");
const Redis = require("ioredis");

class UniversalCacheManager {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Winston logger instance with categories.CACHE
   * @param {Object} options.cacheMetrics - Optional cache metrics instance
   * @param {Object} options.redisConfig - Optional Redis configuration override
   */
  constructor(options = {}) {
    this.logger = options.logger || this._createDefaultLogger();
    this.cacheMetrics = options.cacheMetrics || this._createDefaultMetrics();
    this.redisConfigOverride = options.redisConfig;

    this.client = null;
    this.isConnected = false;
    this.isShuttingDown = false;
    this.connectionPromise = null; // Prevent multiple connection attempts

    // TTL configuration for all entity types (seconds)
    this.TTL = {
      keikka: 300, // 5 minutes - delivery orders, change frequently
      asiakas: 1800, // 30 minutes - customers, relatively stable
      tyomaa: 900, // 15 minutes - worksites, moderate changes
      person: 900, // 15 minutes - persons, moderate changes
      personpvm: 300, // 5 minutes - person schedules, change frequently
      personpvmStatus: 43200, // 12 hours - person schedule status types (static reference data)
      betoni: 3600, // 1 hour - concrete specs, reference data
      betoniReference: 7200, // 2 hours - static reference data
      betoniLaatu: 1800, // 30 minutes - quality data scoped by supplier
      betoniShortcut: 1800, // 30 minutes - user-configured concrete shortcuts
      betoniList: 1800, // 30 minutes - betoni search/filter results
      betoniAttr: 1800, // 30 minutes - betoni attributes (keikka-specific)
      config: 43200, // 12 hours - static configuration
      vehicle: 1800, // 30 minutes - vehicles, relatively stable
      vehicleDate: 1800, // 30 minutes - vehicle dates, moderate changes
      vehicleDateType: 43200, // 12 hours - vehicle date types (reference data)
      vehicleRequiredDateType: 1800, // 30 minutes - vehicle required date types
      personDate: 1800, // 30 minutes - person dates, moderate changes
      personDateType: 43200, // 12 hours - person date types (reference data)
      personRequiredDateType: 1800, // 30 minutes - person required date types
      tyomaaDate: 1800, // 30 minutes - työmaa dates, moderate changes
      tyomaaDateType: 43200, // 12 hours - työmaa date types (reference data)
      asiakasDate: 1800, // 30 minutes - asiakas dates, moderate changes
      asiakasDateType: 43200, // 12 hours - asiakas date types (reference data)
      complianceDashboard: 900, // 15 minutes - dashboard aggregations
      sijainti: 3600, // 1 hour - locations, rarely changes
      geocode: 3600, // 1 hour - geocoding & driving distances
      attachment: 600, // 10 minutes - attachment lists, moderate changes
      attachmentTypes: 43200, // 12 hours - attachment types (static reference data)
      tuote: 1800, // 30 minutes - products, moderate changes
      productReference: 43200, // 12 hours - product types and categories
      barColor: 43200, // 12 hours - grid bar colors (static UI configuration)
      invoiceStatus: 43200, // 12 hours - invoice status lookup table
      tyomaaPerson: 600, // 10 minutes - worksite-person relationships
      asiakasPerson: 900, // 15 minutes - customer-person relationships
      keikkaPerson: 300, // 5 minutes - delivery-person assignments
      keikkaBetoni: 300, // 5 minutes - delivery concrete assignments
      dailyMessage: 300, // 5 minutes - daily messages, frequently updated
      dailyConfirmation: 3600, // 1 hour - daily confirmations, stable once set
      stat: 7200, // 2 hours - statistics updated by cronjobs
      stepLog: 300, // 5 minutes - activity logs, change frequently
      grid: 300, // 5 minutes - grid keikka lists, frequently updated
      help: 43200, // 12 hours - help content, changes very rarely
      legalDocument: 86400, // 24 hours - legal documents, changes rarely
      weather: 3600, // 1 hour - weather module status and forecasts
      ecofleet: 60, // 1 minute - external fleet tracking API (real-time vehicle locations and movement data)
      default: 300, // 5 minutes fallback
    };

    // Production-safe batch limits
    this.BATCH_SIZE = 2000;
    this.SCAN_COUNT = 500; // Increased from 100 to reduce Redis round-trips (5× fewer iterations)
  }

  /**
   * Create default logger if none provided
   */
  _createDefaultLogger() {
    return {
      info: (...args) => console.log('[CACHE]', ...args),
      warn: (...args) => console.warn('[CACHE]', ...args),
      error: (...args) => console.error('[CACHE]', ...args),
      debug: (...args) => console.log('[CACHE-DEBUG]', ...args),
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
        stack: error.stack
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
        port: config.port
      });
    };

    const onError = (err) => {
      this.isConnected = false;
      this.logger.error("Redis error", {
        error: err.message
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
        this.logger.debug("Redis unavailable, skipping operation", { operationType });
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
        error: error.message
      });
      this.cacheMetrics.recordError(operationType, 'unknown', error);
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
        dateInput
      });
      return null;
    }
  }

  /**
   * Cache data with appropriate TTL
   */
  async cache(key, data, entityType = "default") {
    return await this.withRedis(
      async (redis) => {
        const ttl = this.TTL[entityType] || this.TTL.default;
        await redis.setex(key, ttl, JSON.stringify(data));
        this.logger.debug("Cache set successful", { entityType, key, ttl });

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
                maxIterations
              });
              break;
            }
          } catch (scanError) {
            this.logger.error("Scan error", {
              pattern,
              iteration: iterations,
              error: scanError.message
            });
            // Continue with partial results rather than failing completely
            break;
          }
        } while (cursor !== "0");

        this.logger.debug("Scan completed", {
          pattern,
          keysFound: keys.length,
          iterations
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
              batchSize: batch.length
            });
            // Continue with remaining batches rather than failing completely
            continue;
          }
        }

        this.logger.debug("Batch delete completed", {
          deletedCount,
          batches: Math.ceil(keys.length / batchSize)
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
        keysDeleted: deletedCount
      });

      // Record invalidation metric
      const entityType = pattern.split(':')[0] || 'unknown';
      this.cacheMetrics.recordInvalidation(entityType, pattern, deletedCount);

      return deletedCount;
    }
    return 0;
  }

  /**
   * Universal cache invalidation for all entity types
   * This is a shortened version - full implementation continues below...
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
        let individualKeysPattern;
        if (keikkaIdValue) {
          // Targeted: Only clear this specific keikka's cache (100x reduction)
          individualKeysPattern = `keikka:get:${asiakasId || "*"}:${keikkaIdValue}`;
        } else {
          // Fallback: Clear all if we don't know which keikka
          individualKeysPattern = `keikka:get:${asiakasId || "*"}:*`;
        }

        if (yyyymmddValue) {
          return await Promise.all([
            this.invalidateByPattern(individualKeysPattern),
            this.invalidateByPattern(`keikka:list:*:${yyyymmddValue}`)
          ]).then(results => results.reduce((sum, count) => sum + count, 0));
        } else if (targetDate) {
          const yyyymmdd = targetDate.substring(0, 10).replace(/-/g, '');
          return await Promise.all([
            this.invalidateByPattern(individualKeysPattern),
            this.invalidateByPattern(`keikka:list:*:${yyyymmdd}`)
          ]).then(results => results.reduce((sum, count) => sum + count, 0));
        } else if (personIdValue) {
          return await Promise.all([
            this.invalidateByPattern(individualKeysPattern),
            this.invalidateByPattern(`keikka:list:${personIdValue}:*`)
          ]).then(results => results.reduce((sum, count) => sum + count, 0));
        } else {
          return await Promise.all([
            this.invalidateByPattern(individualKeysPattern),
            this.invalidateByPattern(`keikka:list:*:*`)
          ]).then(results => results.reduce((sum, count) => sum + count, 0));
        }
      }
      case "asiakas":
        pattern = `asiakas:*:${asiakasId || "*"}*`;
        break;
      case "vehicleRequiredDateType":
      case "personRequiredDateType":
      case "tyomaaRequiredDateType":
      case "asiakasRequiredDateType":
        // These keys have 3 segments: entityType:operation:asiakasId (e.g., vehicleRequiredDateType:batchCompliance:8)
        pattern = `${entityType}:*:${asiakasId || "*"}`;
        break;
      case "grid":
        if (personId && pumppuAika) {
          const dateKey = this.formatGridDate(pumppuAika);
          pattern = `grid:personId:${personId}:pumppuAika:${dateKey}`;
        } else if (pumppuAika) {
          const dateKey = this.formatGridDate(pumppuAika);
          pattern = `grid:personId:*:pumppuAika:${dateKey}`;
        } else if (personId) {
          pattern = `grid:personId:${personId}:pumppuAika:*`;
        } else {
          pattern = `grid:personId:*:pumppuAika:*`;
        }
        break;
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
          `attachment:*:${asiakasId || "*"}:*`,        // 4-segment asiakasId-based keys (search)
          `attachment:listMissing:${asiakasId || "*"}`, // 3-segment listMissing keys
          `attachment:types:${asiakasId || "*"}`,       // 3-segment type keys
          `attachment:bulk:*:*`,                        // bulk keikka attachment lists
          `attachment:list:*:*`,                        // individual entity attachment lists
          `attachment:get:*`,                           // individual attachment gets
        ];

        return await Promise.all(
          patterns.map(p => this.invalidateByPattern(p))
        ).then(results => results.reduce((sum, count) => sum + count, 0));
      }
      default:
        pattern = `${entityType}:*:${asiakasId || "*"}:*`;
    }

    console.log("🔍 [DEBUG invalidate] Pattern:", pattern, "for entityType:", entityType);
    const keys = await this.scanKeys(pattern);
    console.log("🔍 [DEBUG invalidate] Keys found:", keys.length, keys.slice(0, 3));

    if (keys.length > 0) {
      const deletedCount = await this.batchDelete(keys);
      this.logger.info("Entity cache invalidated", {
        entityType,
        operation,
        keysDeleted: deletedCount
      });
      return deletedCount;
    }

    return 0;
  }

  /**
   * Smart grid invalidation based on operation type and request body
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
      asiakasId
    });

    switch (operation) {
      case "KEIKKA_UPDATE": {
        let totalInvalidated = 0;

        if (newDate) {
          this.logger.debug("Copy operation detected - invalidating ONLY target date", {
            newDate,
            asiakasId
          });
          totalInvalidated += await this.invalidate(operation, "grid", {
            asiakasId,
            pumppuAika: newDate,
          });
          return totalInvalidated;
        }

        if (pumppuAika) {
          totalInvalidated += await this.invalidate(operation, "grid", { asiakasId, pumppuAika });
        } else {
          totalInvalidated += await this.invalidate(operation, "grid", { asiakasId });
        }

        return totalInvalidated;
      }

      case "KEIKKA_COPY":
        if (newDate) {
          this.logger.debug("KEIKKA_COPY - invalidating target date only", {
            newDate,
            asiakasId
          });
          return await this.invalidate(operation, "grid", { asiakasId, pumppuAika: newDate });
        } else {
          this.logger.warn("KEIKKA_COPY without newDate - no invalidation", {
            operation
          });
          return 0;
        }

      default:
        this.logger.warn("Unknown grid operation, using broad invalidation", {
          operation,
          asiakasId
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
      case "KEIKKA_CREATE":
        // Parallelize independent invalidations for better performance
        const [keikkaCount, keikkaPersonCount, keikkaBetoniCount, stepLogCount, attachmentCount, gridCount] =
          await Promise.all([
            this.invalidate(operation, "keikka", params),
            this.invalidate(operation, "keikkaPerson", params),
            this.invalidate(operation, "keikkaBetoni", params),
            this.invalidate(operation, "stepLog", params),
            this.invalidate(operation, "attachment", params),
            this.invalidateGridSmart(operation, params.body || {}, params)
          ]);
        totalInvalidated += keikkaCount + keikkaPersonCount + keikkaBetoniCount + stepLogCount + attachmentCount + gridCount;
        break;

      case "KEIKKA_BULK_UPDATE":
        totalInvalidated += await this.invalidate(operation, "keikka", params);
        totalInvalidated += await this.invalidateGridSmart(operation, params.body || {}, params);
        totalInvalidated += await this.invalidate(operation, "asiakas", params);
        this.logger.debug("KEIKKA_BULK_UPDATE completed", {
          keysInvalidated: totalInvalidated
        });
        break;

      case "VEHICLE_DATE_DISMISS":
      case "VEHICLE_DATE_UNDISMISS":
      case "VEHICLE_DATE_UPDATE":
      case "VEHICLE_DATE_CREATE":
      case "VEHICLE_DATE_DELETE":
        console.log("🔍 [DEBUG] VEHICLE_DATE operation START", { operation, params });

        // Show what keys exist in Redis before invalidation
        const allVehicleKeys = await this.scanKeys("vehicle:*");
        const allVehicleReqKeys = await this.scanKeys("vehicleRequiredDateType:*");
        console.log("🔍 [DEBUG] Existing vehicle keys sample:", allVehicleKeys.slice(0, 3));
        console.log("🔍 [DEBUG] Existing vehicleRequiredDateType keys sample:", allVehicleReqKeys.slice(0, 3));

        // Parallelize independent invalidations for better performance
        const [vehicleDateCount, vehicleCount, vehicleReqCount, vehicleGridCount] = await Promise.all([
          this.invalidate(operation, "vehicleDate", params),
          this.invalidate(operation, "vehicle", params),
          this.invalidate(operation, "vehicleRequiredDateType", params),
          this.invalidateGridSmart(operation, params.body || {}, params)
        ]);

        console.log("🔍 [DEBUG] vehicleDate invalidated:", vehicleDateCount);
        console.log("🔍 [DEBUG] vehicle invalidated:", vehicleCount);
        console.log("🔍 [DEBUG] vehicleRequiredDateType invalidated:", vehicleReqCount);
        console.log("🔍 [DEBUG] grid invalidated:", vehicleGridCount);

        totalInvalidated += vehicleDateCount + vehicleCount + vehicleReqCount + vehicleGridCount;
        console.log("🔍 [DEBUG] VEHICLE_DATE operation TOTAL:", totalInvalidated);
        break;

      case "PERSON_DATE_DISMISS":
      case "PERSON_DATE_UNDISMISS":
      case "PERSON_DATE_UPDATE":
      case "PERSON_DATE_CREATE":
      case "PERSON_DATE_DELETE":
        console.log("🔍 [DEBUG] PERSON_DATE operation START", { operation, params });

        // Parallelize independent invalidations for better performance
        const [personDateCount, personCount, personReqCount, personGridCount] = await Promise.all([
          this.invalidate(operation, "personDate", params),
          this.invalidate(operation, "person", params),
          this.invalidate(operation, "personRequiredDateType", params),
          this.invalidateGridSmart(operation, params.body || {}, params)
        ]);

        console.log("🔍 [DEBUG] personDate invalidated:", personDateCount);
        console.log("🔍 [DEBUG] person invalidated:", personCount);
        console.log("🔍 [DEBUG] personRequiredDateType invalidated:", personReqCount);
        console.log("🔍 [DEBUG] grid invalidated:", personGridCount);

        totalInvalidated += personDateCount + personCount + personReqCount + personGridCount;
        console.log("🔍 [DEBUG] PERSON_DATE operation TOTAL:", totalInvalidated);
        break;

      case "TYOMAA_DATE_DISMISS":
      case "TYOMAA_DATE_UNDISMISS":
      case "TYOMAA_DATE_UPDATE":
      case "TYOMAA_DATE_CREATE":
      case "TYOMAA_DATE_DELETE":
        console.log("🔍 [DEBUG] TYOMAA_DATE operation START", { operation, params });

        // Parallelize independent invalidations for better performance
        const [tyomaaDateCount, tyomaaCount, tyomaaReqCount, tyomaaGridCount] = await Promise.all([
          this.invalidate(operation, "tyomaaDate", params),
          this.invalidate(operation, "tyomaa", params),
          this.invalidate(operation, "tyomaaRequiredDateType", params),
          this.invalidateGridSmart(operation, params.body || {}, params)
        ]);

        console.log("🔍 [DEBUG] tyomaaDate invalidated:", tyomaaDateCount);
        console.log("🔍 [DEBUG] tyomaa invalidated:", tyomaaCount);
        console.log("🔍 [DEBUG] tyomaaRequiredDateType invalidated:", tyomaaReqCount);
        console.log("🔍 [DEBUG] grid invalidated:", tyomaaGridCount);

        totalInvalidated += tyomaaDateCount + tyomaaCount + tyomaaReqCount + tyomaaGridCount;
        console.log("🔍 [DEBUG] TYOMAA_DATE operation TOTAL:", totalInvalidated);
        break;

      case "ASIAKAS_DATE_DISMISS":
      case "ASIAKAS_DATE_UNDISMISS":
      case "ASIAKAS_DATE_UPDATE":
      case "ASIAKAS_DATE_CREATE":
      case "ASIAKAS_DATE_DELETE":
        console.log("🔍 [DEBUG] ASIAKAS_DATE operation START", { operation, params });

        // Parallelize independent invalidations for better performance
        const [asiakasDateCount, asiakasCount, asiakasReqCount, asiakasGridCount] = await Promise.all([
          this.invalidate(operation, "asiakasDate", params),
          this.invalidate(operation, "asiakas", params),
          this.invalidate(operation, "asiakasRequiredDateType", params),
          this.invalidateGridSmart(operation, params.body || {}, params)
        ]);

        console.log("🔍 [DEBUG] asiakasDate invalidated:", asiakasDateCount);
        console.log("🔍 [DEBUG] asiakas invalidated:", asiakasCount);
        console.log("🔍 [DEBUG] asiakasRequiredDateType invalidated:", asiakasReqCount);
        console.log("🔍 [DEBUG] grid invalidated:", asiakasGridCount);

        totalInvalidated += asiakasDateCount + asiakasCount + asiakasReqCount + asiakasGridCount;
        console.log("🔍 [DEBUG] ASIAKAS_DATE operation TOTAL:", totalInvalidated);
        break;

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

        const counts = await Promise.all(
          patterns.map(p => this.invalidateByPattern(p))
        );
        totalInvalidated = counts.reduce((sum, count) => sum + count, 0);

        this.logger.debug("Targeted attachment invalidation", {
          entityType,
          entityId,
          asiakasId,
          keysInvalidated: totalInvalidated
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
          error: error.message
        });
        try {
          this.client.disconnect();
        } catch (disconnectError) {
          this.logger.warn("Force disconnect warning", {
            error: disconnectError.message
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
        efficiencyPercent: parseFloat(summary.hitRate)
      }
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
