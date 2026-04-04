# @ibetoni/utils

General-purpose shared utilities for betoni.online — for functions that don't belong in a domain-specific package.

## Installation

```bash
# In your project's package.json, add:
{
  "dependencies": {
    "@ibetoni/utils": "file:../ibetoni_packages/utils"
  }
}
```

Then run `npm install`

## Features

- **HTML Utilities** - XSS-safe HTML escaping

## Usage

### HTML Escaping

```javascript
const { escapeHtml } = require("@ibetoni/utils");

escapeHtml('<script>alert("xss")</script>');
// "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"

escapeHtml(null); // ""
```

## API Reference

### `escapeHtml(str)`

Escape HTML special characters (`&`, `<`, `>`, `"`, `'`) to prevent XSS. Returns empty string for `null`/`undefined`. Non-string values are coerced via `String()`.

**Returns:** string

## Testing

```bash
npm test
```

## License

UNLICENSED - Internal use only for betoni.online
