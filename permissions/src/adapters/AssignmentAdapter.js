/**
 * Assignment Adapter Interface
 *
 * Base class for checking if a person (pumppari) is assigned to a keikka.
 * Environment-specific implementations should extend this class.
 */

class AssignmentAdapter {
  /**
   * Check if a person is assigned to a keikka
   *
   * Used primarily for Pumppari role - pumpparis can only read keikkas
   * they are assigned to via the keikkaPerson table.
   *
   * @param {Object} user - User object (personId, ownerAsiakasId)
   * @param {Object} keikka - Keikka object to check assignment for
   * @returns {Promise<boolean>} True if person is assigned to the keikka
   */
  async isPersonAssignedToKeikka(user, keikka) {
    throw new Error('isPersonAssignedToKeikka() must be implemented by subclass');
  }
}

module.exports = AssignmentAdapter;
