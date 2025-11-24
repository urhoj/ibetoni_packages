/**
 * Frontend Assignment Adapter
 *
 * Checks if person is assigned to keikka using pre-loaded keikka.assignedPersons array
 * (Frontend version - data is already loaded from API)
 */

const AssignmentAdapter = require('../adapters/AssignmentAdapter');

class FrontendAssignmentAdapter extends AssignmentAdapter {
  /**
   * Check if person is assigned to keikka (frontend implementation)
   *
   * Frontend assumes keikka.assignedPersons is already loaded by API
   *
   * @param {Object} user - User object with personId
   * @param {Object} keikka - Keikka object with assignedPersons array
   * @returns {Promise<boolean>} True if person is assigned
   */
  async isPersonAssignedToKeikka(user, keikka) {
    const personId = user.personId;

    if (!personId || !keikka) {
      return false;
    }

    // Check if keikka has assignedPersons array and person is in it
    if (keikka.assignedPersons && Array.isArray(keikka.assignedPersons)) {
      return keikka.assignedPersons.includes(personId);
    }

    // Fallback: not assigned
    return false;
  }
}

module.exports = FrontendAssignmentAdapter;
