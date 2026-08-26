/**
 * Tests and usage examples for keikkaValidator
 */

import { validateKeikka, PRIORITY_LEVELS } from "./keikkaValidator";
import { VALIDATION_RULE_DEFINITIONS } from "./validationRuleDefinitions.js";
import { getDefaultValidationRulesSettings } from "./validationRuleDefinitions.js";

// Test data examples
const createTestKeikka = (overrides = {}) => ({
  keikkaId: 1,
  keikkaTilaId: 2, // Incomplete status
  keikkaTilaSelite: "Luonnos",
  asiakasId: null,
  asiakasNimi: "",
  ytunnus: "",
  sourceAsiakasId: 123,
  betoniAsiakasId: null,
  betoniAsiakasNimi: "",
  kuskit: [],
  vehicleId: 1,
  vehicleKoko: 8,
  betonit: [],
  tyomaaId: null,
  tyomaa: "",
  osoite: "",
  postinumero: "",
  kaupunki: "",
  yhteyshenkiloNimi: "",
  yhteyshenkiloPuhelin: "",
  betonitiedotLahetetty: false,
  tilausvahvistusLahetetty: false,
  pumppuPuomi: null,
  pumppuLinja: null,
  ...overrides,
});

const testContext = {
  vehicles: [
    {
      vehicleId: 1,
      vehicleNimi: "Betoni-1",
      vehicleKoko: 8,
      vehiclePuomi: 15,
      useNoDriverBar: true,
    },
    {
      vehicleId: 2,
      vehicleNimi: "Betoni-2",
      vehicleKoko: 12,
      vehiclePuomi: 25,
      useNoDriverBar: false,
    },
  ],
  dayDrivers: [
    { personId: 1, personFirstName: "Matti", personLastName: "Meikäläinen", pois: false },
    {
      personId: 2,
      personFirstName: "Liisa",
      personLastName: "Virtanen",
      pois: true,
      personPvmStatus: "Loma",
    },
  ],
  ownerAsiakasId: 123,
};

