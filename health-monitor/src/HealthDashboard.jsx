/**
 * Health Dashboard React Component
 *
 * Displays status of all monitored endpoints with real-time health checks
 * Supports light and dark mode via the darkMode prop
 */

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
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

// Color themes for light and dark mode
const themes = {
  light: {
    background: '#ffffff',
    backgroundAlt: '#f5f5f5',
    text: '#000000',
    textMuted: '#666666',
    textSecondary: '#444444',
    border: '#dddddd',
    cardBackground: '#ffffff',
    cardShadow: '0 2px 4px rgba(0,0,0,0.1)',
    primary: '#1976d2',
    error: '#d32f2f',
    badges: {
      frontend: { bg: '#e3f2fd', text: '#1976d2' },
      backend: { bg: '#f3e5f5', text: '#7b1fa2' },
      functions: { bg: '#fff3e0', text: '#e65100' },
      default: { bg: '#f5f5f5', text: '#666666' }
    }
  },
  dark: {
    background: '#121212',
    backgroundAlt: '#1e1e1e',
    text: '#ffffff',
    textMuted: '#b0b0b0',
    textSecondary: '#9e9e9e',
    border: '#333333',
    cardBackground: '#1e1e1e',
    cardShadow: '0 2px 4px rgba(0,0,0,0.3)',
    primary: '#90caf9',
    error: '#ef5350',
    badges: {
      frontend: { bg: '#1e3a5f', text: '#90caf9' },
      backend: { bg: '#3d2a4d', text: '#ce93d8' },
      functions: { bg: '#3d2c1f', text: '#ffb74d' },
      default: { bg: '#2a2a2a', text: '#b0b0b0' }
    }
  }
};

// Generate styles based on theme
const getStyles = (theme) => ({
  container: {
    fontFamily: 'system-ui, sans-serif',
    padding: '20px',
    backgroundColor: theme.background,
    color: theme.text,
    minHeight: '100%'
  },
  header: {
    marginBottom: '30px'
  },
  headerTitle: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 600,
    color: theme.text
  },
  headerSubtitle: {
    margin: '8px 0 0 0',
    color: theme.textMuted,
    fontSize: '14px'
  },
  summaryBox: {
    padding: '20px',
    backgroundColor: theme.backgroundAlt,
    borderRadius: '8px',
    marginBottom: '30px'
  },
  summaryTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '10px',
    color: theme.text
  },
  summaryStats: {
    display: 'flex',
    gap: '20px',
    fontSize: '14px',
    color: theme.textSecondary
  },
  buttonContainer: {
    marginBottom: '20px'
  },
  button: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: theme.primary,
    color: '#ffffff',
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
    borderBottom: `2px solid ${theme.border}`,
    paddingBottom: '8px',
    color: theme.text
  },
  grid: {
    display: 'grid',
    gap: '15px'
  },
  noResults: {
    textAlign: 'center',
    padding: '40px',
    color: theme.textMuted
  },
  card: {
    padding: '15px',
    backgroundColor: theme.cardBackground,
    borderRadius: '8px',
    boxShadow: theme.cardShadow
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
    fontWeight: 600,
    color: theme.text
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
    color: theme.textMuted,
    marginBottom: '8px'
  },
  link: {
    color: theme.primary,
    textDecoration: 'none'
  },
  cardDetails: {
    display: 'flex',
    gap: '20px',
    fontSize: '13px',
    color: theme.textSecondary
  },
  errorText: {
    color: theme.error
  }
});

/**
 * Get badge color based on endpoint type and theme
 */
function getTypeBadgeColor(type, theme) {
  return theme.badges[type] || theme.badges.default;
}

/**
 * Individual endpoint status card
 */
const EndpointCard = memo(function EndpointCard({ result, theme, styles }) {
  const statusColor = getStatusColor(result.status);
  const badgeColors = getTypeBadgeColor(result.type, theme);

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
  }).isRequired,
  theme: PropTypes.object.isRequired,
  styles: PropTypes.object.isRequired
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
 * @param {boolean} props.darkMode - Enable dark mode (default: false)
 */
export default function HealthDashboard({
  refreshInterval = 60000,
  autoRefresh = true,
  style = {},
  logger = console,
  darkMode = false
}) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [summary, setSummary] = useState(null);

  // Select theme and generate styles
  const theme = darkMode ? themes.dark : themes.light;
  const styles = useMemo(() => getStyles(theme), [theme]);

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
                <EndpointCard
                  key={result.url}
                  result={result}
                  theme={theme}
                  styles={styles}
                />
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
  }),
  darkMode: PropTypes.bool
};
