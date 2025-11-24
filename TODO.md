## Completed Packages

✅ **@ibetoni/auth** - JWT token management, Google OAuth, password hashing (2025-11-10)
✅ **@ibetoni/cache** - Redis cache invalidation patterns
✅ **@ibetoni/permissions** - Permission validation logic (CRITICAL)
✅ **@ibetoni/betoni-utils** - Betoni string formatting, validation, and constants (2025-11-03)
✅ **@ibetoni/constants** - Shared CORS origins, domain constants (2025-11-10)

## Planned Packages

1. @ibetoni/pricing - Invoice calculations (CRITICAL)
2. @ibetoni/email-utils - Email parsing and validation
3. @ibetoni/validators - Email, password, coordinate validation
4. @ibetoni/formatters - String/number formatting
5. @ibetoni/date-utils - Date business logic
6. @ibetoni/strings - Shared string constants
7. @ibetoni/validation - Shared validation logic

## Notes

- Consider renaming @ibetoni/validation vs @ibetoni/validators for clarity

### Recent Additions

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
