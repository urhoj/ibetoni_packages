/**
 * @ibetoni/ocr-utils - Classification Module
 *
 * Document type classification logic based on OCR text content.
 * Identifies document types and source companies from scanned documents.
 */

import {
  DOCUMENT_TYPES,
  ATTACHMENT_GROUPS,
  SOURCE_ASIAKAS_IDS
} from './constants.js';

/**
 * Classification result object
 * @typedef {Object} ClassificationResult
 * @property {number} attachmentTypeId - Document type ID (15-18, 99)
 * @property {number} attachmentGroupId - Document group ID (1, 8)
 * @property {number|null} sourceAsiakasId - Source company ID (who printed it)
 * @property {number} confidence - Classification confidence (0.0-1.0)
 * @property {string} reason - Human-readable classification reason
 */

/**
 * Classify document type based on OCR text content
 *
 * @param {string} ocrText - Full text content from OCR
 * @param {Object} page - Azure Document Intelligence page object (optional, for advanced features)
 * @returns {ClassificationResult}
 */
export function classifyDocumentType(ocrText, page = null) {
  const text = ocrText.toLowerCase();

  // Strategy: Check for most specific patterns first, then broader patterns

  // 1. Kuormakirja (Kalle Urho) - Internal format
  if (text.includes('kuormakirja') && text.includes('kalle urho')) {
    return {
      attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_PUMP,
      attachmentGroupId: ATTACHMENT_GROUPS.TILAUS,
      sourceAsiakasId: SOURCE_ASIAKAS_IDS.KALLE_URHO,
      confidence: 0.95,
      reason: 'Contains "kuormakirja" and "kalle urho" - internal format'
    };
  }

  // 2. Kuormakirja (Rudus) - External supplier
  if (text.includes('kuormakirja') && text.includes('rudus')) {
    return {
      attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_PUMP,
      attachmentGroupId: ATTACHMENT_GROUPS.TILAUS,
      sourceAsiakasId: SOURCE_ASIAKAS_IDS.RUDUS,
      confidence: 0.90,
      reason: 'Contains "kuormakirja" and "rudus" - Rudus supplier format'
    };
  }

  // 3. Kuormakirja (PEAB) - External supplier
  if (text.includes('kuormakirja') && text.includes('peab')) {
    return {
      attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_PUMP,
      attachmentGroupId: ATTACHMENT_GROUPS.TILAUS,
      sourceAsiakasId: SOURCE_ASIAKAS_IDS.PEAB,
      confidence: 0.90,
      reason: 'Contains "kuormakirja" and "peab" - PEAB supplier format'
    };
  }

  // 4. Kuormakirja (Generic pump) - No specific company identified
  if (text.includes('kuormakirja') && (text.includes('pumppu') || text.includes('pumppaus'))) {
    return {
      attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_PUMP,
      attachmentGroupId: ATTACHMENT_GROUPS.TILAUS,
      sourceAsiakasId: null, // Unknown source
      confidence: 0.85,
      reason: 'Contains "kuormakirja" and pump-related keywords'
    };
  }

  // 5. Kuormakirja (Truck) - Concrete truck delivery note
  if (text.includes('kuormakirja') && (text.includes('betoniauto') || text.includes('kuljetus'))) {
    return {
      attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_TRUCK,
      attachmentGroupId: ATTACHMENT_GROUPS.TILAUS,
      sourceAsiakasId: null, // Various suppliers
      confidence: 0.85,
      reason: 'Contains "kuormakirja" and truck/transport keywords'
    };
  }

  // 6. Pystytyspöytäkirja - Equipment installation protocol
  if (text.includes('pystytyspöytäkirja') ||
      (text.includes('pystytys') && text.includes('pöytäkirja'))) {
    return {
      attachmentTypeId: DOCUMENT_TYPES.PYSTYTYSPÖYTÄKIRJA,
      attachmentGroupId: ATTACHMENT_GROUPS.TILAUS,
      sourceAsiakasId: SOURCE_ASIAKAS_IDS.KALLE_URHO, // Typically internal
      confidence: 0.90,
      reason: 'Contains "pystytyspöytäkirja" or installation protocol keywords'
    };
  }

  // 7. Kaatopaikka - Waste disposal receipt
  if (text.includes('kaatopaikka') ||
      text.includes('jäteasema') ||
      text.includes('waste') ||
      text.includes('disposal') ||
      (text.includes('jäte') && text.includes('kuitti'))) {
    return {
      attachmentTypeId: DOCUMENT_TYPES.KAATOPAIKKA,
      attachmentGroupId: ATTACHMENT_GROUPS.YMPÄRISTÖ,
      sourceAsiakasId: null, // Various waste management companies
      confidence: 0.85,
      reason: 'Contains waste disposal or dump site keywords'
    };
  }

  // 8. Generic Kuormakirja - Fallback for delivery notes
  if (text.includes('kuormakirja')) {
    return {
      attachmentTypeId: DOCUMENT_TYPES.KUORMAKIRJA_PUMP,
      attachmentGroupId: ATTACHMENT_GROUPS.TILAUS,
      sourceAsiakasId: null,
      confidence: 0.70,
      reason: 'Contains "kuormakirja" but no specific type identified'
    };
  }

  // 9. Unclassified - Default fallback
  return {
    attachmentTypeId: DOCUMENT_TYPES.UNKNOWN,
    attachmentGroupId: ATTACHMENT_GROUPS.TILAUS, // Default to order-related
    sourceAsiakasId: null,
    confidence: 0.50,
    reason: 'No recognizable document type keywords found'
  };
}

