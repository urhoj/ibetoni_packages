/**
 * @ibetoni/permissions
 *
 * Shared permission validation system for betoni.online
 *
 * Main exports for the permissions package. Use environment-specific
 * exports for frontend and backend implementations.
 */

const KeikkaPermissionValidator = require('./KeikkaPermissionValidator');

// Export core validator class
module.exports = {
  KeikkaPermissionValidator,
};

// Frontend-specific exports are in ./frontend/
// Backend-specific exports are in ./backend/