// Test cases
describe("keikkaValidator", () => {
  test("validates empty keikka with all critical issues", () => {
    const keikka = createTestKeikka();
    const result = validateKeikka(keikka, testContext);

    // Note: Default priority for validation rules is MEDIUM, not CRITICAL
    // Should have multiple validation issues (mostly medium priority)
    expect(result.isValid).toBe(false);
    expect(result.summary.totalIssues).toBeGreaterThan(5);
    // Most issues will be MEDIUM priority by default
    expect(result.summary.medium).toBeGreaterThan(0);

    result.issues.forEach((_issue) => {
      void 0;
    });
  });

  test("validates complete keikka with no issues", () => {
    const completeKeikka = createTestKeikka({
      keikkaTilaId: 4, // Toimitusvalmis
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      ytunnus: "1234567-8",
      betoniAsiakasId: 789,
      betoniAsiakasNimi: "Betoniasema Oy",
      kuskit: [
        {
          personId: 1,
          personFirstName: "Matti",
          personLastName: "Meikäläinen",
        },
      ],
      betonit: [
        {
          betoniId: 1,
          m3: 6.5,
          laatuNimi: "K30",
          betoniVahvistettu: true, // Must be true to pass validation
        },
      ],
      tyomaaId: 101,
      tyomaa: "Test Työmaa",
      osoite: "Testitie 1",
      postinumero: "00100",
      kaupunki: "Helsinki",
      yhteyshenkiloNimi: "Pekka Yhteyshenkilö",
      yhteyshenkiloPuhelin: "050-1234567",
      yhteyshenkiloEmail: "pekka@example.com", // Add valid email to avoid email validation issues
      betonitiedotLahetetty: true,
      tilausvahvistusLahetetty: true,
      pumppuPuomi: 15, // match vehicle boom length (vehicleId: 1 has 15m), prevents MISSING_BOOM_LENGTH
      pumppuLinja: 0, // intentional "no line" — prevents MISSING_LINE_LENGTH without triggering it
    });

    const result = validateKeikka(completeKeikka, testContext);

    if (!result.isValid && result.issues.length > 0) {
      result.issues.forEach((_issue) => {
        void 0;
      });
    }

    expect(result.isValid).toBe(true);
    expect(result.summary.totalIssues).toBe(0);
  });

  test("validates driver availability issue", () => {
    const keikkaWithUnavailableDriver = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      kuskit: [
        {
          personId: 2, // Driver who is on leave
          personFirstName: "Liisa",
          personLastName: "Virtanen",
        },
      ],
      tyomaaId: 101,
      tyomaa: "Test Työmaa",
    });

    const result = validateKeikka(keikkaWithUnavailableDriver, testContext);

    const driverIssue = result.issues.find((issue) => issue.type === "DRIVER_NOT_AVAILABLE");
    if (driverIssue) {
      void 0;
    }

    expect(result.issues.some((issue) => issue.type === "DRIVER_NOT_AVAILABLE")).toBe(true);
  });

  test("validates vehicle boom length issue", () => {
    const keikkaWithShortBoom = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      vehicleId: 1, // Vehicle with 15m boom
      pumppuPuomi: 20, // Requires 20m boom
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaWithShortBoom, testContext);

    const vehicleIssue = result.issues.find((issue) => issue.type === "VEHICLE_BOOM_TOO_SHORT");
    if (vehicleIssue) {
      void 0;
    }

    expect(result.issues.some((issue) => issue.type === "VEHICLE_BOOM_TOO_SHORT")).toBe(true);
  });

  test("validates priority levels distribution", () => {
    const keikka = createTestKeikka();
    const result = validateKeikka(keikka, testContext);

    // Should have issues across different priority levels
    expect(
      result.summary.critical + result.summary.high + result.summary.medium + result.summary.low
    ).toBe(result.summary.totalIssues);
  });

  test("validates category distribution", () => {
    const keikka = createTestKeikka();
    const result = validateKeikka(keikka, testContext);

    Object.entries(result.summary.categories).forEach(([_category, _count]) => {
      void 0;
    });

    // Should have issues across different categories
    const totalCategoryIssues = Object.values(result.summary.categories).reduce(
      (sum, count) => sum + count,
      0
    );
    expect(totalCategoryIssues).toBe(result.summary.totalIssues);
  });

  test("validates pump line concrete type requirement", () => {
    const keikkaWithLongPumpLine = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      pumppuLinja: 25, // Long pump line >20m
      betonit: [
        {
          betoniId: 1,
          m3: 6.5,
          raeKokoId: 1, // Not 8mm (4) or hieno16mm (2)
          raeKokoSelite: "16mm",
        },
      ],
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaWithLongPumpLine, testContext);

    const pumpLineIssue = result.issues.find((issue) => issue.type === "PUMP_LINE_CONCRETE_TYPE");
    if (pumpLineIssue) {
      void 0;
    }

    expect(result.issues.some((issue) => issue.type === "PUMP_LINE_CONCRETE_TYPE")).toBe(true);
    expect(pumpLineIssue.message).toBe("Betoni ei ole linjapumpattavaa (25m 16mm)");
  });

  test("validates pump line concrete type - valid with 8mm concrete", () => {
    const keikkaWith8mmConcrete = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      pumppuLinja: 25, // Long pump line >20m
      betonit: [
        {
          betoniId: 1,
          m3: 6.5,
          raeKokoId: 4, // 8mm concrete - should be valid
        },
      ],
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaWith8mmConcrete, testContext);

    const _pumpLineIssue = result.issues.find((issue) => issue.type === "PUMP_LINE_CONCRETE_TYPE");

    expect(result.issues.some((issue) => issue.type === "PUMP_LINE_CONCRETE_TYPE")).toBe(false);
  });

  test("validates pump line concrete type - valid with hieno16mm concrete", () => {
    const keikkaWithHieno16mm = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      pumppuLinja: 25, // Long pump line >20m
      betonit: [
        {
          betoniId: 1,
          m3: 6.5,
          raeKokoId: 2, // hieno16mm concrete - should be valid
        },
      ],
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaWithHieno16mm, testContext);

    const _pumpLineIssue = result.issues.find((issue) => issue.type === "PUMP_LINE_CONCRETE_TYPE");

    expect(result.issues.some((issue) => issue.type === "PUMP_LINE_CONCRETE_TYPE")).toBe(false);
  });

  // SEVERE_COLD_WARNING tests
  test("validates severe cold warning - triggers at -20°C", () => {
    const keikkaWithSevereCold = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      weatherTemp: -20, // Severe cold
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaWithSevereCold, testContext);

    const coldIssue = result.issues.find((issue) => issue.type === "SEVERE_COLD_WARNING");
    if (coldIssue) {
      void 0;
    }

    expect(result.issues.some((issue) => issue.type === "SEVERE_COLD_WARNING")).toBe(true);
    expect(coldIssue.message).toContain("-20.0°C");
    // Default priority is MEDIUM when no validationSettings are provided
    // Priority is HIGH when using default settings from validationRuleDefinitions.js
    expect(coldIssue.priority).toBe(PRIORITY_LEVELS.MEDIUM);
  });

  test("validates severe cold warning - no warning at -15°C (boundary)", () => {
    const keikkaAtBoundary = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      weatherTemp: -15, // Exactly at threshold - should NOT trigger
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaAtBoundary, testContext);

    const _coldIssue = result.issues.find((issue) => issue.type === "SEVERE_COLD_WARNING");

    expect(result.issues.some((issue) => issue.type === "SEVERE_COLD_WARNING")).toBe(false);
  });

  test("validates severe cold warning - no warning at -10°C", () => {
    const keikkaNormal = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      weatherTemp: -10, // Normal cold
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaNormal, testContext);

    const _coldIssue = result.issues.find((issue) => issue.type === "SEVERE_COLD_WARNING");

    expect(result.issues.some((issue) => issue.type === "SEVERE_COLD_WARNING")).toBe(false);
  });

  test("validates severe cold warning - fallback to min(start, end) when weatherTemp null", () => {
    const keikkaWithStartEndTemps = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      weatherTemp: null, // No average temp
      weatherStartTemp: -10, // Start temp OK
      weatherEndTemp: -18, // End temp severe cold
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaWithStartEndTemps, testContext);

    const coldIssue = result.issues.find((issue) => issue.type === "SEVERE_COLD_WARNING");
    if (coldIssue) {
      void 0;
    }

    expect(result.issues.some((issue) => issue.type === "SEVERE_COLD_WARNING")).toBe(true);
    expect(coldIssue.message).toContain("-18.0°C"); // Should use min of start/end
  });

  test("validates severe cold warning - no weather data", () => {
    const keikkaNoWeather = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      weatherTemp: null,
      weatherStartTemp: null,
      weatherEndTemp: null,
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaNoWeather, testContext);

    const _coldIssue = result.issues.find((issue) => issue.type === "SEVERE_COLD_WARNING");

    expect(result.issues.some((issue) => issue.type === "SEVERE_COLD_WARNING")).toBe(false);
  });

  // SEVERE_HOT_WARNING tests (Heat Wave / Hellepäivä)
  test("validates severe hot warning - triggers at 30°C", () => {
    const keikkaWithSevereHot = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      weatherTemp: 30, // ≥28°C triggers warning
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaWithSevereHot, testContext);

    const hotIssue = result.issues.find((issue) => issue.type === "SEVERE_HOT_WARNING");
    if (hotIssue) {
      void 0;
    }

    expect(result.issues.some((issue) => issue.type === "SEVERE_HOT_WARNING")).toBe(true);
    expect(hotIssue.message).toContain("30.0°C");
    // Default priority is MEDIUM when no validationSettings are provided
    expect(hotIssue.priority).toBe(PRIORITY_LEVELS.MEDIUM);
  });

  test("validates severe hot warning - triggers at boundary 28°C (inclusive)", () => {
    const keikkaAtBoundary = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      weatherTemp: 28, // Exactly 28°C should trigger (≥28)
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaAtBoundary, testContext);

    const _hotIssue = result.issues.find((issue) => issue.type === "SEVERE_HOT_WARNING");

    expect(result.issues.some((issue) => issue.type === "SEVERE_HOT_WARNING")).toBe(true);
  });

  test("validates severe hot warning - no warning at 27°C", () => {
    const keikkaNormal = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      weatherTemp: 27, // Below threshold
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaNormal, testContext);

    const _hotIssue = result.issues.find((issue) => issue.type === "SEVERE_HOT_WARNING");

    expect(result.issues.some((issue) => issue.type === "SEVERE_HOT_WARNING")).toBe(false);
  });

  test("validates severe hot warning - fallback to max(start, end) when weatherTemp null", () => {
    const keikkaWithStartEndTemps = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      weatherTemp: null, // No average temp
      weatherStartTemp: 25, // Start temp OK
      weatherEndTemp: 30, // End temp severe hot
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaWithStartEndTemps, testContext);

    const hotIssue = result.issues.find((issue) => issue.type === "SEVERE_HOT_WARNING");
    if (hotIssue) {
      void 0;
    }

    expect(result.issues.some((issue) => issue.type === "SEVERE_HOT_WARNING")).toBe(true);
    expect(hotIssue.message).toContain("30.0°C"); // Should use max of start/end
  });

  test("validates severe hot warning - no weather data", () => {
    const keikkaNoWeather = createTestKeikka({
      keikkaTilaId: 4,
      asiakasId: 456,
      asiakasNimi: "Test Asiakas Oy",
      weatherTemp: null,
      weatherStartTemp: null,
      weatherEndTemp: null,
      tyomaaId: 101,
    });

    const result = validateKeikka(keikkaNoWeather, testContext);

    const _hotIssue = result.issues.find((issue) => issue.type === "SEVERE_HOT_WARNING");

    expect(result.issues.some((issue) => issue.type === "SEVERE_HOT_WARNING")).toBe(false);
  });

  describe("MISSING_BOOM_LENGTH", () => {
    test("fires when pumppuPuomi is null", () => {
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 1,
        pumppuPuomi: null,
        pumppuLinja: 0, // avoid noise from MISSING_LINE_LENGTH
      });
      const result = validateKeikka(keikka, testContext);
      const issue = result.issues.find((i) => i.type === "MISSING_BOOM_LENGTH");
      expect(issue).toBeDefined();
      expect(issue.message).toBe("Vähimmäispuomia ei ole määritelty");
      expect(issue.category).toBe("vehicle");
      expect(typeof issue.priority).toBe("number");
    });

    test("attaches autofix when vehicle has vehiclePuomi > 0", () => {
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 2, // vehiclePuomi: 25
        pumppuPuomi: null,
        pumppuLinja: 0,
      });
      const result = validateKeikka(keikka, testContext);
      const issue = result.issues.find((i) => i.type === "MISSING_BOOM_LENGTH");
      expect(issue.actions.autoFix).toBeDefined();
      expect(issue.actions.autoFix.field).toBe("pumppuPuomi");
      expect(issue.actions.autoFix.value).toBe(25);
      expect(issue.actions.autoFix.label).toBe("Aseta 25m (ajoneuvon puomi)");
    });

    test("omits autofix when vehicle has no vehiclePuomi", () => {
      const ctxNoBoom = {
        ...testContext,
        vehicles: [{ vehicleId: 99, vehicleNimi: "Pumppu", vehiclePuomi: 0 }],
      };
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 99,
        pumppuPuomi: null,
        pumppuLinja: 0,
      });
      const result = validateKeikka(keikka, ctxNoBoom);
      const issue = result.issues.find((i) => i.type === "MISSING_BOOM_LENGTH");
      expect(issue).toBeDefined();
      expect(issue.actions.autoFix).toBeUndefined();
    });

    test("does NOT fire when pumppuPuomi is 0 (intentional 'no boom')", () => {
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 1,
        pumppuPuomi: 0,
        pumppuLinja: 0,
      });
      const result = validateKeikka(keikka, testContext);
      expect(result.issues.find((i) => i.type === "MISSING_BOOM_LENGTH")).toBeUndefined();
    });

    test("does NOT fire when pumppuPuomi is set", () => {
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 1,
        pumppuPuomi: 24,
        pumppuLinja: 0,
      });
      const result = validateKeikka(keikka, testContext);
      expect(result.issues.find((i) => i.type === "MISSING_BOOM_LENGTH")).toBeUndefined();
    });

    test("respects rules.MISSING_BOOM_LENGTH.enabled = false", () => {
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 1,
        pumppuPuomi: null,
        pumppuLinja: 0,
      });
      const result = validateKeikka(keikka, {
        ...testContext,
        validationSettings: {
          rules: {
            MISSING_BOOM_LENGTH: { enabled: false, priority: PRIORITY_LEVELS.HIGH },
          },
        },
      });
      expect(result.issues.find((i) => i.type === "MISSING_BOOM_LENGTH")).toBeUndefined();
    });
  });

  describe("MISSING_LINE_LENGTH", () => {
    test("fires when pumppuLinja is null", () => {
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 1,
        pumppuPuomi: 24, // suppress MISSING_BOOM_LENGTH noise
        pumppuLinja: null,
      });
      const result = validateKeikka(keikka, testContext);
      const issue = result.issues.find((i) => i.type === "MISSING_LINE_LENGTH");
      expect(issue).toBeDefined();
      expect(issue.message).toBe("Linjaa ei ole määritelty");
      expect(issue.category).toBe("vehicle");
      expect(typeof issue.priority).toBe("number");
    });

    test("omits autofix when boom is null (per spec)", () => {
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 1,
        pumppuPuomi: null,
        pumppuLinja: null,
      });
      const result = validateKeikka(keikka, testContext);
      const issue = result.issues.find((i) => i.type === "MISSING_LINE_LENGTH");
      expect(issue).toBeDefined();
      expect(issue.actions.autoFix).toBeUndefined();
    });

    test("autofix sets line=30 when boom == 0", () => {
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 1,
        pumppuPuomi: 0,
        pumppuLinja: null,
      });
      const result = validateKeikka(keikka, testContext);
      const issue = result.issues.find((i) => i.type === "MISSING_LINE_LENGTH");
      expect(issue.actions.autoFix).toBeDefined();
      expect(issue.actions.autoFix.field).toBe("pumppuLinja");
      expect(issue.actions.autoFix.value).toBe(30);
      expect(issue.actions.autoFix.label).toBe("Laita 30m linjaa");
    });

    test("autofix sets line=0 when boom > 0", () => {
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 1,
        pumppuPuomi: 24,
        pumppuLinja: null,
      });
      const result = validateKeikka(keikka, testContext);
      const issue = result.issues.find((i) => i.type === "MISSING_LINE_LENGTH");
      expect(issue.actions.autoFix).toBeDefined();
      expect(issue.actions.autoFix.field).toBe("pumppuLinja");
      expect(issue.actions.autoFix.value).toBe(0);
      expect(issue.actions.autoFix.label).toBe("Laita roikosta, 0m linjaa");
    });

    test("does NOT fire when pumppuLinja is 0 (intentional 'no line')", () => {
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 1,
        pumppuPuomi: 24,
        pumppuLinja: 0,
      });
      const result = validateKeikka(keikka, testContext);
      expect(result.issues.find((i) => i.type === "MISSING_LINE_LENGTH")).toBeUndefined();
    });

    test("does NOT fire when pumppuLinja is set", () => {
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 1,
        pumppuPuomi: 24,
        pumppuLinja: 30,
      });
      const result = validateKeikka(keikka, testContext);
      expect(result.issues.find((i) => i.type === "MISSING_LINE_LENGTH")).toBeUndefined();
    });

    test("respects rules.MISSING_LINE_LENGTH.enabled = false", () => {
      const keikka = createTestKeikka({
        keikkaTilaId: 4,
        vehicleId: 1,
        pumppuPuomi: 24,
        pumppuLinja: null,
      });
      const result = validateKeikka(keikka, {
        ...testContext,
        validationSettings: {
          rules: {
            MISSING_LINE_LENGTH: { enabled: false, priority: PRIORITY_LEVELS.HIGH },
          },
        },
      });
      expect(result.issues.find((i) => i.type === "MISSING_LINE_LENGTH")).toBeUndefined();
    });
  });

  describe("rule gating defaults (fail-open)", () => {
    test("a rule absent from a sparse saved config still fires", () => {
      // Sparse config mentions only NO_DRIVER — mimics the old stale/partial rules object.
      const keikka = createTestKeikka({ keikkaTilaId: 4 }); // betoniAsiakas* empty -> MISSING_FACTORY
      const result = validateKeikka(keikka, {
        ...testContext,
        validationSettings: { enabled: true, rules: { NO_DRIVER: { enabled: false, priority: 4 } } },
      });
      expect(result.issues.some((i) => i.type === "MISSING_FACTORY")).toBe(true);
    });

    test("an explicitly disabled rule does not fire", () => {
      const keikka = createTestKeikka({ keikkaTilaId: 4 });
      const result = validateKeikka(keikka, {
        ...testContext,
        validationSettings: { enabled: true, rules: { MISSING_FACTORY: { enabled: false, priority: 4 } } },
      });
      expect(result.issues.some((i) => i.type === "MISSING_FACTORY")).toBe(false);
    });

    test("a rule config carrying only a priority (no enabled key) still fires", () => {
      // Regression: the post-pass used to filter with `!ruleConfig.enabled`, so a
      // saved config like { priority: 4 } — no `enabled` key — silently suppressed
      // the rule that isRuleEnabled had correctly let fire (fail-open contract).
      const keikka = createTestKeikka({ keikkaTilaId: 4 });
      const result = validateKeikka(keikka, {
        ...testContext,
        validationSettings: { enabled: true, rules: { MISSING_FACTORY: { priority: 4 } } },
      });
      expect(result.issues.some((i) => i.type === "MISSING_FACTORY")).toBe(true);
    });
  });
});

