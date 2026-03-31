# iBetoni Shared Packages

Shared business logic packages for the betoni.online concrete delivery management platform. These packages provide reusable functionality across all applications (frontend, backend, and Azure Functions).

## 📦 Available Packages

| Package | Version | Description | Documentation |
|---------|---------|-------------|---------------|
| [@ibetoni/auth](./auth/) | 1.0.0 | JWT tokens and Google OAuth authentication | [README](./auth/README.md) |
| [@ibetoni/cache](./cache/) | 1.0.0 | Redis cache with invalidation patterns | [README](./cache/README.md) |
| [@ibetoni/constants](./constants/) | 1.0.0 | Shared CORS origins and domain constants | [README](./constants/README.md) |
| [@ibetoni/permissions](./permissions/) | 1.0.0 | Role-based permission validation | [README](./permissions/README.md) |
| [@ibetoni/betoni-utils](./betoni-utils/) | 1.0.0 | Betoni string formatting and validation | [README](./betoni-utils/README.md) |
| [@ibetoni/fennoa-utils](./fennoa-utils/) | 1.0.0 | Fennoa invoice response parsing and payment status computation | [README](./fennoa-utils/README.md) |

## 🎯 Purpose

These packages encapsulate core business logic that needs to be shared across multiple applications:

- **`@ibetoni/auth`** - JWT token creation/verification and Google OAuth authentication (eliminates 270 lines of duplicate code)
- **`@ibetoni/cache`** - Provides unified Redis caching with automatic invalidation patterns for data consistency
- **`@ibetoni/constants`** - Centralized CORS allowed origins and domain constants (eliminates 90 lines of duplicate code)
- **`@ibetoni/permissions`** - Centralizes role-based access control logic used by both frontend and backend
- **`@ibetoni/betoni-utils`** - Common utilities for concrete specification formatting, validation, and string building
- **`@ibetoni/fennoa-utils`** - Fennoa API response parsing (`parseFennoaInvoiceResponse`) and payment status computation (`computePaymentStatus`)

## 🚀 Usage

### In Workspace (Local Development)

When developing in the complete workspace, packages are automatically available:

```bash
# From workspace root
npm install  # Automatically links all packages via npm workspaces
```

Packages are symlinked in `node_modules/@ibetoni/`:
```
node_modules/
├── @ibetoni/auth → ../../ibetoni_packages/auth
├── @ibetoni/cache → ../../ibetoni_packages/cache
├── @ibetoni/constants → ../../ibetoni_packages/constants
├── @ibetoni/permissions → ../../ibetoni_packages/permissions
├── @ibetoni/betoni-utils → ../../ibetoni_packages/betoni-utils
└── @ibetoni/fennoa-utils → ../../ibetoni_packages/fennoa-utils
```

### In Individual Projects

Projects reference packages using `file:` protocol in `package.json`:

```json
{
  "dependencies": {
    "@ibetoni/auth": "file:../ibetoni_packages/auth",
    "@ibetoni/cache": "file:../ibetoni_packages/cache",
    "@ibetoni/constants": "file:../ibetoni_packages/constants",
    "@ibetoni/permissions": "file:../ibetoni_packages/permissions",
    "@ibetoni/betoni-utils": "file:../ibetoni_packages/betoni-utils",
    "@ibetoni/fennoa-utils": "file:../ibetoni_packages/fennoa-utils"
  }
}
```

### In CI/CD

All three application repositories (puminet4, puminet5api, puminet7-functions-app) include `ibetoni_packages` as a **git submodule** pointing to `urhoj/ibetoni_packages` (branch: `master`). GitHub Actions workflows check out the submodule automatically:

```yaml
- name: Checkout repository
  uses: actions/checkout@v4
  with:
    submodules: true
```

No `GH_PAT` secret is required. The submodule is checked out at the pinned commit pointer stored in each project repo.

## 📖 Package Documentation

### @ibetoni/auth

