/**
 * Frontend Permission Data Adapter
 *
 * Reads permission data from user.companyRoles object (JWT-derived data)
 */

const PermissionDataAdapter = require('../adapters/PermissionDataAdapter');

class FrontendPermissionAdapter extends PermissionDataAdapter {
  /**
   * Get user permissions from companyRoles object in user context
   *
   * Frontend permissions come from JWT token which includes companyRoles
   *
   * @param {Object} user - User object with companyRoles property
   * @returns {Promise<Object>} Permission flags object
   */
  async getUserPermissions(user) {
    if (!user || !user.companyRoles) {
      return this.getEmptyPermissions();
    }

    const companyRoles = user.companyRoles || {};

    return {
      isAsiakasAdmin: companyRoles.isAsiakasAdmin || false,
      isLaskuAdmin: companyRoles.isLaskuAdmin || false,
      isPumppari: companyRoles.isPumppari || false,
      isAttachmentHandler: companyRoles.isAttachmentHandler || false,
      isKeikkaHandler: companyRoles.isKeikkaHandler || false,
      isSijaintiHandler: companyRoles.isSijaintiHandler || false,
      isVehicleHandler: companyRoles.isVehicleHandler || false,
      isTuoteHandler: companyRoles.isTuoteHandler || false,
      isKeikkaViewer: companyRoles.isKeikkaViewer || false,
      isBetoniHandler: companyRoles.isBetoniHandler || false,
      isBetoniViewer: companyRoles.isBetoniViewer || false,
      isPumppuHandler: companyRoles.isPumppuHandler || false,
      isPumppuViewer: companyRoles.isPumppuViewer || false,
      isAsiakasOwner: companyRoles.isAsiakasOwner || false
    };
  }
}

module.exports = FrontendPermissionAdapter;
