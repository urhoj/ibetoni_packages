import { describe, it, expect } from "vitest";

import {
  DOCUMENT_TYPES,
  ATTACHMENT_GROUPS,
  PROCESSING_STATUSES,
  PROCESSING_STATUS_NAMES,
  SOURCE_ASIAKAS_IDS,
  CONFIDENCE_THRESHOLDS,
  getSourceAsiakasName,
  getDocumentTypeName,
  getProcessingStatusName,
  isKuormakirja,
  isEnvironmentalDocument,
} from "../constants.js";

import {
  extractDocumentType,
  extractSourceAsiakasId,
  extractKuormakirjanumero,
  classifyDocumentType,
  extractKeikkaNumber,
  isHighConfidenceClassification,
  needsClassificationReview,
  classifyPages,
} from "../classification.js";

import {
  calculateFieldConfidence,
  calculateAverageConfidence,
  getConfidenceColor,
  getConfidenceIcon,
  getConfidenceLabelFi,
  getConfidenceLabelEn,
  needsReview,
  canAutoApprove,
  formatConfidencePercent,
  getConfidenceStatistics,
} from "../confidence.js";

import {
  validateNumeric,
  validateTime,
  validateDate,
  validateText,
  validateVehicleRegistration,
  validateKuormakirjaNumber,
  normalizeFieldValue,
  validateExtractedFields,
  allRequiredFieldsValid,
} from "../validation.js";

import {
  canTransitionStatus,
  getAllowedNextStatuses,
  validateStatusTransition,
  isTerminalStatus,
  isErrorStatus,
  isInProgressStatus,
  requiresHumanAction,
  getTransitionDescription,
} from "../statusTransitions.js";

// ===== Constants =====

describe("constants", () => {
  it("getSourceAsiakasName returns correct names", () => {
    expect(getSourceAsiakasName(8)).toBe("Kalle Urho");
    expect(getSourceAsiakasName(30)).toBe("Rudus");
    expect(getSourceAsiakasName(28)).toBe("PEAB");
  });

  it("getSourceAsiakasName handles unknown/null", () => {
    expect(getSourceAsiakasName(999)).toBe("Other");
    expect(getSourceAsiakasName(null)).toBe("Unknown");
  });

  it("getDocumentTypeName returns Finnish names", () => {
    expect(getDocumentTypeName(15)).toBe("Kuormakirja (Pumppu)");
    expect(getDocumentTypeName(16)).toBe("Kuormakirja (Betoniauto)");
    expect(getDocumentTypeName(99)).toBe("Tunnistamaton asiakirja");
  });

  it("getDocumentTypeName handles unknown", () => {
    expect(getDocumentTypeName(0)).toBe("Unknown Document Type");
  });

  it("getProcessingStatusName returns correct names", () => {
    expect(getProcessingStatusName(1)).toBe("pending");
    expect(getProcessingStatusName(3)).toBe("completed");
    expect(getProcessingStatusName(5)).toBe("error");
  });

  it("isKuormakirja identifies correct types", () => {
    expect(isKuormakirja(15)).toBe(true);
    expect(isKuormakirja(16)).toBe(true);
    expect(isKuormakirja(17)).toBe(false);
    expect(isKuormakirja(99)).toBe(false);
  });

  it("isEnvironmentalDocument identifies kaatopaikka", () => {
    expect(isEnvironmentalDocument(18)).toBe(true);
    expect(isEnvironmentalDocument(15)).toBe(false);
  });
});

// ===== Classification =====

