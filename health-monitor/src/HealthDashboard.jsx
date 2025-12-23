/**
 * Health Dashboard React Component
 *
 * Displays status of all monitored endpoints with real-time health checks
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import {
  getAllEndpoints,
  checkMultipleEndpoints,
  getStatusSummary,
  formatResponseTime,
  getStatusIcon,
  getStatusColor,
  formatTimestamp,
  groupResultsByType
} from './index.js';

// Styles extracted to prevent re-creation on every render
const styles = {
  container: {
    fontFamily: 'system-ui, sans-serif',
    padding: '20px'
  },
  header: {
    marginBottom: '30px'
  },
  headerTitle: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 600
  },
  headerSubtitle: {
    margin: '8px 0 0 0',
    color: '#666',
    fontSize: '14px'
  },
  summaryBox: {
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    marginBottom: '30px'
  },
  summaryTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '10px'
  },
  summaryStats: {
    display: 'flex',
    gap: '20px',
    fontSize: '14px'
  },
  buttonContainer: {
    marginBottom: '20px'
  },
  button: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#1976d2',
    color: 'white',
    border: 'none',
    borderRadius: '4px'
  },
  sectionContainer: {
    marginBottom: '30px'
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '15px',
    borderBottom: '2px solid #ddd',
    paddingBottom: '8px'
  },
  grid: {
    display: 'grid',
    gap: '15px'
  },
  noResults: {
    textAlign: 'center',
    padding: '40px',
    color: '#666'
  },
  card: {
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  cardContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  cardInner: {
    flex: 1
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px'
  },
  statusIcon: {
    fontSize: '20px'
  },
  cardName: {
    fontSize: '16px',
    fontWeight: 600
  },
  badge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '12px',
    textTransform: 'uppercase'
  },
  cardUrl: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '8px'
  },
  link: {
    color: '#1976d2',
    textDecoration: 'none'
  },
  cardDetails: {
    display: 'flex',
    gap: '20px',
    fontSize: '13px',
    color: '#444'
  },
  errorText: {
    color: '#d32f2f'
  }
};

/**
 * Get badge color based on endpoint type
 */
function getTypeBadgeColor(type) {
  const colors = {
    frontend: { bg: '#e3f2fd', text: '#1976d2' },
    backend: { bg: '#f3e5f5', text: '#7b1fa2' },
    functions: { bg: '#fff3e0', text: '#e65100' }
  };
  return colors[type] || { bg: '#f5f5f5', text: '#666' };
}

/**
 * Individual endpoint status card
 */
const EndpointCard = memo(function EndpointCard({ result }) {
  const statusColor = getStatusColor(result.status);
  const badgeColors = getTypeBadgeColor(result.type);

  return (
    <div style={{
      ...styles.card,
      border: `2px solid ${statusColor}`
    }}>
      <div style={styles.cardContent}>
        <div style={styles.cardInner}>
          {/* Name and Status */}
          <div style={styles.cardHeader}>
            <span style={styles.statusIcon}>{getStatusIcon(result.status)}</span>
            <span style={styles.cardName}>{result.name}</span>
            <span style={{
              ...styles.badge,
              backgroundColor: badgeColors.bg,
              color: badgeColors.text
            }}>
              {result.environment}
            </span>
          </div>

          {/* URL */}
          <div style={styles.cardUrl}>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              {result.url}
            </a>
          </div>

          {/* Details */}
          <div style={styles.cardDetails}>
            <span>
              <strong>Response:</strong> {formatResponseTime(result.responseTime)}
            </span>
            {result.version && (
              <span>
                <strong>Version:</strong> {result.version}
              </span>
            )}
            {result.error && (
              <span style={styles.errorText}>
                <strong>Error:</strong> {result.error}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

EndpointCard.propTypes = {
  result: PropTypes.shape({
    name: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    type: PropTypes.string,
    environment: PropTypes.string,
    status: PropTypes.string.isRequired,
    responseTime: PropTypes.number,
    version: PropTypes.string,
    error: PropTypes.string
  }).isRequired
};

const typeOrder = ['frontend', 'backend', 'functions'];
const typeLabels = {
  frontend: 'Frontend',
  backend: 'Backend API',
  functions: 'Azure Functions'
};

/**
 * HealthDashboard Component
 *
 * @param {Object} props
 * @param {number} props.refreshInterval - Auto-refresh interval in ms (default: 60000)
 * @param {boolean} props.autoRefresh - Enable auto-refresh (default: true)
 * @param {Object} props.style - Custom styling
 * @param {Object} props.logger - Custom logger (default: console)
 */
export default function HealthDashboard({
  refreshInterval = 60000,
  autoRefresh = true,
  style = {},
  logger = console
}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [summary, setSummary] = useState(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    try {
      const endpoints = getAllEndpoints();
      const healthResults = await checkMultipleEndpoints(endpoints);
      setResults(healthResults);
      setSummary(getStatusSummary(healthResults));
      setLastUpdate(new Date().toISOString());
    } catch (error) {
      logger.error('Health check failed:', error);
    } finally {
      setLoading(false);
    }
  }, [logger]);

  // Initial check on mount
  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      checkHealth();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, checkHealth]);

  // Group results by type
  const groupedResults = groupResultsByType(results);

  return (
    <div style={{ ...styles.container, ...style }}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>
          System Status Dashboard
        </h1>
        <p style={styles.headerSubtitle}>
          Last updated: {formatTimestamp(lastUpdate)}
          {loading && ' (Checking...)'}
        </p>
      </div>

      {/* Summary */}
      {summary && (
        <div style={{
          ...styles.summaryBox,
          border: `3px solid ${getStatusColor(summary.overallStatus)}`
        }}>
          <div style={styles.summaryTitle}>
            {getStatusIcon(summary.overallStatus)} Overall Status: {summary.overallStatus.toUpperCase()}
          </div>
          <div style={styles.summaryStats}>
            <span>Healthy: {summary.healthy}</span>
            <span>Slow: {summary.slow}</span>
            <span>Down: {summary.down}</span>
            <span>Total: {summary.total}</span>
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div style={styles.buttonContainer}>
        <button
          onClick={checkHealth}
          disabled={loading}
          style={{
            ...styles.button,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Checking...' : 'Refresh Now'}
        </button>
      </div>

      {/* Results by Type */}
      {typeOrder.map(type => {
        const typeResults = groupedResults[type] || [];
        if (typeResults.length === 0) return null;

        return (
          <div key={type} style={styles.sectionContainer}>
            <h2 style={styles.sectionTitle}>
              {typeLabels[type] || type}
            </h2>

            <div style={styles.grid}>
              {typeResults.map((result) => (
                <EndpointCard key={result.url} result={result} />
              ))}
            </div>
          </div>
        );
      })}

      {/* No Results */}
      {results.length === 0 && !loading && (
        <div style={styles.noResults}>
          No health check results available
        </div>
      )}
    </div>
  );
}

HealthDashboard.propTypes = {
  refreshInterval: PropTypes.number,
  autoRefresh: PropTypes.bool,
  style: PropTypes.object,
  logger: PropTypes.shape({
    error: PropTypes.func
  })
};
