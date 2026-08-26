/**
 * @module keikkaValidator
 * @description Delivery Order Validation System for betoni.online
 *
 * Pure validation engine with 5-level priority system and 7 validation categories.
 * Each validation issue includes actionable remediation steps (click, autoFix, dismiss).
 *
 * **Priority Levels:** CRITICAL (5) → HIGH (4) → MEDIUM (3) → LOW (2) → NOTIFICATION (1)
 * **Categories:** BETONI, ASIAKAS, TYOMAA, CONTACT, VEHICLE, PUMPPARI, MUU
 *
 * **Multi-Tenant Awareness:**
 * - sourceAsiakasId: Order owner (who created the order)
 * - ownerAsiakasId: Current user's customer ID
 * - Rules can be configured to apply only to own orders (verifyOnlyOwnOrders)
 *
 * **Validation Settings:**
 * - Rules can be enabled/disabled individually
 * - Priority levels can be customized per rule
 * - Step log integration for dismissed reminders
 *
 * **Performance:**
 * - O(1) lookups via Map for vehicles and drivers
 * - Single-pass validation with early returns
 * - Optimized for real-time grid validation
 *
 * @see puminet4/src/utils/keikkaValidator.test.js - Complete test coverage
 */

const { isEmail: isValidEmail } = require("@ibetoni/betoni-utils");
const {
  isSevereCold,
  SEVERE_COLD_THRESHOLD,
  isSevereHot,
  SEVERE_HOT_THRESHOLD,
} = require("./weatherThresholds.js");

/**
 * Keikka (delivery order) object for validation
 *
 * @typedef {Object} Keikka
 * @property {number} keikkaId - Order identifier
 * @property {number} keikkaTilaId - Order status ID (4=Toimitusvalmis, >=8=completed)
 * @property {string} [keikkaTilaSelite] - Status description
 * @property {number} asiakasId - Customer ID (0 or null = missing)
 * @property {string} [asiakasNimi] - Customer name
 * @property {string} [ytunnus] - Finnish business ID (Y-tunnus)
 * @property {number} sourceAsiakasId - Order owner's customer ID
 * @property {number} [betoniAsiakasId] - Factory/supplier customer ID
 * @property {string} [betoniAsiakasNimi] - Factory/supplier name
 * @property {Array<Kuski>} [kuskit] - Assigned drivers
 * @property {number} vehicleId - Assigned vehicle ID
 * @property {Array<Betoni>} [betonit] - Concrete specifications
 * @property {number} [tyomaaId] - Worksite ID
 * @property {string} [tyomaa] - Worksite name
 * @property {string} [osoite] - Delivery address
 * @property {string} [postinumero] - Postal code
 * @property {string} [kaupunki] - City name
 * @property {string} [yhteyshenkiloNimi] - Contact person name
 * @property {string} [yhteyshenkiloPuhelin] - Contact phone
 * @property {string} [yhteyshenkiloEmail] - Contact email
 * @property {number} [pumppuPuomi] - Required pump boom length (meters)
 * @property {number} [pumppuLinja] - Pump line length (meters)
 * @property {boolean} [betonitiedotLahetetty] - Concrete data sent flag
 * @property {boolean} [tilausvahvistusLahetetty] - Order confirmation sent flag
 */

/**
 * Driver/Person object
 *
 * @typedef {Object} Kuski
 * @property {number} personId - Person identifier
 * @property {string} [personFirstName] - First name
 * @property {string} [personLastName] - Last name
 */

/**
 * Concrete specification object
 *
 * @typedef {Object} Betoni
 * @property {number} keikkaBetoniId - Concrete line identifier
 * @property {number} m3 - Volume in cubic meters
 * @property {number} [raeKokoId] - Aggregate size ID (2=hieno16mm, 4=8mm for pump lines)
 * @property {string} [raeKokoSelite] - Aggregate size description
 * @property {boolean|null} [betoniVahvistettu] - Validation status (true=confirmed, false=needs validation, null=unknown)
 */

/**
 * Vehicle object for validation
 *
 * @typedef {Object} Vehicle
 * @property {number} vehicleId - Vehicle identifier
 * @property {string} [vehicleNimi] - Vehicle name
 * @property {number} [vehiclePuomi] - Pump boom length in meters
 * @property {boolean} [useNoDriverBar] - Whether vehicle allows no-driver operations
 */

/**
 * Driver status object for availability checking
 *
 * @typedef {Object} DayDriver
 * @property {number} personId - Person identifier
 * @property {string} [personFirstName] - First name
 * @property {string} [personLastName] - Last name
 * @property {boolean} pois - Unavailable flag (true=away/on leave)
 * @property {string} [personPvmStatus] - Availability status text (e.g., "Loma", "Sairas")
 * @property {string} [personPvmStatusName] - Alternative status name field
 */

/**
 * Step log entry for tracking dismissed reminders
 *
 * @typedef {Object} StepLog
 * @property {number} keikkaId - Related order ID
 * @property {number} stepLogTypeId - Log type (4,20=order confirmation dismissed, 5=concrete data sent)
 */

/**
 * Validation settings configuration
 *
 * @typedef {Object} ValidationSettings
 * @property {boolean} [enabled] - Master enable/disable (false = skip all validation)
 * @property {Object<string, RuleConfig>} [rules] - Rule-specific configurations
 * @property {Object<string, RuleConfig>} [validationRules] - Alternative rules field (backward compatibility)
 */

/**
 * Individual validation rule configuration
 *
 * @typedef {Object} RuleConfig
 * @property {boolean} enabled - Rule enabled flag
 * @property {number} [priority] - Custom priority level (1-5)
 * @property {boolean} [verifyOnlyOwnOrders] - Only validate orders owned by current user
 */

/**
 * Validation context with lookup data
 *
 * @typedef {Object} ValidationContext
 * @property {Array<Vehicle>|Map<number,Vehicle>} [vehicles] - Vehicle lookup (array or Map)
 * @property {Array<DayDriver>} [dayDrivers] - Driver availability status
 * @property {number} [ownerAsiakasId] - Current user's customer ID
 * @property {ValidationSettings} [validationSettings] - Rule configurations
 * @property {Array<StepLog>} [stepLogData] - Step log entries for dismissed reminders
 * @property {Map<number, CustomerPaymentStatus>} [customerPaymentData] - Customer payment status map (requires Fennoa + Laskutus modules)
 */

/**
 * Customer payment status for payment validation
 *
 * @typedef {Object} CustomerPaymentStatus
 * @property {number} unpaidInvoicesTotal - Total amount of unpaid invoices (€)
 * @property {number} unpaidInvoicesCount - Number of unpaid invoices
 * @property {string} [oldestOverdueDate] - Date of oldest overdue invoice (ISO string)
 */

/**
 * Validation issue with actionable remediation steps
 *
 * @typedef {Object} ValidationIssue
 * @property {string} id - Unique issue identifier (e.g., "MISSING_ASIAKAS")
 * @property {string} type - Issue type (same as id for most cases)
 * @property {string} message - Human-readable Finnish message
 * @property {string} category - Category from CATEGORIES constant
 * @property {number} priority - Priority level (1-5)
 * @property {string|null} field - Related field name for focusing UI
 * @property {ValidationActions} actions - Actionable remediation steps
 * @property {number} [betoniIndex] - Concrete line index if issue relates to specific betoni
 */

/**
 * Actionable remediation steps for validation issues
 *
 * **Action Types:**
 * - click: Open UI for manual correction
 * - autoFix: Automatic correction (API call or data transformation)
 * - dismiss: Mark issue as handled (creates step log entry)
 *
 * @typedef {Object} ValidationActions
 * @property {ActionClick} click - Manual correction action
 * @property {ActionAutoFix} [autoFix] - Automatic fix action (optional)
 * @property {ActionDismiss} [dismiss] - Dismissal action (optional)
 */

/**
 * Click action for manual correction
 *
 * @typedef {Object} ActionClick
 * @property {string} action - Action handler name (e.g., "openAsiakasSelector")
 * @property {string} label - Button text
 * @property {string} description - Tooltip/help text
 * @property {number} [betoniIndex] - Concrete line index if applicable
 */

/**
 * AutoFix action for automatic correction
 *
 * @typedef {Object} ActionAutoFix
 * @property {string} action - Action handler name (e.g., "setStatus")
 * @property {any} [value] - Value for automatic fix
 * @property {number} [requiredPuomi] - Required boom length for vehicle selection
 * @property {string} [field] - Target field name
 * @property {string} label - Button text
 * @property {string} description - Tooltip/help text
 * @property {number} [betoniIndex] - Concrete line index if applicable
 */

/**
 * Dismiss action for marking issue as handled
 *
 * @typedef {Object} ActionDismiss
 * @property {string} action - Action handler name (e.g., "dismissContact")
 * @property {string} label - Button text
 * @property {string} description - Tooltip/help text
 */

/**
 * Validation result with issues and summary
 *
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - True if no issues found
 * @property {Array<ValidationIssue>} issues - Array of validation issues
 * @property {ValidationSummary} summary - Aggregated summary statistics
 */

/**
 * Validation summary statistics
 *
 * @typedef {Object} ValidationSummary
 * @property {number} totalIssues - Total issue count
 * @property {number} critical - Critical priority count (PRIORITY_LEVELS.CRITICAL)
 * @property {number} high - High priority count (PRIORITY_LEVELS.HIGH)
 * @property {number} medium - Medium priority count (PRIORITY_LEVELS.MEDIUM)
 * @property {number} low - Low priority count (PRIORITY_LEVELS.LOW)
 * @property {number} notification - Notification priority count (PRIORITY_LEVELS.NOTIFICATION)
 * @property {Object<string, number>} categories - Issue count by category
 */

const PRIORITY_LEVELS = {
  CRITICAL: 5, // Order cannot be processed
  HIGH: 4, // Significant issues requiring immediate attention
  MEDIUM: 3, // Important validation failures (current equivalent)
  LOW: 2, // Minor issues or recommendations
  NOTIFICATION: 1, // Informational messages
};

const CATEGORIES = {
  BETONI: "betoni", // Concrete specification validation
  ASIAKAS: "asiakas", // Customer information validation
  TYOMAA: "tyomaa", // Worksite and address validation
  CONTACT: "contact", // Contact person and communication validation
  VEHICLE: "vehicle", // Vehicle and equipment validation
  PUMPPARI: "pumppari", // Pump operator and assignment validation
  MUU: "muu", // Other miscellaneous validations
};

