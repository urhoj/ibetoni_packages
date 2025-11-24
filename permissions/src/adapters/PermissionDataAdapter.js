/**
 * Permission Data Adapter Interface
 *
 * Base class for retrieving user permission data.
 * Environment-specific implementations should extend this class.
 */

class PermissionDataAdapter {
  /**
   * Get user permissions from environment-specific data source
   *
   * @param {Object} user - User object (format depends on environment)
   * @returns {Promise<Object>} Permission flags object with all permission booleans
   *
   * Expected return format:
   * {
   *   isAsiakasAdmin: boolean,
   *   isLaskuAdmin: boolean,
   *   isPumppari: boolean,
   *   isAttachmentHandler: boolean,
   *   isKeikkaHandler: boolean,
   *   isSijaintiHandler: boolean,
   *   isVehicleHandler: boolean,
   *   isTuoteHandler: boolean,
   *   isKeikkaViewer: boolean,
   *   isBetoniHandler: boolean,
   *   isBetoniViewer: boolean,
   *   isPumppuHandler: boolean,
   *   isPumppuViewer: boolean
   * }
   */
  async getUserPermissions(user) {
    throw new Error('getUserPermissions() must be implemented by subclass');
  }

  /**
   * Get empty permissions object (helper method)
   * @returns {Object} Empty permissions with all flags false
   */
  getEmptyPermissions() {
    return {
      isAsiakasAdmin: false,
      isLaskuAdmin: false,
      isPumppari: false,
      isAttachmentHandler: false,
      isKeikkaHandler: false,
      isSijaintiHandler: false,
      isVehicleHandler: false,
      isTuoteHandler: false,
      isKeikkaViewer: false,
      isBetoniHandler: false,
      isBetoniViewer: false,
      isPumppuHandler: false,
      isPumppuViewer: false
    };
  }
}

module.exports = PermissionDataAdapter;
