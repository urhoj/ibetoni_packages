# @ibetoni/auth

Shared authentication utilities for betoni.online platform

## Purpose

Centralized authentication logic used across multiple services, eliminating duplication and ensuring consistent security practices.

## Installation

```bash
# In package.json
"@ibetoni/auth": "file:../ibetoni_packages/auth"
```

## Features

- **JWT Token Management**: Create, verify, and refresh JWT tokens
- **Google OAuth**: Verify Google ID tokens
- **Microsoft Azure AD OAuth**: Secure Microsoft ID token verification with comprehensive security validations
- **Password Hashing**: bcrypt password utilities
- **Flexible Configuration**: Supports both sync (process.env) and async (Key Vault) config
- **Optional Logging**: Works with any logger or console
- **Security Audit Logging**: Comprehensive logging for authentication events

## Usage

### JWT Verification Middleware

```javascript
const { createVerifyTokenMiddleware } = require('@ibetoni/auth');

// Simple usage (uses process.env.JWT_KEY)
const verifyToken = createVerifyTokenMiddleware();
app.use('/api/protected', verifyToken, (req, res) => {
  // req.user contains decoded token data
  res.json({ user: req.user });
});

// With async Key Vault retrieval
const verifyToken = createVerifyTokenMiddleware({
  getEnvVar: environmentHelper.getEnvVar
});
```

### Creating JWT Tokens

```javascript
const { createToken } = require('@ibetoni/auth');

// createToken emits v2 short shape when JWT_SHORT_KEYS=true env var is set,
// otherwise emits v1 legacy shape. Both are accepted by verify middleware.
// Note: companyRoles is NOT stored in JWT - derived on frontend from asiakasesWithTypes
const token = await createToken('user@example.com', 123, {
  ownerAsiakasId: 456,
  tenantAsiakasId: 456,
  globalRoles: { isSystemAdmin: false, isDeveloper: false, /* ... */ },
  asiakasesWithTypes: [
    { asiakasId: 456, roles: ["asiakasAdmin", "keikkaHandler"] },
    { asiakasId: 789, roles: ["pumppari"] }
  ]
});

// With async Key Vault retrieval
const token = await createToken('user@example.com', 123, additionalClaims, {
  getEnvVar: environmentHelper.getEnvVar
});
```

### Payload Codec (Frontend / FE consumers)

The codec is exposed as a sub-export for use in frontend code and any context where only payload manipulation is needed (no signing/verifying):

```javascript
// @ibetoni/auth/codec — lightweight, no crypto dependencies at import time
import { expandPayload, isShortShape } from '@ibetoni/auth/codec';

// Decode an arbitrary JWT payload (does not verify signature)
const raw = JSON.parse(atob(token.split('.')[1]));
const payload = expandPayload(raw, { onUnknownRole: 'skip' }); // FE: forgiving
// payload.personId, payload.ownerAsiakasId, payload.asiakasesWithTypes etc. — always expanded shape

// Backend usage (fail-closed — throws on unknown typeId):
const payload = expandPayload(raw); // default onUnknownRole: 'throw'
```

The codec exports: `compressPayload`, `expandPayload`, `isShortShape`, `PAYLOAD_VERSION`, `GLOBAL_ROLE_FLAGS`, `COMPANY_FLAGS`.

Role integer ↔ name mapping source of truth is `@ibetoni/constants` (`ROLE_NAME_BY_TYPEID`, `ROLE_TYPEID_BY_NAME`).

### Google OAuth Verification

```javascript
const { createGoogleAuth } = require('@ibetoni/auth');

// Create instance
const googleAuth = createGoogleAuth({
  logger: logger.categories.AUTH,
  getEnvVar: environmentHelper.getEnvVar // optional, for Key Vault
});

// Verify Google ID token from frontend
try {
  const payload = await googleAuth.verifyGoogleToken(googleIdToken);
  console.log('User email:', payload.email);
  console.log('User name:', payload.name);
  console.log('Profile picture:', payload.picture);
} catch (error) {
  console.error('Google auth failed:', error);
}
```

### Microsoft OAuth Verification

