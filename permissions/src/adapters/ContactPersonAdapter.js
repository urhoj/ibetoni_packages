/**
 * Contact Person Adapter Interface
 *
 * Base class for checking contact person access to keikkas.
 * Environment-specific implementations should extend this class.
 */

class ContactPersonAdapter {
  /**
   * Check if user has contact person access to a keikka
   *
   * Contact person access includes:
   * - Direct keikka contact person (keikkaContactPersonId)
   * - Customer contact persons (asiakas)
   * - Worksite contact persons (tyomaa)
   * - Betoni supplier contact persons (for kesken+ status)
   * - Pumppu supplier contact persons (for kesken+ status)
   *
   * @param {Object} user - User object (personId, ownerAsiakasId)
   * @param {Object} keikka - Keikka object to check access for
   * @param {string} accessType - Type of access ('read' or 'edit')
   * @returns {Promise<boolean>} True if user has contact person access
   */
  async hasContactPersonAccess(user, keikka, accessType = 'read') {
    throw new Error('hasContactPersonAccess() must be implemented by subclass');
  }
}

module.exports = ContactPersonAdapter;
