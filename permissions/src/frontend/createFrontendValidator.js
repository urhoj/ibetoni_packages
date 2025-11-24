/**
 * Frontend Validator Factory
 *
 * Creates a KeikkaPermissionValidator instance configured with frontend adapters
 */

const KeikkaPermissionValidator = require('../KeikkaPermissionValidator');
const FrontendPermissionAdapter = require('./FrontendPermissionAdapter');
const FrontendContactPersonAdapter = require('./FrontendContactPersonAdapter');
const FrontendAssignmentAdapter = require('./FrontendAssignmentAdapter');

/**
 * Create a permission validator for frontend use
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.logger - Optional logger (defaults to console)
 * @returns {KeikkaPermissionValidator} Configured validator instance
 */
function createFrontendValidator(options = {}) {
  const logger = options.logger || console;

  return new KeikkaPermissionValidator({
    permissionDataAdapter: new FrontendPermissionAdapter(),
    contactPersonAdapter: new FrontendContactPersonAdapter(),
    assignmentAdapter: new FrontendAssignmentAdapter(),
    logger
  });
}

module.exports = createFrontendValidator;
