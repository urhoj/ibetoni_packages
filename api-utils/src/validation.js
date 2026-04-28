/**
 * Validation Utilities
 * Pure validation functions — no response sending, no side effects.
 */

/**
 * Validate required fields in request body.
 * @param {object} body - Request body
 * @param {string[]} requiredFields - Array of required field names
 * @returns {string[]} Array of missing field names (empty if all present)
 */
function validateRequiredFields(body, requiredFields) {
  return requiredFields.filter(
    (field) => body[field] === undefined || body[field] === null || body[field] === ""
  );
}

/**
 * Validate ID parameter is a positive integer.
 * @param {string|number} id - ID to validate
 * @param {string} fieldName - Name for error messaging
 * @returns {string|null} Error message string, or null if valid
 */
function validateId(id, fieldName = "id") {
  if (id === null || id === undefined) {
    return `${fieldName} is required`;
  }
  const numericId = parseInt(id);
  if (isNaN(numericId) || numericId <= 0) {
    return `${fieldName} must be a positive integer`;
  }
  return null;
}

/**
 * Validate that fields in request body are integers (when present).
 * @param {object} body - Request body
 * @param {string[]} fieldNames - Field names to validate
 * @returns {string[]} Array of field names that are not integers
 */
function validateIntegerFields(body, fieldNames) {
  return fieldNames.filter(
    (field) => body[field] !== undefined && !Number.isInteger(body[field])
  );
}

/**
 * Validate date string format.
 * @param {string} dateStr - Date string to validate
 * @param {"YYYYMMDD"|"YYYY-MM-DD"} format - Expected format
 * @returns {boolean} True if valid format
 */
function validateDateFormat(dateStr, format = "YYYYMMDD") {
  if (!dateStr) return false;
  if (format === "YYYY-MM-DD") return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  return /^\d{8}$/.test(dateStr);
}

/**
 * Wrap async route handlers to catch errors and pass to next().
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express route handler with error catching
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  validateRequiredFields,
  validateId,
  validateIntegerFields,
  validateDateFormat,
  asyncHandler,
};