/**
 * Validate delivery order (keikka) with comprehensive business rules
 *
 * Main validation entry point. Runs all validation rules and returns detailed
 * results with actionable remediation steps. Pure function with no side effects.
 *
 * **Validation Categories:**
 * 1. Status: Order must be Toimitusvalmis (4) or completed (>=8)
 * 2. Asiakas: Customer information and Y-tunnus
 * 3. Tehdas: Concrete factory/supplier
 * 4. Drivers: Driver assignment and availability
 * 5. Betoni: Concrete specifications and completeness
 * 6. Työmaa: Worksite and address information
 * 7. Contact: Contact person and communication details
 * 8. Vehicle: Vehicle assignment and equipment requirements
 * 9. Muut: Miscellaneous (confirmations, notifications)
 *
 * **Performance Optimizations:**
 * - Creates O(1) lookup Maps for vehicles and drivers
 * - Early returns for missing data or disabled validation
 * - Single-pass validation (no repeated iterations)
 *
 * **Multi-Tenant Security:**
 * - Some rules only apply to own orders (sourceAsiakasId === ownerAsiakasId)
 * - External orders (sourceAsiakasId !== ownerAsiakasId) skip certain validations
 * - Rule-level verifyOnlyOwnOrders setting for granular control
 *
 * @param {Keikka} keikka - Delivery order object to validate
 * @param {ValidationContext} [options={}] - Validation context with lookup data
 * @returns {ValidationResult} Validation result with issues and summary
 *
 * @example
 * // Validate complete order
 * const keikka = {
 *   keikkaId: 123,
 *   keikkaTilaId: 4, // Toimitusvalmis
 *   asiakasId: 456,
 *   asiakasNimi: "Test Oy",
 *   vehicleId: 1,
 *   kuskit: [{ personId: 10 }]
 * };
 * const result = validateKeikka(keikka, {
 *   ownerAsiakasId: 100,
 *   vehicles: vehicleArray,
 *   dayDrivers: driverStatusArray
 * });
 * logger.category('keikkaValidator').info(result.isValid); // true or false
 * logger.category('keikkaValidator').info(result.summary.totalIssues); // 0 if valid
 *
 * @example
 * // Validate with custom settings
 * const settings = {
 *   enabled: true,
 *   rules: {
 *     INCOMPLETE_STATUS: { enabled: true, priority: PRIORITY_LEVELS.CRITICAL },
 *     MISSING_PHONE: { enabled: false } // Disable phone validation
 *   }
 * };
 * const result = validateKeikka(keikka, {
 *   ownerAsiakasId: 100,
 *   validationSettings: settings
 * });
 *
 * @performance O(n+m+k) where n=drivers, m=concrete specs, k=validation rules
 * @see puminet4/src/utils/keikkaValidator.test.js:54 - Empty keikka validation
 * @see puminet4/src/utils/keikkaValidator.test.js:77 - Complete keikka validation
 */
const validateKeikka = (keikka, options = {}) => {
  if (!keikka || typeof keikka !== "object") {
    return {
      isValid: false,
      issues: [
        {
          id: "INVALID_KEIKKA",
          type: "INVALID_KEIKKA",
          message: "Tilaus puuttuu tai on virheellinen",
          category: CATEGORIES.MUU,
          priority: PRIORITY_LEVELS.CRITICAL,
          field: null,
          actions: {
            click: {
              action: "openKeikkaEditor",
              label: "Avaa tilaus",
              description: "Avaa tilauksen muokkausnäkymä",
            },
          },
        },
      ],
      summary: {
        totalIssues: 1,
        critical: 1,
        high: 0,
        medium: 0,
        low: 0,
        notification: 0,
        categories: {
          [CATEGORIES.MUU]: 1,
        },
      },
    };
  }

  const issues = [];
  const {
    vehicles = [],
    dayDrivers = [],
    ownerAsiakasId = null,
    validationSettings = null,
    stepLogData = null,
  } = options;

  // Check if validation is enabled at all
  if (validationSettings && validationSettings.enabled === false) {
    return {
      isValid: true,
      issues: [],
      summary: {
        totalIssues: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        notification: 0,
        categories: {},
      },
    };
  }

  // Create optimized lookup maps with validation
  const vehicleMap = Array.isArray(vehicles)
    ? new Map(vehicles.filter((v) => v && v.vehicleId != null).map((v) => [v.vehicleId, v]))
    : vehicles instanceof Map
      ? vehicles
      : new Map();

  const driverStatusMap =
    Array.isArray(dayDrivers) && dayDrivers.length > 0
      ? new Map(
          dayDrivers
            .filter((driver) => driver && driver.personId != null)
            .map((driver) => [driver.personId, driver])
        )
      : new Map();

  // Run all validation rules
  validateStatus(keikka, issues, validationSettings, ownerAsiakasId);
  validateAsiakas(keikka, issues, ownerAsiakasId, validationSettings);
  validateTehdas(keikka, issues, validationSettings, ownerAsiakasId);
  validateDrivers(keikka, issues, vehicleMap, driverStatusMap, validationSettings, ownerAsiakasId);
  // @ts-ignore
  validateBetoni(keikka, issues, ownerAsiakasId, validationSettings, stepLogData);
  validateTyomaa(keikka, issues, validationSettings, ownerAsiakasId);
  // @ts-ignore
  validateContact(keikka, issues, validationSettings, ownerAsiakasId, stepLogData);
  validateVehicle(keikka, issues, vehicleMap, validationSettings, ownerAsiakasId);
  // @ts-ignore
  validateMuut(keikka, issues, validationSettings, stepLogData, ownerAsiakasId);
  validateCustomerPayments(
    keikka,
    issues,
    // @ts-ignore
    options.customerPaymentData,
    validationSettings,
    ownerAsiakasId
  );
  validateWeather(keikka, issues, validationSettings, ownerAsiakasId);

  // No post-filtering: every issues.push above is already gated by
  // isRuleEnabled (fail-open) and carries its priority from getRulePriority.
  // A post-pass that re-filtered on `!ruleConfig.enabled` used to suppress
  // rules whose saved config lacked an `enabled` key — see the fail-open
  // regression test.
  const summary = calculateSummary(issues);

  return {
    isValid: issues.length === 0,
    issues,
    summary,
  };
};

/**
 * Check if validation rule should execute
 *
 * Determines rule execution based on:
 * 1. Global enabled flag (validationSettings.enabled)
 * 2. Per-rule enabled flag (rules[ruleId].enabled)
 * 3. verifyOnlyOwnOrders flag (order ownership check)
 *
 * **Multi-Tenant Logic:**
 * - If verifyOnlyOwnOrders=true, only validate own orders
 * - Own orders: sourceAsiakasId === ownerAsiakasId
 * - External orders: sourceAsiakasId !== ownerAsiakasId
 *
 * **Default Behavior:** Rules enabled if no settings provided
 *
 * @param {string} ruleId - Rule identifier (e.g., "INCOMPLETE_STATUS")
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @param {Keikka|null} [keikka=null] - Order object for ownership check
 * @param {number|null} [ownerAsiakasId=null] - Current user's customer ID
 * @returns {boolean} True if rule should execute
 *
 * @example
 * // Rule disabled globally
 * const settings = {
 *   rules: { MISSING_PHONE: { enabled: false } }
 * };
 * const enabled = isRuleEnabled("MISSING_PHONE", settings);
 * logger.category('keikkaValidator').info(enabled); // false
 *
 * @example
 * // Rule with verifyOnlyOwnOrders
 * const settings = {
 *   rules: {
 *     MISSING_ASIAKAS_YTUNNUS: {
 *       enabled: true,
 *       verifyOnlyOwnOrders: true // Only for own orders
 *     }
 *   }
 * };
 * const keikka = { sourceAsiakasId: 100 };
 * const ownOrder = isRuleEnabled("MISSING_ASIAKAS_YTUNNUS", settings, keikka, 100);
 * const externalOrder = isRuleEnabled("MISSING_ASIAKAS_YTUNNUS", settings, keikka, 200);
 * logger.category('keikkaValidator').info(ownOrder); // true (own order)
 * logger.category('keikkaValidator').info(externalOrder); // false (external order)
 */
function isRuleEnabled(ruleId, validationSettings, keikka = null, ownerAsiakasId = null) {
  if (!validationSettings) {
    return true; // Default to enabled if no settings
  }

  // Check for both rules and validationRules for backward compatibility
  const rules = validationSettings.rules || validationSettings.validationRules;

  if (!rules) {
    return true; // Default to enabled if no rules
  }

  const ruleConfig = rules[ruleId];

  // Fail-open: a rule absent from the saved config defaults to ENABLED, matching the
  // `defaultEnabled: true` convention in validationRuleDefinitions.js. Only an explicit
  // `enabled: false` disables a rule. (Returning false for unknown rules previously
  // silently killed every validator rule missing from the stale defaults list — and for a
  // safety system, e.g. the sub-zero pumping warning, fail-open is the correct default.)
  if (ruleConfig && ruleConfig.enabled === false) {
    return false; // Explicitly disabled
  }

  // Check if rule should only apply to own orders
  if (ruleConfig && ruleConfig.verifyOnlyOwnOrders && keikka && ownerAsiakasId) {
    return keikka.sourceAsiakasId === ownerAsiakasId;
  }

  return true; // Rule is enabled (explicitly or by default)
}

/**
 * Get configured priority level for validation rule
 *
 * Returns custom priority from settings or default MEDIUM priority.
 * Used during issue creation to respect user-configured priorities.
 *
 * **Priority Levels:**
 * - CRITICAL (5): Order cannot be processed
 * - HIGH (4): Significant issues requiring immediate attention
 * - MEDIUM (3): Important validation failures (default)
 * - LOW (2): Minor issues or recommendations
 * - NOTIFICATION (1): Informational messages
 *
 * **Backward Compatibility:** Supports both `rules` and `validationRules` fields
 *
 * @param {string} ruleId - Rule identifier (e.g., "INCOMPLETE_STATUS")
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @returns {number} Priority level (1-5), defaults to PRIORITY_LEVELS.MEDIUM (3)
 *
 * @example
 * const settings = {
 *   rules: {
 *     INCOMPLETE_STATUS: { priority: PRIORITY_LEVELS.CRITICAL } // 5
 *   }
 * };
 * const priority = getRulePriority("INCOMPLETE_STATUS", settings);
 * logger.category('keikkaValidator').info(priority); // 5 (CRITICAL)
 * const defaultPriority = getRulePriority("UNKNOWN_RULE", settings);
 * logger.category('keikkaValidator').info(defaultPriority); // 3 (MEDIUM - default)
 */
function getRulePriority(ruleId, validationSettings) {
  if (!validationSettings) {
    return PRIORITY_LEVELS.MEDIUM; // Default priority
  }

  // Check for both rules and validationRules for backward compatibility
  const rules = validationSettings.rules || validationSettings.validationRules;

  if (!rules) {
    return PRIORITY_LEVELS.MEDIUM; // Default priority
  }

  const ruleConfig = rules[ruleId];
  if (ruleConfig && typeof ruleConfig.priority === "number") {
    return ruleConfig.priority;
  }

  return PRIORITY_LEVELS.MEDIUM; // Default priority if not configured
}

