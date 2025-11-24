/**
 * Security Constants
 *
 * Security-related constants for authentication, rate limiting, and access control
 * across all applications.
 *
 * @module @ibetoni/constants/security
 */

/**
 * Login and authentication security constants
 *
 * Usage:
 * ```javascript
 * const { SECURITY } = require('@ibetoni/constants');
 *
 * if (attempts >= SECURITY.MAX_LOGIN_ATTEMPTS) {
 *   lockAccount(SECURITY.LOCKOUT_DURATION);
 * }
 * ```
 *
 * @constant {Object} SECURITY
 */
const SECURITY = {
  /**
   * Maximum failed login attempts before account lockout
   */
  MAX_LOGIN_ATTEMPTS: 5,

  /**
   * Account lockout duration in milliseconds (30 minutes)
   */
  LOCKOUT_DURATION: 30 * 60 * 1000,

  /**
   * Rate limiting time window in milliseconds (15 minutes)
   */
  RATE_LIMIT_WINDOW: 15 * 60 * 1000,

  /**
   * Maximum requests allowed per rate limit window
   */
  MAX_REQUESTS_PER_WINDOW: 10,
};

/**
 * Legacy constant names for backward compatibility
 * @deprecated Use SECURITY object instead
 */
const MAX_LOGIN_ATTEMPTS = SECURITY.MAX_LOGIN_ATTEMPTS;
const LOCKOUT_DURATION = SECURITY.LOCKOUT_DURATION;
const RATE_LIMIT_WINDOW = SECURITY.RATE_LIMIT_WINDOW;
const MAX_REQUESTS_PER_WINDOW = SECURITY.MAX_REQUESTS_PER_WINDOW;

module.exports = {
  SECURITY,
  // Legacy exports for backward compatibility
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION,
  RATE_LIMIT_WINDOW,
  MAX_REQUESTS_PER_WINDOW,
};
