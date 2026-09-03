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
- Production: `https://wonderful-rock-08f826703.3.azurestaticapps.net` (direct Azure SWA origin — bypasses Cloudflare, which returns a bot-challenge 403 to server-to-server requests against the public betoni.online domain)
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
  checkMultipleEndpoints
} from '@ibetoni/health-monitor';

async function checkHealth() {
  const endpoints = getAllEndpoints();
  const results = await checkMultipleEndpoints(endpoints);
  // each result: { name, url, status, responseTime, version, error, lastChecked }
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

#### `getAllEndpoints()`
Gets all configured endpoints.

**Returns:** `Array<Object>` - All endpoint configurations

> Dashboard-formatting helpers (`getStatusSummary`, `formatResponseTime`, `getStatusIcon`,
> `getStatusColor`, `utils.js` grouping/sorting) were removed 2026-08-26 as never-consumed
> scaffolding for a status dashboard that was not built; recover from git history if needed.

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