```javascript
const { createMicrosoftAuth } = require('@ibetoni/auth');

// Create instance with logger and Key Vault integration
const microsoftAuth = createMicrosoftAuth({
  logger: logger.categories.AUTH,
  getEnvVar: environmentHelper.getEnvVar // for MICROSOFT_CLIENT_ID from Key Vault
});

// Verify Microsoft ID token from frontend (MSAL.js)
try {
  const payload = await microsoftAuth.verifyIdToken(microsoftIdToken);

  // Extract user information
  const user = microsoftAuth.extractUser(payload);
  console.log('User email:', user.email);
  console.log('User name:', user.name);
  console.log('Microsoft ID:', user.microsoftId);

  // Security claims
  console.log('Tenant ID:', payload.tid);
  console.log('Issuer:', payload.iss);
  console.log('Has MFA:', payload.amr?.includes('mfa'));
  console.log('Nonce:', payload.nonce);
} catch (error) {
  console.error('Microsoft auth failed:', error.message);
  // Error scenarios:
  // - Invalid signature
  // - Expired token
  // - Unauthorized issuer
  // - Token too old (>1 hour)
}
```

### Password Utilities

```javascript
const { hashPassword, comparePassword } = require('@ibetoni/auth');

// Hash a password
const hashed = hashPassword('mySecurePassword123');

// Compare password with hash (real async bcrypt.compare — always await)
const isValid = await comparePassword('mySecurePassword123', hashed);
```

### Token Refresh

```javascript
const { refreshToken, isTokenExpiringSoon } = require('@ibetoni/auth');

// Check if token is expiring soon
const status = await isTokenExpiringSoon(currentToken, {
  hoursBeforeExpiry: 24 // default
});

if (status.isExpiringSoon) {
  // Issue new token with same claims
  const newToken = await refreshToken(currentToken, {
    logger: logger.categories.AUTH,
    getEnvVar: environmentHelper.getEnvVar
  });
}
```

## API Reference

### JWT Functions

**`createVerifyTokenMiddleware(options)`**
- Creates Express middleware to verify JWT tokens
- Options:
  - `getEnvVar`: Optional async function for env var retrieval
- Returns: Express middleware function

**`createToken(email, personId, additionalClaims, options)`**
- Creates a JWT token
- Parameters:
  - `email`: User email address
  - `personId`: Database person ID
  - `additionalClaims`: Object with extra claims (roles, etc.)
  - `options`: Configuration object
- Returns: Promise<string> JWT token

**`getTokenData(token, options)`**
- Decodes and verifies a JWT token
- Returns: Promise<object> Decoded token payload

**`hashPassword(password)`**
- Hashes a password using bcrypt
- Returns: string Hashed password

**`comparePassword(password, hashedPassword)`**
- Compares password with its hash
- Returns: Promise<boolean> True if match

**`isTokenExpiringSoon(token, options)`**
- Checks if token is close to expiration
- Options:
  - `hoursBeforeExpiry`: Hours threshold (default: 24)
  - `getEnvVar`: Optional async function
- Returns: Promise<{isExpiringSoon, expiresAt, hoursUntilExpiry}>

**`refreshToken(token, options)`**
- Issues new token with same claims but fresh expiration
- Returns: Promise<string> New JWT token

### Google OAuth

**`createGoogleAuth(options)`**
- Creates GoogleAuth instance
- Options:
  - `logger`: Optional logger instance
  - `getEnvVar`: Optional async function
- Returns: GoogleAuth instance

**`googleAuth.verifyGoogleToken(token)`**
- Verifies Google ID token
- Returns: Promise<object> Google payload with user info

### Microsoft OAuth (Azure AD)

**`createMicrosoftAuth(options)`**
- Creates MicrosoftAuth instance with comprehensive security validations
- Options:
  - `logger`: Optional logger instance for security audit logs
  - `getEnvVar`: Optional async function for Key Vault integration
- Returns: MicrosoftAuth instance

**`microsoftAuth.verifyIdToken(token)`**
- Verifies Microsoft ID token with security checks:
  - RSA256 signature validation using Microsoft's public keys (JWKS)
  - Issuer validation (Azure AD multi-tenant pattern)
  - Audience validation (matches MICROSOFT_CLIENT_ID)
  - Token expiration with 60-second clock skew tolerance
  - Maximum token age validation (1 hour)
  - Nonce validation (warns if missing)
  - Tenant ID logging for audit trail
