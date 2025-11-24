# @ibetoni/permissions

Shared permission validation system for betoni.online backend and frontend services.

## Overview

This package provides unified permission validation logic shared between:
- **puminet4** - Frontend (React PWA)
- **puminet5api** - Backend (Node.js/Express API)
- **puminet7-functions-app** - Functions/cron jobs server

## Features

- ✅ **Unified Business Logic** - Permission rules defined once, used everywhere
- ✅ **Adapter Pattern** - Environment-specific data retrieval (frontend/backend)
- ✅ **Type-Safe Permission Checking** - Keikka read/edit permissions
- ✅ **Role-Based Access Control** - Admin, Handler, Viewer, Pumppari roles
- ✅ **Contact Person Access** - Validates contact person relationships
- ✅ **Logger Injection** - Use your own logger implementation
- ✅ **Permission Caching** - 5-minute in-memory cache for performance

## Installation

### Prerequisites

This package requires **winston** for logging (peer dependency):

```bash
npm install winston
```

**Why is winston required?**
When using file-based npm dependencies (recommended for monorepo setup), the parent project must explicitly declare peer dependencies. This ensures consistent logging across services.

### Install the Package

Or use file reference in package.json (recommended):
```json
{
  "dependencies": {
    "@ibetoni/permissions": "file:../ibetoni_packages/permissions",
    "winston": "^3.18.3"
  }
}
```

**Important:** Always include `winston` alongside the permissions package when using file-based dependencies.

## Usage

### Frontend (puminet4)

```javascript
import { createFrontendValidator } from '@ibetoni/permissions/frontend';

// Create validator with frontend adapters
const permissionValidator = createFrontendValidator({
  logger: console // or your custom logger
});

// Check read permission
const canRead = await permissionValidator.canReadKeikka(user, keikka);

// Check edit permission
const canEdit = await permissionValidator.canEditKeikka(user, keikka);
```

### Backend (puminet5api)

```javascript
const { createBackendValidator } = require('@ibetoni/permissions/backend');
const logger = require('./modules/logging/logger');
const mssqlcon = require('./dbconnection');

// Create validator with backend adapters
const permissionValidator = createBackendValidator({
  logger: logger.categories.PERMISSIONS,
  dbConnection: mssqlcon
});

// Check permissions
const canRead = await permissionValidator.canReadKeikka(
  { personId, ownerAsiakasId },
  keikka
);

const canEdit = await permissionValidator.canEditKeikka(
  { personId, ownerAsiakasId },
  keikka
);
```

### Express Middleware (Backend)

```javascript
const { createKeikkaPermissionMiddleware } = require('@ibetoni/permissions/backend');

const { requireKeikkaRead, requireKeikkaEdit } = createKeikkaPermissionMiddleware({
  logger: myLogger,
  dbConnection: mssqlcon
});

// Use in routes
router.get('/keikka/:keikkaId', requireKeikkaRead, (req, res) => {
  // req.keikka is pre-loaded and validated
  // req.hasEditPermission is available
  res.json(req.keikka);
});

router.put('/keikka/:keikkaId', requireKeikkaEdit, (req, res) => {
  // User has edit permission
  // Update keikka...
});
```

## API Reference

### KeikkaPermissionValidator

Core validator class containing permission business logic.

#### Methods

##### `async canReadKeikka(user, keikka)`

Checks if user can read a keikka.

**Parameters:**
- `user` - User object (frontend: with companyRoles, backend: with personId/ownerAsiakasId)
- `keikka` - Keikka object to check access for

**Returns:** `Promise<boolean>`

**Permission Rules:**
1. **AsiakasAdmin**: Can read any keikka where tenant involved (source/owner/betoni/pumppu)
2. **Pumppari**: Can only read assigned keikkas
3. **KeikkaHandler/Viewer**: Can read all tenant keikkas
4. **BetoniHandler/Viewer**: Can read keikkas with betoni relationship
5. **PumppuHandler/Viewer**: Can read keikkas with pumppu relationship
6. **Contact Person**: Can read keikkas where they are contact person

##### `async canEditKeikka(user, keikka)`

Checks if user can edit a keikka.

**Parameters:**
- `user` - User object
- `keikka` - Keikka object to check access for

**Returns:** `Promise<boolean>`

**Permission Rules:**
1. **AsiakasAdmin**: Can edit until tilaId < 7 (before laskutettu)
2. **LaskuAdmin**: Can edit when tilaId === 7 (laskutettu status only)
3. **Pumppari**: No edit permissions (returns false)
4. **KeikkaHandler**: Can edit until tilaId < 7 for tenant keikkas
5. **BetoniHandler**: Can edit until tilaId < 7 for betoni keikkas
6. **PumppuHandler**: Can edit until tilaId < 7 for pumppu keikkas
7. **Contact Person**: Can edit only when tilaId === 1 (luonnos/draft)

