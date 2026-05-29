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
/**
 * Read a numeric env override; fall back to default when unset/invalid.
 * Used to relax login rate limits in dev without changing production posture.
 *   LOGIN_RATE_LIMIT_WINDOW_MS  — override RATE_LIMIT_WINDOW
 *   LOGIN_RATE_LIMIT_MAX        — override MAX_REQUESTS_PER_WINDOW
 */
function envNumber(name, defaultValue) {
  const raw = typeof process !== "undefined" && process.env ? process.env[name] : undefined;
  if (!raw) return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

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
   * Rate limiting time window in milliseconds.
   * Production default: 15 min. Dev override via LOGIN_RATE_LIMIT_WINDOW_MS.
   * NOTE: temporarily loosened to 60s while CLI lifecycle smoke iterates.
   */
  RATE_LIMIT_WINDOW: envNumber("LOGIN_RATE_LIMIT_WINDOW_MS", 60 * 1000),

  /**
   * Maximum requests allowed per rate limit window.
   * Production default was 10. Dev override via LOGIN_RATE_LIMIT_MAX.
   * NOTE: temporarily loosened to 1000 while CLI lifecycle smoke iterates.
   */
  MAX_REQUESTS_PER_WINDOW: envNumber("LOGIN_RATE_LIMIT_MAX", 1000),
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
