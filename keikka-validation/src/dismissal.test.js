import {
  VALIDATION_DISMISSED_STEP_LOG_TYPE,
  DISMISS_WINDOW_DAYS,
  getIssueFingerprint,
  buildDismissalData,
  parseDismissal,
  isDismissalForVehicle,
  isOutsideDismissWindow,
} from "./dismissal.js";

describe("dismissal helpers (fb#2802)", () => {
  test("constants", () => {
    expect(VALIDATION_DISMISSED_STEP_LOG_TYPE).toBe(34);
    expect(DISMISS_WINDOW_DAYS).toBe(30);
  });

  test("fingerprint is the message unless the issue sets dismissKey", () => {
    expect(getIssueFingerprint({ message: "A" })).toBe("A");
    expect(getIssueFingerprint({ message: "A", dismissKey: "SEVERE_COLD_WARNING" })).toBe(
      "SEVERE_COLD_WARNING"
    );
  });

  test("parseDismissal round-trips buildDismissalData on a type-34 row", () => {
    const data2 = buildDismissalData({ issueId: "X", fingerprint: "m", reason: "asiakas haluaa" });
    expect(parseDismissal({ stepLogTypeId: 34, data2 })).toEqual({ issueId: "X", fingerprint: "m", vehicleId: null });
    const withVehicle = buildDismissalData({ issueId: "X", fingerprint: "m", vehicleId: "53" });
    expect(parseDismissal({ stepLogTypeId: 34, data2: withVehicle })).toEqual({ issueId: "X", fingerprint: "m", vehicleId: 53 });
  });

  describe("isDismissalForVehicle (fb#2820)", () => {
    test("matches only the vehicle it was made on", () => {
      expect(isDismissalForVehicle({ issueId: "NO_DRIVER", vehicleId: 53 }, 53)).toBe(true);
      expect(isDismissalForVehicle({ issueId: "NO_DRIVER", vehicleId: 53 }, "53")).toBe(true);
      expect(isDismissalForVehicle({ issueId: "NO_DRIVER", vehicleId: 53 }, 54)).toBe(false);
      expect(isDismissalForVehicle({ issueId: "NO_DRIVER", vehicleId: 53 }, null)).toBe(false);
    });
    test("weather stays dismissed on any vehicle", () => {
      expect(isDismissalForVehicle({ issueId: "SEVERE_COLD_WARNING", vehicleId: 53 }, 54)).toBe(true);
      expect(isDismissalForVehicle({ issueId: "SEVERE_HOT_WARNING", vehicleId: 53 }, 54)).toBe(true);
    });
    test("a pre-fb#2820 row without vehicleId matches any vehicle", () => {
      expect(isDismissalForVehicle({ issueId: "NO_DRIVER", vehicleId: null }, 54)).toBe(true);
    });
  });

  test("parseDismissal ignores other types and malformed data2", () => {
    const data2 = buildDismissalData({ issueId: "X", fingerprint: "m" });
    expect(parseDismissal({ stepLogTypeId: 4, data2 })).toBeNull();
    expect(parseDismissal({ stepLogTypeId: 34, data2: "{bad" })).toBeNull();
    expect(parseDismissal({ stepLogTypeId: 34, data2: '{"issueId":1}' })).toBeNull();
    expect(parseDismissal({ stepLogTypeId: 34, data2: null })).toBeNull();
  });

  describe("isOutsideDismissWindow", () => {
    const now = new Date("2026-10-23T10:00:00Z");
    test("an order 30 days back (same day start) is inside", () => {
      expect(isOutsideDismissWindow({ pumppuAika: "2026-09-23T06:00:00Z" }, now)).toBe(false);
    });
    test("an order before that day is outside", () => {
      expect(isOutsideDismissWindow({ pumppuAika: "2026-09-22T23:00:00Z" }, now)).toBe(true);
    });
    test("a future order is inside", () => {
      expect(isOutsideDismissWindow({ pumppuAika: "2026-12-01T06:00:00Z" }, now)).toBe(false);
    });
    test("no date is inside", () => {
      expect(isOutsideDismissWindow({}, now)).toBe(false);
    });
    test("falls back to timeStart", () => {
      expect(isOutsideDismissWindow({ timeStart: "2026-08-01T06:00:00Z" }, now)).toBe(true);
    });
  });
});
