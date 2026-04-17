/**
 * Keikka Permission Validator
 *
 * Core permission validation business logic for betoni.online
 * Uses adapter pattern to handle environment-specific data retrieval
 */

class KeikkaPermissionValidator {
  constructor(options = {}) {
    this.permissionDataAdapter = options.permissionDataAdapter;
    this.contactPersonAdapter = options.contactPersonAdapter;
    this.assignmentAdapter = options.assignmentAdapter;
    this.logger = options.logger || this._createDefaultLogger();
    this.permissionCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // Validate required adapters
    if (!this.permissionDataAdapter) {
      throw new Error("permissionDataAdapter is required");
    }
    if (!this.contactPersonAdapter) {
      throw new Error("contactPersonAdapter is required");
    }
    if (!this.assignmentAdapter) {
      throw new Error("assignmentAdapter is required");
    }
  }

  /**
   * Create default logger (console-based)
   * @private
   */
  _createDefaultLogger() {
    return {
      info: (...args) => console.log("[INFO]", ...args),
      warn: (...args) => console.warn("[WARN]", ...args),
      error: (...args) => console.error("[ERROR]", ...args),
      debug: (...args) => console.log("[DEBUG]", ...args),
    };
  }

  /**
   * Get empty permissions object
   * @returns {Object} Empty permissions with all flags set to false
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
      isPumppuViewer: false,
    };
  }

  /**
   * Get user permissions (uses adapter with caching)
   * @param {Object} user - User object (format depends on environment)
   * @returns {Promise<Object>} Permission flags object
   */
  async getUserPermissions(user) {
    if (!user) {
      return this.getEmptyPermissions();
    }

    // Check cache
    const cacheKey = this._getCacheKey(user);
    const cached = this.permissionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.permissions;
    }

