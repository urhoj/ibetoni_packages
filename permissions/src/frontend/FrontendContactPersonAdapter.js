/**
 * Frontend Contact Person Adapter
 *
 * Checks contact person access using pre-loaded keikka.contactPersons arrays
 * (Frontend version - data is already loaded from API)
 */

const ContactPersonAdapter = require('../adapters/ContactPersonAdapter');

class FrontendContactPersonAdapter extends ContactPersonAdapter {
  /**
   * Check if user has contact person access (frontend implementation)
   *
   * Frontend assumes keikka.contactPersons is already loaded by API
   *
   * @param {Object} user - User object with personId
   * @param {Object} keikka - Keikka object with contactPersons arrays
   * @param {string} accessType - 'read' or 'edit'
   * @returns {Promise<boolean>} True if has contact person access
   */
  async hasContactPersonAccess(user, keikka, accessType = 'read') {
    const personId = user.personId;

    if (!personId || !keikka) {
      return false;
    }

    // Direct keikka contact person
    if (keikka.keikkaContactPersonId === personId) {
      return true;
    }

    // Check if user is in any of the contact person arrays (if provided by API)
    if (keikka.contactPersons) {
      const authField = accessType === 'edit' ? 'authEdit' : 'authRead';

      // Check keikka team members
      if (keikka.contactPersons.keikka) {
        const hasAccess = keikka.contactPersons.keikka.some(cp =>
          cp.personId === personId && cp[authField]
        );
        if (hasAccess) return true;
      }

      // Check customer contact persons
      if (keikka.contactPersons.asiakas) {
        const hasAccess = keikka.contactPersons.asiakas.some(cp =>
          cp.personId === personId && (cp.isContactPerson || cp[authField])
        );
        if (hasAccess) return true;
      }

      // Check worksite contact persons
      if (keikka.contactPersons.tyomaa) {
        const hasAccess = keikka.contactPersons.tyomaa.some(cp =>
          cp.personId === personId && (cp.isContactPerson || cp[authField])
        );
        if (hasAccess) return true;
      }

      // Betoni/Pumppu supplier contact (for kesken+ status, tilaId > 1)
      const tilaId = keikka.keikkaTilaId || keikka.tilaId;
      if (tilaId > 1) {
        if (keikka.contactPersons.betoni) {
          const hasAccess = keikka.contactPersons.betoni.some(cp =>
            cp.personId === personId && (cp.isContactPerson || cp[authField])
          );
          if (hasAccess) return true;
        }

        if (keikka.contactPersons.pumppu) {
          const hasAccess = keikka.contactPersons.pumppu.some(cp =>
            cp.personId === personId && (cp.isContactPerson || cp[authField])
          );
          if (hasAccess) return true;
        }
      }
    }

    return false;
  }
}

module.exports = FrontendContactPersonAdapter;
