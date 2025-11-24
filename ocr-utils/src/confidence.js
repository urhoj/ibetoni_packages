/**
 * @ibetoni/ocr-utils - Confidence Module
 *
 * Confidence scoring and visual helpers for OCR field extraction.
 * Provides color coding, icons, and scoring logic for UI confidence indicators.
 */

import { CONFIDENCE_THRESHOLDS } from './constants.js';

/**
 * Calculate field confidence score based on OCR confidence and validation result
 *
 * @param {number} ocrConfidence - Raw OCR confidence from Azure Document Intelligence (0.0-1.0)
 * @param {Object} validationResult - Validation result from validation module
 * @param {boolean} validationResult.isValid - Whether field passes validation
 * @param {Array<string>} validationResult.errors - Validation error messages
 * @returns {number} - Adjusted confidence score (0.0-1.0)
 */
export function calculateFieldConfidence(ocrConfidence, validationResult) {
  // If validation fails, confidence is zero
  if (!validationResult.isValid) return 0.00;

  // If validation passes, adjust OCR confidence based on threshold
  if (ocrConfidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    // High confidence - use as-is
    return ocrConfidence;
  } else if (ocrConfidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    // Medium confidence - apply slight penalty
    return ocrConfidence * 0.95;
  } else {
    // Low confidence - apply significant penalty
    return ocrConfidence * 0.85;
  }
}

/**
 * Calculate average confidence across multiple fields
 *
 * @param {Array<{value: any, confidence: number}>} fields - Array of extracted fields
 * @returns {number} - Average confidence (0.0-1.0)
 */
export function calculateAverageConfidence(fields) {
  if (!fields || fields.length === 0) return 0.00;

  const totalConfidence = fields.reduce((sum, field) => sum + (field.confidence || 0), 0);
  return totalConfidence / fields.length;
}

/**
 * Get Material-UI theme color name based on confidence score
 * Returns theme color palette path for MUI styling
 *
 * @param {number} confidence - Confidence score (0.0-1.0)
 * @returns {string} - MUI theme color (e.g., 'success.main', 'warning.main', 'error.main')
 */
export function getConfidenceColor(confidence) {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return 'success.main'; // Green - High confidence, auto-approve
  } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return 'warning.main'; // Orange - Medium confidence, review recommended
  } else {
    return 'error.main'; // Red - Low confidence, manual review required
  }
}

/**
 * Get Material-UI icon name based on confidence score
 * Returns icon component name for MUI icons
 *
 * @param {number} confidence - Confidence score (0.0-1.0)
 * @returns {string} - MUI icon name (e.g., 'CheckCircle', 'Warning', 'Error')
 */
export function getConfidenceIcon(confidence) {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return 'CheckCircle'; // ✅ Green checkmark
  } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return 'Warning'; // ⚠️ Orange warning
  } else {
    return 'Error'; // ❌ Red error
  }
}

/**
 * Get confidence level label (localized Finnish)
 *
 * @param {number} confidence - Confidence score (0.0-1.0)
 * @returns {string} - Confidence level label in Finnish
 */
export function getConfidenceLabelFi(confidence) {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return 'Korkea luotettavuus';
  } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return 'Kohtalainen luotettavuus';
  } else {
    return 'Matala luotettavuus';
  }
}

/**
 * Get confidence level label (English)
 *
 * @param {number} confidence - Confidence score (0.0-1.0)
 * @returns {string} - Confidence level label in English
 */
export function getConfidenceLabelEn(confidence) {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return 'High confidence';
  } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return 'Medium confidence';
  } else {
    return 'Low confidence';
  }
}

/**
 * Determine if field needs human review based on confidence
 *
 * @param {number} confidence - Confidence score (0.0-1.0)
 * @returns {boolean}
 */
export function needsReview(confidence) {
  return confidence < CONFIDENCE_THRESHOLDS.MEDIUM;
}

/**
 * Determine if field can be auto-approved (high confidence)
 *
 * @param {number} confidence - Confidence score (0.0-1.0)
 * @returns {boolean}
 */
export function canAutoApprove(confidence) {
  return confidence >= CONFIDENCE_THRESHOLDS.HIGH;
}

/**
 * Format confidence as percentage string
 *
 * @param {number} confidence - Confidence score (0.0-1.0)
 * @param {number} decimals - Number of decimal places (default: 0)
 * @returns {string} - Formatted percentage (e.g., "95%", "87.5%")
 */
export function formatConfidencePercent(confidence, decimals = 0) {
  const percent = (confidence * 100).toFixed(decimals);
  return `${percent}%`;
}

/**
 * Get confidence styling object for MUI sx prop
 * Returns complete styling object with color, border, and background
 *
 * @param {number} confidence - Confidence score (0.0-1.0)
 * @param {Object} theme - MUI theme object (for alpha/lighten functions)
 * @returns {Object} - MUI sx styling object
 */
export function getConfidenceStyling(confidence, theme) {
  const color = getConfidenceColor(confidence);

  return {
    borderLeft: `3px solid`,
    borderColor: color,
    backgroundColor: theme.palette.mode === 'dark'
      ? theme.palette.alpha(color, 0.1)
      : theme.palette.alpha(color, 0.05),
    '&:hover': {
      backgroundColor: theme.palette.mode === 'dark'
        ? theme.palette.alpha(color, 0.15)
        : theme.palette.alpha(color, 0.1)
    }
  };
}

/**
 * Batch calculate confidence for multiple fields
 *
 * @param {Object} extractedFields - Object with field names as keys
 * @param {Function} validationFn - Validation function for each field
 * @returns {Object} - Fields with confidence scores added
 */
export function calculateFieldsConfidence(extractedFields, validationFn) {
  const fieldsWithConfidence = {};

  for (const [fieldName, fieldData] of Object.entries(extractedFields)) {
    const validationResult = validationFn(fieldName, fieldData.value);
    const confidence = calculateFieldConfidence(fieldData.confidence || 0, validationResult);

    fieldsWithConfidence[fieldName] = {
      ...fieldData,
      confidence,
      needsReview: needsReview(confidence),
      canAutoApprove: canAutoApprove(confidence),
      validationErrors: validationResult.errors
    };
  }

  return fieldsWithConfidence;
}

/**
 * Get confidence statistics for a document
 *
 * @param {Object} extractedFields - Object with field names as keys
 * @returns {Object} - Statistics object
 */
export function getConfidenceStatistics(extractedFields) {
  const fields = Object.values(extractedFields);
  const confidences = fields.map(f => f.confidence || 0);

  return {
    average: calculateAverageConfidence(fields),
    min: Math.min(...confidences),
    max: Math.max(...confidences),
    highConfidenceCount: confidences.filter(c => c >= CONFIDENCE_THRESHOLDS.HIGH).length,
    mediumConfidenceCount: confidences.filter(c => c >= CONFIDENCE_THRESHOLDS.MEDIUM && c < CONFIDENCE_THRESHOLDS.HIGH).length,
    lowConfidenceCount: confidences.filter(c => c < CONFIDENCE_THRESHOLDS.MEDIUM).length,
    totalFields: fields.length,
    needsReviewCount: confidences.filter(c => needsReview(c)).length
  };
}
