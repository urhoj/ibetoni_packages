/**
 * Backend Exports
 *
 * Convenience exports for backend usage
 */

const createBackendValidator = require('./createBackendValidator');
const BackendPermissionAdapter = require('./BackendPermissionAdapter');
const BackendContactPersonAdapter = require('./BackendContactPersonAdapter');
const BackendAssignmentAdapter = require('./BackendAssignmentAdapter');

module.exports = {
  createBackendValidator,
  BackendPermissionAdapter,
  BackendContactPersonAdapter,
  BackendAssignmentAdapter
};
