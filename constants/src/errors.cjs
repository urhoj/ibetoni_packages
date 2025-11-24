/**
 * Error Codes
 *
 * Standard error code constants used across all applications
 * for consistent error handling and reporting.
 *
 * Error codes are organized by category with number ranges:
 * - 1000-1999: Validation Errors
 * - 2000-2999: API Errors
 * - 3000-3999: Database Errors
 * - 4000-4999: System Errors
 * - 5000-5999: Business Logic Errors
 *
 * @module @ibetoni/constants/errors
 */

/**
 * Standard error codes categorized by type
 *
 * Usage:
 * ```javascript
 * const { ERROR_CODES } = require('@ibetoni/constants');
 * throw new Error(ERROR_CODES.VALIDATION_ERROR);
 * ```
 */
const ERROR_CODES = {
  // ============================================================================
  // Validation Errors (1000-1999)
  // ============================================================================
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_ID: "INVALID_ID",
  INVALID_DATE: "INVALID_DATE",

  // Sijainti/Location specific validation
  INVALID_COORDINATES: "INVALID_COORDINATES",
  INVALID_ORIGIN: "INVALID_ORIGIN",
  INVALID_DESTINATION: "INVALID_DESTINATION",
  MISSING_REQUIRED_PARAMS: "MISSING_REQUIRED_PARAMS",

  // ============================================================================
  // API Errors (2000-2999)
  // ============================================================================
  API_ERROR: "API_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // External API specific errors
  GOOGLE_MAPS_API_ERROR: "GOOGLE_MAPS_API_ERROR",
  GOOGLE_MAPS_QUOTA_EXCEEDED: "GOOGLE_MAPS_QUOTA_EXCEEDED",
  GOOGLE_MAPS_TIMEOUT: "GOOGLE_MAPS_TIMEOUT",
  GOOGLE_MAPS_INVALID_REQUEST: "GOOGLE_MAPS_INVALID_REQUEST",

  // ============================================================================
  // Database Errors (3000-3999)
  // ============================================================================
  DATABASE_ERROR: "DATABASE_ERROR",
  DATABASE_CONNECTION_ERROR: "DATABASE_CONNECTION_ERROR",
  DATABASE_QUERY_ERROR: "DATABASE_QUERY_ERROR",
  CONSTRAINT_VIOLATION: "CONSTRAINT_VIOLATION",
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
  CACHE_ERROR: "CACHE_ERROR",

  // ============================================================================
  // System Errors (4000-4999)
  // ============================================================================
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT_ERROR: "TIMEOUT_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",

  // ============================================================================
  // Business Logic Errors (5000-5999)
  // ============================================================================
  BUSINESS_LOGIC_ERROR: "BUSINESS_LOGIC_ERROR",
  OPERATION_FAILED: "OPERATION_FAILED",
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
  INVALID_OPERATION: "INVALID_OPERATION",

  // Sijainti/Location specific business logic
  NO_ROUTE_FOUND: "NO_ROUTE_FOUND",
  DISTANCE_CALCULATION_FAILED: "DISTANCE_CALCULATION_FAILED",
  LOCATION_NOT_FOUND: "LOCATION_NOT_FOUND",
};

module.exports = {
  ERROR_CODES,
};