/**
 * Check if step log entry exists for order
 *
 * Used to determine if user has dismissed a validation reminder.
 * Step logs track user actions like "dismiss contact email warning".
 *
 * **Step Log Type IDs:**
 * - 4, 20: Order confirmation dismissed
 * - 5: Concrete data sent
 *
 * **Use Cases:**
 * - Skip validation if user explicitly dismissed reminder
 * - Check if action was performed (alternative to boolean flags)
 *
 * @param {number} keikkaId - Order identifier
 * @param {Array<number>} stepLogTypeIds - Step log type IDs to check for
 * @param {Array<StepLog>} stepLogData - Array of step log entries
 * @returns {boolean} True if any matching step log exists
 *
 * @example
 * // Check if order confirmation was dismissed
 * const stepLogs = [
 *   { keikkaId: 123, stepLogTypeId: 4 },
 *   { keikkaId: 456, stepLogTypeId: 5 }
 * ];
 * const dismissed = hasStepLog(123, [4, 20], stepLogs);
 * logger.category('keikkaValidator').info(dismissed); // true (stepLogTypeId 4 found)
 * const notDismissed = hasStepLog(789, [4, 20], stepLogs);
 * logger.category('keikkaValidator').info(notDismissed); // false (no matching entry)
 *
 * @performance O(n) where n=stepLogData length
 */
function hasStepLog(keikkaId, stepLogTypeIds, stepLogData) {
  if (!stepLogData || !Array.isArray(stepLogData) || !keikkaId) {
    return false;
  }

  return stepLogData.some(
    (log) => log.keikkaId === keikkaId && stepLogTypeIds.includes(log.stepLogTypeId)
  );
}

/**
 * Validate order status is ready for delivery
 *
 * **Business Rule:** Order must be "Toimitusvalmis" (4) or completed (>=8)
 * to be considered valid for processing.
 *
 * **Status IDs:**
 * - 4: Toimitusvalmis (ready for delivery)
 * - >= 8: Completed statuses
 * - < 4: Incomplete (draft, planning, etc.)
 *
 * **AutoFix:** Can automatically set status to Toimitusvalmis (4)
 *
 * @param {Keikka} keikka - Order to validate
 * @param {Array<ValidationIssue>} issues - Issues array (mutated)
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @param {number|null} ownerAsiakasId - Current user's customer ID
 * @returns {void} Mutates issues array
 *
 * @example
 * const keikka = { keikkaTilaId: 2, keikkaTilaSelite: "Luonnos" };
 * const issues = [];
 * validateStatus(keikka, issues, null, 100);
 * logger.category('keikkaValidator').info(issues[0].type); // "INCOMPLETE_STATUS"
 * logger.category('keikkaValidator').info(issues[0].actions.autoFix.value); // 4 (Toimitusvalmis)
 */
function validateStatus(keikka, issues, validationSettings, ownerAsiakasId) {
  // Status should be Toimitusvalmis (4) or completed (>=8)
  if (keikka.keikkaTilaId !== 4 && keikka.keikkaTilaId < 8) {
    if (isRuleEnabled("INCOMPLETE_STATUS", validationSettings, keikka, ownerAsiakasId)) {
      issues.push({
        id: "INCOMPLETE_STATUS",
        type: "INCOMPLETE_STATUS",
        message: `Tila: ${keikka.keikkaTilaSelite || "Ei tilaa"}`,
        category: CATEGORIES.MUU,
        priority: getRulePriority("INCOMPLETE_STATUS", validationSettings),
        field: "keikkaTilaId",
        actions: {
          click: {
            action: "openStatusSelector",
            label: "Muuta tilaa",
            description: "Avaa tilan valitsin",
          },
          autoFix: {
            action: "setStatus",
            value: 4,
            label: "Aseta Toimitusvalmis",
            description: "Aseta tilaksi Toimitusvalmis automaattisesti",
          },
        },
      });
    }
  }
}

/**
 * Validate customer (asiakas) information
 *
 * **Validation Rules:**
 * 1. Customer ID must exist (asiakasId > 0)
 * 2. Customer name must be present
 * 3. Y-tunnus required for own company orders
 *
 * **Multi-Tenant Logic:**
 * - Own orders (sourceAsiakasId === ownerAsiakasId): Strict validation including Y-tunnus
 * - External orders: Relaxed validation (no Y-tunnus requirement)
 *
 * **Early Return:** Stops validation if customer ID missing (no point validating details)
 *
 * **Finnish Business Context:**
 * - Y-tunnus: Finnish business identifier (format: 1234567-8)
 * - Required for invoicing and legal compliance
 *
 * @param {Keikka} keikka - Order to validate
 * @param {Array<ValidationIssue>} issues - Issues array (mutated)
 * @param {number|null} ownerAsiakasId - Current user's customer ID
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @returns {void} Mutates issues array
 *
 * @example
 * // Missing customer
 * const keikka = { asiakasId: 0, sourceAsiakasId: 100 };
 * const issues = [];
 * validateAsiakas(keikka, issues, 100, null);
 * logger.category('keikkaValidator').info(issues[0].type); // "MISSING_OMA_ASIAKAS"
 *
 * @example
 * // Missing Y-tunnus (own order)
 * const keikka = {
 *   asiakasId: 456,
 *   asiakasNimi: "Test Oy",
 *   ytunnus: "", // Missing
 *   sourceAsiakasId: 100
 * };
 * const issues = [];
 * validateAsiakas(keikka, issues, 100, null);
 * logger.category('keikkaValidator').info(issues[0].type); // "MISSING_ASIAKAS_YTUNNUS"
 */
function validateAsiakas(keikka, issues, ownerAsiakasId, validationSettings) {
  const hasMissingAsiakas = !keikka.asiakasId || keikka.asiakasId === 0;

  if (hasMissingAsiakas) {
    // Determine if this is own company order or external order
    const isOwnOrder = keikka.sourceAsiakasId === ownerAsiakasId;
    const validationId = isOwnOrder ? "MISSING_OMA_ASIAKAS" : "MISSING_VIERAS_ASIAKAS";
    const message = "Asiakas puuttuu";

    if (isRuleEnabled(validationId, validationSettings, keikka, ownerAsiakasId)) {
      issues.push({
        id: validationId,
        type: validationId,
        message: message,
        category: CATEGORIES.ASIAKAS,
        priority: getRulePriority(validationId, validationSettings),
        field: "asiakasId",
        actions: {
          click: {
            action: "openAsiakasSelector",
            label: "Valitse asiakas",
            description: "Avaa asiakasvalitsin",
          },
        },
      });
    }
    return; // Early return - no need to validate further customer details
  }

  // Customer name validation
  if (!keikka.asiakasNimi || keikka.asiakasNimi.trim() === "") {
    if (isRuleEnabled("MISSING_ASIAKAS_NIMI", validationSettings, keikka, ownerAsiakasId)) {
      issues.push({
        id: "MISSING_ASIAKAS_NIMI",
        type: "MISSING_ASIAKAS_NIMI",
        message: "Asiakkaan nimi puuttuu",
        category: CATEGORIES.ASIAKAS,
        priority: getRulePriority("MISSING_ASIAKAS_NIMI", validationSettings),
        field: "asiakasNimi",
        actions: {
          click: {
            action: "openAsiakasEditor",
            label: "Muokkaa asiakasta",
            description: "Avaa asiakkaan muokkausnäkymä",
          },
        },
      });
    }
  }

  // Y-tunnus validation (only for own company orders)
  if (
    keikka.sourceAsiakasId === ownerAsiakasId &&
    (!keikka.ytunnus || keikka.ytunnus.trim() === "")
  ) {
    if (isRuleEnabled("MISSING_ASIAKAS_YTUNNUS", validationSettings, keikka, ownerAsiakasId)) {
      issues.push({
        id: "MISSING_ASIAKAS_YTUNNUS",
        type: "MISSING_ASIAKAS_YTUNNUS",
        message: "Asiakkaan Y-tunnus puuttuu",
        category: CATEGORIES.ASIAKAS,
        priority: getRulePriority("MISSING_ASIAKAS_YTUNNUS", validationSettings),
        field: "ytunnus",
        actions: {
          click: {
            action: "openAsiakasEditor",
            label: "Muokkaa asiakasta",
            description: "Avaa asiakkaan muokkausnäkymä",
          },
        },
      });
    }
  }
}

/**
 * Validate concrete factory/supplier (tehdas)
 *
 * **Business Rule:** Every order must specify a concrete factory/supplier
 * for production and delivery coordination.
 *
 * **Validation Logic:** Either betoniAsiakasNimi OR betoniAsiakasId must exist
 *
 * **AutoFix:** Can fetch nearest factory based on delivery address
 *
 * @param {Keikka} keikka - Order to validate
 * @param {Array<ValidationIssue>} issues - Issues array (mutated)
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @param {number|null} ownerAsiakasId - Current user's customer ID
 * @returns {void} Mutates issues array
 *
 * @example
 * const keikka = {
 *   betoniAsiakasId: null,
 *   betoniAsiakasNimi: "" // Both missing
 * };
 * const issues = [];
 * validateTehdas(keikka, issues, null, 100);
 * logger.category('keikkaValidator').info(issues[0].type); // "MISSING_FACTORY"
 * logger.category('keikkaValidator').info(issues[0].actions.autoFix.action); // "fetchDefaultFactory"
 */
function validateTehdas(keikka, issues, validationSettings, ownerAsiakasId) {
  if (!keikka.betoniAsiakasNimi && !keikka.betoniAsiakasId) {
    if (isRuleEnabled("MISSING_FACTORY", validationSettings, keikka, ownerAsiakasId)) {
      issues.push({
        id: "MISSING_FACTORY",
        type: "MISSING_FACTORY",
        message: "Tehdas puuttuu",
        category: CATEGORIES.BETONI,
        priority: getRulePriority("MISSING_FACTORY", validationSettings),
        field: "betoniAsiakasId",
        actions: {
          click: {
            action: "openFactorySelector",
            label: "Valitse tehdas",
            description: "Avaa tehtaan valitsin",
          },
          autoFix: {
            action: "fetchDefaultFactory",
            label: "Hae lähin tehdas",
            description: "Hae automaattisesti lähin tehdas",
          },
        },
      });
    }
  }
}

