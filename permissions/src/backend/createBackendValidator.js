/**
 * Backend Validator Factory
 *
 * Creates a KeikkaPermissionValidator instance configured with backend adapters
 */

const KeikkaPermissionValidator = require('../KeikkaPermissionValidator');
const BackendPermissionAdapter = require('./BackendPermissionAdapter');
const BackendContactPersonAdapter = require('./BackendContactPersonAdapter');
const BackendAssignmentAdapter = require('./BackendAssignmentAdapter');

/**
 * Create a permission validator for backend use
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.dbConnection - Database connection (required)
 * @param {Object} options.logger - Optional logger (defaults to console)
 * @returns {KeikkaPermissionValidator} Configured validator instance
 */
function createBackendValidator(options = {}) {
  if (!options.dbConnection) {
    throw new Error('dbConnection is required for backend validator');
  }

  const logger = options.logger || console;

  return new KeikkaPermissionValidator({
    permissionDataAdapter: new BackendPermissionAdapter(options.dbConnection),
    contactPersonAdapter: new BackendContactPersonAdapter(options.dbConnection),
    assignmentAdapter: new BackendAssignmentAdapter(options.dbConnection),
    logger
  });
}

module.exports = createBackendValidator;
