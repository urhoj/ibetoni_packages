const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { buildCompanyRoles } = require("@ibetoni/constants");

/**
 * JWT Utilities for betoni.online platform
 *
 * Provides JWT token creation, verification, and management
 * Compatible with both sync (process.env) and async (Key Vault) configurations
 */

/**
 * Get JWT key from environment
 * Supports both sync and async retrieval
 * @param {object} [options] - Configuration options
 * @param {function} [options.getEnvVar] - Optional async function to get env var
 * @returns {Promise<string>} JWT key
 */
const getJwtKey = async (options = {}) => {
  if (options.getEnvVar) {
    // Async retrieval (Key Vault)
    return await options.getEnvVar("JWT_KEY");
  }
  // Sync retrieval (process.env)
  const jwtKey = process.env.JWT_KEY;
  if (!jwtKey) {
    throw new Error("JWT_KEY environment variable is not set");
  }
  return jwtKey;
};

/**
 * Derive companyRoles from asiakasesWithTypes for current ownerAsiakasId
 * This provides backward compatibility - companyRoles is no longer stored in JWT
 * but derived from asiakasesWithTypes + ownerAsiakasId
 *
 * @param {Array} asiakasesWithTypes - Array of {asiakasId, roles}
 * @param {number} ownerAsiakasId - Current company ID
 * @returns {object} companyRoles object with boolean flags
 */
const deriveCompanyRoles = (asiakasesWithTypes, ownerAsiakasId) => {
  const currentAsiakas = Array.isArray(asiakasesWithTypes)
    ? asiakasesWithTypes.find((a) => a.asiakasId === ownerAsiakasId)
    : null;
  return { ownerAsiakasId, ...buildCompanyRoles(currentAsiakas?.roles) };
};

/**
 * Build a normalized asiakasList from JWT asiakasesWithTypes.
 *
 * Mirrors the frontend `user.asiakasList` shape so backend and frontend
 * code can use identical access patterns: `entry.companyRoles.isXxx`.
 *
 * Pure function. Never throws. Returns [] for any non-array input.
 * The legacy `roles: string[]` field is intentionally dropped from the
 * output — consumers should read `companyRoles` instead.
 *
 * @param {Array} asiakasesWithTypes - JWT field, array of {asiakasId, ownerAsiakasId, roles, isPumppuToimittaja, ...}
 * @returns {Array} array of {asiakasId, ownerAsiakasId, companyRoles: {isXxx: boolean}, isPumppuToimittaja, ...}
 */
const deriveAsiakasList = (asiakasesWithTypes) => {
  if (!Array.isArray(asiakasesWithTypes)) return [];
  return asiakasesWithTypes.map(({ roles, ...rest }) => ({
    ...rest,
    companyRoles: buildCompanyRoles(roles),
  }));
};

/**
 * Create Express middleware to verify JWT tokens
 * @param {object} [options] - Middleware options
 * @param {function} [options.getEnvVar] - Optional async function to get env vars
 * @returns {function} Express middleware function
 */
const createVerifyTokenMiddleware = (options = {}) => {
  return async (req, res, next) => {
    // Extract token from cookie (server-side navigation) or Authorization header (API calls)
    let token = req.cookies?.auth_token;
    let tokenSource = "cookie";

    // If not in cookie, check Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error(
          "Authentication failed: Missing token in both cookie and Authorization header",
          { path: req.path },
        );
        return res.status(403).json({
          success: false,
          message: "A token is required for authentication",
          error: "MISSING_TOKEN",
        });
      }

      token = authHeader.substring(7); // Remove 'Bearer ' prefix
      tokenSource = "header";
    }

    if (!token || token === "undefined") {
      console.error("Authentication failed: Empty token", {
        path: req.path,
        tokenSource,
      });
      return res.status(403).json({
        success: false,
        message: "A token is required for authentication",
        error: "MISSING_TOKEN",
      });
    }

    try {
      const jwtKey = await getJwtKey(options);
      const decoded = /** @type {import('jsonwebtoken').JwtPayload} */ (
        jwt.verify(token, jwtKey)
      );

      // Validate required claims
      if (!decoded.personId && !decoded.email) {
        console.error("JWT missing required claims", {
          path: req.path,
          hasPersonId: !!decoded.personId,
          hasEmail: !!decoded.email,
        });
        return res.status(401).json({
          success: false,
          message: "Invalid Token",
          error: "INVALID_TOKEN_CLAIMS",
        });
      }

      // Derive companyRoles from asiakasesWithTypes if not already present
      // This provides backward compatibility - JWT no longer stores companyRoles directly
      if (
        !decoded.companyRoles &&
        decoded.asiakasesWithTypes &&
        decoded.ownerAsiakasId
      ) {
        decoded.companyRoles = deriveCompanyRoles(
          decoded.asiakasesWithTypes,
          decoded.ownerAsiakasId,
        );
      }

      // Normalized per-company shape mirroring the frontend `user.asiakasList`.
      // Always present (defaults to []), so consumers can iterate without guards.
      decoded.asiakasList = deriveAsiakasList(decoded.asiakasesWithTypes);

      // Attach user data to request
      req.user = decoded;

      return next();
    } catch (error) {
      console.error("JWT verification failed", {
        error: error.message,
        path: req.path,
        tokenSource,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid Token",
        error: "INVALID_TOKEN",
      });
    }
  };
};

