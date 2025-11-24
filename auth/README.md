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
- **Password Hashing**: bcrypt password utilities
- **Flexible Configuration**: Supports both sync (process.env) and async (Key Vault) config
- **Optional Logging**: Works with any logger or console

## Usage

### JWT Verification Middleware

```javascript
const { createVerifyTokenMiddleware } = require('@ibetoni/auth');
const logger = require('./logger');

// Simple usage (uses process.env.JWT_KEY)
const verifyToken = createVerifyTokenMiddleware();
app.use('/api/protected', verifyToken, (req, res) => {
  // req.user contains decoded token data
  res.json({ user: req.user });
});

// With logger
const verifyToken = createVerifyTokenMiddleware({ logger: logger.categories.AUTH });

// With async Key Vault retrieval
const verifyToken = createVerifyTokenMiddleware({
  logger: logger.categories.AUTH,
  getEnvVar: environmentHelper.getEnvVar
});
```

### Creating JWT Tokens

```javascript
const { createToken } = require('@ibetoni/auth');

// Simple usage
const token = await createToken('user@example.com', 123, {
  globalRoles: { isSystemAdmin: true },
  companyRoles: { /* ... */ }
});

// With logger and async config
const token = await createToken('user@example.com', 123, additionalClaims, {
  logger: logger.categories.AUTH,
  getEnvVar: environmentHelper.getEnvVar
});
```

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

### Password Utilities

```javascript
const { hashPassword, comparePassword } = require('@ibetoni/auth');

// Hash a password
const hashed = hashPassword('mySecurePassword123');

// Compare password with hash
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
  - `logger`: Optional logger instance
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

## Configuration

### Environment Variables Required

- `JWT_KEY`: Secret key for signing JWT tokens
- `GOOGLE_CLIENT_ID`: Google OAuth client ID

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
- Passwords are hashed with bcrypt (10 rounds)
- All token verification requires valid `personId` or `email` claims
- Google OAuth tokens are verified against configured `GOOGLE_CLIENT_ID`

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