describe("classification", () => {
  describe("extractDocumentType", () => {
    it("identifies Rudus kuormakirja", () => {
      const result = extractDocumentType("Kuormakirja betoni www.rudus.fi toimitus");
      expect(result.attachmentTypeId).toBe(DOCUMENT_TYPES.KUORMAKIRJA_TRUCK);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("identifies Rudus pump kuormakirja", () => {
      const result = extractDocumentType("Kuormakirja www.rudus.fi pumpun siirto");
      expect(result.attachmentTypeId).toBe(DOCUMENT_TYPES.KUORMAKIRJA_PUMP);
    });

    it("identifies PEAB kuormakirja", () => {
      const result = extractDocumentType("Kuormakirja PEAB betoni");
      expect(result.attachmentTypeId).toBe(DOCUMENT_TYPES.KUORMAKIRJA_PUMP);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("identifies Kalle Urho internal format", () => {
      const result = extractDocumentType("Kalle Urho pumppaus tilausnumero 12345");
      expect(result.attachmentTypeId).toBe(DOCUMENT_TYPES.KUORMAKIRJA_PUMP);
      expect(result.confidence).toBe(0.95);
    });

    it("identifies pystytyspöytäkirja", () => {
      const result = extractDocumentType("Pystytyspöytäkirja pumppuauto");
      expect(result.attachmentTypeId).toBe(DOCUMENT_TYPES.PYSTYTYSPÖYTÄKIRJA);
    });

    it("identifies kaatopaikka", () => {
      const result = extractDocumentType("Kaatopaikka kuitti jäte");
      expect(result.attachmentTypeId).toBe(DOCUMENT_TYPES.KAATOPAIKKA);
      expect(result.attachmentGroupId).toBe(ATTACHMENT_GROUPS.YMPÄRISTÖ);
    });

    it("returns UNKNOWN for unrecognized text", () => {
      const result = extractDocumentType("random text no keywords");
      expect(result.attachmentTypeId).toBe(DOCUMENT_TYPES.UNKNOWN);
    });

    it("handles null/empty text", () => {
      expect(extractDocumentType(null).attachmentTypeId).toBe(DOCUMENT_TYPES.UNKNOWN);
      expect(extractDocumentType("").attachmentTypeId).toBe(DOCUMENT_TYPES.UNKNOWN);
    });

    it("generic kuormakirja fallback has lower confidence", () => {
      const result = extractDocumentType("kuormakirja something");
      expect(result.attachmentTypeId).toBe(DOCUMENT_TYPES.KUORMAKIRJA_PUMP);
      expect(result.confidence).toBe(0.70);
    });
  });

  describe("extractSourceAsiakasId", () => {
    it("identifies Rudus", () => {
      expect(extractSourceAsiakasId("www.rudus.fi betoni")).toBe(SOURCE_ASIAKAS_IDS.RUDUS);
    });

    it("identifies PEAB", () => {
      expect(extractSourceAsiakasId("PEAB betoni oy")).toBe(SOURCE_ASIAKAS_IDS.PEAB);
    });

    it("identifies Kalle Urho", () => {
      expect(extractSourceAsiakasId("Kalle Urho Oy")).toBe(SOURCE_ASIAKAS_IDS.KALLE_URHO);
    });

    it("returns null for unknown", () => {
      expect(extractSourceAsiakasId("unknown company")).toBeNull();
      expect(extractSourceAsiakasId(null)).toBeNull();
    });
  });

  describe("extractKuormakirjanumero", () => {
    it("extracts Rudus format", () => {
      const result = extractKuormakirjanumero("KUORMAKIRJANUMERO: 27962502 / 20073");
      expect(result).toBe("27962502 / 20073");
    });

    it("extracts bracket format", () => {
      const result = extractKuormakirjanumero("( 1137 , 28386640 )");
      expect(result).toBe("28386640");
    });

    it("extracts generic format", () => {
      const result = extractKuormakirjanumero("kuormakirja nro 123456");
      expect(result).toBe("123456");
    });

    it("returns null for no match", () => {
      expect(extractKuormakirjanumero("no numbers")).toBeNull();
      expect(extractKuormakirjanumero(null)).toBeNull();
    });
  });

  describe("classifyDocumentType", () => {
    it("returns combined classification result", () => {
      const result = classifyDocumentType("Kuormakirja www.rudus.fi KUORMAKIRJANUMERO: 27962502 / 20073");
      expect(result.attachmentTypeId).toBe(DOCUMENT_TYPES.KUORMAKIRJA_TRUCK);
      expect(result.sourceAsiakasId).toBe(SOURCE_ASIAKAS_IDS.RUDUS);
      expect(result.kuormakirjanumero).toBe("27962502 / 20073");
    });
  });

  describe("extractKeikkaNumber", () => {
    it("extracts tilausnumero", () => {
      expect(extractKeikkaNumber("tilausnumero: 12345")).toBe("12345");
    });

    it("extracts keikka number", () => {
      expect(extractKeikkaNumber("keikka 54321")).toBe("54321");
    });

    it("returns null for no match", () => {
      expect(extractKeikkaNumber("no order number")).toBeNull();
      expect(extractKeikkaNumber(null)).toBeNull();
    });
  });

  describe("confidence helpers", () => {
    it("isHighConfidenceClassification", () => {
      expect(isHighConfidenceClassification(0.90)).toBe(true);
      expect(isHighConfidenceClassification(0.85)).toBe(true);
      expect(isHighConfidenceClassification(0.84)).toBe(false);
    });

    it("needsClassificationReview", () => {
      expect(needsClassificationReview({ confidence: 0.50, attachmentTypeId: 15 })).toBe(true);
      expect(needsClassificationReview({ confidence: 0.90, attachmentTypeId: 99 })).toBe(true);
      expect(needsClassificationReview({ confidence: 0.80, attachmentTypeId: 15 })).toBe(false);
    });
  });

  describe("classifyPages", () => {
    it("classifies multiple pages", () => {
      const pages = [
        { pageNumber: 1, text: "Kuormakirja www.rudus.fi" },
        { pageNumber: 2, text: "Pystytyspöytäkirja" },
      ];
      const results = classifyPages(pages);
      expect(results).toHaveLength(2);
      expect(results[0].pageNumber).toBe(1);
      expect(results[0].attachmentTypeId).toBe(DOCUMENT_TYPES.KUORMAKIRJA_TRUCK);
      expect(results[1].attachmentTypeId).toBe(DOCUMENT_TYPES.PYSTYTYSPÖYTÄKIRJA);
    });
  });
});

// ===== Confidence =====

describe("confidence", () => {
  describe("calculateFieldConfidence", () => {
    it("returns 0 for invalid validation", () => {
      expect(calculateFieldConfidence(0.95, { isValid: false, errors: ["err"] })).toBe(0);
    });

    it("returns full score for high confidence", () => {
      expect(calculateFieldConfidence(0.95, { isValid: true, errors: [] })).toBe(0.95);
    });

    it("applies slight penalty for medium confidence", () => {
      const result = calculateFieldConfidence(0.80, { isValid: true, errors: [] });
      expect(result).toBeCloseTo(0.76, 1);
    });

    it("applies significant penalty for low confidence", () => {
      const result = calculateFieldConfidence(0.50, { isValid: true, errors: [] });
      expect(result).toBeCloseTo(0.425, 2);
    });
  });

  describe("calculateAverageConfidence", () => {
    it("calculates average", () => {
      const fields = [{ confidence: 0.8 }, { confidence: 0.6 }];
      expect(calculateAverageConfidence(fields)).toBeCloseTo(0.7);
    });

    it("returns 0 for empty array", () => {
      expect(calculateAverageConfidence([])).toBe(0);
      expect(calculateAverageConfidence(null)).toBe(0);
    });
  });

  describe("getConfidenceColor", () => {
    it("returns success for high", () => {
      expect(getConfidenceColor(0.95)).toBe("success.main");
    });

    it("returns warning for medium", () => {
      expect(getConfidenceColor(0.80)).toBe("warning.main");
    });

    it("returns error for low", () => {
      expect(getConfidenceColor(0.50)).toBe("error.main");
    });
  });

  describe("getConfidenceIcon", () => {
    it("returns correct icons", () => {
      expect(getConfidenceIcon(0.95)).toBe("CheckCircle");
      expect(getConfidenceIcon(0.80)).toBe("Warning");
      expect(getConfidenceIcon(0.50)).toBe("Error");
    });
  });

  describe("labels", () => {
    it("Finnish labels", () => {
      expect(getConfidenceLabelFi(0.95)).toBe("Korkea luotettavuus");
      expect(getConfidenceLabelFi(0.80)).toBe("Kohtalainen luotettavuus");
      expect(getConfidenceLabelFi(0.50)).toBe("Matala luotettavuus");
    });

    it("English labels", () => {
      expect(getConfidenceLabelEn(0.95)).toBe("High confidence");
      expect(getConfidenceLabelEn(0.80)).toBe("Medium confidence");
      expect(getConfidenceLabelEn(0.50)).toBe("Low confidence");
    });
  });

  describe("needsReview / canAutoApprove", () => {
    it("needsReview for low confidence", () => {
      expect(needsReview(0.50)).toBe(true);
      expect(needsReview(0.74)).toBe(true);
      expect(needsReview(0.75)).toBe(false);
    });

    it("canAutoApprove for high confidence", () => {
      expect(canAutoApprove(0.90)).toBe(true);
      expect(canAutoApprove(0.89)).toBe(false);
    });
  });

  describe("formatConfidencePercent", () => {
    it("formats without decimals", () => {
      expect(formatConfidencePercent(0.95)).toBe("95%");
    });

    it("formats with decimals", () => {
      expect(formatConfidencePercent(0.875, 1)).toBe("87.5%");
    });
  });

  describe("getConfidenceStatistics", () => {
    it("calculates statistics", () => {
      const fields = {
        field1: { confidence: 0.95 },
        field2: { confidence: 0.80 },
        field3: { confidence: 0.50 },
      };
      const stats = getConfidenceStatistics(fields);
      expect(stats.totalFields).toBe(3);
      expect(stats.highConfidenceCount).toBe(1);
      expect(stats.mediumConfidenceCount).toBe(1);
      expect(stats.lowConfidenceCount).toBe(1);
      expect(stats.min).toBe(0.50);
      expect(stats.max).toBe(0.95);
    });
  });
});

// ===== Validation =====

describe("validation", () => {
  describe("validateNumeric", () => {
    it("validates valid number", () => {
      const result = validateNumeric(42);
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe(42);
    });

    it("converts comma decimal string", () => {
      const result = validateNumeric("3,5");
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe(3.5);
    });

    it("rejects NaN", () => {
      expect(validateNumeric("abc").isValid).toBe(false);
    });

    it("validates range", () => {
      expect(validateNumeric(5, { min: 10 }).isValid).toBe(false);
      expect(validateNumeric(15, { max: 10 }).isValid).toBe(false);
    });

    it("handles required empty value", () => {
      expect(validateNumeric(null, { required: true }).isValid).toBe(false);
      expect(validateNumeric(null, { required: false }).isValid).toBe(true);
    });
  });

  describe("validateTime", () => {
    it("validates HH:mm format", () => {
      const result = validateTime("14:30");
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe("14:30");
    });

    it("validates HH.mm format", () => {
      const result = validateTime("8.05");
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe("08:05");
    });

    it("rejects invalid time", () => {
      expect(validateTime("25:00").isValid).toBe(false);
      expect(validateTime("12:61").isValid).toBe(false);
    });

    it("handles required empty", () => {
      expect(validateTime(null, { required: true }).isValid).toBe(false);
      expect(validateTime(null).isValid).toBe(true);
    });
  });

  describe("validateDate", () => {
    it("validates ISO format", () => {
      const result = validateDate("2024-06-15");
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe("2024-06-15");
    });

    it("validates Finnish format", () => {
      const result = validateDate("15.06.2024");
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe("2024-06-15");
    });

    it("rejects invalid date", () => {
      expect(validateDate("not-a-date").isValid).toBe(false);
    });

    it("handles required empty", () => {
      expect(validateDate(null, { required: true }).isValid).toBe(false);
      expect(validateDate(null).isValid).toBe(true);
    });
  });

  describe("validateText", () => {
    it("validates text within bounds", () => {
      const result = validateText("hello", { minLength: 2, maxLength: 10 });
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe("hello");
    });

    it("rejects too short text", () => {
      expect(validateText("ab", { minLength: 5 }).isValid).toBe(false);
    });

    it("rejects too long text", () => {
      expect(validateText("abcdef", { maxLength: 3 }).isValid).toBe(false);
    });

    it("validates pattern", () => {
      expect(validateText("ABC", { pattern: /^[A-Z]+$/ }).isValid).toBe(true);
      expect(validateText("abc", { pattern: /^[A-Z]+$/ }).isValid).toBe(false);
    });
  });

  describe("validateVehicleRegistration", () => {
    it("validates ABC-123 format", () => {
      const result = validateVehicleRegistration("ABC-123");
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe("ABC-123");
    });

    it("normalizes to uppercase", () => {
      const result = validateVehicleRegistration("abc-123");
      expect(result.normalizedValue).toBe("ABC-123");
    });

    it("rejects invalid format", () => {
      expect(validateVehicleRegistration("ABCDEF").isValid).toBe(false);
    });

    it("handles required empty", () => {
      expect(validateVehicleRegistration(null, { required: true }).isValid).toBe(false);
      expect(validateVehicleRegistration(null).isValid).toBe(true);
    });
  });

  describe("validateKuormakirjaNumber", () => {
    it("validates positive integer", () => {
      const result = validateKuormakirjaNumber("123456");
      expect(result.isValid).toBe(true);
      expect(result.normalizedValue).toBe(123456);
    });

    it("strips non-digits", () => {
      const result = validateKuormakirjaNumber("KK-12345");
      expect(result.normalizedValue).toBe(12345);
    });

    it("rejects zero/negative", () => {
      expect(validateKuormakirjaNumber("0").isValid).toBe(false);
    });

    it("handles required empty", () => {
      expect(validateKuormakirjaNumber(null, { required: true }).isValid).toBe(false);
    });
  });

  describe("normalizeFieldValue", () => {
    it("trims strings", () => {
      expect(normalizeFieldValue("  hello  ")).toBe("hello");
    });

    it("returns null for null/undefined", () => {
      expect(normalizeFieldValue(null)).toBeNull();
      expect(normalizeFieldValue(undefined)).toBeNull();
    });

    it("passes through numbers", () => {
      expect(normalizeFieldValue(42)).toBe(42);
    });
  });

  describe("validateExtractedFields", () => {
    it("validates fields by type definitions", () => {
      const fields = { volume: "3.5", time: "14:30" };
      const definitions = {
        volume: { type: "numeric", options: { min: 0 } },
        time: { type: "time", options: {} },
      };
      const results = validateExtractedFields(fields, definitions);
      expect(results.volume.isValid).toBe(true);
      expect(results.time.isValid).toBe(true);
    });

    it("passes through undefined field definitions", () => {
      const results = validateExtractedFields({ extra: "test" }, {});
      expect(results.extra.isValid).toBe(true);
      expect(results.extra.normalizedValue).toBe("test");
    });
  });

  describe("allRequiredFieldsValid", () => {
    it("returns true when all valid", () => {
      expect(allRequiredFieldsValid({ a: { isValid: true }, b: { isValid: true } })).toBe(true);
    });

    it("returns false when any invalid", () => {
      expect(allRequiredFieldsValid({ a: { isValid: true }, b: { isValid: false } })).toBe(false);
    });
  });
});

// ===== Status Transitions =====

describe("statusTransitions", () => {
  describe("canTransitionStatus", () => {
    it("allows PENDING -> PROCESSING", () => {
      expect(canTransitionStatus(PROCESSING_STATUSES.PENDING, PROCESSING_STATUSES.PROCESSING)).toBe(true);
    });

    it("allows PROCESSING -> COMPLETED", () => {
      expect(canTransitionStatus(PROCESSING_STATUSES.PROCESSING, PROCESSING_STATUSES.COMPLETED)).toBe(true);
    });

    it("disallows PENDING -> COMPLETED (skip step)", () => {
      expect(canTransitionStatus(PROCESSING_STATUSES.PENDING, PROCESSING_STATUSES.COMPLETED)).toBe(false);
    });

    it("allows ERROR -> PROCESSING (retry)", () => {
      expect(canTransitionStatus(PROCESSING_STATUSES.ERROR, PROCESSING_STATUSES.PROCESSING)).toBe(true);
    });

    it("allows CANCELLED -> PENDING (restart)", () => {
      expect(canTransitionStatus(PROCESSING_STATUSES.CANCELLED, PROCESSING_STATUSES.PENDING)).toBe(true);
    });
  });

  describe("getAllowedNextStatuses", () => {
    it("returns allowed transitions for PENDING", () => {
      const allowed = getAllowedNextStatuses(PROCESSING_STATUSES.PENDING);
      expect(allowed).toContain(PROCESSING_STATUSES.PROCESSING);
      expect(allowed).toContain(PROCESSING_STATUSES.CANCELLED);
      expect(allowed).not.toContain(PROCESSING_STATUSES.COMPLETED);
    });

    it("returns empty for invalid status", () => {
      expect(getAllowedNextStatuses(999)).toEqual([]);
    });
  });

  describe("validateStatusTransition", () => {
    it("returns valid for allowed transition", () => {
      const result = validateStatusTransition(PROCESSING_STATUSES.PENDING, PROCESSING_STATUSES.PROCESSING);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("returns error for invalid transition", () => {
      const result = validateStatusTransition(PROCESSING_STATUSES.PENDING, PROCESSING_STATUSES.COMPLETED);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("pending");
      expect(result.error).toContain("completed");
    });
  });

  describe("status type checks", () => {
    it("isTerminalStatus", () => {
      expect(isTerminalStatus(PROCESSING_STATUSES.COMPLETED)).toBe(true);
      expect(isTerminalStatus(PROCESSING_STATUSES.CANCELLED)).toBe(true);
      expect(isTerminalStatus(PROCESSING_STATUSES.SKIPPED)).toBe(true);
      expect(isTerminalStatus(PROCESSING_STATUSES.PROCESSING)).toBe(false);
    });

    it("isErrorStatus", () => {
      expect(isErrorStatus(PROCESSING_STATUSES.ERROR)).toBe(true);
      expect(isErrorStatus(PROCESSING_STATUSES.PENDING)).toBe(false);
    });

    it("isInProgressStatus", () => {
      expect(isInProgressStatus(PROCESSING_STATUSES.PENDING)).toBe(true);
      expect(isInProgressStatus(PROCESSING_STATUSES.PROCESSING)).toBe(true);
      expect(isInProgressStatus(PROCESSING_STATUSES.COMPLETED)).toBe(false);
    });

    it("requiresHumanAction", () => {
      expect(requiresHumanAction(PROCESSING_STATUSES.NEEDS_REVIEW)).toBe(true);
      expect(requiresHumanAction(PROCESSING_STATUSES.ERROR)).toBe(true);
      expect(requiresHumanAction(PROCESSING_STATUSES.PROCESSING)).toBe(false);
    });
  });

  describe("getTransitionDescription", () => {
    it("formats description without reason", () => {
      const desc = getTransitionDescription(PROCESSING_STATUSES.PENDING, PROCESSING_STATUSES.PROCESSING);
      expect(desc).toBe("Status changed from pending to processing");
    });

    it("formats description with reason", () => {
      const desc = getTransitionDescription(PROCESSING_STATUSES.ERROR, PROCESSING_STATUSES.PROCESSING, "retry");
      expect(desc).toBe("Status changed from error to processing: retry");
    });
  });
});
