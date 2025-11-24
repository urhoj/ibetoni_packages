/**
 * @ibetoni/ocr-utils - Validation Module
 *
 * Field validation logic for OCR extracted data.
 * Validates field types, ranges, formats, and business rules.
 */

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {Array<string>} errors - List of validation error messages
 * @property {any} normalizedValue - Normalized/cleaned value
 */

/**
 * Validate numeric field (e.g., m³, hours, counts)
 *
 * @param {any} value - Field value to validate
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum allowed value
 * @param {number} options.max - Maximum allowed value
 * @param {number} options.decimals - Maximum decimal places
 * @param {boolean} options.required - Whether field is required
 * @returns {ValidationResult}
 */
export function validateNumeric(value, options = {}) {
  const {
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    decimals = 2,
    required = false
  } = options;

  const errors = [];

  // Check if value exists
  if (value === null || value === undefined || value === '') {
    if (required) {
      errors.push('Arvo on pakollinen');
      return { isValid: false, errors, normalizedValue: null };
    }
    return { isValid: true, errors: [], normalizedValue: null };
  }

  // Convert to number
  const numValue = typeof value === 'string'
    ? parseFloat(value.replace(',', '.').replace(/[^\d.-]/g, ''))
    : Number(value);

  // Check if valid number
  if (isNaN(numValue)) {
    errors.push('Arvon täytyy olla numero');
    return { isValid: false, errors, normalizedValue: null };
  }

  // Check range
  if (numValue < min) {
    errors.push(`Arvon täytyy olla vähintään ${min}`);
  }

  if (numValue > max) {
    errors.push(`Arvon täytyy olla enintään ${max}`);
  }

  // Normalize to specified decimal places
  const normalized = parseFloat(numValue.toFixed(decimals));

  return {
    isValid: errors.length === 0,
    errors,
    normalizedValue: normalized
  };
}

/**
 * Validate time field (HH:mm format)
 *
 * @param {any} value - Time string to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.required - Whether field is required
 * @returns {ValidationResult}
 */
export function validateTime(value, options = {}) {
  const { required = false } = options;
  const errors = [];

  if (!value) {
    if (required) {
      errors.push('Aika on pakollinen');
      return { isValid: false, errors, normalizedValue: null };
    }
    return { isValid: true, errors: [], normalizedValue: null };
  }

  // Accept various time formats: "HH:mm", "HH.mm", "HHmm", "H:mm"
  const timeStr = String(value).trim();
  const timePattern = /^(\d{1,2})[:.,-]?(\d{2})$/;
  const match = timeStr.match(timePattern);

  if (!match) {
    errors.push('Ajan täytyy olla muodossa HH:mm');
    return { isValid: false, errors, normalizedValue: null };
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23) {
    errors.push('Tunnit täytyy olla välillä 0-23');
  }

  if (minutes < 0 || minutes > 59) {
    errors.push('Minuutit täytyy olla välillä 0-59');
  }

  // Normalize to HH:mm format
  const normalized = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return {
    isValid: errors.length === 0,
    errors,
    normalizedValue: normalized
  };
}

/**
 * Validate date field (YYYY-MM-DD or DD.MM.YYYY)
 *
 * @param {any} value - Date string to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.required - Whether field is required
 * @param {Date} options.minDate - Minimum allowed date
 * @param {Date} options.maxDate - Maximum allowed date
 * @returns {ValidationResult}
 */
export function validateDate(value, options = {}) {
  const { required = false, minDate = null, maxDate = null } = options;
  const errors = [];

  if (!value) {
    if (required) {
      errors.push('Päivämäärä on pakollinen');
      return { isValid: false, errors, normalizedValue: null };
    }
    return { isValid: true, errors: [], normalizedValue: null };
  }

  const dateStr = String(value).trim();
  let date = null;

  // Try ISO format (YYYY-MM-DD)
  const isoPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const isoMatch = dateStr.match(isoPattern);
  if (isoMatch) {
    date = new Date(dateStr);
  }

  // Try Finnish format (DD.MM.YYYY)
  const fiPattern = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
  const fiMatch = dateStr.match(fiPattern);
  if (fiMatch) {
    const [, day, month, year] = fiMatch;
    date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }

  if (!date || isNaN(date.getTime())) {
    errors.push('Päivämäärän täytyy olla muodossa DD.MM.YYYY tai YYYY-MM-DD');
    return { isValid: false, errors, normalizedValue: null };
  }

  // Check range
  if (minDate && date < minDate) {
    errors.push(`Päivämäärän täytyy olla ${minDate.toLocaleDateString('fi-FI')} jälkeen`);
  }

  if (maxDate && date > maxDate) {
    errors.push(`Päivämäärän täytyy olla ennen ${maxDate.toLocaleDateString('fi-FI')}`);
  }

  // Normalize to ISO format
  const normalized = date.toISOString().split('T')[0];

  return {
    isValid: errors.length === 0,
    errors,
    normalizedValue: normalized
  };
}

