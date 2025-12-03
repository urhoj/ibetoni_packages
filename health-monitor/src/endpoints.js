/**
 * Configuration for all monitored endpoints across deployment environments
 */

export const ENDPOINTS = {
  frontend: [
    {
      name: "Production Frontend",
      url: "https://ibetoni.fi",
      versionEndpoint: "https://ibetoni.fi/version",
      type: "frontend",
      environment: "production",
    },
    {
      name: "Staging Frontend",
      url: "https://wonderful-rock-08f826703-staging.westeurope.3.azurestaticapps.net",
      versionEndpoint: "https://wonderful-rock-08f826703-staging.westeurope.3.azurestaticapps.net/version",
      type: "frontend",
      environment: "staging",
    },
  ],
  backend: [
    {
      name: "Production API",
      url: "https://api.ibetoni.fi",
      versionEndpoint: "https://api.ibetoni.fi/api/version",
      type: "backend",
      environment: "production",
    },
    {
      name: "Staging API",
      url: "https://api-staging.ibetoni.fi",
      versionEndpoint: "https://api-staging.ibetoni.fi/api/version",
      type: "backend",
      environment: "staging",
    },
  ],
  functions: [
    {
      name: "Azure Functions",
      url: "https://functions.ibetoni.fi",
      versionEndpoint: "https://functions.ibetoni.fi/api/httpTest",
      type: "functions",
      environment: "production",
    },
  ],
  infrastructure: [
    {
      name: "Database",
      url: "https://api.ibetoni.fi/api/test/sql",
      versionEndpoint: "https://api.ibetoni.fi/api/test/sql",
      type: "infrastructure",
      environment: "production",
    },
    {
      name: "Redis",
      url: "https://api.ibetoni.fi/api/test/redis",
      versionEndpoint: "https://api.ibetoni.fi/api/test/redis",
      type: "infrastructure",
      environment: "production",
    },
  ],
};

/**
 * Get all endpoints as a flat array
 */
export function getAllEndpoints() {
  return [
    ...ENDPOINTS.frontend,
    ...ENDPOINTS.backend,
    ...ENDPOINTS.functions,
    ...ENDPOINTS.infrastructure,
  ];
}

/**
 * Get endpoints by type
 */
export function getEndpointsByType(type) {
  return ENDPOINTS[type] || [];
}

/**
 * Get endpoints by environment
 */
export function getEndpointsByEnvironment(environment) {
  return getAllEndpoints().filter((ep) => ep.environment === environment);
}