/**
 * Validate driver assignment and availability
 *
 * **Validation Rules:**
 * 1. Driver must be assigned (unless vehicle allows no-driver operation)
 * 2. Assigned drivers must be available (not pois=true)
 *
 * **Vehicle Configuration:**
 * - useNoDriverBar=false: Driver required (shows NO_DRIVER warning)
 * - useNoDriverBar=true: Driver optional (no warning)
 *
 * **Driver Availability:**
 * - Checks dayDrivers status (pois flag)
 * - Shows status text (e.g., "Loma", "Sairas")
 * - Uses optimized Map lookup for O(1) performance
 *
 * **AutoFix:** Can assign default driver from day schedule
 *
 * @param {Keikka} keikka - Order to validate
 * @param {Array<ValidationIssue>} issues - Issues array (mutated)
 * @param {Map<number,Vehicle>} vehicleMap - Vehicle lookup map
 * @param {Map<number,DayDriver>} driverStatusMap - Driver status lookup map
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @param {number|null} ownerAsiakasId - Current user's customer ID
 * @returns {void} Mutates issues array
 *
 * @example
 * // No driver assigned
 * const keikka = { vehicleId: 1, kuskit: [] };
 * const vehicleMap = new Map([[1, { vehicleId: 1, useNoDriverBar: false }]]);
 * const issues = [];
 * validateDrivers(keikka, issues, vehicleMap, new Map(), null, 100);
 * logger.category('keikkaValidator').info(issues[0].type); // "NO_DRIVER"
 *
 * @example
 * // Driver unavailable
 * const keikka = {
 *   vehicleId: 1,
 *   kuskit: [{ personId: 10, personFirstName: "Matti", personLastName: "Meikäläinen" }]
 * };
 * const driverMap = new Map([[10, { personId: 10, pois: true, personPvmStatus: "Loma" }]]);
 * const issues = [];
 * validateDrivers(keikka, issues, new Map(), driverMap, null, 100);
 * logger.category('keikkaValidator').info(issues[0].type); // "DRIVER_NOT_AVAILABLE"
 * logger.category('keikkaValidator').info(issues[0].message); // "Kuljettaja: Matti Meikäläinen - Loma"
 *
 * @performance O(n) where n=number of assigned drivers
 */
function validateDrivers(
  keikka,
  issues,
  vehicleMap,
  driverStatusMap,
  validationSettings,
  ownerAsiakasId
) {
  if (!keikka.kuskit || keikka.kuskit.length === 0) {
    // Check if vehicle allows no driver
    const vehicle = vehicleMap.get(keikka.vehicleId);
    const shouldShowNoDriverWarning = vehicle?.useNoDriverBar !== false;

    if (
      shouldShowNoDriverWarning &&
      isRuleEnabled("NO_DRIVER", validationSettings, keikka, ownerAsiakasId)
    ) {
      issues.push({
        id: "NO_DRIVER",
        type: "NO_DRIVER",
        message: "Kuski puuttuu",
        category: CATEGORIES.VEHICLE,
        priority: getRulePriority("NO_DRIVER", validationSettings),
        field: "kuskit",
        actions: {
          click: {
            action: "openDriverSelector",
            label: "Valitse kuski",
            description: "Avaa kuljettajan valitsin",
          },
          autoFix: {
            action: "assignDefaultDriver",
            label: "Aseta oletuskuski",
            description: "Aseta automaattisesti oletuskuski päivän aikataulusta",
          },
        },
      });
    }
  } else if (driverStatusMap.size > 0) {
    // Check driver availability using pre-built map
    keikka.kuskit.forEach((kuski, index) => {
      if (kuski && kuski.personId) {
        const driverData = driverStatusMap.get(kuski.personId);
        if (
          driverData &&
          driverData.pois &&
          isRuleEnabled("DRIVER_NOT_AVAILABLE", validationSettings, keikka, ownerAsiakasId)
        ) {
          const driverName = `${kuski.personFirstName || ""} ${kuski.personLastName || ""}`.trim();
          const statusText =
            driverData.personPvmStatus || driverData.personPvmStatusName || "Ei saatavilla";

          issues.push({
            id: `DRIVER_NOT_AVAILABLE_${kuski.personId}`,
            type: "DRIVER_NOT_AVAILABLE",
            message: `Kuljettaja: ${driverName} - ${statusText}`,
            category: CATEGORIES.VEHICLE,
            priority: getRulePriority("DRIVER_NOT_AVAILABLE", validationSettings),
            field: `kuskit[${index}]`,
            actions: {
              click: {
                action: "openDriverSelector",
                label: "Vaihda kuljettaja",
                description: "Avaa kuljettajan valitsin",
              },
            },
          });
        }
      }
    });
  }
}

/**
 * Validate concrete (betoni) specifications
 *
 * **Multi-Tenant Security:** Only validates own company orders (early return for external)
 *
 * **Validation Rules:**
 * 1. Concrete specifications must exist (betonit array)
 * 2. Each concrete spec must have m3 > 0
 * 3. Long pump lines (>20m) require 8mm or hieno16mm aggregate
 * 4. Concrete must be validated (betoniVahvistettu=true)
 * 5. Concrete data must be sent (betonitiedotLahetetty or step log)
 *
 * **Pump Line Logic:**
 * - pumppuLinja > 20m requires specific aggregate sizes
 * - raeKokoId=4 (8mm) or raeKokoId=2 (hieno16mm) are valid
 * - Ensures concrete can be pumped through long lines
 *
 * **Validation Status:**
 * - betoniVahvistettu=true: Confirmed (no warning)
 * - betoniVahvistettu=false: Needs validation (show warning)
 * - betoniVahvistettu=null: Unknown (no warning, considered acceptable)
 *
 * **Step Log Integration:**
 * - stepLogTypeId=5: Concrete data sent (alternative to flag)
 *
 * @param {Keikka} keikka - Order to validate
 * @param {Array<ValidationIssue>} issues - Issues array (mutated)
 * @param {number|null} ownerAsiakasId - Current user's customer ID
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @param {Array<StepLog>} stepLogData - Step log entries
 * @returns {void} Mutates issues array
 *
 * @example
 * // Missing concrete specs
 * const keikka = {
 *   betonit: [],
 *   sourceAsiakasId: 100 // Own order
 * };
 * const issues = [];
 * validateBetoni(keikka, issues, 100, null, []);
 * logger.category('keikkaValidator').info(issues[0].type); // "INCOMPLETE_CONCRETE"
 *
 * @example
 * // Long pump line with invalid aggregate
 * const keikka = {
 *   pumppuLinja: 25, // >20m
 *   betonit: [{ m3: 6.5, raeKokoId: 1, raeKokoSelite: "16mm" }],
 *   sourceAsiakasId: 100
 * };
 * const issues = [];
 * validateBetoni(keikka, issues, 100, null, []);
 * logger.category('keikkaValidator').info(issues[0].type); // "PUMP_LINE_CONCRETE_TYPE"
 * logger.category('keikkaValidator').info(issues[0].message); // "Betoni ei ole linjapumpattavaa (25m 16mm)"
 *
 * @example
 * // Concrete needs validation
 * const keikka = {
 *   betonit: [{ m3: 6.5, betoniVahvistettu: false }],
 *   sourceAsiakasId: 100
 * };
 * const issues = [];
 * validateBetoni(keikka, issues, 100, null, []);
 * logger.category('keikkaValidator').info(issues[0].type); // "INCOMPLETE_BETONI_VALIDATION"
 * logger.category('keikkaValidator').info(issues[0].message); // "Määrä / laatu varmistus"
 *
 * @performance O(n) where n=number of concrete specs
 * @see puminet4/src/utils/keikkaValidator.test.js:205 - Pump line validation tests
 */
function validateBetoni(keikka, issues, ownerAsiakasId, validationSettings, stepLogData) {
  // Early return for external orders
  if (keikka.sourceAsiakasId !== ownerAsiakasId) return;

  if (!keikka.betonit || !Array.isArray(keikka.betonit) || keikka.betonit.length === 0) {
    if (isRuleEnabled("INCOMPLETE_CONCRETE", validationSettings, keikka, ownerAsiakasId)) {
      issues.push({
        id: "INCOMPLETE_CONCRETE",
        type: "INCOMPLETE_CONCRETE",
        message: "Betonitiedot puuttuvat",
        category: CATEGORIES.BETONI,
        priority: getRulePriority("INCOMPLETE_CONCRETE", validationSettings),
        field: "betonit",
        actions: {
          click: {
            action: "openBetoniEditor",
            label: "Lisää betoni",
            description: "Avaa betonin muokkausnäkymä",
          },
          autoFix: {
            action: "validateBetoni",
            label: "Vahvista betonitiedot",
            description: "Vahvista nykyiset betonitiedot",
          },
        },
      });
    }
    return; // Early return - no concrete data to validate further
  }

  // Check each betoni for completeness
  keikka.betonit.forEach((betoni, index) => {
    if (!betoni.m3 || betoni.m3 <= 0) {
      if (isRuleEnabled("MISSING_CONCRETE_M3", validationSettings, keikka, ownerAsiakasId)) {
        issues.push({
          id: `MISSING_CONCRETE_M3_${index}`,
          type: "MISSING_CONCRETE_M3",
          message: `Betonin määrä puuttuu (${index + 1}.)`,
          category: CATEGORIES.BETONI,
          priority: getRulePriority("MISSING_CONCRETE_M3", validationSettings),
          field: `betonit[${index}].m3`,
          actions: {
            click: {
              action: "openBetoniEditor",
              betoniIndex: index,
              label: "Muokkaa betonia",
              description: "Avaa betonin muokkausnäkymä",
            },
          },
        });
      }
    }
  });

  // Pump line validation - check if pumppuLinja > 20m requires 8mm or hieno16mm concrete
  if (
    // @ts-ignore
    keikka.pumppuLinja > 20 &&
    isRuleEnabled("PUMP_LINE_CONCRETE_TYPE", validationSettings, keikka, ownerAsiakasId)
  ) {
    const has8mmOrHieno16mm = keikka.betonit.some(
      (betoni) => betoni.raeKokoId === 4 || betoni.raeKokoId === 2
    );

    if (!has8mmOrHieno16mm) {
      // Get aggregate size description from the first concrete entry with safe access
      const raeKokoSelite =
        keikka.betonit.length > 0 && keikka.betonit[0]?.raeKokoSelite
          ? keikka.betonit[0].raeKokoSelite
          : "16mm";

      issues.push({
        id: "PUMP_LINE_CONCRETE_TYPE",
        type: "PUMP_LINE_CONCRETE_TYPE",
        message: `Betoni ei ole linjapumpattavaa (${keikka.pumppuLinja}m ${raeKokoSelite})`,
        category: CATEGORIES.BETONI,
        priority: getRulePriority("PUMP_LINE_CONCRETE_TYPE", validationSettings),
        field: "betonit",
        actions: {
          click: {
            action: "openBetoniEditor",
            label: "Muokkaa betonia",
            description: "Avaa betonin muokkausnäkymä",
          },
          dismiss: {
            action: "dismissPumpLineConcrete",
            label: "Ohita linjapumpattavuus-varoitus",
            description: "Merkitse linjapumpattavuus-varoitus käsitellyksi",
          },
        },
      });
    }
  }

  // Betoni completeness validation - check if betoni is validated
  keikka.betonit.forEach((betoni, index) => {
    // Skip if betoni is already confirmed (true)
    if (betoni.betoniVahvistettu === true) return;

    // Only check if betoniVahvistettu is explicitly false (not null)
    if (
      betoni.betoniVahvistettu === false &&
      isRuleEnabled("INCOMPLETE_BETONI_VALIDATION", validationSettings, keikka, ownerAsiakasId)
    ) {
      // Show "Määrä / laatu varmistus" message for false values
      issues.push({
        id: `INCOMPLETE_BETONI_VALIDATION_${index}`,
        type: "INCOMPLETE_BETONI_VALIDATION",
        message: "Määrä / laatu varmistus",
        category: CATEGORIES.BETONI,
        priority: getRulePriority("INCOMPLETE_BETONI_VALIDATION", validationSettings),
        field: `betonit[${index}].betoniVahvistettu`,
        betoniIndex: index,
        actions: {
          click: {
            action: "openGridKeikkaEditor",
            betoniIndex: index,
            label: "Avaa betonin muokkaus",
            description: "Avaa tilauksen betonin vahvistus",
          },
          autoFix: {
            action: "acceptBetoni",
            betoniIndex: index,
            label: "Hyväksy betoni",
            description: "Aseta betoni 'Määrä ja laatu vahvistettu'",
          },
        },
      });
    }
  });

  // Concrete data not sent - check both flag and step log
  const hasConcreteDataSent =
    keikka.betonitiedotLahetetty || hasStepLog(keikka.keikkaId, [5], stepLogData);

  if (
    !hasConcreteDataSent &&
    isRuleEnabled("CONCRETE_DATA_NOT_SENT", validationSettings, keikka, ownerAsiakasId)
  ) {
    issues.push({
      id: "CONCRETE_DATA_NOT_SENT",
      type: "CONCRETE_DATA_NOT_SENT",
      message: "Betonitiedot lähettämättä",
      category: CATEGORIES.BETONI,
      priority: getRulePriority("CONCRETE_DATA_NOT_SENT", validationSettings),
      field: "betonitiedotLahetetty",
      actions: {
        click: {
          action: "openSendBetonitiedot",
          label: "Lähetä betonitiedot",
          description: "Avaa betonitietojen lähetys",
        },
        autoFix: {
          action: "sendBetonitiedot",
          label: "Lähetä heti",
          description: "Lähetä betonitiedot automaattisesti",
        },
        dismiss: {
          action: "dismissBetonitiedot",
          label: "Ohita lähetys-varoitus",
          description: "Merkitse lähetys-varoitus käsitellyksi",
        },
      },
    });
  }
}

