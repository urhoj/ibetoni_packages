# @ibetoni/constants

Shared constants for betoni.online platform

## Purpose

Centralized constants used across multiple services, eliminating duplication and ensuring consistency.

## Installation

```bash
# In package.json
"@ibetoni/constants": "file:../ibetoni_packages/constants"
```

## Usage

### CORS Allowed Origins

```javascript
const { allowedOrigins } = require('@ibetoni/constants');

// Use in CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  }
}));
```

### Import from specific module

```javascript
const { allowedOrigins } = require('@ibetoni/constants/domains');
```

## Contents

### Domains (`src/domains.js`)

- **allowedOrigins**: Array of 44+ trusted domains for CORS configuration
  - Production environments (betoni.online, ibetoni.fi)
  - Staging, Latest, Stable environments
  - Functions app domains
  - API and data domains
  - Localhost for development

### HTTP Status Codes (`src/http.js`)

- **HTTP_STATUS**: Standard HTTP status code constants
  - Success: `OK` (200), `CREATED` (201)
  - Client Errors: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `METHOD_NOT_ALLOWED` (405), `CONFLICT` (409)
  - Server Errors: `INTERNAL_SERVER_ERROR` (500), `SERVICE_UNAVAILABLE` (503)

```javascript
const { HTTP_STATUS } = require('@ibetoni/constants');
res.status(HTTP_STATUS.OK).json({ data });
```

### Error Codes (`src/errors.js`)

- **ERROR_CODES**: Comprehensive error code constants organized by category
  - **Validation Errors (1000-1999)**: `VALIDATION_ERROR`, `INVALID_INPUT`, `MISSING_REQUIRED_FIELD`, `INVALID_ID`, `INVALID_DATE`, `INVALID_COORDINATES`, `INVALID_ORIGIN`, `INVALID_DESTINATION`, `MISSING_REQUIRED_PARAMS`
  - **API Errors (2000-2999)**: `API_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `RATE_LIMIT_EXCEEDED`, `GOOGLE_MAPS_API_ERROR`, `GOOGLE_MAPS_QUOTA_EXCEEDED`, `GOOGLE_MAPS_TIMEOUT`, `GOOGLE_MAPS_INVALID_REQUEST`
  - **Database Errors (3000-3999)**: `DATABASE_ERROR`, `DATABASE_CONNECTION_ERROR`, `DATABASE_QUERY_ERROR`, `CONSTRAINT_VIOLATION`, `RECORD_NOT_FOUND`, `CACHE_ERROR`
  - **System Errors (4000-4999)**: `INTERNAL_SERVER_ERROR`, `NETWORK_ERROR`, `TIMEOUT_ERROR`, `SERVICE_UNAVAILABLE`, `AUTHENTICATION_ERROR`
  - **Business Logic Errors (5000-5999)**: `BUSINESS_LOGIC_ERROR`, `OPERATION_FAILED`, `RESOURCE_CONFLICT`, `INVALID_OPERATION`, `NO_ROUTE_FOUND`, `DISTANCE_CALCULATION_FAILED`, `LOCATION_NOT_FOUND`

```javascript
const { ERROR_CODES } = require('@ibetoni/constants');
throw new Error(ERROR_CODES.VALIDATION_ERROR);
```

### Cache TTL (`src/cache.js`)

- **CACHE_TTL**: Default Time-To-Live values for cached entities (in seconds)
  - `CACHE_TTL.KEIKKA` - 600 (10 minutes) - Orders change frequently
  - `CACHE_TTL.TYOMAA` - 1200 (20 minutes) - Worksites change moderately
  - `CACHE_TTL.PERSON` - 1800 (30 minutes) - Person data relatively stable
  - `CACHE_TTL.VEHICLE` - 1800 (30 minutes) - Vehicle data relatively stable
  - `CACHE_TTL.WEATHER` - 900 (15 minutes) - Weather data changes frequently

```javascript
const { CACHE_TTL } = require('@ibetoni/constants');
await setCachedData('keikka', customerId, data, CACHE_TTL.KEIKKA);
```

**Legacy exports (deprecated)**: `DEFAULT_KEIKKA_TTL`, `DEFAULT_TYOMAA_TTL`, `DEFAULT_PERSON_TTL`, `DEFAULT_VEHICLE_TTL`, `DEFAULT_WEATHER_TTL`

### Security Constants (`src/security.js`)

- **SECURITY**: Security and rate limiting constants
  - `SECURITY.MAX_LOGIN_ATTEMPTS` - 5
  - `SECURITY.LOCKOUT_DURATION` - 1800000 (30 minutes in ms)
  - `SECURITY.RATE_LIMIT_WINDOW` - 900000 (15 minutes in ms)
  - `SECURITY.MAX_REQUESTS_PER_WINDOW` - 10

```javascript
const { SECURITY } = require('@ibetoni/constants');
if (attempts >= SECURITY.MAX_LOGIN_ATTEMPTS) {
  lockAccount(SECURITY.LOCKOUT_DURATION);
}
```

**Legacy exports (deprecated)**: `MAX_LOGIN_ATTEMPTS`, `LOCKOUT_DURATION`, `RATE_LIMIT_WINDOW`, `MAX_REQUESTS_PER_WINDOW`

## Maintenance

### Adding New Domains

1. Edit `src/domains.js`
2. Add domain to appropriate section (production, staging, etc.)
3. Include both `.betoni.online` and `.ibetoni.fi` variants
4. Update this README if adding new categories
5. Test CORS behavior in affected apps

### Documentation

See `puminet5api/docs/tech/DOMAIN_WHITELIST_CHECKLIST.md` for comprehensive domain management procedures.

## Migration Guide

### From puminet5api

**Before:**
```javascript
// Local allowedOrigins array (44+ lines)
const allowedOrigins = [
  "https://stable.ibetoni.fi",
  "https://stable.betoni.online",
  // ... 42 more domains
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true
}));
```

**After:**
```javascript
const { allowedOrigins } = require('@ibetoni/constants');

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true
}));
```

**Result:** Eliminates 44 lines of duplicate domain definitions.

### From puminet7-functions-app

**Before:**
```javascript
// Local allowedOrigins array (44+ lines)
const allowedOrigins = [
  "https://stable.ibetoni.fi",
  // ... many more
];

