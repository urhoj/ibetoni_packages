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
import {
  ADMIN_COMPANY_ROLE_TYPE_IDS,
  ASIAKAS_EDITOR_ROLE_TYPE_ID,
  KALLE_URHO_OY_ASIAKAS_ID,
  MAXBE_OY_ASIAKAS_ID,
  ASIAKAS_LASKU_READ_ROLE_TYPE_IDS,
  COMPANY_ROLE_TO_TYPE_ID,
  PERSON_ANY_ADMIN_SETTING_TYPE_IDS,
  PERSON_SETTING_TYPE_IDS,
  ROLE_NAME_TO_KEY_MAP,
  TYPE_ID_TO_ROLE_NAME,
} from "./roles.js";

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

  // Role mapping constants
  COMPANY_ROLE_TO_TYPE_ID,
  ROLE_NAME_TO_KEY_MAP,
  TYPE_ID_TO_ROLE_NAME,
  ADMIN_COMPANY_ROLE_TYPE_IDS,
  ASIAKAS_EDITOR_ROLE_TYPE_ID,
  KALLE_URHO_OY_ASIAKAS_ID,
  MAXBE_OY_ASIAKAS_ID,
  ASIAKAS_LASKU_READ_ROLE_TYPE_IDS,
  PERSON_ANY_ADMIN_SETTING_TYPE_IDS,
  PERSON_SETTING_TYPE_IDS,
};
