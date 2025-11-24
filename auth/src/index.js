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

  // Google OAuth
  GoogleAuth,
  createGoogleAuth,
};
