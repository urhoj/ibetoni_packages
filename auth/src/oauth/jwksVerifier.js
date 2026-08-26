const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const jwksClient = require("jwks-rsa");

/**
 * Shared JWKS plumbing for the OAuth providers (Microsoft, Apple, LinkedIn).
 *
 * Each provider used to carry its own copy of the same lazily-initialized
 * jwks-rsa client and jwt.verify key-resolver callback; the only variation was
 * the JWKS URI. This module is that block, once.
 *
 * @module @ibetoni/auth/oauth/jwksVerifier
 */

const jwtVerify = promisify(jwt.verify);

/**
 * Build a key resolver compatible with jwt.verify's secretOrKeyProvider shape.
 * The jwks-rsa client is created lazily on first use; keys are cached 24h.
 *
 * @param {string} jwksUri - Provider's JWKS endpoint
 * @param {object|null} [injectedClient] - Test stub exposing getSigningKey(kid)
 *   (vitest 4.x cannot intercept CJS require() of jwks-rsa via vi.mock, so the
 *   providers pass their `options.jwksClient` constructor hook through here).
 * @returns {(header: object, callback: Function) => void}
 */
function createKeyResolver(jwksUri, injectedClient = null) {
  let client = injectedClient;
  return (header, callback) => {
    if (!client) {
      client = jwksClient({
        jwksUri,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 24 * 60 * 60 * 1000, // 24 hours
      });
    }
    client
      .getSigningKey(header.kid)
      .then((key) => callback(null, key.getPublicKey()))
      .catch((err) => callback(err));
  };
}

module.exports = { jwtVerify, createKeyResolver };