/**
 * Create a JWT token for a user
 * @param {string} email - User email
 * @param {number} personId - User person ID
 * @param {object} additionalClaims - Additional claims to include in token
 * @param {object} [options] - Token creation options
 * @param {function} [options.getEnvVar] - Optional async function to get env vars
 * @param {string} [options.expiresIn] - Optional token expiry (e.g. '60d'), defaults to '7d'
 * @returns {Promise<string>} JWT token
 */
const createToken = async (
  email,
  personId,
  additionalClaims = {},
  options = {},
) => {
  const jwtKey = await getJwtKey(options);

  // Default token expiration: 7 days; callers can override via options.expiresIn
  const expiresIn = options.expiresIn || "7d";

  // Base claims that are always included
  const user = {
    email,
    personId,
    ...additionalClaims, // Allow additional claims (globalRoles, companyRoles, etc.)
  };

  const token = jwt.sign(user, jwtKey, {
    expiresIn: /** @type {any} */ (expiresIn),
  });

  return token;
};

/**
 * Get decoded JWT token data
 * @param {string} token - JWT token
 * @param {object} [options] - Decoding options
 * @param {function} [options.getEnvVar] - Optional async function to get env vars
 * @returns {Promise<object>} Decoded token payload
 */
const getTokenData = async (token, options = {}) => {
  const jwtKey = await getJwtKey(options);
  const decoded = /** @type {import('jsonwebtoken').JwtPayload} */ (
    jwt.verify(token, jwtKey)
  );
  return decoded;
};

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {string} Hashed password
 */
const hashPassword = (password) => {
  const hashedPassword = bcrypt.hashSync(password, 10);
  return hashedPassword;
};

/**
 * Compare a password with its hash
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
const comparePassword = async (password, hashedPassword) => {
  const result = await bcrypt.compareSync(password, hashedPassword);
  return result;
};

/**
 * Check if token is close to expiration
 * @param {string} token - JWT token to check
 * @param {object} [options] - Check options
 * @param {number} [options.hoursBeforeExpiry] - Hours before expiry to consider "close" (default: 24)
 * @param {function} [options.getEnvVar] - Optional async function to get env vars
 * @returns {Promise<{isExpiringSoon: boolean, expiresAt: Date|null, hoursUntilExpiry: number}>}
 */
const isTokenExpiringSoon = async (token, options = {}) => {
  const hoursBeforeExpiry = options.hoursBeforeExpiry || 24;

  try {
    const decoded = await getTokenData(token, options);
    const expiresAt = new Date(decoded.exp * 1000);
    const now = new Date();
    const hoursUntilExpiry =
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    return {
      isExpiringSoon: hoursUntilExpiry <= hoursBeforeExpiry,
      expiresAt,
      hoursUntilExpiry: Math.round(hoursUntilExpiry * 10) / 10, // Round to 1 decimal
    };
  } catch (_error) {
    // If token is invalid or expired, return true for expiring soon
    return {
      isExpiringSoon: true,
      expiresAt: null,
      hoursUntilExpiry: 0,
    };
  }
};

/**
 * Refresh a JWT token (issue new token with same claims)
 * @param {string} token - Current JWT token
 * @param {object} [options] - Refresh options
 * @param {function} [options.getEnvVar] - Optional async function to get env vars
 * @returns {Promise<string>} New JWT token with refreshed expiration
 */
const refreshToken = async (token, options = {}) => {
  const decoded = await getTokenData(token, options);

  // Extract relevant claims (excluding JWT standard claims like exp, iat)
  const {
    email,
    personId,
    exp: _exp,
    iat: _iat,
    ...additionalClaims
  } = decoded;

  // Issue new token with same claims but fresh expiration
  const newToken = await createToken(
    email,
    personId,
    additionalClaims,
    options,
  );
  return newToken;
};

module.exports = {
  createVerifyTokenMiddleware,
  createToken,
  getTokenData,
  hashPassword,
  comparePassword,
  isTokenExpiringSoon,
  refreshToken,
  deriveCompanyRoles,
  deriveAsiakasList,
};
