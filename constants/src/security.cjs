/**
 * Security Constants
 *
 * Login/lockout security constants shared across all applications.
 * Login rate-limit knobs (window + max requests) live in
 * puminet5api/modules/auth/loginRateLimiter.js, the only consumer —
 * they were removed from here after the exported defaults drifted from
 * the documented production values while nothing imported them.
 *
 * @module @ibetoni/constants/security
 */

/** Maximum failed login attempts before account lockout */
const MAX_LOGIN_ATTEMPTS = 5;

/** Account lockout duration in milliseconds (30 minutes) */
const LOCKOUT_DURATION = 30 * 60 * 1000;

module.exports = { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION };
