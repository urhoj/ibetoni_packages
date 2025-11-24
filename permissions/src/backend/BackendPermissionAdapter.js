/**
 * Backend Permission Data Adapter
 *
 * Queries asiakasPersonSettings table to get user permissions
 */

const PermissionDataAdapter = require('../adapters/PermissionDataAdapter');

class BackendPermissionAdapter extends PermissionDataAdapter {
  constructor(dbConnection) {
    super();
    this.dbConnection = dbConnection;

    if (!this.dbConnection) {
      throw new Error('dbConnection is required for BackendPermissionAdapter');
    }
  }

  /**
   * Get user permissions from database
   *
   * Maps personSettingTypeId to permission flags:
   * - 2,5 = isAsiakasAdmin
   * - 5 = isLaskuAdmin
   * - 8 = isPumppari
   * - 10 = isAttachmentHandler
   * - 11 = isKeikkaHandler
   * - 12 = isSijaintiHandler
   * - 13 = isVehicleHandler
   * - 14 = isTuoteHandler
   * - 17 = isKeikkaViewer
   * - 18 = isBetoniHandler
   * - 19 = isBetoniViewer
   * - 20 = isPumppuHandler
   * - 21 = isPumppuViewer
   * - 22 = isAsiakasOwner
   *
   * @param {Object} user - User object with personId and ownerAsiakasId
   * @returns {Promise<Object>} Permission flags object
   */
  async getUserPermissions(user) {
    if (!user || !user.personId || !user.ownerAsiakasId) {
      return this.getEmptyPermissions();
    }

    const { personId, ownerAsiakasId } = user;

    try {
      const conn = await this.dbConnection.getConnection();
      const result = await conn
        .request()
        .input("personId", personId)
        .input("asiakasId", ownerAsiakasId)
        .query(`
          SELECT personSettingTypeId
          FROM asiakasPersonSettings
          WHERE personId = @personId
          AND asiakasId = @asiakasId
          AND isActive = 1
        `);

      const settingTypes = result.recordset.map(row => row.personSettingTypeId);

      return {
        isAsiakasAdmin: settingTypes.includes(2) || settingTypes.includes(5),
        isLaskuAdmin: settingTypes.includes(5),
        isPumppari: settingTypes.includes(8),
        isAttachmentHandler: settingTypes.includes(10),
        isKeikkaHandler: settingTypes.includes(11),
        isSijaintiHandler: settingTypes.includes(12),
        isVehicleHandler: settingTypes.includes(13),
        isTuoteHandler: settingTypes.includes(14),
        isKeikkaViewer: settingTypes.includes(17),
        isBetoniHandler: settingTypes.includes(18),
        isBetoniViewer: settingTypes.includes(19),
        isPumppuHandler: settingTypes.includes(20),
        isPumppuViewer: settingTypes.includes(21),
        isAsiakasOwner: settingTypes.includes(22)
      };
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      return this.getEmptyPermissions();
    }
  }
}

module.exports = BackendPermissionAdapter;
