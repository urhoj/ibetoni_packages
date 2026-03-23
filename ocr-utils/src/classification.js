/**
 * @ibetoni/ocr-utils - Classification Module
 *
 * Three standalone extractors + a convenience wrapper.
 * Each extractor can be used independently or via classifyDocumentType().
 */

import {
  DOCUMENT_TYPES,
  ATTACHMENT_GROUPS,
  SOURCE_ASIAKAS_IDS,
} from "./constants.js";

/**
 * Extract document type from OCR text
 *
 * @param {string} ocrText - Full text content from OCR
 * @returns {{ attachmentTypeId: number, attachmentGroupId: number, confidence: number, reason: string }}
 */
export function extractDocumentType(ocrText) {
  const text = ocrText.toLowerCase();

  // Check external suppliers first — their docs may contain customer names like "Kalle Urho"
  if (text.includes("kuormakirja") && text.includes("www.rudus.fi")) {
    const isPump = text.includes("pumpun siirto");
    return isPump
      ? { attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_PUMP, attachmentGroupId: ATTACHMENT_GROUPS.TILAUS, confidence: 0.92, reason: 'Rudus kuormakirja with "pumpun siirto"' }
      : { attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_TRUCK, attachmentGroupId: ATTACHMENT_GROUPS.TILAUS, confidence: 0.92, reason: 'Rudus kuormakirja without pump transfer keyword' };
  }

  if (text.includes("kuormakirja") && text.includes("peab")) {
    const isPump = text.includes("pumpun siirto");
    return isPump
      ? { attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_PUMP, attachmentGroupId: ATTACHMENT_GROUPS.TILAUS, confidence: 0.90, reason: 'Peab kuormakirja with "pumpun siirto"' }
      : { attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_TRUCK, attachmentGroupId: ATTACHMENT_GROUPS.TILAUS, confidence: 0.90, reason: 'Peab kuormakirja without pump transfer keyword' };
  }

  // Kalle Urho internal formats (check after external suppliers)
  if (text.includes("kalle urho") && (
    text.includes("sarkatie") ||
    text.includes("pumppaus") ||
    text.includes("tilausnumero") ||
    text.includes("betoni.online") ||
    text.includes("betoni online")
  )) {
    return { attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_PUMP, attachmentGroupId: ATTACHMENT_GROUPS.TILAUS, confidence: 0.95, reason: 'Kalle Urho internal format with pump/order keywords' };
  }

  if (text.includes("kuormakirja") && text.includes("kalle urho")) {
    return { attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_PUMP, attachmentGroupId: ATTACHMENT_GROUPS.TILAUS, confidence: 0.95, reason: 'Contains "kuormakirja" and "kalle urho"' };
  }

  // Generic pump kuormakirja
  if (text.includes("kuormakirja") && (text.includes("pumppu") || text.includes("pumppaus"))) {
    return { attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_PUMP, attachmentGroupId: ATTACHMENT_GROUPS.TILAUS, confidence: 0.85, reason: 'Contains "kuormakirja" and pump keywords' };
  }

  // Truck kuormakirja
  if (text.includes("kuormakirja") && (text.includes("betoniauto") || text.includes("kuljetus"))) {
    return { attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_TRUCK, attachmentGroupId: ATTACHMENT_GROUPS.TILAUS, confidence: 0.85, reason: 'Contains "kuormakirja" and truck keywords' };
  }

  // Pystytyspöytäkirja
  if (text.includes("pystytyspöytäkirja") || (text.includes("pystytys") && text.includes("pöytäkirja"))) {
    return { attachmentTypeId: DOCUMENT_TYPES.PYSTYTYSPÖYTÄKIRJA, attachmentGroupId: ATTACHMENT_GROUPS.TILAUS, confidence: 0.90, reason: 'Contains pystytyspöytäkirja keywords' };
  }

  // Kaatopaikka / waste disposal
  if (
    text.includes("kaatopaikka") ||
    text.includes("jäteasema") ||
    text.includes("waste") ||
    text.includes("disposal") ||
    (text.includes("jäte") && text.includes("kuitti"))
  ) {
    return { attachmentTypeId: DOCUMENT_TYPES.KAATOPAIKKA, attachmentGroupId: ATTACHMENT_GROUPS.YMPÄRISTÖ, confidence: 0.85, reason: 'Contains waste disposal keywords' };
  }

  // Generic kuormakirja fallback
  if (text.includes("kuormakirja")) {
    return { attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_PUMP, attachmentGroupId: ATTACHMENT_GROUPS.TILAUS, confidence: 0.70, reason: 'Contains "kuormakirja" but no specific type identified' };
  }

  return { attachmentTypeId: DOCUMENT_TYPES.UNKNOWN, attachmentGroupId: ATTACHMENT_GROUPS.TILAUS, confidence: 0.50, reason: 'No recognizable document type keywords found' };
}

