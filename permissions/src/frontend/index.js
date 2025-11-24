/**
 * Frontend Exports
 *
 * Convenience exports for frontend usage
 */

const createFrontendValidator = require('./createFrontendValidator');
const FrontendPermissionAdapter = require('./FrontendPermissionAdapter');
const FrontendContactPersonAdapter = require('./FrontendContactPersonAdapter');
const FrontendAssignmentAdapter = require('./FrontendAssignmentAdapter');

module.exports = {
  createFrontendValidator,
  FrontendPermissionAdapter,
  FrontendContactPersonAdapter,
  FrontendAssignmentAdapter
};