/**
 * Detect Helsinki abbreviation (HKI) in address fields
 *
 * **Finnish Address Pattern:** "HKI" is common abbreviation for Helsinki
 * that should be expanded to full city name for proper address validation.
 *
 * **Search Fields:**
 * - osoite, tyomaaOsoite, tyomaaOsoite1-4
 * - postinumero
 * - kaupunki
 *
 * **Pattern Matching:**
 * - Case-insensitive
 * - Word boundary matching (\b)
 * - Detects: HKI, Helsinki, Espoo, Vantaa, Kauniainen, Kirkkonummi, Sipoo, Kerava, Tuusula, Järvenpää
 *
 * **Use Cases:**
 * - Enable Helsinki autofix for missing city
 * - Detect city in address before geocoding
 *
 * @param {Keikka} keikka - Order with address fields
 * @returns {boolean} True if HKI pattern or major city found in address
 *
 * @example
 * // HKI found in city field
 * const keikka = { kaupunki: "HKI" };
 * logger.category('keikkaValidator').info(checkForHkiPattern(keikka)); // true
 *
 * @example
 * // Helsinki found in address
 * const keikka = { osoite: "Mannerheimintie 1, Helsinki" };
 * logger.category('keikkaValidator').info(checkForHkiPattern(keikka)); // true
 *
 * @example
 * // No pattern found
 * const keikka = { osoite: "Rantatie 5", kaupunki: "Turku" };
 * logger.category('keikkaValidator').info(checkForHkiPattern(keikka)); // false
 *
 * @performance O(1) - regex check on fixed number of fields
 */
function checkForHkiPattern(keikka) {
  const k = /** @type {any} */ (keikka);
  // Check all address-related fields for HKI pattern or full city names
  const fieldsToCheck = [
    k.osoite,
    k.tyomaaOsoite,
    k.tyomaaOsoite1,
    k.tyomaaOsoite2,
    k.tyomaaOsoite3,
    k.tyomaaOsoite4,
    k.postinumero,
    k.kaupunki,
  ];

  // Case-insensitive check for HKI pattern or full city names (Helsinki, Espoo, Vantaa, Kauniainen, Kirkkonummi, Sipoo, Kerava, Tuusula, Järvenpää)
  const cityPattern =
    /\b(HKI|Helsinki|Espoo|Vantaa|Kauniainen|Kirkkonummi|Sipoo|Kerava|Tuusula|Järvenpää)\b/i;

  return fieldsToCheck.some((field) => {
    if (!field || typeof field !== "string") return false;
    return cityPattern.test(field);
  });
}

/**
 * Validate worksite (työmaa) and address information
 *
 * **Validation Rules:**
 * 1. Worksite must exist (tyomaaId, tyomaa, or tyomaaNimi)
 * 2. Address must be present
 * 3. Postal code must be present
 * 4. City must be present
 * 5. City cannot be "HKI" (must be expanded to "Helsinki")
 *
 * **Field Name Variations:**
 * - Address: osoite, tyomaaOsoite, tyomaaOsoite1
 * - Postal code: postinumero, tyomaaOsoite3
 * - City: kaupunki, tyomaaOsoite4
 *
 * **HKI Pattern Detection:**
 * - Detects "HKI" in city field specifically
 * - Detects HKI pattern in any address field
 * - Enables Helsinki autofix when pattern found
 *
 * **AutoFix Options:**
 * 1. geoCodeAddress: Fetch missing city/postal code from address
 * 2. convertHkiToHelsinki: Convert "HKI" → "Helsinki"
 * 3. fetchTyomaaAddress: Fetch from worksite master data
 *
 * **Conditional AutoFix:**
 * - Geocoding requires at least one field (city OR postal code)
 * - Both missing: No geocoding autofix available
 *
 * @param {Keikka} keikka - Order to validate
 * @param {Array<ValidationIssue>} issues - Issues array (mutated)
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @param {number|null} ownerAsiakasId - Current user's customer ID
 * @returns {void} Mutates issues array
 *
 * @example
 * // Missing worksite
 * const keikka = {
 *   tyomaaId: null,
 *   tyomaa: "",
 *   tyomaaNimi: ""
 * };
 * const issues = [];
 * validateTyomaa(keikka, issues, null, 100);
 * logger.category('keikkaValidator').info(issues[0].type); // "MISSING_WORKSITE"
 *
 * @example
 * // HKI in city field
 * const keikka = {
 *   tyomaaId: 1,
 *   osoite: "Mannerheimintie 1",
 *   postinumero: "00100",
 *   kaupunki: "HKI" // Should be Helsinki
 * };
 * const issues = [];
 * validateTyomaa(keikka, issues, null, 100);
 * logger.category('keikkaValidator').info(issues[0].type); // "CITY_IS_HKI"
 * logger.category('keikkaValidator').info(issues[0].actions.autoFix.action); // "convertHkiToHelsinki"
 *
 * @example
 * // Missing city with HKI pattern detected
 * const keikka = {
 *   tyomaaId: 1,
 *   osoite: "Address in HKI area",
 *   postinumero: "00100",
 *   kaupunki: "" // Missing
 * };
 * const issues = [];
 * validateTyomaa(keikka, issues, null, 100);
 * logger.category('keikkaValidator').info(issues[0].type); // "MISSING_WORKSITE_TOWN"
 * logger.category('keikkaValidator').info(issues[0].message); // "Kaupunki puuttuu (kaupunki havaittu osoitteessa)"
 * logger.category('keikkaValidator').info(issues[0].actions.autoFix.value); // "Helsinki"
 *
 * @performance O(1) - fixed field checks
 */
