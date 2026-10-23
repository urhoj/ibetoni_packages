import {
  VALIDATION_DISMISSED_STEP_LOG_TYPE,
  DISMISS_WINDOW_DAYS,
  getIssueFingerprint,
  buildDismissalData,
  parseDismissal,
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
    expect(parseDismissal({ stepLogTypeId: 34, data2 })).toEqual({ issueId: "X", fingerprint: "m" });
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
