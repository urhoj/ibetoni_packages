/**
 * Email validation and parsing utilities
 * Shared between frontend and backend
 */

/* eslint-disable no-useless-escape */
const EMAIL_REGEX =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

/**
 * Check if a string is a valid email address
 * @param {string} value - The string to validate
 * @returns {boolean} True if valid email
 */
function isEmail(value) {
  return EMAIL_REGEX.test(value);
}

/**
 * Parse multiple email addresses separated by semicolon
 * @param {string} emailString - String like "email1@test.com; email2@test.com"
 * @returns {string[]} Array of valid email addresses
 */
function parseMultipleEmails(emailString) {
  if (!emailString) return [];

  return emailString
    .split(";")
    .map((email) => email.trim())
    .filter((email) => email && isEmail(email));
}

/**
 * Validate multiple email string - returns { valid, invalid } arrays
 * @param {string} emailString - String like "email1@test.com; email2@test.com"
 * @returns {{ valid: string[], invalid: string[] }}
 */
function validateMultipleEmails(emailString) {
  if (!emailString) return { valid: [], invalid: [] };

  const parts = emailString
    .split(";")
    .map((email) => email.trim())
    .filter((email) => email);

  const valid = [];
  const invalid = [];
  for (const email of parts) {
    if (isEmail(email)) {
      valid.push(email);
    } else {
      invalid.push(email);
    }
  }
  return { valid, invalid };
}

module.exports = { isEmail, parseMultipleEmails, validateMultipleEmails };
