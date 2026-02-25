/**
 * Format a person's full name from first and last name parts.
 * Handles null/undefined values gracefully.
 *
 * @param {string|null|undefined} firstName
 * @param {string|null|undefined} lastName
 * @param {string} fallback - Returned when both names are empty
 * @returns {string}
 */
export function formatPersonName(firstName, lastName, fallback = "Nimetön") {
  return [firstName, lastName].filter(Boolean).join(" ") || fallback;
}
