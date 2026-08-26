/**
 * @ibetoni/ocr-utils
 *
 * Reusable OCR utilities for betoni.online
 * Shared across frontend (puminet4) and backend (puminet5api)
 *
 * @module @ibetoni/ocr-utils
 */

// ===== Constants =====
export {
  DOCUMENT_TYPES,
  ATTACHMENT_GROUPS,
  PROCESSING_STATUSES,
  SOURCE_ASIAKAS_IDS,
  CONFIDENCE_THRESHOLDS,
  getSourceAsiakasName,
  getDocumentTypeName
} from './constants.js';

// ===== Classification =====
export {
  extractDocumentType,
  extractSourceAsiakasId,
  extractKuormakirjanumero,
  needsClassificationReview
} from './classification.js';

// ===== Confidence Scoring =====
export { formatConfidencePercent } from './confidence.js';
