/**
 * @ibetoni/auth
 *
 * Shared authentication utilities for betoni.online platform
 *
 * This package provides centralized authentication logic including:
 * - JWT token creation, verification, and management
 * - Google OAuth verification
 * - Password hashing and comparison
 *
 * Usage:
 *   const { createVerifyTokenMiddleware, createToken } = require('@ibetoni/auth');
 *   const { createGoogleAuth } = require('@ibetoni/auth');
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
const jwtPayloadCodec = require("./jwt/jwtPayloadCodec.cjs");
const { GoogleAuth, createGoogleAuth } = require("./oauth/googleAuth");

module.exports = {
  // JWT utilities
  createVerifyTokenMiddleware: jwtUtils.createVerifyTokenMiddleware,
  createToken: jwtUtils.createToken,
  getTokenData: jwtUtils.getTokenData,
  hashPassword: jwtUtils.hashPassword,
  comparePassword: jwtUtils.comparePassword,
  isTokenExpiringSoon: jwtUtils.isTokenExpiringSoon,
  refreshToken: jwtUtils.refreshToken,
  deriveAsiakasList: jwtUtils.deriveAsiakasList,
  deriveCompanyRoles: jwtUtils.deriveCompanyRoles,

  // JWT payload codec (v2 short shape)
  compressPayload: jwtPayloadCodec.compressPayload,
  expandPayload: jwtPayloadCodec.expandPayload,
  isShortShape: jwtPayloadCodec.isShortShape,
  PAYLOAD_VERSION: jwtPayloadCodec.PAYLOAD_VERSION,
  GLOBAL_ROLE_FLAGS: jwtPayloadCodec.GLOBAL_ROLE_FLAGS,
  COMPANY_FLAGS: jwtPayloadCodec.COMPANY_FLAGS,

  // Google OAuth
  GoogleAuth,
  createGoogleAuth,

  // Microsoft OAuth
  MicrosoftAuth: require("./oauth/microsoftAuth").MicrosoftAuth,
  createMicrosoftAuth: require("./oauth/microsoftAuth").createMicrosoftAuth,
};
