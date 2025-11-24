/**
 * Core health checking logic for monitoring endpoints
 */

import axios from 'axios';

/**
 * Status levels
 */
export const STATUS = {
  HEALTHY: 'healthy',
  SLOW: 'slow',
  DOWN: 'down',
  UNKNOWN: 'unknown'
};

/**
 * Response time thresholds (milliseconds)
 */
const THRESHOLDS = {
  HEALTHY_MAX: 2000,  // < 2s is healthy
  SLOW_MAX: 5000      // 2-5s is slow, > 5s or timeout is down
};

/**
 * Check health of a single endpoint
 *
 * @param {Object} endpoint - Endpoint configuration
 * @param {string} endpoint.name - Display name
 * @param {string} endpoint.url - Base URL for ping test
 * @param {string} endpoint.versionEndpoint - URL for version check
 * @returns {Promise<Object>} Health check result
 */
export async function checkEndpointHealth(endpoint) {
  const startTime = Date.now();

  const result = {
    name: endpoint.name,
    url: endpoint.url,
    type: endpoint.type,
    environment: endpoint.environment,
    status: STATUS.UNKNOWN,
    responseTime: null,
    version: null,
    error: null,
    lastChecked: new Date().toISOString()
  };

  try {
    // Ping the version endpoint to check health AND get version
    const response = await axios.get(endpoint.versionEndpoint, {
      timeout: THRESHOLDS.SLOW_MAX,
      validateStatus: (status) => status < 500, // Accept all non-5xx as "up"
      headers: {
        'User-Agent': 'ibetoni-health-monitor/1.0'
      }
    });

    const responseTime = Date.now() - startTime;
    result.responseTime = responseTime;

    // Check if we got a successful response
    if (response.status === 200) {
      // Try to extract version from response
      if (response.data && response.data.version) {
        result.version = response.data.version;
      }

      // Determine status based on response time
      if (responseTime < THRESHOLDS.HEALTHY_MAX) {
        result.status = STATUS.HEALTHY;
      } else if (responseTime < THRESHOLDS.SLOW_MAX) {
        result.status = STATUS.SLOW;
      } else {
        result.status = STATUS.DOWN;
      }
    } else {
      // Non-200 response
      result.status = STATUS.DOWN;
      result.error = `HTTP ${response.status}`;
    }

  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.status = STATUS.DOWN;

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      result.error = 'Timeout';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      result.error = 'Connection failed';
    } else if (error.response) {
      result.error = `HTTP ${error.response.status}`;
    } else {
      result.error = error.message || 'Unknown error';
    }
  }

  return result;
}

/**
 * Check health of multiple endpoints in parallel
 *
 * @param {Array<Object>} endpoints - Array of endpoint configurations
 * @returns {Promise<Array<Object>>} Array of health check results
 */
export async function checkMultipleEndpoints(endpoints) {
  const promises = endpoints.map(endpoint => checkEndpointHealth(endpoint));
  return Promise.all(promises);
}

/**
 * Get status summary from health check results
 *
 * @param {Array<Object>} results - Health check results
 * @returns {Object} Summary statistics
 */
export function getStatusSummary(results) {
  const summary = {
    total: results.length,
    healthy: 0,
    slow: 0,
    down: 0,
    unknown: 0,
    overallStatus: STATUS.HEALTHY
  };

  results.forEach(result => {
    switch (result.status) {
      case STATUS.HEALTHY:
        summary.healthy++;
        break;
      case STATUS.SLOW:
        summary.slow++;
        break;
      case STATUS.DOWN:
        summary.down++;
        break;
      default:
        summary.unknown++;
    }
  });

  // Determine overall status
  if (summary.down > 0) {
    summary.overallStatus = STATUS.DOWN;
  } else if (summary.slow > 0) {
    summary.overallStatus = STATUS.SLOW;
  } else if (summary.healthy === summary.total) {
    summary.overallStatus = STATUS.HEALTHY;
  } else {
    summary.overallStatus = STATUS.UNKNOWN;
  }

  return summary;
}

/**
 * Format response time for display
 *
 * @param {number} ms - Response time in milliseconds
 * @returns {string} Formatted string
 */
export function formatResponseTime(ms) {
  if (ms === null) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Get status icon/emoji
 *
 * @param {string} status - Status level
 * @returns {string} Emoji
 */
export function getStatusIcon(status) {
  switch (status) {
    case STATUS.HEALTHY:
      return '🟢';
    case STATUS.SLOW:
      return '🟡';
    case STATUS.DOWN:
      return '🔴';
    default:
      return '⚪';
  }
}

/**
 * Get status color for styling
 *
 * @param {string} status - Status level
 * @returns {string} Color code
 */
export function getStatusColor(status) {
  switch (status) {
    case STATUS.HEALTHY:
      return '#4caf50'; // Green
    case STATUS.SLOW:
      return '#ff9800'; // Orange
    case STATUS.DOWN:
      return '#f44336'; // Red
    default:
      return '#9e9e9e'; // Grey
  }
}