describe("validation rule registry coverage", () => {
  // Every rule the engine can emit must be configurable in the settings UI.
  const EMITTED_RULE_IDS = [
    "INCOMPLETE_STATUS", "MISSING_OMA_ASIAKAS", "MISSING_VIERAS_ASIAKAS",
    "MISSING_ASIAKAS_NIMI", "MISSING_ASIAKAS_YTUNNUS", "MISSING_FACTORY",
    "NO_DRIVER", "DRIVER_NOT_AVAILABLE", "INCOMPLETE_CONCRETE", "MISSING_CONCRETE_M3",
    "PUMP_LINE_CONCRETE_TYPE", "INCOMPLETE_BETONI_VALIDATION", "CONCRETE_DATA_NOT_SENT",
    "MISSING_WORKSITE", "MISSING_ADDRESS", "MISSING_WORKSITE_POST", "CITY_IS_HKI",
    "MISSING_WORKSITE_TOWN", "MISSING_CONTACT_PERSON", "MISSING_PHONE", "MISSING_CONTACT_EMAIL",
    "VEHICLE_BOOM_TOO_SHORT", "MISSING_BOOM_LENGTH", "MISSING_LINE_LENGTH",
    "ORDER_CONFIRMATION_NOT_SENT", "CUSTOMER_PAYMENTS_LATE", "SEVERE_COLD_WARNING", "SEVERE_HOT_WARNING",
  ];

  test.each(EMITTED_RULE_IDS)("registry defines %s", (ruleId) => {
    expect(VALIDATION_RULE_DEFINITIONS[ruleId]).toBeDefined();
  });

  test("VEHICLE_BOOM_TOO_SHORT default priority stays HIGH", () => {
    expect(VALIDATION_RULE_DEFINITIONS.VEHICLE_BOOM_TOO_SHORT.defaultPriority).toBe(4);
  });
});

