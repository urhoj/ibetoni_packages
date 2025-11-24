/**
 * Health Dashboard React Component
 *
 * Displays status of all monitored endpoints with real-time health checks
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  getAllEndpoints,
  checkMultipleEndpoints,
  getStatusSummary,
  formatResponseTime,
  getStatusIcon,
  getStatusColor,
  formatTimestamp,
  groupResultsByEnvironment
} from './index.js';

/**
 * HealthDashboard Component
 *
 * @param {Object} props
 * @param {number} props.refreshInterval - Auto-refresh interval in ms (default: 60000)
 * @param {boolean} props.autoRefresh - Enable auto-refresh (default: true)
 * @param {Object} props.style - Custom styling
 */
export default function HealthDashboard({
  refreshInterval = 60000,
  autoRefresh = true,
  style = {}
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
      console.error('Health check failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Group results by environment
  const groupedResults = groupResultsByEnvironment(results);
  const environments = ['production', 'staging', 'latest', 'stable'];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '20px', ...style }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>
          System Status Dashboard
        </h1>
        <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '14px' }}>
          Last updated: {formatTimestamp(lastUpdate)}
          {loading && ' (Checking...)'}
        </p>
      </div>

      {/* Summary */}
      {summary && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          marginBottom: '30px',
          border: `3px solid ${getStatusColor(summary.overallStatus)}`
        }}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '10px' }}>
            {getStatusIcon(summary.overallStatus)} Overall Status: {summary.overallStatus.toUpperCase()}
          </div>
          <div style={{ display: 'flex', gap: '20px', fontSize: '14px' }}>
            <span>🟢 Healthy: {summary.healthy}</span>
            <span>🟡 Slow: {summary.slow}</span>
            <span>🔴 Down: {summary.down}</span>
            <span>Total: {summary.total}</span>
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={checkHealth}
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 500,
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Checking...' : 'Refresh Now'}
        </button>
      </div>

      {/* Results by Environment */}
      {environments.map(env => {
        const envResults = groupedResults[env] || [];
        if (envResults.length === 0) return null;

        return (
          <div key={env} style={{ marginBottom: '30px' }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '15px',
              textTransform: 'capitalize',
              borderBottom: '2px solid #ddd',
              paddingBottom: '8px'
            }}>
              {env} Environment
            </h2>

            <div style={{ display: 'grid', gap: '15px' }}>
              {envResults.map((result, index) => (
                <EndpointCard key={index} result={result} />
              ))}
            </div>
          </div>
        );
      })}

      {/* No Results */}
      {results.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No health check results available
        </div>
      )}
    </div>
  );
}

/**
 * Individual endpoint status card
 */
function EndpointCard({ result }) {
  const statusColor = getStatusColor(result.status);

  return (
    <div style={{
      padding: '15px',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: `2px solid ${statusColor}`,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          {/* Name and Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px' }}>{getStatusIcon(result.status)}</span>
            <span style={{ fontSize: '16px', fontWeight: 600 }}>{result.name}</span>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              backgroundColor: result.type === 'frontend' ? '#e3f2fd' : '#f3e5f5',
              color: result.type === 'frontend' ? '#1976d2' : '#7b1fa2',
              borderRadius: '12px',
              textTransform: 'uppercase'
            }}>
              {result.type}
            </span>
          </div>

          {/* URL */}
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1976d2', textDecoration: 'none' }}
            >
              {result.url}
            </a>
          </div>

          {/* Details */}
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#444' }}>
            <span>
              <strong>Response:</strong> {formatResponseTime(result.responseTime)}
            </span>
            {result.version && (
              <span>
                <strong>Version:</strong> {result.version}
              </span>
            )}
            {result.error && (
              <span style={{ color: '#d32f2f' }}>
                <strong>Error:</strong> {result.error}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
