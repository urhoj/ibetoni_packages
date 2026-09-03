# @ibetoni/cache

Shared Redis cache and invalidation system for betoni.online backend services.

## Overview

This package provides unified cache management and invalidation logic shared between:
- **puminet5api** - Main API server
- **puminet7-functions-app** - Azure Functions/cron jobs server

## Features

- ✅ **Universal Cache Invalidation** - Consistent invalidation across all services
- ✅ **Cross-Entity Relationships** - Smart invalidation for related entities
- ✅ **Distributed Locking** - Redis-based locks with graceful shutdown
- ✅ **Logger Injection** - Use your own logger implementation
- ✅ **Metrics Tracking** - Optional performance monitoring
- ✅ **Azure Redis Support** - Works with Azure Redis Cache
- ✅ **Production-Safe Scanning** - Uses SCAN instead of KEYS
- ✅ **L1 In-Memory Cache** - LRU cache (30min TTL) for static reference data, eliminates Redis round-trips

## Installation

### Prerequisites

This package requires **ioredis** to be installed in your consuming project:

```bash
npm install ioredis
```

**Why is ioredis required?**
When using file-based npm dependencies (recommended for monorepo setup), the parent project must explicitly declare `ioredis` as a dependency. This ensures a single version is used and prevents "Cannot find module 'ioredis'" errors.

### Install the Cache Package

```bash
npm install @ibetoni/cache
```

Or use file reference in package.json (recommended):
```json
{
  "dependencies": {
    "@ibetoni/cache": "file:../ibetoni_packages/cache",
    "ioredis": "^5.8.2"
  }
}
```

**Important:** Always include `ioredis` alongside the cache package when using file-based dependencies.

## Usage

### Basic Setup (Singleton)

```javascript
const { getSingletonCacheManager } = require('@ibetoni/cache');

// Initialize once, use anywhere — repeated calls return the same instance
const cacheManager = getSingletonCacheManager();

// Invalidate cache after database update
await cacheManager.invalidateCrossEntity('KEIKKA_BULK_UPDATE', {
  operation: 'tila_cron',
  affectedCount: 10
});
```

**Note**: `getCacheManager()` is a deprecated alias supported for backward compatibility. New code should use `getSingletonCacheManager()`.

### Advanced Configuration

```javascript
const { UniversalCacheManager } = require('@ibetoni/cache');

// Custom Redis configuration (bypasses the singleton)
const cacheManager = new UniversalCacheManager({
  redisConfig: {
    host: 'custom-redis-host',
    port: 6379,
    password: 'custom-password'
  }
});
```

### Distributed Locking

Prevent race conditions in concurrent operations:

```javascript
const { DistributedLockManager } = require('@ibetoni/cache');
const logger = require('./logger');

// Create lock manager
const lockManager = new DistributedLockManager({ logger });

// Acquire lock for critical section
const lock = await lockManager.acquireLock({
  lockKey: 'fennoa:customer:sync',
  ttl: 30000,  // 30 seconds
  retryCount: 3,
  retryDelay: 1000
});

try {
  if (lock.acquired) {
    // Critical section - only one process can execute
    await syncCustomerToFennoa(customerId);
  } else {
    console.log('Another process is already syncing');
  }
} finally {
  // Always release lock
  await lockManager.releaseLock(lock);
}
```

**Use Cases**:
- External API synchronization (Fennoa, Digitraffic)
- Database batch operations
- Cron job race condition prevention
- Multi-server deployment coordination

## API Reference

### `getSingletonCacheManager(options)`

Get (or create on first call) the shared cache manager instance.

**Parameters (first call only):**
- `options.cacheMetrics` (Object) - Optional custom metrics instance
- `options.redisConfig` (Object) - Optional Redis configuration override
- `options.keyNamespace` (String) - Optional per-build key-namespace override

**Returns:** `UniversalCacheManager` instance

### `cacheManager.invalidateCrossEntity(operation, params)`

Invalidate cache for complex cross-entity operations.