/**
 * Extract source company (who created the document) from OCR text
 *
 * @param {string} ocrText - Full text content from OCR
 * @returns {number|null} sourceAsiakasId or null if unknown
 */
export function extractSourceAsiakasId(ocrText) {
  const text = ocrText.toLowerCase();

  if (text.includes("www.rudus.fi")) return SOURCE_ASIAKAS_IDS.RUDUS;
  if (text.includes("peab")) return SOURCE_ASIAKAS_IDS.PEAB;
  if (text.includes("kalle urho")) return SOURCE_ASIAKAS_IDS.KALLE_URHO;

  return null;
}

/**
 * Extract kuormakirjanumero (delivery note number) from OCR text
 *
 * @param {string} ocrText - Full text content from OCR
 * @returns {string|null} kuormakirjanumero or null if not found
 */
export function extractKuormakirjanumero(ocrText) {
  // Kalle Urho internal: "Tilausnumero: 10163" (this is the keikkaId)
  const tilausMatch = ocrText.match(/Tilausnumero[:\s]*\n?\s*(\d{4,10})/i);
  if (tilausMatch) return tilausMatch[1];

  // Rudus: "27962502 / 20073" or "28386640 / 20152" (8-digit KK number / delivery sub-number)
  const rudusMatch = ocrText.match(/\b(\d{7,9})\s*\/\s*(\d{4,6})\b/);
  if (rudusMatch) return `${rudusMatch[1]} / ${rudusMatch[2]}`;

  // Rudus bracket format: "( 1137 , 28386640 )"
  const bracketMatch = ocrText.match(/\(\s*\d+\s*,\s*(\d{7,9})\s*\)/);
  if (bracketMatch) return bracketMatch[1];

  // Generic: "kuormakirja nro 123456" or "kk no 123456"
  // Exclude numbers starting with 0 (Finnish phone numbers, e.g. 0204477670)
  const genericMatch = ocrText.match(/(?:kuormakirja|kk)[^0-9]*(?:n[:.]?o?|numero|nro)?[^0-9]*(\d{6,10})/i);
  if (genericMatch && !genericMatch[1].startsWith('0')) return genericMatch[1];

  return null;
}

/**
 * Classify document — convenience wrapper calling all three extractors
 *
 * @param {string} ocrText - Full text content from OCR
 * @returns {{ attachmentTypeId, attachmentGroupId, sourceAsiakasId, kuormakirjanumero, confidence, reason }}
 */
export function classifyDocumentType(ocrText) {
  const { attachmentTypeId, attachmentGroupId, confidence, reason } = extractDocumentType(ocrText);
  const sourceAsiakasId = extractSourceAsiakasId(ocrText);
  const kuormakirjanumero = extractKuormakirjanumero(ocrText);
  return { attachmentTypeId, attachmentGroupId, sourceAsiakasId, kuormakirjanumero, confidence, reason };
}

/**
 * Extract potential keikka number from OCR text
 * Looks for common keikka/tilaus number patterns in our order system
 *
 * @param {string} ocrText - Full text content from OCR
 * @returns {string|null}
 */
export function extractKeikkaNumber(ocrText) {
  const tilausMatch = ocrText.match(/tilaus(?:numero)?[:\s]+(\d{4,10})/i);
  if (tilausMatch) return tilausMatch[1];

  const keikkaMatch = ocrText.match(/keikka(?:numero)?[:\s]+(\d{4,10})/i);
  if (keikkaMatch) return keikkaMatch[1];

  const orderMatch = ocrText.match(/order[:\s]+(\d{4,10})/i);
  if (orderMatch) return orderMatch[1];

  return null;
}

/**
 * @param {number} confidence
 * @returns {boolean}
 */
export function isHighConfidenceClassification(confidence) {
  return confidence >= 0.85;
}

/**
 * @param {{ confidence: number, attachmentTypeId: number }} classification
 * @returns {boolean}
 */
export function needsClassificationReview(classification) {
  if (classification.confidence < 0.75) return true;
  if (classification.attachmentTypeId === DOCUMENT_TYPES.UNKNOWN) return true;
  return false;
}

/**
 * Classify multiple pages from a multi-page PDF
 *
 * @param {Array<{pageNumber: number, text: string}>} pages
 * @returns {Array<{ pageNumber, attachmentTypeId, attachmentGroupId, sourceAsiakasId, kuormakirjanumero, confidence, reason }>}
 */
export function classifyPages(pages) {
  return pages.map(({ pageNumber, text }) => ({
    pageNumber,
    ...classifyDocumentType(text),
  }));
}
