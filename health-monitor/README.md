# @ibetoni/health-monitor

Health monitoring and status dashboard for betoni.online deployment environments.

## Overview

This package provides comprehensive health checking functionality for monitoring all deployment environments across frontend and backend services.

## Features

- ✅ Real-time health checks for all deployment environments
- 📊 Color-coded status indicators
- ⚡ Response time monitoring
- 📦 Version tracking for each deployment

## Monitored Endpoints

### Frontend (puminet4)
- Production: `https://ibetoni.fi`
- Staging: `https://wonderful-rock-08f826703-staging.westeurope.3.azurestaticapps.net`

### Backend API (puminet5api)
- Production: `https://api.ibetoni.fi`
- Staging: `https://api-staging.ibetoni.fi`

### Azure Functions (puminet7-functions-app)
- Production: `https://functions.ibetoni.fi`

> **Note:** Azure Static Web Apps staging environments cannot have custom domains, hence the full Azure URL for staging frontend.

## Installation

```bash
npm install @ibetoni/health-monitor
```

## Usage

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
Gets endpoints by type ('frontend', 'backend', or 'functions').

**Returns:** `Array<Object>` - Filtered endpoints

#### `getEndpointsByEnvironment(environment)`
Gets endpoints by environment ('production' or 'staging').

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

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test
```

## License

UNLICENSED - Internal use only for betoni.online