**Parameters:**
- `operation` (String) - Operation type (e.g., 'KEIKKA_BULK_UPDATE', 'KEIKKA_UPDATE')
- `params` (Object) - Parameters for invalidation (asiakasId, entityId, etc.)
- `params.gridScope` (Object, optional) - `{ tenants: number[] }`, the visible-tenant set a caller
  (puminet5api's `modules/cache/gridScope.js`) resolved for the changed row. When present, grid
  sweeps for `KEIKKA_*`, `PALKKI_*`, `PERSON_PVM_*`, `KEIKKA_PERSON_UPDATE` and worksite ops narrow
  to keys whose visible-tenant CSV contains one of those tenants, at any date, instead of the
  date-scoped or tenant-blind fallback. Absent or empty → today's broader sweep (never narrower
  than what the caller can prove).

**Returns:** `Promise<number>` - Number of keys invalidated

**Supported Operations:**
- `KEIKKA_BULK_UPDATE` - Bulk delivery order updates (used by tilaCron)
- `KEIKKA_UPDATE` - Single delivery order update
- `KEIKKA_CREATE` - New delivery order creation
- `KEIKKA_DELETE` - Delivery order deletion
- `KEIKKA_PERSON_UPDATE` - Person assigned/removed/added on a keikka (or a palkki, via a
  `"p<palkkiId>"` keikkaId) - scoped to that row's tenants, not a tenant-wide person sweep
- `PALKKI_UPDATE` - Grid bar update (targeted, ~95% fewer cache keys than KEIKKA_UPDATE)
- `PALKKI_DELETE` - Grid bar deletion
- `PALKKI_CREATE` - Grid bar creation
- `GRID_UPDATE` - Grid-only cache invalidation (for visibility changes)
- `PERSON_UPDATE` - Person/user updates
- `PERSON_PREFS_UPDATE` - A person's own preferences (dark mode, password, dontAsks, settings) -
  invalidates only that person + their auth/role caches, never the grid
