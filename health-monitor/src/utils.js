/**
 * Utility functions for health monitoring
 */

/**
 * Format timestamp for display
 *
 * @param {string} isoString - ISO 8601 timestamp
 * @returns {string} Formatted string
 */
export function formatTimestamp(isoString) {
  if (!isoString) return 'Never';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 60) {
    return `${diffSec} seconds ago`;
  } else if (diffMin < 60) {
    return `${diffMin} minutes ago`;
  } else {
    return date.toLocaleTimeString();
  }
}

/**
 * Group health check results by type
 *
 * @param {Array<Object>} results - Health check results
 * @returns {Object} Grouped results
 */
export function groupResultsByType(results) {
  return results.reduce((acc, result) => {
    const type = result.type || 'unknown';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(result);
    return acc;
  }, {});
}

/**
 * Group health check results by environment
 *
 * @param {Array<Object>} results - Health check results
 * @returns {Object} Grouped results
 */
export function groupResultsByEnvironment(results) {
  return results.reduce((acc, result) => {
    const env = result.environment || 'unknown';
    if (!acc[env]) {
      acc[env] = [];
    }
    acc[env].push(result);
    return acc;
  }, {});
}

/**
 * Sort results by status (down first, then slow, then healthy)
 *
 * @param {Array<Object>} results - Health check results
 * @returns {Array<Object>} Sorted results
 */
export function sortByStatus(results) {
  const statusPriority = {
    down: 0,
    slow: 1,
    healthy: 2,
    unknown: 3
  };

  return [...results].sort((a, b) => {
    const priorityA = statusPriority[a.status] ?? 999;
    const priorityB = statusPriority[b.status] ?? 999;
    return priorityA - priorityB;
  });
}

/**
 * Calculate uptime percentage from historical data
 * (Placeholder for future implementation)
 *
 * @param {Array<Object>} historicalData - Array of past health checks
 * @returns {number} Uptime percentage (0-100)
 */
export function calculateUptime(historicalData) {
  if (!historicalData || historicalData.length === 0) {
    return 100;
  }

  const healthyCount = historicalData.filter(
    result => result.status === 'healthy' || result.status === 'slow'
  ).length;

  return (healthyCount / historicalData.length) * 100;
}