describe("regression: production-style settings enable safety/vehicle/betoni rules", () => {
  // Mirrors what asiakas_getKeikkaValidointiSettings hands validateKeikka in the grid.
  const prodSettings = { enabled: true, rules: getDefaultValidationRulesSettings() };

  test("MISSING_BOOM_LENGTH fires with full default settings", () => {
    const keikka = createTestKeikka({ keikkaTilaId: 4, vehicleId: 1, pumppuPuomi: null, pumppuLinja: 0 });
    const result = validateKeikka(keikka, { ...testContext, validationSettings: prodSettings });
    expect(result.issues.some((i) => i.type === "MISSING_BOOM_LENGTH")).toBe(true);
  });

  test("SEVERE_COLD_WARNING fires with full default settings", () => {
    const keikka = createTestKeikka({ keikkaTilaId: 4, vehicleId: 1, pumppuPuomi: 15, pumppuLinja: 0, weatherTemp: -20 });
    const result = validateKeikka(keikka, { ...testContext, validationSettings: prodSettings });
    expect(result.issues.some((i) => i.type === "SEVERE_COLD_WARNING")).toBe(true);
  });

  test("PUMP_LINE_CONCRETE_TYPE fires with full default settings", () => {
    const keikka = createTestKeikka({
      keikkaTilaId: 4, vehicleId: 1, pumppuPuomi: 15, pumppuLinja: 25,
      betonit: [{ m3: 6.5, raeKokoId: 1, raeKokoSelite: "16mm" }], // raeKokoId 1 = 16mm, NOT a safe pump-line type (validator allows only 2=hieno16mm / 4=8mm), so the rule must fire
    });
    const result = validateKeikka(keikka, { ...testContext, validationSettings: prodSettings });
    expect(result.issues.some((i) => i.type === "PUMP_LINE_CONCRETE_TYPE")).toBe(true);
  });
});

