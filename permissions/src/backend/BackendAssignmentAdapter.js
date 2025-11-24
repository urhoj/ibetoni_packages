/**
 * Backend Assignment Adapter
 *
 * Queries keikkaPerson table to check if person is assigned to keikka
 */

const AssignmentAdapter = require('../adapters/AssignmentAdapter');

class BackendAssignmentAdapter extends AssignmentAdapter {
  constructor(dbConnection) {
    super();
    this.dbConnection = dbConnection;

    if (!this.dbConnection) {
      throw new Error('dbConnection is required for BackendAssignmentAdapter');
    }
  }

  /**
   * Check if person is assigned to keikka (backend implementation)
   *
   * Queries keikkaPerson table for assignment relationship
   *
   * @param {Object} user - User object with personId
   * @param {Object} keikka - Keikka object with keikkaId
   * @returns {Promise<boolean>} True if person is assigned
   */
  async isPersonAssignedToKeikka(user, keikka) {
    if (!user || !user.personId || !keikka || !keikka.keikkaId) {
      return false;
    }

    try {
      const conn = await this.dbConnection.getConnection();
      const result = await conn
        .request()
        .input("personId", user.personId)
        .input("keikkaId", keikka.keikkaId)
        .query(`
          SELECT 1
          FROM keikkaPerson
          WHERE personId = @personId
          AND keikkaId = @keikkaId
          AND isDeleted = 0
        `);

      return result.recordset.length > 0;
    } catch (error) {
      console.error("Error checking person keikka assignment:", error);
      return false;
    }
  }
}

module.exports = BackendAssignmentAdapter;
