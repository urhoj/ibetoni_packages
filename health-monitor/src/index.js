/**
 * @ibetoni/health-monitor
 *
 * Health checks for betoni.online deployment environments.
 * Sole consumer: puminet7-functions-app /api/external-health.
 */

export { ENDPOINTS, getAllEndpoints } from './endpoints.js';
export { STATUS, checkEndpointHealth, checkMultipleEndpoints } from './healthChecker.js';
