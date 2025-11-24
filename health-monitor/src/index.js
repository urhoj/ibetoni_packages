/**
 * @ibetoni/health-monitor
 *
 * Health monitoring and status dashboard for betoni.online deployment environments
 */

// Export endpoints configuration
export {
  ENDPOINTS,
  getAllEndpoints,
  getEndpointsByType,
  getEndpointsByEnvironment
} from './endpoints.js';

// Export health checking functions
export {
  STATUS,
  checkEndpointHealth,
  checkMultipleEndpoints,
  getStatusSummary,
  formatResponseTime,
  getStatusIcon,
  getStatusColor
} from './healthChecker.js';

// Export utilities
export {
  formatTimestamp,
  groupResultsByType,
  groupResultsByEnvironment,
  sortByStatus,
  calculateUptime
} from './utils.js';

// Export React component (if in browser environment)
export { default as HealthDashboard } from './HealthDashboard.jsx';
