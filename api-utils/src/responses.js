/**
 * API Response Handler
 * Single source of truth for Express response helpers across betoni.online services.
 *
 * sendSuccess — sends raw data (no wrapping)
 * sendError / convenience wrappers — sends { success: false, message, error }
 * handleRouteError — for catch blocks: Sentry + error response
 */

const sentry = require("@ibetoni/sentry");

/**
 * Send raw data as JSON response.
 * @param {object} res - Express response object
 * @param {*} data - Data to send (sent as-is, no wrapping)
 * @param {number} statusCode - HTTP status code (default: 200)
 */
function sendSuccess(res, data, statusCode = 200) {
  res.status(statusCode).json(data);
}

/**
 * Send error response for guard clauses (validation, not-found, auth checks).
 * Does NOT log or report to Sentry — use handleRouteError for catch blocks.
 * @param {object} res - Express response object
 * @param {string|Error} error - Error message or Error object
 * @param {number} statusCode - HTTP status code (default: 500)
 */
function sendError(res, error, statusCode = 500) {
  const message = typeof error === "string" ? error : error.message || "An error occurred";
  res.status(statusCode).json({ success: false, message, error: message });
}

function sendValidationError(res, message) {
  sendError(res, message, 400);
}

function sendNotFound(res, message = "Resource not found") {
  sendError(res, message, 404);
}

function sendUnauthorized(res, message = "Unauthorized") {
  sendError(res, message, 401);
}

function sendForbidden(res, message = "Forbidden") {
  sendError(res, message, 403);
}

/**
 * Catch-block error handler: Sentry + error response.
 * Use in catch blocks where unexpected errors need reporting.
 * @param {object} res - Express response object
 * @param {Error} error - The caught error (set error.statusCode for non-500)
 * @param {string} operation - Short operation name (e.g. "person-set")
 * @param {object} extra - Additional context (_entity for Sentry tags)
 */
function handleRouteError(res, error, operation, extra = {}) {
  const { _entity = "unknown", ...sentryExtra } = extra;
  const req = res.req || {};
  const user = req.user || {};
  const asiakasId = user.ownerAsiakasId || user.asiakasId;

  sentry.captureException(error, {
    user: user.personId
      ? {
          id: String(user.personId),
          username: user.personEmail || user.email,
          asiakasId: asiakasId ? String(asiakasId) : undefined,
        }
      : undefined,
    tags: {
      entity: _entity,
      operation,
      method: req.method,
      path: req.route?.path || req.baseUrl || req.path,
      asiakasId: asiakasId ? String(asiakasId) : undefined,
    },
    extra: {
      ...sentryExtra,
      requestId: req.id || req.requestId,
      query: req.query,
      bodyKeys: req.body && typeof req.body === "object" ? Object.keys(req.body) : undefined,
    },
  });
  const message = error.clientMessage || error.message || `Failed: ${operation}`;
  res.status(error.statusCode || 500).json({ success: false, message, error: message });
}

module.exports = {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  handleRouteError,
};