function validateTyomaa(keikka, issues, validationSettings, ownerAsiakasId) {
  const k = /** @type {any} */ (keikka);
  // Check if worksite exists - tyomaaId is the key field
  if (
    !k.tyomaaId &&
    (!k.tyomaa || k.tyomaa.trim() === "") &&
    (!k.tyomaaNimi || k.tyomaaNimi.trim() === "")
  ) {
    if (isRuleEnabled("MISSING_WORKSITE", validationSettings, keikka, ownerAsiakasId)) {
      issues.push({
        id: "MISSING_WORKSITE",
        type: "MISSING_WORKSITE",
        message: "Työmaa puuttuu",
        category: CATEGORIES.TYOMAA,
        priority: getRulePriority("MISSING_WORKSITE", validationSettings),
        field: "tyomaaId",
        actions: {
          click: {
            action: "openTyomaaSelector",
            label: "Valitse työmaa",
            description: "Avaa työmaiden valitsin",
          },
          dismiss: {
            action: "dismissTyomaa",
            label: "Ohita työmaa-varoitus",
            description: "Merkitse työmaa-varoitus käsitellyksi",
          },
        },
      });
    }
    return; // Early return - no worksite to validate address details for
  }

  // Address validation - check multiple possible field names
  const hasAddress =
    (k.osoite && k.osoite.trim() !== "") ||
    (k.tyomaaOsoite && k.tyomaaOsoite.trim() !== "") ||
    (k.tyomaaOsoite1 && k.tyomaaOsoite1.trim() !== "");

  if (!hasAddress && isRuleEnabled("MISSING_ADDRESS", validationSettings, keikka, ownerAsiakasId)) {
    issues.push({
      id: "MISSING_ADDRESS",
      type: "MISSING_ADDRESS",
      message: "Osoite puuttuu",
      category: CATEGORIES.TYOMAA,
      priority: getRulePriority("MISSING_ADDRESS", validationSettings),
      field: "osoite",
      actions: {
        click: {
          action: "openTyomaaEditor",
          label: "Muokkaa työmaata",
          description: "Avaa työmaiden muokkausnäkymä",
        },
        dismiss: {
          action: "dismissAddress",
          label: "Ohita osoite-varoitus",
          description: "Merkitse osoite-varoitus käsitellyksi",
        },
      },
    });
  }

  // Postal code validation - check multiple possible field names
  const hasPostalCode =
    (k.postinumero && k.postinumero.trim() !== "") ||
    (k.tyomaaOsoite3 && k.tyomaaOsoite3.trim() !== "");

  // City validation - check multiple possible field names
  const hasCity =
    (k.kaupunki && k.kaupunki.trim() !== "") || (k.tyomaaOsoite4 && k.tyomaaOsoite4.trim() !== "");

  // Check if HKI pattern exists in address fields
  const hasHkiPattern = checkForHkiPattern(keikka);

  // Check if city field specifically contains HKI (needs correction even if city is "present")
  const cityIsHki =
    (k.kaupunki && /^\s*HKI\s*$/i.test(k.kaupunki)) ||
    (k.tyomaaOsoite4 && /^\s*HKI\s*$/i.test(k.tyomaaOsoite4));

  // Check if both postal code and city are missing to determine autofix availability
  const bothMissing = !hasPostalCode && !hasCity;

  if (
    !hasPostalCode &&
    isRuleEnabled("MISSING_WORKSITE_POST", validationSettings, keikka, ownerAsiakasId)
  ) {
    const actions = {
      click: {
        action: "openTyomaaEditor",
        label: "Muokkaa työmaata",
        description: "Avaa työmaiden muokkausnäkymä",
      },
      dismiss: {
        action: "dismissPostinumero",
        label: "Ohita postinumero-varoitus",
        description: "Merkitse postinumero-varoitus käsitellyksi",
      },
    };

    // Only add autoFix if city is available for geocoding
    if (!bothMissing) {
      actions.autoFix = {
        action: "geoCodeAddress",
        field: "postinumero",
        label: "Hae postinumero",
        description: "Hae postinumero osoitteen perusteella",
      };
    }

    issues.push({
      id: "MISSING_WORKSITE_POST",
      type: "MISSING_WORKSITE_POST",
      message: "Postinumero puuttuu",
      category: CATEGORIES.TYOMAA,
      priority: getRulePriority("MISSING_WORKSITE_POST", validationSettings),
      field: "postinumero",
      actions,
    });
  }

  // Check if city contains HKI that should be corrected to Helsinki
  if (cityIsHki && isRuleEnabled("CITY_IS_HKI", validationSettings, keikka, ownerAsiakasId)) {
    issues.push({
      id: "CITY_IS_HKI",
      type: "CITY_IS_HKI",
      message: "Kaupunki on HKI (pitäisi olla Helsinki)",
      category: CATEGORIES.TYOMAA,
      priority: getRulePriority("CITY_IS_HKI", validationSettings),
      field: "kaupunki",
      actions: {
        click: {
          action: "openTyomaaEditor",
          label: "Muokkaa työmaata",
          description: "Avaa työmaiden muokkausnäkymä",
        },
        autoFix: {
          action: "convertHkiToHelsinki",
          field: "kaupunki",
          label: "Korjaa HKI → Helsinki",
          description: "Muuta HKI-lyhenne Helsingiksi",
        },
        dismiss: {
          action: "dismissHki",
          label: "Ohita HKI-varoitus",
          description: "Merkitse HKI-varoitus käsitellyksi",
        },
      },
      // @ts-ignore
      hasHkiFix: true,
    });
  }

  if (
    !hasCity &&
    isRuleEnabled("MISSING_WORKSITE_TOWN", validationSettings, keikka, ownerAsiakasId)
  ) {
    const actions = {
      click: {
        action: "openTyomaaEditor",
        label: "Muokkaa työmaata",
        description: "Avaa työmaiden muokkausnäkymä",
      },
      dismiss: {
        action: "dismissKaupunki",
        label: "Ohita kaupunki-varoitus",
        description: "Merkitse kaupunki-varoitus käsitellyksi",
      },
    };

    // If HKI pattern is detected, add autoFix to set city to Helsinki
    if (hasHkiPattern) {
      actions.autoFix = {
        action: "convertHkiToHelsinki",
        field: "kaupunki",
        value: "Helsinki",
        label: "Aseta Helsinki",
        description: "Aseta kaupungiksi Helsinki (HKI havaittu)",
      };
    }
    // Otherwise, only add geocoding autoFix if postal code is available
    else if (!bothMissing) {
      actions.autoFix = {
        action: "geoCodeAddress",
        field: "kaupunki",
        label: "Hae kaupunki",
        description: "Hae kaupunki osoitteen perusteella",
      };
    }

    issues.push({
      id: "MISSING_WORKSITE_TOWN",
      type: "MISSING_WORKSITE_TOWN",
      message: hasHkiPattern
        ? "Kaupunki puuttuu (kaupunki havaittu osoitteessa)"
        : "Kaupunki puuttuu",
      category: CATEGORIES.TYOMAA,
      priority: getRulePriority("MISSING_WORKSITE_TOWN", validationSettings),
      field: "kaupunki",
      actions,
      // @ts-ignore
      hasHkiFix: hasHkiPattern, // Flag for UI to show city fix button
    });
  }
}

/**
 * Validate contact person and communication details
 *
 * **Validation Rules:**
 * 1. Contact person name must exist
 * 2. Phone number must exist
 * 3. Email address must exist and be valid format
 *
 * **Email Validation:**
 * - Uses isValidEmail() from statics1
 * - Checks format validity (not just presence)
 * - Distinguishes: missing vs invalid email
 *
 * **Field Name Variations:**
 * - Name: yhteyshenkiloNimi, personFirstName+personLastName, keikkaContactPersonId
 * - Phone: yhteyshenkiloPuhelin, personPhone
 * - Email: yhteyshenkiloEmail, personEmail, contactPersonEmail
 *
 * **Step Log Integration:**
 * - stepLogTypeId=4,20: Contact email reminder dismissed
 * - Skips email validation if dismissed
 *
 * **Early Return:** Skips phone validation if contact person missing
 *
 * **AutoFix:**
 * - fetchContactPhone: Fetch from person master data
 *
 * @param {Keikka} keikka - Order to validate
 * @param {Array<ValidationIssue>} issues - Issues array (mutated)
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @param {number|null} ownerAsiakasId - Current user's customer ID
 * @param {Array<StepLog>} stepLogData - Step log entries
 * @returns {void} Mutates issues array
 *
 * @example
 * // Missing contact person
 * const keikka = { yhteyshenkiloNimi: "" };
 * const issues = [];
 * validateContact(keikka, issues, null, 100, []);
 * logger.category('keikkaValidator').info(issues[0].type); // "MISSING_CONTACT_PERSON"
 *
 * @example
 * // Invalid email format
 * const keikka = {
 *   yhteyshenkiloNimi: "Pekka Test",
 *   yhteyshenkiloPuhelin: "050-1234567",
 *   yhteyshenkiloEmail: "invalid-email" // Invalid format
 * };
 * const issues = [];
 * validateContact(keikka, issues, null, 100, []);
 * logger.category('keikkaValidator').info(issues[0].type); // "MISSING_CONTACT_EMAIL"
 * logger.category('keikkaValidator').info(issues[0].message); // "Sähköpostiosoite ei ole kelvollinen"
 *
 * @example
 * // Email reminder dismissed
 * const keikka = {
 *   keikkaId: 123,
 *   yhteyshenkiloNimi: "Pekka Test",
 *   yhteyshenkiloEmail: "" // Missing
 * };
 * const stepLogs = [{ keikkaId: 123, stepLogTypeId: 20 }]; // Dismissed
 * const issues = [];
 * validateContact(keikka, issues, null, 100, stepLogs);
 * logger.category('keikkaValidator').info(issues.length); // 0 (validation skipped due to dismissal)
 *
 * @performance O(1) - fixed field checks
 */
function validateContact(keikka, issues, validationSettings, ownerAsiakasId, stepLogData) {
  const k = /** @type {any} */ (keikka);
  // Check for contact person - can be in different field names depending on context
  const hasContactName =
    (k.yhteyshenkiloNimi && k.yhteyshenkiloNimi.trim() !== "") ||
    (k.personFirstName && k.personLastName) ||
    k.keikkaContactPersonId;

  if (
    !hasContactName &&
    isRuleEnabled("MISSING_CONTACT_PERSON", validationSettings, keikka, ownerAsiakasId)
  ) {
    issues.push({
      id: "MISSING_CONTACT_PERSON",
      type: "MISSING_CONTACT_PERSON",
      message: "Yhteyshenkilö puuttuu",
      category: CATEGORIES.CONTACT,
      priority: getRulePriority("MISSING_CONTACT_PERSON", validationSettings),
      field: "yhteyshenkiloNimi",
      actions: {
        click: {
          action: "openContactEditor",
          label: "Lisää yhteyshenkilö",
          description: "Avaa yhteyshenkilön muokkausnäkymä",
        },
        dismiss: {
          action: "dismissContact",
          label: "Ohita yhteyshenkilö-varoitus",
          description: "Merkitse yhteyshenkilö-varoitus käsitellyksi",
        },
      },
    });
    return; // Early return - no contact person to validate phone for
  }

  // Check for phone number - can be in different field names
  const hasContactPhone =
    (k.yhteyshenkiloPuhelin && k.yhteyshenkiloPuhelin.trim() !== "") ||
    (k.personPhone && k.personPhone.trim() !== "");

  if (
    !hasContactPhone &&
    isRuleEnabled("MISSING_PHONE", validationSettings, keikka, ownerAsiakasId)
  ) {
    issues.push({
      id: "MISSING_PHONE",
      type: "MISSING_PHONE",
      message: "Puhelinnumero puuttuu",
      category: CATEGORIES.CONTACT,
      priority: getRulePriority("MISSING_PHONE", validationSettings),
      field: "yhteyshenkiloPuhelin",
      actions: {
        click: {
          action: "openContactEditor",
          label: "Lisää puhelinnumero",
          description: "Avaa yhteyshenkilön muokkausnäkymä",
        },
        autoFix: {
          action: "fetchContactPhone",
          label: "Hae puhelinnumero",
          description: "Hae puhelinnumero yhteyshenkilötiedoista",
        },
        dismiss: {
          action: "dismissPhone",
          label: "Ohita puhelin-varoitus",
          description: "Merkitse puhelin-varoitus käsitellyksi",
        },
      },
    });
  }

  // Check for email address - can be in different field names and validate format
  const contactEmailFields = [k.yhteyshenkiloEmail, k.personEmail, k.contactPersonEmail];

  const hasValidContactEmail = contactEmailFields.some(
    (email) => email && email.trim() !== "" && isValidEmail(email.trim())
  );

  // Check if there's any email field with content (even if invalid)
  const hasAnyEmailContent = contactEmailFields.some((email) => email && email.trim() !== "");

  // Check if contact email reminder has been dismissed via stepLog (uses same stepLogTypeId as order confirmation)
  const hasContactEmailDismissed = hasStepLog(keikka.keikkaId, [4, 20], stepLogData);

  if (
    hasContactName && // Only check email if contact person exists
    !hasValidContactEmail &&
    !hasContactEmailDismissed && // Skip if reminder has been dismissed
    isRuleEnabled("MISSING_CONTACT_EMAIL", validationSettings, keikka, ownerAsiakasId)
  ) {
    // Determine message based on whether email exists but is invalid, or is completely missing
    const message = hasAnyEmailContent
      ? "Sähköpostiosoite ei ole kelvollinen"
      : "Sähköpostiosoite puuttuu";

    issues.push({
      id: "MISSING_CONTACT_EMAIL",
      type: "MISSING_CONTACT_EMAIL",
      message: message,
      category: CATEGORIES.CONTACT,
      priority: getRulePriority("MISSING_CONTACT_EMAIL", validationSettings),
      field: "yhteyshenkiloEmail",
      actions: {
        click: {
          action: "openPersonEditor",
          label: "Muokkaa yhteyshenkilöä",
          description: "Avaa henkilön muokkausnäkymä",
        },
        dismiss: {
          action: "dismissContactEmail",
          label: "Poista muistutus",
          description: "Merkitse sähköposti-varoitus käsitellyksi",
        },
      },
    });
  }
}

