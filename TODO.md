## Completed Packages

✅ **@ibetoni/auth** - JWT token management, Google OAuth, password hashing (2025-11-10)
✅ **@ibetoni/cache** - Redis cache invalidation patterns
✅ **@ibetoni/permissions** - Permission validation logic (CRITICAL)
✅ **@ibetoni/betoni-utils** - Betoni string formatting, validation, and constants (2025-11-03)
✅ **@ibetoni/constants** - Shared CORS origins, domain constants (2025-11-10)
✅ **@ibetoni/sentry** - Shared Sentry init, captureError/captureException, PII redaction
✅ **@ibetoni/health-monitor** - Deployment health checks and response-time monitoring
✅ **@ibetoni/ocr-utils** - OCR document classification, confidence scoring, status transitions
✅ **@ibetoni/fennoa-utils** - Fennoa invoice parsing and payment status computation
✅ **@ibetoni/utils** - General-purpose utilities (HTML escaping)
✅ **@ibetoni/api-utils** - Express response helpers + request validators (2026-04-28)

## Planned Packages

1. @ibetoni/pricing - Invoice calculations (CRITICAL)
2. @ibetoni/email-utils - Email parsing and validation (extends betoni-utils)
3. @ibetoni/validators - Domain validators (Finnish phone, postal codes, coordinates) — note: generic request validators already shipped in api-utils
4. @ibetoni/formatters - String/number formatting
5. @ibetoni/date-utils - Date business logic
6. @ibetoni/strings - Shared string constants

## Notes

- The previously-planned @ibetoni/validation was superseded by @ibetoni/api-utils (validateRequiredFields, validateId, validateIntegerFields, validateDateFormat, asyncHandler).

### Recent Additions

**@ibetoni/api-utils** (2026-04-28):
- Express response builders: `sendSuccess`, `sendError`, `sendValidationError`, `sendNotFound`, `sendUnauthorized`, `sendForbidden`
- Catch-block helper: `handleRouteError(res, err, operation, { _entity, ... })` reports to Sentry with user/asiakas tags + sends `{ success: false, message, error }` response
- Pure validators: `validateRequiredFields`, `validateId`, `validateIntegerFields`, `validateDateFormat`
- Async wrapper: `asyncHandler(fn)` for routes
- Promoted from `puminet5api/utils/{apiResponseHandler,validation}.js`; original files now thin shims that re-export from this package — 148 puminet5api callers untouched
- Used by: puminet5api (via shim), betonijerry-api (direct)

**@ibetoni/constants** (2025-11-10):
- Centralized CORS allowed origins (44+ domains)
- Eliminates 90 lines of duplicate code
- Used by: puminet5api, puminet7-functions-app
- Single source of truth for domain whitelist

**@ibetoni/auth** (2025-11-10):
- JWT token creation and verification (`createToken`, `verifyToken`)
- Google OAuth verification (`createGoogleAuth`, `verifyGoogleToken`)
- Password hashing utilities (`hashPassword`, `comparePassword`)
- Token refresh logic (`isTokenExpiringSoon`, `refreshToken`)
- Supports both sync (process.env) and async (Key Vault) configuration
- Eliminates 270 lines of duplicate authentication code
- Used by: puminet5api, puminet7-functions-app
- Backward compatible with existing code (wrapper modules preserve old API)

**@ibetoni/betoni-utils** (2025-11-03):
- betoniStringBuilder.js - Multiple string formats (standard, comprehensive, with/without attributes)
- betoniValidator.js - betoni_isComplete() validation
- constants.js - RasitusLuokatArr, WEATHER_RESISTANT_CLASSES
- Used in: keikkaBetoniSql.js, pdfUtils.js, and available for frontend migration
