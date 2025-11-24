/**
 * Backend Contact Person Adapter
 *
 * Queries multiple tables to check contact person access to keikkas
 */

const ContactPersonAdapter = require('../adapters/ContactPersonAdapter');

class BackendContactPersonAdapter extends ContactPersonAdapter {
  constructor(dbConnection) {
    super();
    this.dbConnection = dbConnection;

    if (!this.dbConnection) {
      throw new Error('dbConnection is required for BackendContactPersonAdapter');
    }
  }

  /**
   * Check if user has contact person access (backend implementation)
   *
   * Queries multiple tables to check various contact person relationships:
   * - Direct keikka contact person (keikkaContactPersonId)
   * - Keikka team member with auth flags
   * - Customer contact person or team member
   * - Worksite contact person or team member
   * - Betoni/Pumppu supplier contact (for kesken+ status)
   *
   * @param {Object} user - User object with personId
   * @param {Object} keikka - Keikka object with keikkaId, asiakasId, tyomaaId, etc.
   * @param {string} accessType - 'read' or 'edit'
   * @returns {Promise<boolean>} True if has contact person access
   */
  async hasContactPersonAccess(user, keikka, accessType = 'read') {
    if (!user || !user.personId || !keikka) {
      return false;
    }

    const personId = user.personId;

    try {
      const conn = await this.dbConnection.getConnection();

      // Direct keikka contact person
      if (keikka.keikkaContactPersonId === personId) {
        return true;
      }

      const authField = accessType === 'edit' ? 'authEdit' : 'authRead';

      // Check various contact person relationships
      const queries = [
        // Keikka team member with auth permission
        `SELECT 1 FROM keikkaPerson
         WHERE keikkaId = @keikkaId AND personId = @personId
         AND isDeleted = 0 AND ${authField} = 1`,

        // Customer contact person
        `SELECT 1 FROM asiakas
         WHERE asiakasId = @asiakasId AND asiakasContactPersonId = @personId`,

        // Customer team member with auth permission
        `SELECT 1 FROM asiakasPersonSettings
         WHERE asiakasId = @asiakasId AND personId = @personId
         AND isDeleted = 0 AND ${authField} = 1`,

        // Worksite contact person
        `SELECT 1 FROM tyomaa
         WHERE tyomaaId = @tyomaaId AND tyomaaContactPersonId = @personId`,

        // Worksite team member with auth permission
        `SELECT 1 FROM tyomaaPerson tp
         INNER JOIN tyomaa t ON tp.tyomaaId = t.tyomaaId
         WHERE t.tyomaaId = @tyomaaId AND tp.personId = @personId
         AND tp.isDeleted = 0 AND tp.${authField} = 1`
      ];

      for (const query of queries) {
        const result = await conn
          .request()
          .input("personId", personId)
          .input("keikkaId", keikka.keikkaId)
          .input("asiakasId", keikka.asiakasId)
          .input("tyomaaId", keikka.tyomaaId)
          .query(query);

        if (result.recordset.length > 0) {
          return true;
        }
      }

      // Betoni/Pumppu supplier contact (for kesken+ status, tilaId > 1)
      const tilaId = keikka.keikkaTilaId || keikka.tilaId;
      if (tilaId > 1) {
        const supplierQueries = [
          // Betoni supplier contact
          `SELECT 1 FROM asiakas
           WHERE asiakasId = @betoniAsiakasId AND asiakasContactPersonId = @personId`,

          // Pumppu supplier contact
          `SELECT 1 FROM asiakas
           WHERE asiakasId = @pumppuAsiakasId AND asiakasContactPersonId = @personId`,

          // Betoni supplier team member with auth permission
          `SELECT 1 FROM asiakasPersonSettings
           WHERE asiakasId = @betoniAsiakasId AND personId = @personId
           AND isDeleted = 0 AND ${authField} = 1`,

          // Pumppu supplier team member with auth permission
          `SELECT 1 FROM asiakasPersonSettings
           WHERE asiakasId = @pumppuAsiakasId AND personId = @personId
           AND isDeleted = 0 AND ${authField} = 1`
        ];

        for (const query of supplierQueries) {
          const result = await conn
            .request()
            .input("personId", personId)
            .input("betoniAsiakasId", keikka.betoniAsiakasId)
            .input("pumppuAsiakasId", keikka.pumppuAsiakasId)
            .query(query);

          if (result.recordset.length > 0) {
            return true;
          }
        }
      }

      return false;

    } catch (error) {
      console.error("Error checking contact person access:", error);
      return false;
    }
  }
}

module.exports = BackendContactPersonAdapter;
