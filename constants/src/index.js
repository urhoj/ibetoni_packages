/**
 * @ibetoni/constants
 *
 * Shared constants for betoni.online platform
 *
 * This package provides centralized constants used across multiple services,
 * eliminating duplication and ensuring consistency.
 *
 * Usage:
 *   import { allowedOrigins, HTTP_STATUS, ERROR_CODES } from '@ibetoni/constants';
 *   // or access specific modules
 *   import { HTTP_STATUS } from '@ibetoni/constants/http';
 */

import { allowedOrigins } from "./domains.js";
import { HTTP_STATUS } from "./http.js";
import { ERROR_CODES } from "./errors.js";
import {
  CACHE_TTL,
  DEFAULT_KEIKKA_TTL,
  DEFAULT_TYOMAA_TTL,
  DEFAULT_PERSON_TTL,
  DEFAULT_VEHICLE_TTL,
  DEFAULT_WEATHER_TTL,
} from "./cache.js";
import {
  SECURITY,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION,
  RATE_LIMIT_WINDOW,
  MAX_REQUESTS_PER_WINDOW,
} from "./security.js";

export {
  // Domain constants
  allowedOrigins,

  // HTTP status codes
  HTTP_STATUS,

  // Error codes
  ERROR_CODES,

  // Cache TTL values
  CACHE_TTL,
  DEFAULT_KEIKKA_TTL,
  DEFAULT_TYOMAA_TTL,
  DEFAULT_PERSON_TTL,
  DEFAULT_VEHICLE_TTL,
  DEFAULT_WEATHER_TTL,

  // Security constants
  SECURITY,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION,
  RATE_LIMIT_WINDOW,
  MAX_REQUESTS_PER_WINDOW,
};