// Usage example
export const exampleUsage = () => {
  const sampleKeikka = createTestKeikka({
    asiakasId: 456,
    asiakasNimi: "Partial Customer",
    keikkaTilaId: 3, // Not ready
    kuskit: [], // No drivers
    betonit: [{ m3: 0 }], // Invalid concrete amount
  });

  const validationResult = validateKeikka(sampleKeikka, {
    ownerAsiakasId: 123,
    vehicles: testContext.vehicles,
    dayDrivers: testContext.dayDrivers,
  });

  // Group issues by priority
  const issuesByPriority = {
    [PRIORITY_LEVELS.CRITICAL]: [],
    [PRIORITY_LEVELS.HIGH]: [],
    [PRIORITY_LEVELS.MEDIUM]: [],
    [PRIORITY_LEVELS.LOW]: [],
    [PRIORITY_LEVELS.NOTIFICATION]: [],
  };

  validationResult.issues.forEach((issue) => {
    issuesByPriority[issue.priority].push(issue);
  });

  Object.entries(issuesByPriority).forEach(([_priority, issues]) => {
    if (issues.length > 0) {
      issues.forEach((issue) => {
        if (issue.actions.autoFix) {
          void 0;
        }
        if (issue.actions.dismiss) {
          void 0;
        }
      });
    }
  });

  return validationResult;
};

// Run example if called directly
const hasNodeModuleSupport =
  typeof globalThis !== "undefined" &&
  typeof globalThis.require !== "undefined" &&
  typeof globalThis.module !== "undefined";

if (hasNodeModuleSupport && globalThis.require.main === globalThis.module) {
  exampleUsage();
}