    // Fetch from adapter
    try {
      const permissions =
        await this.permissionDataAdapter.getUserPermissions(user);

      // Cache the result
      this.permissionCache.set(cacheKey, {
        permissions,
        timestamp: Date.now(),
      });
      return permissions;
    } catch (error) {
      console.error("Failed to load permissions", {
        error: error.message,
        user,
      });
      return this.getEmptyPermissions();
    }
  }

  /**
   * Generate cache key for user
   * @private
   */
  _getCacheKey(user) {
    const personId = user.personId || user.id;
    const asiakasId = user.ownerAsiakasId || user.asiakasId;
    return `${personId}-${asiakasId}`;
  }

  /**
   * Check if user can read a specific keikka
   *
   * PURE BUSINESS LOGIC - No database or context dependencies
   *
   * @param {Object} user - User object (personId, ownerAsiakasId)
   * @param {Object} keikka - Keikka object with sourceAsiakasId, ownerAsiakasId, betoniAsiakasId, pumppuAsiakasId
   * @returns {Promise<boolean>} True if user can read the keikka
   */
  async canReadKeikka(user, keikka) {
    if (!user || !keikka) {
      console.log("canReadKeikka called with missing user or keikka");
      return false;
    }

    const permissions = await this.getUserPermissions(user);
    const ownerAsiakasId = user.ownerAsiakasId || user.asiakasId;

    // Admin access: see all keikkas for their tenant
    if (
      permissions.isAsiakasAdmin &&
      (keikka.sourceAsiakasId === ownerAsiakasId ||
        keikka.ownerAsiakasId === ownerAsiakasId ||
        keikka.betoniAsiakasId === ownerAsiakasId ||
        keikka.pumppuAsiakasId === ownerAsiakasId)
    ) {
      return true;
    }

    // Pumppari: only assigned keikkas (delegate to adapter)
    if (permissions.isPumppari) {
      const isAssigned = await this.assignmentAdapter.isPersonAssignedToKeikka(
        user,
        keikka,
      );
      return isAssigned;
    }

    // KeikkaHandler/Viewer: all keikkas where tenant is involved
    if (
      (permissions.isKeikkaHandler || permissions.isKeikkaViewer) &&
      (keikka.sourceAsiakasId === ownerAsiakasId ||
        keikka.ownerAsiakasId === ownerAsiakasId ||
        keikka.betoniAsiakasId === ownerAsiakasId ||
        keikka.pumppuAsiakasId === ownerAsiakasId)
    ) {
      return true;
    }

    // BetoniHandler/Viewer: keikkas with betoni connection
    if (
      (permissions.isBetoniHandler || permissions.isBetoniViewer) &&
      (keikka.sourceAsiakasId === ownerAsiakasId ||
        keikka.betoniAsiakasId === ownerAsiakasId)
    ) {
      return true;
    }

    // PumppuHandler/Viewer: keikkas with pumppu connection
    if (
      (permissions.isPumppuHandler || permissions.isPumppuViewer) &&
      (keikka.sourceAsiakasId === ownerAsiakasId ||
        keikka.pumppuAsiakasId === ownerAsiakasId)
    ) {
      return true;
    }

    // Contact person access (delegate to adapter)
    const hasContactAccess =
      await this.contactPersonAdapter.hasContactPersonAccess(
        user,
        keikka,
        "read",
      );
    return hasContactAccess;
  }

  /**
   * Check if user can edit a specific keikka
   *
   * PURE BUSINESS LOGIC - No database or context dependencies
   *
   * @param {Object} user - User object (personId, ownerAsiakasId)
   * @param {Object} keikka - Keikka object with tilaId, sourceAsiakasId, etc.
   * @returns {Promise<boolean>} True if user can edit the keikka
   */
  async canEditKeikka(user, keikka) {
    if (!user || !keikka) {
      console.log("canEditKeikka called with missing user or keikka");
      return false;
    }

    const permissions = await this.getUserPermissions(user);
    const ownerAsiakasId = user.ownerAsiakasId || user.asiakasId;
    const tilaId = keikka.keikkaTilaId || keikka.tilaId;

    // System/Customer Admin: Full access until laskutettu (tilaId < 7)
    if (
      permissions.isAsiakasAdmin &&
      tilaId < 7 &&
      (keikka.sourceAsiakasId === ownerAsiakasId ||
        keikka.ownerAsiakasId === ownerAsiakasId ||
        keikka.betoniAsiakasId === ownerAsiakasId ||
        keikka.pumppuAsiakasId === ownerAsiakasId)
    ) {
      return true;
    }

    // Lasku Admin: Can edit laskutettu status (tilaId === 7)
    if (
      permissions.isLaskuAdmin &&
      tilaId === 7 &&
      (keikka.sourceAsiakasId === ownerAsiakasId ||
        keikka.ownerAsiakasId === ownerAsiakasId ||
        keikka.betoniAsiakasId === ownerAsiakasId ||
        keikka.pumppuAsiakasId === ownerAsiakasId)
    ) {
      return true;
    }

    // Pumppari: No edit permissions (view only)
    if (permissions.isPumppari) {
      return false;
    }

    // KeikkaHandler: Edit until laskutettu for tenant keikkas
    if (
      permissions.isKeikkaHandler &&
      tilaId < 7 &&
      (keikka.sourceAsiakasId === ownerAsiakasId ||
        keikka.ownerAsiakasId === ownerAsiakasId ||
        keikka.betoniAsiakasId === ownerAsiakasId ||
        keikka.pumppuAsiakasId === ownerAsiakasId)
    ) {
      return true;
    }

    // BetoniHandler: Edit until laskutettu for betoni-related keikkas
    if (
      permissions.isBetoniHandler &&
      tilaId < 7 &&
      (keikka.sourceAsiakasId === ownerAsiakasId ||
        keikka.betoniAsiakasId === ownerAsiakasId)
    ) {
      return true;
    }

    // PumppuHandler: Edit until laskutettu for pumppu-related keikkas
    if (
      permissions.isPumppuHandler &&
      tilaId < 7 &&
      (keikka.sourceAsiakasId === ownerAsiakasId ||
        keikka.pumppuAsiakasId === ownerAsiakasId)
    ) {
      return true;
    }

    // Contact person edit permissions (only for luonnos status, tilaId === 1)
    if (tilaId === 1) {
      const hasContactAccess =
        await this.contactPersonAdapter.hasContactPersonAccess(
          user,
          keikka,
          "edit",
        );
      return hasContactAccess;
    }

    return false;
  }

  /**
   * Clear permission cache
   * @param {number} personId - Person ID (optional)
   * @param {number} asiakasId - Company ID (optional)
   */
  clearPermissionCache(personId = null, asiakasId = null) {
    if (personId && asiakasId) {
      const cacheKey = `${personId}-${asiakasId}`;
      this.permissionCache.delete(cacheKey);
    } else if (personId) {
      for (const key of this.permissionCache.keys()) {
        if (key.startsWith(`${personId}-`)) {
          this.permissionCache.delete(key);
        }
      }
    } else {
      // Clear entire cache
      this.permissionCache.clear();
    }
  }

  /**
   * Get cache status for monitoring
   * @returns {Object} Cache status
   */
  getCacheStatus() {
    return {
      size: this.permissionCache.size,
      timeout: this.cacheTimeout,
    };
  }
}

module.exports = KeikkaPermissionValidator;