/**
 * Extract potential keikka number from OCR text
 * Looks for common keikka/tilaus number patterns
 *
 * @param {string} ocrText - Full text content from OCR
 * @returns {string|null} - Extracted keikka number or null
 */
export function extractKeikkaNumber(ocrText) {
  const text = ocrText;

  // Pattern 1: "Tilaus: 12345" or "Tilausnumero: 12345"
  const tilausPattern = /tilaus(?:numero)?[:\s]+(\d{4,10})/i;
  const tilausMatch = text.match(tilausPattern);
  if (tilausMatch) return tilausMatch[1];

  // Pattern 2: "Keikka: 12345" or "Keikkanumero: 12345"
  const keikkaPattern = /keikka(?:numero)?[:\s]+(\d{4,10})/i;
  const keikkaMatch = text.match(keikkaPattern);
  if (keikkaMatch) return keikkaMatch[1];

  // Pattern 3: "Order: 12345"
  const orderPattern = /order[:\s]+(\d{4,10})/i;
  const orderMatch = text.match(orderPattern);
  if (orderMatch) return orderMatch[1];

  return null;
}

/**
 * Determine if classification confidence is high enough for auto-processing
 *
 * @param {number} confidence - Classification confidence (0.0-1.0)
 * @returns {boolean}
 */
export function isHighConfidenceClassification(confidence) {
  return confidence >= 0.85;
}

/**
 * Determine if document needs human review based on classification
 *
 * @param {ClassificationResult} classification
 * @returns {boolean}
 */
export function needsClassificationReview(classification) {
  // Low confidence or unknown document type
  if (classification.confidence < 0.75) return true;
  if (classification.attachmentTypeId === DOCUMENT_TYPES.UNKNOWN) return true;

  return false;
}

/**
 * Batch classify multiple pages from a multi-page PDF
 *
 * @param {Array<{pageNumber: number, text: string, page: Object}>} pages
 * @returns {Array<ClassificationResult & {pageNumber: number}>}
 */
export function classifyPages(pages) {
  return pages.map(({ pageNumber, text, page }) => ({
    pageNumber,
    ...classifyDocumentType(text, page)
  }));
}