app.use(cors({ origin: allowedOrigins }));
```

**After:**
```javascript
const { allowedOrigins } = require('@ibetoni/constants');

app.use(cors({ origin: allowedOrigins }));
```

**Result:** Single source of truth for CORS configuration across all applications.

### Migrating HTTP Status Codes & Error Codes

**Backend (`standardizedErrorHandling.js`):**

**Before:**
```javascript
const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  // ... 40+ more error codes
};

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  // ... 9 more status codes
};
```

**After:**
```javascript
const { ERROR_CODES, HTTP_STATUS } = require("@ibetoni/constants");
```

**Frontend (`errorResponse.js`):**

**Before:**
```javascript
export const ERROR_CODES = {
  INVALID_COORDINATES: "INVALID_COORDINATES",
  // ... 20+ error codes
};
```

**After:**
```javascript
import { ERROR_CODES } from "@ibetoni/constants";
export { ERROR_CODES }; // Re-export for backward compatibility
```

**Result:** Eliminates ~120 lines of duplicate error code definitions across 3 files.

### Migrating Cache TTL Constants

**Before (each queryRunner file):**
```javascript
const DEFAULT_KEIKKA_TTL = 600; // 10 minutes
// Duplicated in 5 separate files
```

**After:**
```javascript
const { DEFAULT_KEIKKA_TTL } = require("@ibetoni/constants");
// Or use the new CACHE_TTL object
const { CACHE_TTL } = require("@ibetoni/constants");
await setCachedData('keikka', customerId, data, CACHE_TTL.KEIKKA);
```

**Files Updated:**
- `modules/keikka/keikkaQueryRunner.js`
- `modules/tyomaa/tyomaaQueryRunner.js`
- `modules/person/personQueryRunner.js`
- `modules/vehicle/vehicleQueryRunner.js`
- `modules/weather/weatherQueryRunner.js`

**Result:** Eliminates ~10 lines, ensures consistent TTL values across all entities.

### Migrating Security Constants

**Before (`modules/auth/loginRateLimiter.js`):**
```javascript
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 10;
```

**After:**
```javascript
const {
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION,
  RATE_LIMIT_WINDOW,
  MAX_REQUESTS_PER_WINDOW
} = require("@ibetoni/constants");
// Or use the SECURITY object
const { SECURITY } = require("@ibetoni/constants");
if (attempts >= SECURITY.MAX_LOGIN_ATTEMPTS) {
  lockAccount(SECURITY.LOCKOUT_DURATION);
}
```

**Files Updated:**
- `modules/auth/loginRateLimiter.js`

**Result:** Eliminates ~4 lines, centralizes security-critical constants.

## Impact Summary

**Total Lines Eliminated:** ~180 lines (100% complete)
- CORS Origins: ~90 lines (3 files)
- HTTP Status Codes: ~25 lines (2+ files)
- Error Codes: ~120 lines (3 files)
- Cache TTL: ~10 lines (5 files)
- Security: ~4 lines (1 file - ✅ MIGRATED)

**Benefits:**
- Single source of truth for critical business rules
- Consistent error handling across all applications
- Easier maintenance - change once, apply everywhere
- Reduced risk of inconsistent constant values
- Better code organization and discoverability

## Used By

- `puminet5api` - Main backend API
- `puminet7-functions-app` - Container app for cron jobs
- `puminet4` - Frontend React PWA

## Future Additions

This package can be extended with other shared constants:

- User roles and permissions
- HTTP status codes
- Error codes
- Business rule constants
- Shared enums

## Notes

- All domains must use HTTPS in production
- Localhost entries (HTTP) are for development only
- Keep domains organized by environment for maintainability