- Returns: Promise<object> Microsoft token payload with user info and security claims
- Throws: Error if token invalid, expired, or from unauthorized issuer

**`microsoftAuth.extractUser(payload)`**
- Extracts standardized user object from Microsoft token payload
- Parameters:
  - `payload`: Decoded Microsoft ID token
- Returns: Object with microsoftId, email, name, firstName, lastName

## Configuration

### Environment Variables Required

- `JWT_KEY`: Secret key for signing JWT tokens
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `MICROSOFT_CLIENT_ID`: Microsoft Azure AD application (client) ID

### Sync vs Async Configuration

**Sync (process.env):**
```javascript
// Just use the functions, they'll read from process.env
const token = await createToken(email, personId);
```

**Async (Azure Key Vault):**
```javascript
// Provide getEnvVar function
const token = await createToken(email, personId, additionalClaims, {
  getEnvVar: environmentHelper.getEnvVar
});
```

## Security Notes

- JWT tokens expire after 7 days by default
- Temporary tokens (for special use cases) expire after 3 minutes
- Passwords are hashed with bcrypt (10 rounds); `comparePassword` uses real async `bcrypt.compare`
- `jwt.verify` pins the algorithm allowlist to `["HS256"]` — algorithm confusion attacks are blocked
- All token verification requires valid `personId` or `email` claims
- Google OAuth tokens are verified against configured `GOOGLE_CLIENT_ID`
- **Microsoft OAuth Security** (Updated 2026-01-29):
  - ID tokens verified using Microsoft's public keys (JWKS) with RS256 algorithm
  - Multi-tenant issuer validation: `https://login.microsoftonline.com/{tenant-guid}/v2.0`
  - Clock skew tolerance: 60 seconds
  - Maximum token age: 1 hour
  - Nonce validation for replay attack prevention
  - MFA (Multi-Factor Authentication) claim support via `amr` array
  - Comprehensive security audit logging (tenant ID, issuer, email)
  - JWKS key caching: 24 hours (max 5 keys)

## Used By

- `puminet5api` - Main backend API
- `puminet7-functions-app` - Container app for cron jobs

## Migration Guide

### From puminet5api

**Before:**
```javascript
const { verifyToken, getToken } = require('./authz/verifyToken');
const google = require('./modules/person/google');

app.use('/api', verifyToken, routes);
const token = await getToken(email, personId, additionalClaims);
const payload = await google.verifyGoogleToken(googleToken);
```

**After:**
```javascript
const { createVerifyTokenMiddleware, createToken, createGoogleAuth } = require('@ibetoni/auth');

const verifyToken = createVerifyTokenMiddleware({
  getEnvVar: environmentHelper.getEnvVar
});
const googleAuth = createGoogleAuth({
  getEnvVar: environmentHelper.getEnvVar
});

app.use('/api', verifyToken, routes);
const token = await createToken(email, personId, additionalClaims, {
  getEnvVar: environmentHelper.getEnvVar
});
const payload = await googleAuth.verifyGoogleToken(googleToken);
```

### From puminet7-functions-app

**Before:**
```javascript
const { verifyToken, createToken } = require('./auth/jwtMiddleware');
const googleAuth = require('./auth/googleAuth');

app.use('/admin', verifyToken, routes);
const token = createToken(email, personId, additionalClaims);
const payload = await googleAuth.verifyGoogleToken(googleToken);
```

**After:**
```javascript
const { createVerifyTokenMiddleware, createToken, createGoogleAuth } = require('@ibetoni/auth');

const verifyToken = createVerifyTokenMiddleware({
  logger: logger.categories.AUTH
});
const googleAuth = createGoogleAuth({
  logger: logger.categories.AUTH
});

app.use('/admin', verifyToken, routes);
const token = await createToken(email, personId, additionalClaims, {
  logger: logger.categories.AUTH
});
const payload = await googleAuth.verifyGoogleToken(googleToken);
```

## Testing

```javascript
// Test token creation and verification
const token = await createToken('test@example.com', 1);
const decoded = await getTokenData(token);
console.assert(decoded.email === 'test@example.com');
console.assert(decoded.personId === 1);
```