##### `getUserPermissions(user)`

Extracts permission flags from user object.

**Returns:** `Promise<PermissionFlags>`

**Permission Flags:**
```javascript
{
  isAsiakasAdmin: boolean,
  isLaskuAdmin: boolean,
  isPumppari: boolean,
  isAttachmentHandler: boolean,
  isKeikkaHandler: boolean,
  isSijaintiHandler: boolean,
  isVehicleHandler: boolean,
  isTuoteHandler: boolean,
  isKeikkaViewer: boolean,
  isBetoniHandler: boolean,
  isBetoniViewer: boolean,
  isPumppuHandler: boolean,
  isPumppuViewer: boolean
}
```

##### `clearPermissionCache()`

Clears the permission cache. Call this when permissions change (e.g., after role updates).

**Returns:** `void`

### Adapters

Adapters handle environment-specific data retrieval.

#### PermissionDataAdapter

Interface for retrieving user permissions.

**Methods:**
- `async getUserPermissions(user)` - Returns permission flags object

#### ContactPersonAdapter

Interface for checking contact person access.

**Methods:**
- `async hasContactPersonAccess(user, keikka, accessType)` - Returns boolean

#### AssignmentAdapter

Interface for checking pumppari assignments.

**Methods:**
- `async isPersonAssignedToKeikka(user, keikka)` - Returns boolean

## Permission Caching

The validator includes built-in permission caching with a 5-minute TTL:

- Cache is stored in memory (Map)
- Cache keys include personId and asiakasId
- Automatic expiration after 5 minutes
- Call `clearPermissionCache()` to manually clear

**Frontend Cache:**
- Caches user permission flags from companyRoles

**Backend Cache:**
- Caches user permission flags from database queries
- Reduces database load for frequent permission checks

## Environment Variables

No environment variables required. The package is pure business logic with injected dependencies.

## Troubleshooting

### Cannot find module 'winston'

**Error:** `Error: Cannot find module 'winston'`

**Cause:** The consuming project doesn't have `winston` installed as a direct dependency.

**Solution:**
1. Add winston to your project's package.json:
   ```json
   {
     "dependencies": {
       "winston": "^3.18.3"
     }
   }
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

See [Installation Prerequisites](#prerequisites) for more details.

### Permissions not updating after role changes

**Cause:** Permission cache hasn't expired yet (5-minute TTL).

**Solution:**
```javascript
permissionValidator.clearPermissionCache();
```

### Frontend permissions different from backend

**Cause:** User's companyRoles in JWT token may be stale.

**Solution:**
- Have user log out and log back in to refresh JWT
- Or implement token refresh on role changes

## Development

### Running Tests

```bash
npm test
```

(Note: Tests not yet implemented)

### Package Structure

```
@ibetoni/permissions/
├── package.json
├── README.md
└── src/
    ├── index.js                      # Main exports
    ├── KeikkaPermissionValidator.js  # Core validator
    ├── adapters/                     # Adapter interfaces
    │   ├── PermissionDataAdapter.js
    │   ├── ContactPersonAdapter.js
    │   └── AssignmentAdapter.js
    ├── frontend/                     # Frontend adapters
    │   ├── FrontendPermissionAdapter.js
    │   ├── FrontendContactPersonAdapter.js
    │   ├── FrontendAssignmentAdapter.js
    │   └── createFrontendValidator.js
    └── backend/                      # Backend adapters
        ├── BackendPermissionAdapter.js
        ├── BackendContactPersonAdapter.js
        ├── BackendAssignmentAdapter.js
        ├── createBackendValidator.js
        └── middleware.js
```

## Migration Guide

### From Old Validator (Frontend)

**Before:**
```javascript
import keikkaPermissionValidator from '../utils/keikkaPermissionValidator';

const canRead = keikkaPermissionValidator.canReadKeikka(user, keikka);
```

**After:**
```javascript
import { createFrontendValidator } from '@ibetoni/permissions/frontend';

const validator = createFrontendValidator({ logger: console });

// Note: Now async!
const canRead = await validator.canReadKeikka(user, keikka);
```

### From Old Validator (Backend)

**Before:**
```javascript
const permissionValidator = require('../utils/keikkaPermissionValidator');

const canRead = await permissionValidator.canReadKeikka(personId, ownerAsiakasId, keikka);
```

**After:**
```javascript
const { createBackendValidator } = require('@ibetoni/permissions/backend');

const validator = createBackendValidator({
  logger: myLogger,
  dbConnection: mssqlcon
});

// Unified parameter signature
const canRead = await validator.canReadKeikka(
  { personId, ownerAsiakasId },
  keikka
);
```

## License

UNLICENSED - Private package for betoni.online

## Support

For issues or questions, contact the betoni.online development team.