- `VEHICLE_UPDATE` - Vehicle updates
- `VEHICLE_CREATE` - Vehicle creation
- `VEHICLE_DELETE` - Vehicle deletion
- `VEHICLE_VISIBILITY_*` - Vehicle visibility operations (cross-tenant)
- `ASIAKAS_UPDATE` - Customer updates (with cross-entity: keikka if keikkaId, linked customer if linkedAsiakasId, and the edited customer via entityId when it differs from the caller's tenant - e.g. a system admin editing a different company)
- `ASIAKAS_CREATE` - Customer creation (same cross-entity rules)
- `ASIAKAS_DELETE` - Customer deletion (same cross-entity rules)
- `TYOMAA_UPDATE` - Worksite updates
- `TYOMAA_CREATE` - Worksite creation
- `TYOMAA_DELETE` - Worksite deletion
- `TUOTE_UPDATE` - Product updates (with cross-entity: lasku, keikka - products affect invoice line items)
- `TUOTE_CREATE` - Product creation
- `TUOTE_DELETE` - Product deletion (also clears keikkaLaskuRivit references)
- `LASKU_UPDATE` - Invoice header/row updates (invalidates: lasku, stat)
- `LASKU_CREATE` - Invoice creation (invalidates: lasku, stat)
- `LASKU_DELETE` - Invoice deletion (invalidates: lasku, stat)
- `LASKUPOHJA_UPDATE` - Invoice template updates
- `LASKUPOHJA_CREATE` - Invoice template creation
- `LASKUPOHJA_DELETE` - Invoice template deletion
- `LASKUPOHJA_RIVI_DELETE` - Invoice template row deletion
- `NOTIFICATION_CREATE` - New notification sent
- `NOTIFICATION_UPDATE` - Notification acknowledged
- `NOTIFICATION_READ` - Notification marked as read
- `NOTIFICATION_BROADCAST` - Group notification (invalidates all caches for asiakasId)
- `ASIAKAS_PERSON_SETTING_*` - Role/permission changes (invalidates auth cache)
- And many more...

**`authz:` lookup memo sweep.** After the per-operation switch, every operation whose
family (the prefix before the first `_`, lowercased) is `asiakas`, `tyomaa`, `vehicle`,
`sijainti` or `person` also sweeps `authz:*:<family>:<params.entityId>` (or
`authz:*:<family>:*` when `params.entityId` is absent — never a double wildcard). The id
segment is matched EXACTLY: keys are shaped `authz:<kind>[.<qualifier>]:<family>:<id>` with
the id always last, so the glob needs no trailing `*`. It used to have one, which made the
id a prefix match — sweeping entity 12 also cleared 123, 124, 1200. Safe but wasteful, and
each pattern costs a full SCAN, so reaching qualified keys via a second pattern would have
cost more than moving the qualifier into the `kind` segment (`module.ecofleet`). Those keys
are written by `puminet5api/modules/cache/authzLookupCache.js` (entity owner, sijainti
`{asiakasId,isPublic}`, company module flags) for the pre-cache read gates. The sweep is
keyed on `params.entityId` (the TARGET); `params.asiakasId` is the writer's tenant and is
never used as a fallback. `SIJAINTI_LATLNG_UPDATE` is excluded (loop op, geocode-only), and
so are the family's own compliance-date sub-ops (`*_DATE_*`, `*_REQUIRED_DATE_TYPE_*` —
same anchored-family regex `invalidateGridSmart` uses for fb#761/fb#1031): they touch only
compliance-date rows, never the owner/isPublic/module flags this memo caches.

Both halves of that contract — the keys `authzLookupCache` writes and the glob swept here —
are built from **`src/authzKeys.js`** (`authzKey()` / `authzSweepGlob()`, re-exported from the
package root), so a renamed segment moves both at once. Before fb#1261 they were independent
template literals in two repos, each pinned by hand-typed strings, so a rename on either side
left both suites green while the sweep quietly became a no-op — and this sweep backs an
authorization gate, not a freshness one, so that failure mode is fail-OPEN. Pinned by
`scripts/test-authz-invalidation.js`, whose closing block glob-matches the emitted sweep
against keys `authzKey()` produced rather than comparing typed strings.

### `cacheManager.invalidate(operation, entityType, params)`

Invalidate cache for a specific entity type.

**Parameters:**
- `operation` (String) - Operation type
- `entityType` (String) - Entity type (e.g., 'keikka', 'asiakas', 'person')
- `params` (Object) - Parameters including asiakasId, entityId, etc.

**Returns:** `Promise<number>` - Number of keys invalidated

### `cacheManager.cache(key, data, entityType)`

Store data in Redis with appropriate TTL. Also populates L1 in-memory cache for eligible entity types.

**Parameters:**
- `key` (String) - Cache key
- `data` (any) - Data to cache (will be JSON stringified for Redis)
- `entityType` (String) - Entity type for TTL selection (default: 'default')

**Returns:** `Promise<boolean>` - Success status

### `cacheManager.get(key, entityType)`

Retrieve data from cache. Checks L1 in-memory cache first for eligible entity types, then Redis.

**Parameters:**
- `key` (String) - Cache key
- `entityType` (String) - Entity type for metrics and L1 eligibility (default: 'data')

**Returns:** `Promise<any|null>` - Cached data or null if not found

### `cacheManager.clearAllCache()`

Clear all cached data — iterates all entity types, clears matching Redis keys, and clears L1 in-memory cache. Safer than `flushdb` because it only clears cache keys, not socket sessions.

**Returns:** `Promise<number>` - Total Redis keys cleared

### `cacheManager.clearL1Cache()`

Clear all L1 in-memory cache entries. Called by `memoryManager` during memory pressure cleanup.

### `cacheManager.getL1Stats()`

Get L1 cache statistics for monitoring.

**Returns:** `{ size, maxSize, entityTypes }` - Current L1 cache state

### `DistributedLockManager`

Distributed locking for race condition prevention.

#### `lockManager.acquireLock(options)`

Acquire a distributed lock.

**Parameters:**
- `options.lockKey` (String) - Unique lock identifier (required)
- `options.ttl` (Number) - Lock timeout in milliseconds (default: 30000)
- `options.retryCount` (Number) - Number of retry attempts (default: 3)
- `options.retryDelay` (Number) - Delay between retries in milliseconds (default: 100)

**Returns:** `Promise<DistributedLock>` - Lock object with `acquired` property

**Example:**
```javascript
const lock = await lockManager.acquireLock({
  lockKey: 'invoice:create:123',
  ttl: 30000,
  retryCount: 5
});
```

#### `lockManager.releaseLock(lock)`

Release a previously acquired lock.

**Parameters:**
- `lock` (DistributedLock) - Lock object from `acquireLock()`

**Returns:** `Promise<void>`

**Example:**
```javascript
await lockManager.releaseLock(lock);
```

### Graceful Shutdown

The lock manager automatically releases all active locks when the process receives SIGTERM or SIGINT signals. This prevents locks from being held until TTL expires after process restarts.

**Automatic behavior:**
- On SIGTERM/SIGINT: All active locks are released before exit
- Useful for: nodemon restarts, container stops, deployments

## Environment Variables

The cache manager uses these environment variables for Redis connection:

### Azure Managed Redis (Production)
```env
REDIS_HOSTNAME=puminet7amr.northeurope.redis.azure.net
REDIS_PORT=10000
REDIS_ACCESS_KEY=your-access-key
REDIS_CACHE_ENABLED=true  # Set to 'false' to disable cache
```

### Local Redis (Development)
```env
SIMPLIFIED_REDIS_HOST=localhost
SIMPLIFIED_REDIS_PORT=6379
```

## Examples

### Example 1: Cron Job with Cache Invalidation

```javascript
const { getSingletonCacheManager } = require('@ibetoni/cache');
const database = require('./database');

const cacheManager = getSingletonCacheManager();

// Cron job that updates delivery statuses
async function deliveryStatusSync() {
  try {
    // Execute stored procedure
    const result = await database.executeStoredProcedure('keikka_autoSetTila_toimitettu');

    // Invalidate cache for all affected deliveries
    const affectedRecords = result.recordsets[0]?.length || 0;
    if (affectedRecords > 0) {
      await cacheManager.invalidateCrossEntity('KEIKKA_BULK_UPDATE', {
        operation: 'tila_cron',
        affectedCount: affectedRecords
      });
      console.log(`✅ Updated ${affectedRecords} deliveries, cache invalidated`);
    }
  } catch (error) {
    console.error('❌ Delivery status sync failed:', error);
  }
}
```

### Example 2: API Route with Cache Invalidation

```javascript
const { getSingletonCacheManager } = require('@ibetoni/cache');

// Initialize once at app startup
const cacheManager = getSingletonCacheManager({ logger: myLogger });

// Use in route handler
router.put('/api/keikka/:keikkaId', async (req, res) => {
  const { keikkaId } = req.params;
  const asiakasId = req.user.ownerAsiakasId;

  // Update database
  await database.updateKeikka(keikkaId, req.body);

  // Invalidate cache
  await cacheManager.invalidateCrossEntity('KEIKKA_UPDATE', {
    asiakasId,
    keikkaId,
    body: req.body
  });

  res.json({ success: true });
});
```

## TTL Configuration

### TTL Multiplier

All TTL values are scaled by a global **TTL multiplier** (default: `4.0`). This allows easy optimization of cache duration without modifying individual values.

**Configure via environment variable:**
```bash
CACHE_TTL_MULTIPLIER=4.0    # 4× all TTLs (default)
CACHE_TTL_MULTIPLIER=5.0    # 5× all TTLs (aggressive caching)
CACHE_TTL_MULTIPLIER=1.0    # Original TTLs (conservative)
```

**Or programmatically:**
```javascript
const cacheManager = new UniversalCacheManager({
  logger: myLogger,
  ttlMultiplier: 5.0  // Override default multiplier
});
```

**Query current configuration:**
```javascript
const config = cacheManager.getTtlConfig();
// Returns: { multiplier, maxTtl, excluded, effectiveTtls, baseTtls }
```

### Multiplier Exclusions

Some entity types are excluded from the multiplier (require real-time or fixed-duration data):
- `ecofleet` - Real-time vehicle GPS positions (always 1 minute)
- `ecofleet-daily` - Daily keikka presence check for cron smart fetch skip (always 4 hours)
- `ecofleet-daily-today` - Today's GPS timeline/route data (always 10 minutes)

### Maximum TTL Cap

TTLs are capped at **7 days** (604,800 seconds) regardless of multiplier to prevent excessively long cache times.

### Base TTL Values (Before Multiplier)

| Entity Type | Base TTL | With 4× Multiplier | Description |
|-------------|----------|-------------------|-------------|
| keikka | 1hr | **4hr** | Delivery orders |
| asiakas | 2hr | **8hr** | Customers |
| person | 2hr | **8hr** | Users/persons |
| vehicle | 2hr | **8hr** | Vehicles |
| tyomaa | 2hr | **8hr** | Worksites |
| betoni | 1hr | **4hr** | Concrete specifications |
| betoniPrices | 5min | **~20min** | Concrete price lookups (SP-heavy) |
| grid | 1hr | **4hr** | Grid keikka lists |
| stepLog | 1hr | **4hr** | Keikka activity logs |
| stat | 2hr | **8hr** | Statistics (updated by cron) |
| config | 12hr | **48hr** | Configuration data |
| help | 12hr | **48hr** | Help content |
| legalDocument | 24hr | **96hr** | Legal documents |
| holiday | 24hr | **96hr** | National holidays |
| notifications | 2min | **8min** | Push notifications (time-sensitive) |
| auth | 5min | **~20min** | Login permissions / role cache (jitter via cache()) |
| ecofleet | 1min | **1min** | Real-time GPS (excluded from multiplier) |
| ecofleet-daily | 4hr | **4hr** | Daily keikka check, cron smart fetch (excluded from multiplier) |
| ecofleet-daily-today | 10min | **10min** | Today's GPS timeline/route (excluded from multiplier) |
| keikkaTila | 12hr | **48hr** | Delivery status types (L1 eligible) |
| default | 1hr | **4hr** | Fallback for unknown types |

### L1 In-Memory Cache

Static reference data entity types are cached in an L1 in-memory LRU cache (max 500 entries, 30-minute TTL) in front of Redis. This eliminates Redis network round-trips for data that rarely changes.

**L1-eligible entity types:** config, betoniReference, personpvmStatus, personDateType, personRequiredDateType, tyomaaDateType, asiakasDateType, vehicleDateType, vehicleRequiredDateType, attachmentTypes, productReference, barColor, invoiceStatus, laskuStatusType, help, holiday, keikkaTila

L1 entries are automatically cleared on pattern-based invalidation and during memory pressure cleanup via `memoryManager`.

### TTL Jitter

All TTLs include ±5% random jitter to prevent cache stampedes (synchronized expiration).

## Development

### Project Structure

```
@ibetoni/cache/
├── package.json
├── README.md
└── src/
    ├── index.js              # Main exports
    ├── UniversalCacheManager.js  # Core cache manager
    └── CacheMetrics.js       # Metrics tracking
```

### Running Tests

```bash
# Coming soon
npm test
```

## Migration Guide

### From Direct Module Imports

**Before:**
```javascript
const cacheSystem = require('../modules/cache');
await cacheSystem.UniversalCacheManager.invalidate(...);
```

**After:**
```javascript
const { getSingletonCacheManager } = require('@ibetoni/cache');
const cacheManager = getSingletonCacheManager();
await cacheManager.invalidate(...);
```

## Troubleshooting

### Cannot find module 'ioredis'

**Error:** `Error: Cannot find module 'ioredis'`

**Cause:** The consuming project doesn't have `ioredis` installed as a direct dependency.

**Solution:**
1. Add ioredis to your project's package.json:
   ```json
   {
     "dependencies": {
       "ioredis": "^5.8.2"
     }
   }
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

See [Installation Prerequisites](#prerequisites) for more details.

### Cache Not Invalidating

1. Check Redis connection:
   ```javascript
   const status = cacheManager.getStatus();
   console.log('Redis status:', status);
   ```

2. Verify environment variables are set

3. Check logger output for errors

### Performance Issues

1. Review cache TTLs - adjust if needed
2. Monitor metrics: `cacheManager.cacheMetrics.getSummary()`
3. Check Redis server load

## License

UNLICENSED - Private package for betoni.online

## Support

For issues or questions, contact the betoni.online development team.
