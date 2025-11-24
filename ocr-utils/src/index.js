/**
 * @ibetoni/ocr-utils
 *
 * Reusable OCR utilities for betoni.online
 * Shared across frontend (puminet4), backend (puminet5api), and Azure Functions (puminet7-functions-app)
 *
 * @module @ibetoni/ocr-utils
 */

// ===== Constants =====
export {
  DOCUMENT_TYPES,
  ATTACHMENT_GROUPS,
  PROCESSING_STATUSES,
  PROCESSING_STATUS_NAMES,
  SOURCE_ASIAKAS_IDS,
  SOURCE_ASIAKAS_NAMES,
  CONFIDENCE_THRESHOLDS,
  OCR_ENGINES,
  DOCUMENT_TYPE_NAMES,
  getSourceAsiakasName,
  getDocumentTypeName,
  getProcessingStatusName,
  isKuormakirja,
  isEnvironmentalDocument
} from './constants.js';

// ===== Classification =====
export {
  classifyDocumentType,
  extractKeikkaNumber,
  isHighConfidenceClassification,
  needsClassificationReview,
  classifyPages
} from './classification.js';

// ===== Confidence Scoring =====
export {
  calculateFieldConfidence,
  calculateAverageConfidence,
  getConfidenceColor,
  getConfidenceIcon,
  getConfidenceLabelFi,
  getConfidenceLabelEn,
  needsReview,
  canAutoApprove,
  formatConfidencePercent,
  getConfidenceStyling,
  calculateFieldsConfidence,
  getConfidenceStatistics
} from './confidence.js';

// ===== Validation =====
export {
  validateNumeric,
  validateTime,
  validateDate,
  validateText,
  validateVehicleRegistration,
  validateKuormakirjaNumber,
  normalizeFieldValue,
  validateExtractedFields,
  allRequiredFieldsValid
} from './validation.js';

// ===== Status Transitions =====
export {
  canTransitionStatus,
  getAllowedNextStatuses,
  validateStatusTransition,
  isTerminalStatus,
  isErrorStatus,
  isInProgressStatus,
  requiresHumanAction,
  getTransitionDescription
} from './statusTransitions.js';
