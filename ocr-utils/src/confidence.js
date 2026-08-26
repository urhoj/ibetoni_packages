/**
 * @ibetoni/ocr-utils - Confidence Module
 *
 * Confidence display helpers for OCR field extraction.
 */

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