/**
 * Validate text field
 *
 * @param {any} value - Text value to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.required - Whether field is required
 * @param {number} options.minLength - Minimum string length
 * @param {number} options.maxLength - Maximum string length
 * @param {RegExp} options.pattern - Regex pattern to match
 * @returns {ValidationResult}
 */
export function validateText(value, options = {}) {
  const {
    required = false,
    minLength = 0,
    maxLength = Number.MAX_SAFE_INTEGER,
    pattern = null
  } = options;

  const errors = [];

  if (!value || value === '') {
    if (required) {
      errors.push('Teksti on pakollinen');
      return { isValid: false, errors, normalizedValue: null };
    }
    return { isValid: true, errors: [], normalizedValue: null };
  }

  const text = String(value).trim();

  if (text.length < minLength) {
    errors.push(`Tekstin täytyy olla vähintään ${minLength} merkkiä`);
  }

  if (text.length > maxLength) {
    errors.push(`Tekstin täytyy olla enintään ${maxLength} merkkiä`);
  }

  if (pattern && !pattern.test(text)) {
    errors.push('Teksti ei vastaa vaadittua muotoa');
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedValue: text
  };
}

/**
 * Validate vehicle registration (Finnish format: ABC-123)
 *
 * @param {any} value - Registration number to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.required - Whether field is required
 * @returns {ValidationResult}
 */
export function validateVehicleRegistration(value, options = {}) {
  const { required = false } = options;
  const errors = [];

  if (!value) {
    if (required) {
      errors.push('Rekisterinumero on pakollinen');
      return { isValid: false, errors, normalizedValue: null };
    }
    return { isValid: true, errors: [], normalizedValue: null };
  }

  const regStr = String(value).trim().toUpperCase().replace(/\s/g, '');

  // Finnish vehicle registration formats:
  // ABC-123 (standard)
  // XX-1234 (old format)
  // 123-ABC (old format)
  const pattern = /^([A-Z]{2,3}-\d{1,4}|\d{3}-[A-Z]{1,3})$/;

  if (!pattern.test(regStr)) {
    errors.push('Rekisterinumero ei ole oikeassa muodossa (esim. ABC-123)');
    return { isValid: false, errors, normalizedValue: null };
  }

  return {
    isValid: true,
    errors: [],
    normalizedValue: regStr
  };
}

/**
 * Validate kuormakirja number (integer)
 *
 * @param {any} value - Kuormakirja number to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.required - Whether field is required
 * @returns {ValidationResult}
 */
export function validateKuormakirjaNumber(value, options = {}) {
  const { required = false } = options;
  const errors = [];

  if (!value) {
    if (required) {
      errors.push('Kuormakirja numero on pakollinen');
      return { isValid: false, errors, normalizedValue: null };
    }
    return { isValid: true, errors: [], normalizedValue: null };
  }

  const numStr = String(value).trim().replace(/\D/g, '');
  const num = parseInt(numStr, 10);

  if (isNaN(num) || num <= 0) {
    errors.push('Kuormakirja numeron täytyy olla positiivinen kokonaisluku');
    return { isValid: false, errors, normalizedValue: null };
  }

  return {
    isValid: true,
    errors: [],
    normalizedValue: num
  };
}

/**
 * Normalize field value (clean whitespace, format)
 *
 * @param {any} value - Value to normalize
 * @returns {any} - Normalized value
 */
export function normalizeFieldValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim();
  return value;
}

/**
 * Validate all extracted fields from a document
 *
 * @param {Object} extractedFields - Object with field names as keys
 * @param {Object} fieldDefinitions - Field validation definitions
 * @returns {Object} - Validation results for all fields
 */
export function validateExtractedFields(extractedFields, fieldDefinitions) {
  const results = {};

  for (const [fieldName, fieldValue] of Object.entries(extractedFields)) {
    const definition = fieldDefinitions[fieldName];
    if (!definition) {
      // No validation defined for this field, skip
      results[fieldName] = {
        isValid: true,
        errors: [],
        normalizedValue: normalizeFieldValue(fieldValue)
      };
      continue;
    }

    // Apply appropriate validator based on field type
    switch (definition.type) {
      case 'numeric':
        results[fieldName] = validateNumeric(fieldValue, definition.options);
        break;
      case 'time':
        results[fieldName] = validateTime(fieldValue, definition.options);
        break;
      case 'date':
        results[fieldName] = validateDate(fieldValue, definition.options);
        break;
      case 'text':
        results[fieldName] = validateText(fieldValue, definition.options);
        break;
      case 'vehicleRegistration':
        results[fieldName] = validateVehicleRegistration(fieldValue, definition.options);
        break;
      case 'kuormakirjaNumber':
        results[fieldName] = validateKuormakirjaNumber(fieldValue, definition.options);
        break;
      default:
        results[fieldName] = {
          isValid: true,
          errors: [],
          normalizedValue: normalizeFieldValue(fieldValue)
        };
    }
  }

  return results;
}

/**
 * Check if all required fields are present and valid
 *
 * @param {Object} validationResults - Results from validateExtractedFields
 * @returns {boolean}
 */
export function allRequiredFieldsValid(validationResults) {
  return Object.values(validationResults).every(result => result.isValid);
}
