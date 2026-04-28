/**
 * @ibetoni/api-utils — shared Express helpers for betoni.online services.
 *
 * Usage:
 *   const { sendSuccess, sendError, handleRouteError, asyncHandler,
 *           validateRequiredFields, validateId } = require("@ibetoni/api-utils");
 *
 * Submodule access:
 *   const { handleRouteError } = require("@ibetoni/api-utils/responses");
 *   const { asyncHandler } = require("@ibetoni/api-utils/validation");
 */

const responses = require("./responses");
const validation = require("./validation");

module.exports = {
  ...responses,
  ...validation,
  responses,
  validation,
};
