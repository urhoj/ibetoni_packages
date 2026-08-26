import { describe, it, expect } from "vitest";

import {
  DOCUMENT_TYPES,
  ATTACHMENT_GROUPS,
  SOURCE_ASIAKAS_IDS,
  getSourceAsiakasName,
  getDocumentTypeName,
} from "../constants.js";

import {
  extractDocumentType,
  extractSourceAsiakasId,
  extractKuormakirjanumero,
  needsClassificationReview,
} from "../classification.js";

import { formatConfidencePercent } from "../confidence.js";

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

  describe("needsClassificationReview", () => {
    it("flags low confidence and UNKNOWN type", () => {
      expect(needsClassificationReview({ confidence: 0.50, attachmentTypeId: 15 })).toBe(true);
      expect(needsClassificationReview({ confidence: 0.90, attachmentTypeId: 99 })).toBe(true);
      expect(needsClassificationReview({ confidence: 0.80, attachmentTypeId: 15 })).toBe(false);
    });
  });
});

// ===== Confidence =====

describe("confidence", () => {
  describe("formatConfidencePercent", () => {
    it("formats without decimals", () => {
      expect(formatConfidencePercent(0.95)).toBe("95%");
    });

    it("formats with decimals", () => {
      expect(formatConfidencePercent(0.875, 1)).toBe("87.5%");
    });
  });
});