JWT token creation/verification and Google OAuth authentication.

```javascript
// JWT Token Creation
const { createToken } = require('@ibetoni/auth');

const token = await createToken(email, personId, {
  ownerAsiakasId: customerId,
  roleId: roleId
}, {
  getEnvVar: (varName) => process.env[varName] // or Key Vault
});

// JWT Token Verification (Middleware)
const { createVerifyTokenMiddleware } = require('@ibetoni/auth');

const verifyToken = createVerifyTokenMiddleware({
  getEnvVar: (varName) => process.env[varName]
});

app.use('/api/protected', verifyToken, protectedRoutes);

// Google OAuth Verification
const { createGoogleAuth } = require('@ibetoni/auth');

const googleAuth = createGoogleAuth({
  getEnvVar: (varName) => process.env[varName]
});

const payload = await googleAuth.verifyGoogleToken(idToken);
console.log(payload.email, payload.name);
```

**Key Features:**
- JWT token generation with 7-day expiration
- JWT verification middleware for Express
- Google OAuth ID token verification
- Token refresh logic (`isTokenExpiringSoon`, `refreshToken`)
- Password hashing utilities (`hashPassword`, `comparePassword`)
- Supports both sync (process.env) and async (Key Vault) configuration
- Backward compatible wrappers in existing apps

[Full Documentation →](./auth/README.md)

### @ibetoni/cache

Redis cache and invalidation management.

```typescript
import {
  getCachedData,
  setCachedData,
  invalidateCacheForCustomer
} from '@ibetoni/cache';

// Get cached data
const orders = await getCachedData('orders', customerId);

// Set cache with auto-expiration
await setCachedData('orders', customerId, orders, 3600);

// Invalidate cache patterns
await invalidateCacheForCustomer(customerId, ['orders', 'invoices']);
```

[Full Documentation →](./cache/README.md)

### @ibetoni/constants

Shared CORS allowed origins and domain constants.

```javascript
const { allowedOrigins } = require('@ibetoni/constants');

// Use in Express CORS middleware
const cors = require('cors');

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
```

**Included Origins:**
- Production domains: `betoni.online`, `ibetoni.fi`, `pumppukone.fi`
- Staging domains: `latest`, `stable`, `staging` slots
- Development: `localhost:5173`, `localhost:3000`, `127.0.0.1:*`
- Azure environments: `*.azurewebsites.net`, `*.azurestaticapps.net`

**Benefits:**
- Single source of truth for CORS configuration (44+ domains)
- Eliminates 90 lines of duplicate code
- Automatic updates across all applications
- Consistent security policy

[Full Documentation →](./constants/README.md)

### @ibetoni/permissions

Permission validation and role checking.

```typescript
import { hasPermission, PERMISSIONS } from '@ibetoni/permissions';

// Check single permission
if (hasPermission(user, PERMISSIONS.KEIKKA_CREATE)) {
  // Allow order creation
}

// Frontend usage
import { usePermissions } from '@ibetoni/permissions/hooks';

function OrderButton() {
  const { can } = usePermissions();

  if (!can(PERMISSIONS.KEIKKA_CREATE)) return null;
  return <button>Create Order</button>;
}
```

[Full Documentation →](./permissions/README.md)

### @ibetoni/betoni-utils

Concrete specification utilities.

```typescript
import {
  buildBetonName,
  validateBetonSpec,
  formatLujuusLuokka
} from '@ibetoni/betoni-utils';

// Build display name
const name = buildBetonName({
  lujuusLuokka: 'C30/37',
  runkoaine: 16,
  rasitusluokka: 'XC3'
});
// Result: "C30/37 16mm XC3"

// Validate specifications
const { isValid, errors } = validateBetonSpec(betonData);

// Format strength class
const formatted = formatLujuusLuokka('C30/37'); // "C30/37"
```

[Full Documentation →](./betoni-utils/README.md)

## 🛠️ Development

### Adding a New Package