/**
 * Validate vehicle equipment requirements
 *
 * **Validation Rules:**
 * 1. Vehicle boom must be long enough for required pump boom
 *
 * **Business Logic:**
 * - requiredPuomi (pumppuPuomi): Pump boom length required by job
 * - vehiclePuomi: Vehicle's actual boom length
 * - Validation fails if: requiredPuomi > vehiclePuomi
 *
 * **Edge Cases:**
 * - Skips validation if either value is 0 (undefined requirement)
 * - Uses vehicleMap for O(1) lookup
 *
 * **AutoFix:** Can automatically select vehicle with longer boom
 *
 * @param {Keikka} keikka - Order to validate
 * @param {Array<ValidationIssue>} issues - Issues array (mutated)
 * @param {Map<number,Vehicle>} vehicleMap - Vehicle lookup map
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @param {number|null} ownerAsiakasId - Current user's customer ID
 * @returns {void} Mutates issues array
 *
 * @example
 * // Boom too short
 * const keikka = {
 *   vehicleId: 1,
 *   pumppuPuomi: 20 // Requires 20m
 * };
 * const vehicleMap = new Map([[1, { vehicleId: 1, vehiclePuomi: 15 }]]); // Only 15m
 * const issues = [];
 * validateVehicle(keikka, issues, vehicleMap, null, 100);
 * logger.category('keikkaValidator').info(issues[0].type); // "VEHICLE_BOOM_TOO_SHORT"
 * logger.category('keikkaValidator').info(issues[0].message); // "Puomi ei riitä (20m > 15m)"
 * logger.category('keikkaValidator').info(issues[0].actions.autoFix.requiredPuomi); // 20
 *
 * @performance O(1) - single Map lookup
 * @see puminet4/src/utils/keikkaValidator.test.js:152 - Boom validation test
 */
function validateVehicle(keikka, issues, vehicleMap, validationSettings, ownerAsiakasId) {
  // Check if vehicle boom is too short
  const vehicle = vehicleMap.get(keikka.vehicleId);
  const vehiclePuomi = vehicle?.vehiclePuomi || 0;
  const requiredPuomi = keikka.pumppuPuomi || 0;

  if (
    requiredPuomi > vehiclePuomi &&
    vehiclePuomi > 0 &&
    requiredPuomi > 0 &&
    isRuleEnabled("VEHICLE_BOOM_TOO_SHORT", validationSettings, keikka, ownerAsiakasId)
  ) {
    issues.push({
      id: "VEHICLE_BOOM_TOO_SHORT",
      type: "VEHICLE_BOOM_TOO_SHORT",
      message: `Puomi ei riitä (${requiredPuomi}m > ${vehiclePuomi}m)`,
      category: CATEGORIES.VEHICLE,
      priority: getRulePriority("VEHICLE_BOOM_TOO_SHORT", validationSettings),
      field: "vehicleId",
      actions: {
        click: {
          action: "openVehicleSelector",
          label: "Vaihda ajoneuvo",
          description: "Avaa ajoneuvon valitsin",
        },
        dismiss: {
          action: "dismissBoom",
          label: "Ohita puomi-varoitus",
          description: "Merkitse puomi-varoitus käsitellyksi",
        },
      },
    });
  }

  // MISSING_BOOM_LENGTH — null only; 0 is intentional "no boom" (line-only job)
  if (
    keikka.pumppuPuomi == null &&
    isRuleEnabled("MISSING_BOOM_LENGTH", validationSettings, keikka, ownerAsiakasId)
  ) {
    const vehicleForBoom = vehicleMap.get(keikka.vehicleId);
    const vehicleBoomLength = vehicleForBoom?.vehiclePuomi || 0;
    const boomIssue = {
      id: "MISSING_BOOM_LENGTH",
      type: "MISSING_BOOM_LENGTH",
      message: "Vähimmäispuomia ei ole määritelty",
      category: CATEGORIES.VEHICLE,
      priority: getRulePriority("MISSING_BOOM_LENGTH", validationSettings),
      field: "pumppuPuomi",
      actions: {
        click: {
          action: "openGridKeikkaEditor",
          label: "Avaa pumppuasetukset",
          description: "Avaa tilaus pumppu-välilehdelle",
        },
      },
    };
    if (vehicleBoomLength > 0) {
      boomIssue.actions.autoFix = {
        field: "pumppuPuomi",
        value: vehicleBoomLength,
        label: `Aseta ${vehicleBoomLength}m (ajoneuvon puomi)`,
        description: "Aseta puomiksi ajoneuvon puomin pituus",
      };
    }
    issues.push(boomIssue);
  }

  // MISSING_LINE_LENGTH — null only; 0 is intentional "no line" (boom-only job)
  if (
    keikka.pumppuLinja == null &&
    isRuleEnabled("MISSING_LINE_LENGTH", validationSettings, keikka, ownerAsiakasId)
  ) {
    const lineIssue = {
      id: "MISSING_LINE_LENGTH",
      type: "MISSING_LINE_LENGTH",
      message: "Linjaa ei ole määritelty",
      category: CATEGORIES.VEHICLE,
      priority: getRulePriority("MISSING_LINE_LENGTH", validationSettings),
      field: "pumppuLinja",
      actions: {
        click: {
          action: "openGridKeikkaEditor",
          label: "Avaa pumppuasetukset",
          description: "Avaa tilaus pumppu-välilehdelle",
        },
      },
    };
    // Autofix only when boom is filled. Spec: null boom -> no line autofix.
    if (keikka.pumppuPuomi != null) {
      const lineValue = keikka.pumppuPuomi === 0 ? 30 : 0;
      const lineLabel =
        keikka.pumppuPuomi === 0 ? "Laita 30m linjaa" : "Laita roikosta, 0m linjaa";
      lineIssue.actions.autoFix = {
        field: "pumppuLinja",
        value: lineValue,
        label: lineLabel,
        description: lineLabel,
      };
    }
    issues.push(lineIssue);
  }
}

/**
 * Validate miscellaneous requirements (order confirmation)
 *
 * **Validation Rules:**
 * 1. Order confirmation must be sent (if valid email exists)
 *
 * **Conditional Validation:**
 * - Only validates if contact has valid email address
 * - Skips if no email to send confirmation to
 *
 * **Step Log Integration:**
 * - stepLogTypeId=4,20: Order confirmation dismissed or sent
 * - Alternative to tilausvahvistusLahetetty flag
 *
 * **Email Validation:**
 * - Checks multiple email fields (yhteyshenkiloEmail, personEmail, contactPersonEmail)
 * - Uses isValidEmail() for format validation
 *
 * **AutoFix:** Can send order confirmation automatically
 *
 * @param {Keikka} keikka - Order to validate
 * @param {Array<ValidationIssue>} issues - Issues array (mutated)
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @param {Array<StepLog>} stepLogData - Step log entries
 * @param {number|null} ownerAsiakasId - Current user's customer ID
 * @returns {void} Mutates issues array
 *
 * @example
 * // Order confirmation not sent (with valid email)
 * const keikka = {
 *   keikkaId: 123,
 *   tilausvahvistusLahetetty: false,
 *   yhteyshenkiloEmail: "pekka@example.com"
 * };
 * const issues = [];
 * validateMuut(keikka, issues, null, [], 100);
 * logger.category('keikkaValidator').info(issues[0].type); // "ORDER_CONFIRMATION_NOT_SENT"
 * logger.category('keikkaValidator').info(issues[0].actions.autoFix.action); // "sendTilausvahvistus"
 *
 * @example
 * // No email - no validation
 * const keikka = {
 *   tilausvahvistusLahetetty: false,
 *   yhteyshenkiloEmail: "" // No email
 * };
 * const issues = [];
 * validateMuut(keikka, issues, null, [], 100);
 * logger.category('keikkaValidator').info(issues.length); // 0 (skipped, no email to send to)
 *
 * @performance O(1) - fixed field checks
 */
function validateMuut(keikka, issues, validationSettings, stepLogData, ownerAsiakasId) {
  const k = /** @type {any} */ (keikka);
  // Order confirmation not sent - check both flag and step log
  const hasOrderConfirmationSent =
    k.tilausvahvistusLahetetty || hasStepLog(k.keikkaId, [4, 20], stepLogData);

  // Check if there's a valid email address to send confirmation to
  const contactEmailFields = [k.yhteyshenkiloEmail, k.personEmail, k.contactPersonEmail];

  const hasValidContactEmail = contactEmailFields.some(
    (email) => email && email.trim() !== "" && isValidEmail(email.trim())
  );

  // Only show order confirmation validation if there's a valid email to send to
  if (
    !hasOrderConfirmationSent &&
    hasValidContactEmail && // Only validate if we have a valid email
    isRuleEnabled("ORDER_CONFIRMATION_NOT_SENT", validationSettings, keikka, ownerAsiakasId)
  ) {
    issues.push({
      id: "ORDER_CONFIRMATION_NOT_SENT",
      type: "ORDER_CONFIRMATION_NOT_SENT",
      message: "Tilausvahvistus lähettämättä",
      category: CATEGORIES.MUU,
      priority: getRulePriority("ORDER_CONFIRMATION_NOT_SENT", validationSettings),
      field: "tilausvahvistusLahetetty",
      actions: {
        click: {
          action: "openSendTilausvahvistus",
          label: "Lähetä vahvistus",
          description: "Avaa tilausvahvistuksen lähetys",
        },
        autoFix: {
          action: "sendTilausvahvistus",
          label: "Lähetä heti",
          description: "Lähetä tilausvahvistus automaattisesti",
        },
        dismiss: {
          action: "dismissTilausvahvistus",
          label: "Ohita vahvistus-varoitus",
          description: "Merkitse vahvistus-varoitus käsitellyksi",
        },
      },
    });
  }
}

/**
 * Validate customer payment status
 *
 * **Business Rule:** Warn when customer has unpaid invoices exceeding €1000
 *
 * **Prerequisites:**
 * - customerPaymentData must be provided (Map<asiakasId, paymentStatus>)
 * - Only validates own orders (sourceAsiakasId === ownerAsiakasId)
 * - Caller must check Fennoa + Laskutus modules are enabled before passing data
 *
 * **Payment Status Object:**
 * - unpaidInvoicesTotal: Total amount of unpaid invoices
 * - unpaidInvoicesCount: Number of unpaid invoices
 * - oldestOverdueDate: Date of oldest overdue invoice
 *
 * @param {Keikka} keikka - Order to validate
 * @param {Array<ValidationIssue>} issues - Issues array (mutated)
 * @param {Map<number, Object>|null} customerPaymentData - Customer payment status map
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @param {number|null} ownerAsiakasId - Current user's customer ID
 * @returns {void} Mutates issues array
 *
 * @example
 * const paymentData = new Map([
 *   [123, { unpaidInvoicesTotal: 1500, unpaidInvoicesCount: 3 }]
 * ]);
 * const keikka = { asiakasId: 123, sourceAsiakasId: 100 };
 * const issues = [];
 * validateCustomerPayments(keikka, issues, paymentData, null, 100);
 * logger.category('keikkaValidator').info(issues[0].type); // "CUSTOMER_PAYMENTS_LATE"
 */
