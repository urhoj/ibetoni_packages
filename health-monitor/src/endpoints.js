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
      url: "https://staging.ibetoni.fi",
      versionEndpoint: "https://staging.ibetoni.fi/version",
      type: "frontend",
      environment: "staging",
    },
    {
      name: "Latest Frontend",
      url: "https://latest.ibetoni.fi",
      versionEndpoint: "https://latest.ibetoni.fi/version",
      type: "frontend",
      environment: "latest",
    },
    {
      name: "Stable Frontend",
      url: "https://stable.ibetoni.fi",
      versionEndpoint: "https://stable.ibetoni.fi/version",
      type: "frontend",
      environment: "stable",
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
    {
      name: "Latest API",
      url: "https://api-latest.ibetoni.fi",
      versionEndpoint: "https://api-latest.ibetoni.fi/api/version",
      type: "backend",
      environment: "latest",
    },
    {
      name: "Stable API",
      url: "https://api-stable.ibetoni.fi",
      versionEndpoint: "https://api-stable.ibetoni.fi/api/version",
      type: "backend",
      environment: "stable",
    },
  ],
};

/**
 * Get all endpoints as a flat array
 */
export function getAllEndpoints() {
  return [...ENDPOINTS.frontend, ...ENDPOINTS.backend];
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
