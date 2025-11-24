/**
 * @ibetoni/ocr-utils - Constants Module
 *
 * Shared constants for OCR document processing across frontend, backend, and Azure Functions.
 * Single source of truth for document types, statuses, and classifications.
 */

/**
 * Document Types (attachmentTypeId values)
 * Maps to attachmentTypes table in database
 */
export const DOCUMENT_TYPES = {
  // Kuormakirjas (Delivery Notes)
  KUORMAKIRJA_PUMP: 15,        // Pump operator kuormakirja (all formats)
  KUORMAKIRJA_TRUCK: 16,        // Concrete truck kuormakirja

  // Installation & Setup
  PYSTYTYSPÖYTÄKIRJA: 17,       // Equipment installation protocol

  // Environmental & Waste
  KAATOPAIKKA: 18,              // Waste disposal receipt

  // Unclassified
  UNKNOWN: 99                    // Unidentified document requiring classification
};

/**
 * Attachment Groups (attachmentGroupId values)
 * Maps to attachmentGroups table in database
 */
export const ATTACHMENT_GROUPS = {
  TILAUS: 1,          // Order/Delivery (keikkaId)
  TOIMITUS: 2,        // Delivery actuals
  LASKUTUS: 3,        // Invoicing
  TYOMAA: 4,          // Worksite
  AJONEUVO: 5,        // Vehicle
  HENKILOSTO: 6,      // Personnel
  MUU: 7,             // Other
  YMPÄRISTÖ: 8        // Environmental (NEW for OCR project)
};

/**
 * Processing Statuses (processingStatusId values)
 * Global reusable status system for OCR, imports, exports, etc.
 * Maps to processingStatuses table in database
 */
export const PROCESSING_STATUSES = {
  PENDING: 1,         // Waiting to be processed
  PROCESSING: 2,      // Currently being processed
  COMPLETED: 3,       // Successfully completed
  NEEDS_REVIEW: 4,    // Requires human review/validation
  ERROR: 5,           // Processing failed with error
  CANCELLED: 6,       // Processing cancelled by user
  SKIPPED: 7          // Skipped (not applicable)
};

/**
 * Processing Status Names (for display and filtering)
 */
export const PROCESSING_STATUS_NAMES = {
  1: 'pending',
  2: 'processing',
  3: 'completed',
  4: 'needs_review',
  5: 'error',
  6: 'cancelled',
  7: 'skipped'
};

/**
 * Source Asiakas IDs (who printed the document)
 * Maps to asiakas table in database
 *
 * NOTE: Rudus and PEAB IDs are placeholders - update with actual asiakasId from production
 */
export const SOURCE_ASIAKAS_IDS = {
  KALLE_URHO: 1,      // Internal betoni.online kuormakirjas (standard format)
  RUDUS: 123,         // Rudus concrete plant kuormakirjas (TBD - actual asiakasId)
  PEAB: 456           // PEAB concrete plant kuormakirjas (TBD - actual asiakasId)
};

/**
 * Source Asiakas Names (for display)
 */
export const SOURCE_ASIAKAS_NAMES = {
  1: 'Kalle Urho',
  123: 'Rudus',
  456: 'PEAB'
};

/**
 * Get source company name by asiakasId
 * @param {number|null} sourceAsiakasId
 * @returns {string}
 */
export function getSourceAsiakasName(sourceAsiakasId) {
  if (!sourceAsiakasId) return 'Unknown';
  return SOURCE_ASIAKAS_NAMES[sourceAsiakasId] || 'Other';
}

/**
 * OCR Confidence Thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.90,         // Green - Auto-approve
  MEDIUM: 0.75,       // Orange - Review recommended
  LOW: 0.0            // Red - Manual review required
};

/**
 * OCR Engines
 */
export const OCR_ENGINES = {
  AZURE_DOCINTEL_V4: 'azure_docintel_v4',
  AZURE_DOCINTEL_V3: 'azure_docintel_v3'
};

/**
 * Document Type Display Names (Finnish)
 */
export const DOCUMENT_TYPE_NAMES = {
  [DOCUMENT_TYPES.KUORMAKIRJA_PUMP]: 'Kuormakirja (Pumppu)',
  [DOCUMENT_TYPES.KUORMAKIRJA_TRUCK]: 'Kuormakirja (Betoniauto)',
  [DOCUMENT_TYPES.PYSTYTYSPÖYTÄKIRJA]: 'Pystytyspöytäkirja',
  [DOCUMENT_TYPES.KAATOPAIKKA]: 'Kaatopaikka kuitti',
  [DOCUMENT_TYPES.UNKNOWN]: 'Tunnistamaton asiakirja'
};

/**
 * Get document type display name
 * @param {number} documentTypeId
 * @returns {string}
 */
export function getDocumentTypeName(documentTypeId) {
  return DOCUMENT_TYPE_NAMES[documentTypeId] || 'Unknown Document Type';
}

/**
 * Get processing status display name
 * @param {number} statusId
 * @returns {string}
 */
export function getProcessingStatusName(statusId) {
  return PROCESSING_STATUS_NAMES[statusId] || 'unknown';
}

/**
 * Check if document type is kuormakirja (any format)
 * @param {number} documentTypeId
 * @returns {boolean}
 */
export function isKuormakirja(documentTypeId) {
  return documentTypeId === DOCUMENT_TYPES.KUORMAKIRJA_PUMP ||
         documentTypeId === DOCUMENT_TYPES.KUORMAKIRJA_TRUCK;
}

/**
 * Check if document type is environmental/waste disposal
 * @param {number} documentTypeId
 * @returns {boolean}
 */
export function isEnvironmentalDocument(documentTypeId) {
  return documentTypeId === DOCUMENT_TYPES.KAATOPAIKKA;
}