function validateCustomerPayments(
  keikka,
  issues,
  customerPaymentData,
  validationSettings,
  ownerAsiakasId
) {
  // Early return if no payment data provided (modules not enabled or not fetched)
  if (!customerPaymentData || !(customerPaymentData instanceof Map)) {
    return;
  }

  // Early return for external orders (only validate own orders)
  if (keikka.sourceAsiakasId !== ownerAsiakasId) {
    return;
  }

  // Check if rule is enabled
  if (!isRuleEnabled("CUSTOMER_PAYMENTS_LATE", validationSettings, keikka, ownerAsiakasId)) {
    return;
  }

  // Get customer's payment status
  const asiakasId = keikka.asiakasId;
  if (!asiakasId || asiakasId === 0) {
    return; // No customer assigned
  }

  const paymentStatus = customerPaymentData.get(asiakasId);
  if (!paymentStatus) {
    return; // No payment data for this customer
  }

  // Threshold for warning (€1000)
  const THRESHOLD = 1000;

  if (paymentStatus.unpaidInvoicesTotal >= THRESHOLD) {
    // Format currency for display
    const formattedAmount = new Intl.NumberFormat("fi-FI", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(paymentStatus.unpaidInvoicesTotal);

    issues.push({
      id: "CUSTOMER_PAYMENTS_LATE",
      type: "CUSTOMER_PAYMENTS_LATE",
      message: `Maksamattomia laskuja: ${formattedAmount} (${paymentStatus.unpaidInvoicesCount || 1} kpl)`,
      category: CATEGORIES.ASIAKAS,
      priority: getRulePriority("CUSTOMER_PAYMENTS_LATE", validationSettings),
      field: "asiakasId",
      actions: {
        click: {
          action: "openAsiakasPaymentDetails",
          label: "Näytä maksutiedot",
          description: "Avaa asiakkaan maksutilanne",
        },
        // No dismiss or autoFix - this validation cannot be bypassed
      },
    });
  }
}

/**
 * Validate weather conditions for safe pumping
 *
 * **Business Rule:** Pumping is prohibited below -15°C
 * This is a safety constraint for concrete pumping operations.
 *
 * **Temperature Source Priority:**
 * 1. weatherTemp (average temperature during pumping period)
 * 2. Minimum of weatherStartTemp and weatherEndTemp (fallback)
 *
 * @param {Keikka} keikka - Order to validate
 * @param {Array<ValidationIssue>} issues - Issues array (mutated)
 * @param {ValidationSettings|null} validationSettings - Settings configuration
 * @param {number|null} ownerAsiakasId - Current user's customer ID
 * @returns {void} Mutates issues array
 *
 * @example
 * const keikka = { weatherTemp: -20 }; // Severe cold
 * const issues = [];
 * validateWeather(keikka, issues, null, 100);
 * logger.category('keikkaValidator').info(issues[0].type); // "SEVERE_COLD_WARNING"
 */
function validateWeather(keikka, issues, validationSettings, ownerAsiakasId) {
  const k = /** @type {any} */ (keikka);
  const { weatherTemp, weatherStartTemp, weatherEndTemp } = k;

  // Check for severe cold (use min temp - catches coldest period)
  if (isRuleEnabled("SEVERE_COLD_WARNING", validationSettings, keikka, ownerAsiakasId)) {
    const coldTemp =
      weatherTemp ?? Math.min(weatherStartTemp ?? Infinity, weatherEndTemp ?? Infinity);

    if (isSevereCold(coldTemp)) {
      issues.push({
        id: "SEVERE_COLD_WARNING",
        type: "SEVERE_COLD_WARNING",
        message: `Pakkasvaroitus: Pumppaus ei suositella (${coldTemp.toFixed(1)}°C < ${SEVERE_COLD_THRESHOLD}°C)`,
        category: CATEGORIES.MUU,
        priority: getRulePriority("SEVERE_COLD_WARNING", validationSettings),
        field: "weatherTemp",
        actions: {
          click: {
            action: "openWeatherDisplay",
            label: "Näytä sää",
            description: "Avaa sääennuste",
          },
        },
      });
    }
  }

  // Check for severe hot / heat wave (use max temp - catches hottest period)
  if (isRuleEnabled("SEVERE_HOT_WARNING", validationSettings, keikka, ownerAsiakasId)) {
    const hotTemp =
      weatherTemp ?? Math.max(weatherStartTemp ?? -Infinity, weatherEndTemp ?? -Infinity);

    if (isSevereHot(hotTemp)) {
      issues.push({
        id: "SEVERE_HOT_WARNING",
        type: "SEVERE_HOT_WARNING",
        message: `Hellevaroitus: Tauotus vaaditaan (${hotTemp.toFixed(1)}°C ≥ ${SEVERE_HOT_THRESHOLD}°C)`,
        category: CATEGORIES.MUU,
        priority: getRulePriority("SEVERE_HOT_WARNING", validationSettings),
        field: "weatherTemp",
        actions: {
          click: {
            action: "openWeatherDisplay",
            label: "Näytä sää",
            description: "Avaa sääennuste",
          },
        },
      });
    }
  }
}

/**
 * Calculate validation summary statistics
 *
 * Aggregates validation issues into summary object with:
 * - Total issue count
 * - Breakdown by priority level
 * - Breakdown by category
 *
 * **Summary Structure:**
 * - totalIssues: Total count
 * - critical, high, medium, low, notification: Priority counts
 * - categories: Object with category counts
 *
 * @param {Array<ValidationIssue>} issues - Filtered validation issues
 * @returns {ValidationSummary} Summary statistics
 *
 * @example
 * const issues = [
 *   { priority: PRIORITY_LEVELS.CRITICAL, category: CATEGORIES.ASIAKAS },
 *   { priority: PRIORITY_LEVELS.MEDIUM, category: CATEGORIES.BETONI },
 *   { priority: PRIORITY_LEVELS.MEDIUM, category: CATEGORIES.BETONI }
 * ];
 * const summary = calculateSummary(issues);
 * logger.category('keikkaValidator').info(summary.totalIssues); // 3
 * logger.category('keikkaValidator').info(summary.critical); // 1
 * logger.category('keikkaValidator').info(summary.medium); // 2
 * logger.category('keikkaValidator').info(summary.categories.betoni); // 2
 *
 * @performance O(n) where n=number of issues
 */
function calculateSummary(issues) {
  const summary = {
    totalIssues: issues.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    notification: 0,
    categories: {},
  };

  issues.forEach((issue) => {
    // Count by priority
    switch (issue.priority) {
      case PRIORITY_LEVELS.CRITICAL:
        summary.critical++;
        break;
      case PRIORITY_LEVELS.HIGH:
        summary.high++;
        break;
      case PRIORITY_LEVELS.MEDIUM:
        summary.medium++;
        break;
      case PRIORITY_LEVELS.LOW:
        summary.low++;
        break;
      case PRIORITY_LEVELS.NOTIFICATION:
        summary.notification++;
        break;
    }

    // Count by category
    if (!summary.categories[issue.category]) {
      summary.categories[issue.category] = 0;
    }
    summary.categories[issue.category]++;
  });

  return summary;
}

/**
 * Get Finnish display name for priority level
 *
 * **Priority Names:**
 * - CRITICAL (5): "Kriittinen"
 * - HIGH (4): "Korkea"
 * - MEDIUM (3): "Keskitaso"
 * - LOW (2): "Matala"
 * - NOTIFICATION (1): "Huomautus"
 *
 * @param {number} priority - Priority level (1-5)
 * @returns {string} Finnish display name
 *
 * @example
 * logger.category('keikkaValidator').info(getPriorityName(PRIORITY_LEVELS.CRITICAL)); // "Kriittinen"
 * logger.category('keikkaValidator').info(getPriorityName(99)); // "Tuntematon" (unknown)
 */
const getPriorityName = (priority) => {
  switch (priority) {
    case PRIORITY_LEVELS.CRITICAL:
      return "Kriittinen";
    case PRIORITY_LEVELS.HIGH:
      return "Korkea";
    case PRIORITY_LEVELS.MEDIUM:
      return "Keskitaso";
    case PRIORITY_LEVELS.LOW:
      return "Matala";
    case PRIORITY_LEVELS.NOTIFICATION:
      return "Huomautus";
    default:
      return "Tuntematon";
  }
};

/**
 * Get Material-UI color for priority level
 *
 * **Consistent UI Theming:** Used across all validation components
 * for unified visual priority representation.
 *
 * **Color Mapping:**
 * - CRITICAL (5): "error" (red)
 * - HIGH (4): "warning" (orange)
 * - MEDIUM (3): "info" (blue)
 * - LOW (2): "success" (green)
 * - NOTIFICATION (1): "default" (gray)
 *
 * @param {number} priority - Priority level (1-5)
 * @returns {string} Material-UI color name
 *
 * @example
 * const color = getPriorityColor(PRIORITY_LEVELS.CRITICAL);
 * // Use in MUI component:
 * // <Chip color={color} label="Kriittinen" />
 */
const getPriorityColor = (priority) => {
  switch (priority) {
    case PRIORITY_LEVELS.CRITICAL:
      return "error";
    case PRIORITY_LEVELS.HIGH:
      return "warning";
    case PRIORITY_LEVELS.MEDIUM:
      return "info";
    case PRIORITY_LEVELS.LOW:
      return "success";
    case PRIORITY_LEVELS.NOTIFICATION:
      return "default";
    default:
      return "default";
  }
};

/**
 * Get Finnish display name for validation category
 *
 * **Category Names:**
 * - BETONI: "Betoni"
 * - ASIAKAS: "Asiakas"
 * - TYOMAA: "Työmaa"
 * - CONTACT: "Yhteystieto"
 * - VEHICLE: "Ajoneuvo"
 * - PUMPPARI: "Pumppari"
 * - MUU: "Muu"
 *
 * @param {string} category - Category constant from CATEGORIES
 * @returns {string} Finnish display name
 *
 * @example
 * logger.category('keikkaValidator').info(getCategoryName(CATEGORIES.BETONI)); // "Betoni"
 * logger.category('keikkaValidator').info(getCategoryName("unknown")); // "Tuntematon"
 */
const getCategoryName = (category) => {
  switch (category) {
    case CATEGORIES.BETONI:
      return "Betoni";
    case CATEGORIES.ASIAKAS:
      return "Asiakas";
    case CATEGORIES.TYOMAA:
      return "Työmaa";
    case CATEGORIES.CONTACT:
      return "Yhteystieto";
    case CATEGORIES.VEHICLE:
      return "Ajoneuvo";
    case CATEGORIES.PUMPPARI:
      return "Pumppari";
    case CATEGORIES.MUU:
      return "Muu";
    default:
      return "Tuntematon";
  }
};

module.exports = { validateKeikka, PRIORITY_LEVELS, CATEGORIES, getPriorityName, getPriorityColor, getCategoryName };
