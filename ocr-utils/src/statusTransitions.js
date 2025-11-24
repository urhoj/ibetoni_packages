/**
 * @ibetoni/ocr-utils - Status Transitions Module
 *
 * State machine logic for processing status transitions.
 * Defines allowed status changes and validation rules.
 */

import { PROCESSING_STATUSES, PROCESSING_STATUS_NAMES } from './constants.js';

/**
 * Allowed status transitions (state machine)
 * Key = current status, Value = array of allowed next statuses
 */
const ALLOWED_TRANSITIONS = {
  [PROCESSING_STATUSES.PENDING]: [
    PROCESSING_STATUSES.PROCESSING,
    PROCESSING_STATUSES.CANCELLED,
    PROCESSING_STATUSES.SKIPPED
  ],
  [PROCESSING_STATUSES.PROCESSING]: [
    PROCESSING_STATUSES.COMPLETED,
    PROCESSING_STATUSES.NEEDS_REVIEW,
    PROCESSING_STATUSES.ERROR,
    PROCESSING_STATUSES.CANCELLED
  ],
  [PROCESSING_STATUSES.COMPLETED]: [
    PROCESSING_STATUSES.NEEDS_REVIEW, // Re-review if issues found
    PROCESSING_STATUSES.PROCESSING    // Reprocess if needed
  ],
  [PROCESSING_STATUSES.NEEDS_REVIEW]: [
    PROCESSING_STATUSES.COMPLETED,    // After human review
    PROCESSING_STATUSES.ERROR,        // If review identifies errors
    PROCESSING_STATUSES.PROCESSING    // Reprocess after corrections
  ],
  [PROCESSING_STATUSES.ERROR]: [
    PROCESSING_STATUSES.PROCESSING,   // Retry processing
    PROCESSING_STATUSES.PENDING,      // Reset to pending
    PROCESSING_STATUSES.CANCELLED     // Give up
  ],
  [PROCESSING_STATUSES.CANCELLED]: [
    PROCESSING_STATUSES.PENDING       // Restart from beginning
  ],
  [PROCESSING_STATUSES.SKIPPED]: [
    PROCESSING_STATUSES.PENDING       // Restart if needed
  ]
};

/**
 * Check if status transition is allowed
 *
 * @param {number} currentStatus - Current processing status ID
 * @param {number} nextStatus - Desired next status ID
 * @returns {boolean}
 */
export function canTransitionStatus(currentStatus, nextStatus) {
  const allowedTransitions = ALLOWED_TRANSITIONS[currentStatus];
  return allowedTransitions ? allowedTransitions.includes(nextStatus) : false;
}

/**
 * Get allowed next statuses for current status
 *
 * @param {number} currentStatus - Current processing status ID
 * @returns {Array<number>}
 */
export function getAllowedNextStatuses(currentStatus) {
  return ALLOWED_TRANSITIONS[currentStatus] || [];
}

/**
 * Validate status transition and return error message if invalid
 *
 * @param {number} currentStatus - Current processing status ID
 * @param {number} nextStatus - Desired next status ID
 * @returns {Object} - { isValid: boolean, error: string|null }
 */
export function validateStatusTransition(currentStatus, nextStatus) {
  if (!canTransitionStatus(currentStatus, nextStatus)) {
    const currentName = PROCESSING_STATUS_NAMES[currentStatus] || 'unknown';
    const nextName = PROCESSING_STATUS_NAMES[nextStatus] || 'unknown';
    return {
      isValid: false,
      error: `Cannot transition from ${currentName} to ${nextName}`
    };
  }

  return { isValid: true, error: null };
}

/**
 * Determine if status represents a terminal state (processing complete)
 *
 * @param {number} status - Processing status ID
 * @returns {boolean}
 */
export function isTerminalStatus(status) {
  return status === PROCESSING_STATUSES.COMPLETED ||
         status === PROCESSING_STATUSES.CANCELLED ||
         status === PROCESSING_STATUSES.SKIPPED;
}

/**
 * Determine if status represents an error state
 *
 * @param {number} status - Processing status ID
 * @returns {boolean}
 */
export function isErrorStatus(status) {
  return status === PROCESSING_STATUSES.ERROR;
}

/**
 * Determine if status represents an in-progress state
 *
 * @param {number} status - Processing status ID
 * @returns {boolean}
 */
export function isInProgressStatus(status) {
  return status === PROCESSING_STATUSES.PENDING ||
         status === PROCESSING_STATUSES.PROCESSING;
}

/**
 * Determine if status requires human action
 *
 * @param {number} status - Processing status ID
 * @returns {boolean}
 */
export function requiresHumanAction(status) {
  return status === PROCESSING_STATUSES.NEEDS_REVIEW ||
         status === PROCESSING_STATUSES.ERROR;
}

/**
 * Get status transition history description (for audit log)
 *
 * @param {number} fromStatus - Previous status ID
 * @param {number} toStatus - New status ID
 * @param {string} reason - Reason for transition
 * @returns {string}
 */
export function getTransitionDescription(fromStatus, toStatus, reason = '') {
  const fromName = PROCESSING_STATUS_NAMES[fromStatus] || 'unknown';
  const toName = PROCESSING_STATUS_NAMES[toStatus] || 'unknown';

  let description = `Status changed from ${fromName} to ${toName}`;
  if (reason) {
    description += `: ${reason}`;
  }

  return description;
}