1. Create package directory:
   ```bash
   mkdir ibetoni_packages/my-package
   cd ibetoni_packages/my-package
   ```

2. Initialize package:
   ```json
   {
     "name": "@ibetoni/my-package",
     "version": "1.0.0",
     "main": "src/index.js",
     "peerDependencies": {
       "react": "^19.0.0"  // If needed
     }
   }
   ```

3. Create source files:
   ```bash
   mkdir src
   touch src/index.js
   touch README.md
   ```

4. Register in workspace:
   ```bash
   # Edit root package.json
   {
     "workspaces": [
       "puminet4",
       "puminet5api",
       "puminet7-functions-app",
       "ibetoni_packages/auth",
       "ibetoni_packages/cache",
       "ibetoni_packages/constants",
       "ibetoni_packages/permissions",
       "ibetoni_packages/betoni-utils",
       "ibetoni_packages/my-package"  // Add here
     ]
   }
   ```

5. Install and test:
   ```bash
   cd ../..  # Back to workspace root
   npm install
   ```

### Making Changes to Packages

Changes to shared packages are immediately reflected in all consuming applications via symlinks. After editing, commit and push to this repo, then sync all project submodule pointers from the workspace root:

```bash
# 1. Edit package source (changes immediately available in dev via symlinks)
vim ibetoni_packages/cache/src/index.js

# 2. Commit and push to ibetoni_packages repo
git -C /c/Users/juhau/code/ibetoni_packages add .
git -C /c/Users/juhau/code/ibetoni_packages commit -m "feat: your change"
git -C /c/Users/juhau/code/ibetoni_packages push origin master

# 3. Update submodule pointers in all 3 project repos (from workspace root)
npm run sync
```

No rebuild or republish needed during development!

### Package Guidelines

- **Keep packages focused** - Each package should have a single, clear purpose
- **Document thoroughly** - Each package must have comprehensive README
- **Consider peer dependencies** - Don't bundle React, etc. Use peer dependencies
- **Export ES modules** - Use modern ES module syntax
- **TypeScript types** - Provide TypeScript definitions when possible
- **Test comprehensively** - Include usage examples and edge cases

## 📋 Planned Packages

See [TODO.md](./TODO.md) for upcoming packages and improvements.

Planned additions include:
- `@ibetoni/pricing` - Invoice calculations (CRITICAL)
- `@ibetoni/email-utils` - Email parsing and validation
- `@ibetoni/validators` - Email, password, coordinate validation
- `@ibetoni/formatters` - String/number formatting
- `@ibetoni/date-utils` - Date business logic
- `@ibetoni/strings` - Shared string constants
- `@ibetoni/validation` - Shared validation logic

## 🔒 Security

These packages may contain business logic that should not be exposed publicly:

- ✅ Packages are in **private** `urhoj/ibetoni_packages` repository
- ✅ CI/CD uses git submodules — no `GH_PAT` required
- ✅ No packages published to npm registry
- ✅ All dependencies stay within organization

## 🐛 Troubleshooting

### Package not found in node_modules

```bash
# Re-install workspace
cd /path/to/workspace-root
npm install
```

### Changes not reflected in app

Symlinks may be broken. Rebuild workspace:
```bash
rm -rf node_modules
npm install
```

### CI/CD build fails with "Cannot resolve @ibetoni/..."

Ensure the project's `.gitmodules` file correctly references `urhoj/ibetoni_packages` and that the workflow uses `submodules: true` in its checkout step. See [Root README](../README.md#ci-cd-configuration).

## 📚 More Information

- **Workspace Setup:** [Root README](../README.md)
- **CI/CD Configuration:** [CLAUDE.md](../CLAUDE.md#ci-cd-configuration)
- **Development Guidelines:** [CLAUDE.md](../CLAUDE.md)
- **Individual Package Docs:** See README.md in each package directory

## 📄 License

UNLICENSED - Proprietary software for betoni.online
