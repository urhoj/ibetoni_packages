/**
 * @ibetoni/auth
 *
 * Shared authentication utilities for betoni.online platform
 *
 * This package provides centralized authentication logic including:
 * - JWT token creation, verification, and management
 * - Google OAuth verification
 * - Microsoft OAuth verification
 * - Apple OAuth verification
 * - Password hashing and comparison
 *
 * Usage:
 *   const { createVerifyTokenMiddleware, createToken } = require('@ibetoni/auth');
 *   const { createGoogleAuth, createMicrosoftAuth, createAppleAuth } = require('@ibetoni/auth');
 *
 * Configuration:
 *   All functions support both sync (process.env) and async (Key Vault) configuration:
 *   - Sync: Just call the functions, they'll use process.env
 *   - Async: Pass { getEnvVar: asyncFunction } as options parameter
 *
 * Logger Support:
 *   All functions accept an optional logger parameter for custom logging
 */

const jwtUtils = require("./jwt/jwtUtils");
const { GoogleAuth, createGoogleAuth, INVALID_OAUTH_TOKEN } = require("./oauth/googleAuth");

// The JWT payload codec (v2 short shape) is NOT re-exported here — consume it via
// the dedicated subpath `@ibetoni/auth/codec`, which routes ESM callers to the .js
// half and CJS callers to the .cjs half. The root barrel would pin everyone to CJS.

module.exports = {
  // JWT utilities
  createVerifyTokenMiddleware: jwtUtils.createVerifyTokenMiddleware,
  createToken: jwtUtils.createToken,
  getTokenData: jwtUtils.getTokenData,
  hashPassword: jwtUtils.hashPassword,
  comparePassword: jwtUtils.comparePassword,
  refreshToken: jwtUtils.refreshToken,
  deriveAsiakasList: jwtUtils.deriveAsiakasList,
  deriveCompanyRoles: jwtUtils.deriveCompanyRoles,

  // Google OAuth
  GoogleAuth,
  createGoogleAuth,
  // Tag on OAuth verification errors meaning "bad credential" → answer 401.
  // Untagged errors from the same call are server faults → 500 + Sentry.
  INVALID_OAUTH_TOKEN,
  isInvalidTokenError: require("./oauth/oauthErrors").isInvalidTokenError,

  // Microsoft OAuth
  MicrosoftAuth: require("./oauth/microsoftAuth").MicrosoftAuth,
  createMicrosoftAuth: require("./oauth/microsoftAuth").createMicrosoftAuth,

  // Apple OAuth
  AppleAuth: require("./oauth/appleAuth").AppleAuth,
  createAppleAuth: require("./oauth/appleAuth").createAppleAuth,

  // LinkedIn OAuth
  LinkedInAuth: require("./oauth/linkedinAuth").LinkedInAuth,
  createLinkedInAuth: require("./oauth/linkedinAuth").createLinkedInAuth,
};
