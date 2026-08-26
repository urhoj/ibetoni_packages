const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { buildCompanyRoles } = require("@ibetoni/constants");
const { compressPayload, expandPayload } = require("./jwtPayloadCodec.cjs");

// Sign-side gate: when true, createToken emits the v2 short wire shape
// (~50% smaller for typical multi-company users). Verify side accepts both
// shapes unconditionally via expandPayload, so this flag can be flipped
// independently per environment.
const useShortShape = () => process.env.JWT_SHORT_KEYS === "true";

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
 * NOTE the entries carry NO `ownerAsiakasId`: the claim builder selects only
 * asiakasId + the four company-type flags, so nothing downstream can resolve a
 * company's OWNER from this list — only membership by asiakasId. Backend gates
 * that appear to offer owner-based access off this data are inert, not live
 * (betoni.online feedback #398).
 *
 * @param {Array} asiakasesWithTypes - JWT field, array of {asiakasId, roles, isPumppuToimittaja, ...}
 * @returns {Array} array of {asiakasId, companyRoles: {isXxx: boolean}, isPumppuToimittaja, ...}
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
      const rawDecoded = /** @type {import('jsonwebtoken').JwtPayload} */ (
        jwt.verify(token, jwtKey, { algorithms: ["HS256"] })
      );
      // Expand v2 short shape → canonical. Legacy/peli payloads pass through.
      // Fail-closed on unknown role typeId (throws → caught below → 401).
      const decoded = expandPayload(rawDecoded);

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
      //
      // NOT a wire claim — it is derived HERE, from `asiakasesWithTypes`, before
      // req.user is assigned. Backend membership gates read the derived field, so
      // grepping the JWT's claims alone makes those gates look dead (feedback
      // #398). Pinned by jwtUtils.integration.test.js.
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

  // Scope tokens (peli) are a DIFFERENT token family with their own claims
  // (peliUserId, displayName) — compressPayload is an app-token whitelist and
  // would drop them at sign time, silently breaking that login. They stay
  // long-shape regardless of the flag; verify accepts both shapes anyway.
  const short = useShortShape() && user.scope === undefined;
  const payload = short ? compressPayload(user) : user;

  const token = jwt.sign(payload, jwtKey, {
    algorithm: "HS256",
    expiresIn: /** @type {any} */ (expiresIn),
    // iss claim binds tokens to the betoni.online environment so a token
    // can't be replayed against an unrelated service that happens to share
    // the JWT_KEY. Verify side is intentionally NOT enforcing yet — once
    // all in-flight tokens carry iss (after token TTL), a follow-up commit
    // adds { issuer: "betoni.online" } to jwt.verify to enforce strictly.
    issuer: "betoni.online",
    // Drop iat in short shape — no source-code consumers; saves ~12 B/token.
    ...(short ? { noTimestamp: true } : {}),
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
  const rawDecoded = /** @type {import('jsonwebtoken').JwtPayload} */ (
    jwt.verify(token, jwtKey, { algorithms: ["HS256"] })
  );
  // Expand v2 short shape → canonical. Fail-closed on unknown role typeId.
  return expandPayload(rawDecoded);
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
  const result = await bcrypt.compare(password, hashedPassword);
  return result;
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

  // Extract relevant claims (excluding JWT standard claims like exp, iat, iss).
  // iss must be dropped — createToken sets `issuer` in jwt.sign options and
  // jsonwebtoken throws if the payload also carries an iss property.
  const {
    email,
    personId,
    exp: _exp,
    iat: _iat,
    iss: _iss,
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
  refreshToken,
  deriveCompanyRoles,
  deriveAsiakasList,
};
