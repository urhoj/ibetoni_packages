/**
 * HTTP Status Codes
 *
 * Standard HTTP status code constants used across all applications
 * for consistent API response handling.
 *
 * @module @ibetoni/constants/http
 */

/**
 * HTTP status codes mapping
 *
 * Usage:
 * ```javascript
 * const { HTTP_STATUS } = require('@ibetoni/constants');
 * res.status(HTTP_STATUS.OK).json({ data });
 * ```
 */
const HTTP_STATUS = {
  // Success responses (2xx)
  OK: 200,
  CREATED: 201,

  // Client error responses (4xx)
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,

  // Server error responses (5xx)
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

module.exports = {
  HTTP_STATUS,
};
