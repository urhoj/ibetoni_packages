/**
 * Canonical list of allowed origins for CORS configuration
 *
 * This list defines all trusted domains that can make cross-origin requests
 * to betoni.online backend services. Used by CORS middleware in both
 * puminet5api (main backend) and puminet7-functions-app (cron jobs).
 *
 * Last Updated: 2025-11-10
 *
 * Maintenance:
 * - When adding new environment, add all domain variants
 * - Include both betoni.online and ibetoni.fi domains
 * - Test CORS behavior after adding new domains
 * - See: puminet5api/docs/tech/DOMAIN_WHITELIST_CHECKLIST.md
 *
 * @type {string[]}
 */
const allowedOrigins = [
  // stable environment
  "https://stable.ibetoni.fi",
  "https://stable.betoni.online",
  "https://vara.ibetoni.fi",
  "https://vara.betoni.online",

  // functions
  "https://functions.ibetoni.fi",
  "https://puminet7functions.azurewebsites.net",

  // staging environment
  "https://puminet7app-staging.azurewebsites.net",
  "https://staging.betoni.online",
  "https://staging.ibetoni.fi",

  // latest environment
  "https://puminet7app-latest.azurewebsites.net",
  "https://latest.betoni.online",
  "https://latest.ibetoni.fi",

  // staging slot (blue-green deployment staging)
  "https://prod.ibetoni.fi",
  "https://staging.betoni.online",

  // production (live)
  "https://puminet7app.azurewebsites.net",
  "https://puminet7api.azurewebsites.net",
  "https://betoni.online",
  "https://www.betoni.online",
  "https://ibetoni.fi",
  "https://www.ibetoni.fi",

  // api & data
  "https://data.betoni.online",
  "https://data.ibetoni.fi",
  "https://api.betoni.online",
  "https://api.ibetoni.fi",
  "https://api-stable.betoni.online",
  "https://api-stable.ibetoni.fi",
  "https://api-latest.betoni.online",
  "https://api-latest.ibetoni.fi",
  "https://api-staging.betoni.online",
  "https://api-prod.ibetoni.fi",

  // localhost for development
  "http://localhost:3000",
  "http://localhost:5173", // Vite dev server
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173", // Vite dev server
  "http://127.0.0.1:8080",
];

module.exports = {
  allowedOrigins,
};
