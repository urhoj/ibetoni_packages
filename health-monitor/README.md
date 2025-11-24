# @ibetoni/health-monitor

Health monitoring and status dashboard for betoni.online deployment environments.

## Overview

This package provides comprehensive health checking functionality for monitoring all deployment environments across frontend and backend services.

## Features

- ✅ Real-time health checks for all deployment environments
- 📊 Visual status dashboard with color-coded indicators
- ⚡ Response time monitoring
- 📦 Version tracking for each deployment
- 🔄 Auto-refresh capability
- 🎨 Reusable React components

## Monitored Endpoints

### Frontend (puminet4)
- Production: `https://ibetoni.fi`
- Staging: `https://staging.ibetoni.fi`
- Latest: `https://latest.ibetoni.fi`
- Stable: `https://stable.ibetoni.fi`

### Backend API (puminet5api)
- Production: `https://api.ibetoni.fi`
- Staging: `https://api-staging.ibetoni.fi`
- Latest: `https://api-latest.ibetoni.fi`
- Stable: `https://api.stable.ibetoni.fi`

## Installation

```bash
npm install @ibetoni/health-monitor
```

## Usage

### React Component

```jsx
import { HealthDashboard } from '@ibetoni/health-monitor';

function StatusPage() {
  return (
    <HealthDashboard
      refreshInterval={60000}  // 60 seconds
      autoRefresh={true}
    />
  );
}
```

### Programmatic Health Checks

```javascript
import {
  getAllEndpoints,
  checkMultipleEndpoints,
  getStatusSummary
} from '@ibetoni/health-monitor';

async function checkHealth() {
  const endpoints = getAllEndpoints();
  const results = await checkMultipleEndpoints(endpoints);
  const summary = getStatusSummary(results);

  console.log(`Overall status: ${summary.overallStatus}`);
  console.log(`Healthy: ${summary.healthy}, Down: ${summary.down}`);

  return results;
}
```

### Single Endpoint Check

```javascript
import { checkEndpointHealth } from '@ibetoni/health-monitor';

const endpoint = {
  name: 'Production API',
  url: 'https://api.ibetoni.fi',
  versionEndpoint: 'https://api.ibetoni.fi/api/version',
  type: 'backend',
  environment: 'production'
};

const result = await checkEndpointHealth(endpoint);
console.log(result);
// {
//   name: 'Production API',
//   url: 'https://api.ibetoni.fi',
//   status: 'healthy',
//   responseTime: 245,
//   version: '5.1.0',
//   error: null,
//   lastChecked: '2025-01-09T12:34:56.789Z'
// }
```

## Status Levels

- **🟢 Healthy**: Response time < 2 seconds, HTTP 200
- **🟡 Slow**: Response time 2-5 seconds, HTTP 200
- **🔴 Down**: Response time > 5 seconds, timeout, or error

## API Reference

### Functions

#### `checkEndpointHealth(endpoint)`
Checks health of a single endpoint.

**Returns:** `Promise<Object>` - Health check result

#### `checkMultipleEndpoints(endpoints)`
Checks health of multiple endpoints in parallel.

**Returns:** `Promise<Array<Object>>` - Array of health check results

#### `getStatusSummary(results)`
Calculates summary statistics from health check results.

**Returns:** `Object` - Summary with counts and overall status

#### `getAllEndpoints()`
Gets all configured endpoints.

**Returns:** `Array<Object>` - All endpoint configurations

#### `getEndpointsByType(type)`
Gets endpoints by type ('frontend' or 'backend').

**Returns:** `Array<Object>` - Filtered endpoints

#### `getEndpointsByEnvironment(environment)`
Gets endpoints by environment ('production', 'staging', 'latest', 'stable').

**Returns:** `Array<Object>` - Filtered endpoints

### Utility Functions

#### `formatResponseTime(ms)`
Formats response time for display (e.g., "245ms" or "2.45s").

#### `formatTimestamp(isoString)`
Formats timestamp as relative time (e.g., "5 minutes ago").

#### `getStatusIcon(status)`
Returns emoji for status level (🟢/🟡/🔴/⚪).

#### `getStatusColor(status)`
Returns color code for status level.

#### `sortByStatus(results)`
Sorts results with down services first.

## Components

### `<HealthDashboard>`

Main dashboard component for displaying health status.

**Props:**
- `refreshInterval` (number): Auto-refresh interval in ms (default: 60000)
- `autoRefresh` (boolean): Enable auto-refresh (default: true)
- `style` (object): Custom styling

## Integration Examples

### Functions App (Express)

```javascript
import express from 'express';
import {
  getAllEndpoints,
  checkMultipleEndpoints
} from '@ibetoni/health-monitor';

const app = express();

app.get('/api/health', async (req, res) => {
  const endpoints = getAllEndpoints();
  const results = await checkMultipleEndpoints(endpoints);
  res.json(results);
});
```

### Frontend (React)

```jsx
import { HealthDashboard } from '@ibetoni/health-monitor';

function AdminStatusPage() {
  return (
    <div>
      <h1>System Status</h1>
      <HealthDashboard />
    </div>
  );
}
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test
```

## License

UNLICENSED - Internal use only for betoni.online
