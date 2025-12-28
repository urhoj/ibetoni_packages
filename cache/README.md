# @ibetoni/cache

Shared Redis cache and invalidation system for betoni.online backend services.

## Overview

This package provides unified cache management and invalidation logic shared between:
- **puminet5api** - Main API server
- **puminet7-functions-app** - Azure Functions/cron jobs server

## Features

- ✅ **Universal Cache Invalidation** - Consistent invalidation across all services
- ✅ **Cross-Entity Relationships** - Smart invalidation for related entities
- ✅ **Logger Injection** - Use your own logger implementation
- ✅ **Metrics Tracking** - Optional performance monitoring
- ✅ **Azure Redis Support** - Works with Azure Redis Cache
- ✅ **Production-Safe Scanning** - Uses SCAN instead of KEYS

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

### Basic Setup

```javascript
const { createCacheManager } = require('@ibetoni/cache');
const logger = require('./logger'); // Your Winston logger

// Create cache manager instance
const cacheManager = createCacheManager({
  logger: logger.categories.CACHE
});

// Invalidate cache after database update
await cacheManager.invalidateCrossEntity('KEIKKA_BULK_UPDATE', {
  operation: 'tila_cron',
  affectedCount: 10
});
```

### Using Singleton Pattern

```javascript
const { getSingletonCacheManager } = require('@ibetoni/cache');
const logger = require('./logger');

// Initialize once
const cacheManager = getSingletonCacheManager({
  logger: logger.categories.CACHE
});

// Use anywhere in your application
const cacheManager2 = getSingletonCacheManager(); // Returns same instance
```

### Backward Compatibility

For legacy code using `getCacheManager()`:

```javascript
const { getCacheManager } = require('@ibetoni/cache');
const logger = require('./logger');

// Works the same as getSingletonCacheManager()
const cacheManager = getCacheManager({
  logger: logger.categories.CACHE
});
```

**Note**: `getCacheManager()` is deprecated but supported for backward compatibility. New code should use `getSingletonCacheManager()`.

### Advanced Configuration

```javascript
const { UniversalCacheManager, CacheMetrics } = require('@ibetoni/cache');

// Custom metrics implementation
const customMetrics = new CacheMetrics();

// Custom Redis configuration
const cacheManager = new UniversalCacheManager({
  logger: myLogger,
  cacheMetrics: customMetrics,
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

### `createCacheManager(options)`

Create a new cache manager instance.

**Parameters:**
- `options.logger` (Object) - Winston logger instance (required)
- `options.cacheMetrics` (Object) - Optional custom metrics instance
- `options.redisConfig` (Object) - Optional Redis configuration override

**Returns:** `UniversalCacheManager` instance

### `cacheManager.invalidateCrossEntity(operation, params)`

Invalidate cache for complex cross-entity operations.

**Parameters:**
- `operation` (String) - Operation type (e.g., 'KEIKKA_BULK_UPDATE', 'KEIKKA_UPDATE')
- `params` (Object) - Parameters for invalidation (asiakasId, entityId, etc.)

**Returns:** `Promise<number>` - Number of keys invalidated

**Supported Operations:**
- `KEIKKA_BULK_UPDATE` - Bulk delivery order updates (used by tilaCron)
- `KEIKKA_UPDATE` - Single delivery order update
- `KEIKKA_CREATE` - New delivery order creation
- `KEIKKA_DELETE` - Delivery order deletion
- `PALKKI_UPDATE` - Grid bar update (targeted, ~95% fewer cache keys than KEIKKA_UPDATE)
- `PALKKI_DELETE` - Grid bar deletion
- `PALKKI_CREATE` - Grid bar creation
- `GRID_UPDATE` - Grid-only cache invalidation (for visibility changes)
- `PERSON_UPDATE` - Person/user updates
- `VEHICLE_UPDATE` - Vehicle updates
- `VEHICLE_CREATE` - Vehicle creation
- `VEHICLE_DELETE` - Vehicle deletion
- `VEHICLE_VISIBILITY_*` - Vehicle visibility operations (cross-tenant)
- `ASIAKAS_UPDATE` - Customer updates (with cross-entity: keikka if keikkaId, linked customer if linkedAsiakasId)
- `ASIAKAS_CREATE` - Customer creation
- `ASIAKAS_DELETE` - Customer deletion
- `TYOMAA_UPDATE` - Worksite updates
- `TYOMAA_CREATE` - Worksite creation
- `TYOMAA_DELETE` - Worksite deletion
- `TUOTE_UPDATE` - Product updates (with cross-entity: lasku, keikka - products affect invoice line items)
- `TUOTE_CREATE` - Product creation
- `TUOTE_DELETE` - Product deletion (also clears keikkaLaskuRivit references)
- And many more...

### `cacheManager.invalidate(operation, entityType, params)`

Invalidate cache for a specific entity type.

**Parameters:**
- `operation` (String) - Operation type
- `entityType` (String) - Entity type (e.g., 'keikka', 'asiakas', 'person')
- `params` (Object) - Parameters including asiakasId, entityId, etc.

**Returns:** `Promise<number>` - Number of keys invalidated

### `cacheManager.cache(key, data, entityType)`

Store data in cache with appropriate TTL.

**Parameters:**
- `key` (String) - Cache key
- `data` (any) - Data to cache (will be JSON stringified)
- `entityType` (String) - Entity type for TTL selection (default: 'default')

**Returns:** `Promise<boolean>` - Success status

### `cacheManager.get(key, entityType)`

Retrieve data from cache.

**Parameters:**
- `key` (String) - Cache key
- `entityType` (String) - Entity type for metrics (default: 'data')

**Returns:** `Promise<any|null>` - Cached data or null if not found

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

## Environment Variables

The cache manager uses these environment variables for Redis connection:

### Azure Redis (Production)
```env
REDIS_HOSTNAME=your-redis.redis.cache.windows.net
REDIS_PORT=6380
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
const { createCacheManager } = require('@ibetoni/cache');
const database = require('./database');
const logger = require('./logger');

const cacheManager = createCacheManager({
  logger: logger.categories.CACHE
});

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

Default TTL values (in seconds):

| Entity Type | TTL | Description |
|-------------|-----|-------------|
| keikka | 300s (5min) | Delivery orders (change frequently) |
| asiakas | 1800s (30min) | Customers (relatively stable) |
| person | 900s (15min) | Users/persons (moderate changes) |
| vehicle | 1800s (30min) | Vehicles (relatively stable) |
| betoni | 3600s (1hr) | Concrete specifications |
| grid | 300s (5min) | Grid/list views |
| stat | 7200s (2hrs) | Statistics (updated by cron) |
| config | 43200s (12hrs) | Configuration data |
| default | 300s (5min) | Fallback for unknown types |

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
const { createCacheManager } = require('@ibetoni/cache');
const cacheManager = createCacheManager({ logger: myLogger });
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
