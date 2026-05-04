# @ibetoni/api-utils

Shared Express response helpers, route error handler, and request validators for betoni.online services.

Promoted from `puminet5api/utils/{apiResponseHandler,validation}.js` so all backends (puminet5api, betonijerry-api, future workspaces) share one implementation.

## Exports

### Response helpers (from `./responses`)

| Function | Behavior |
|---|---|
| `sendSuccess(res, data, statusCode = 200)` | Sends raw `data` as JSON. No wrapping. |
| `sendError(res, error, statusCode = 500)` | Sends `{ success: false, message, error }`. No Sentry. Use for guard clauses. |
| `sendValidationError(res, message)` | `sendError` with status 400. |
| `sendNotFound(res, message?)` | `sendError` with status 404. |
| `sendUnauthorized(res, message?)` | `sendError` with status 401. |
| `sendForbidden(res, message?)` | `sendError` with status 403. |
| `handleRouteError(res, error, operation, extra?)` | For catch blocks: reports to Sentry with user/asiakas tags + sends error response. Reads `error.statusCode` (default 500). `extra._entity` becomes the `entity` tag; `extra._tags` is merged into Sentry tags (use for queryable per-route diagnostics like `targetAsiakasId`); all other keys land in Sentry "extra". |

### Validators (from `./validation`)

| Function | Returns |
|---|---|
| `validateRequiredFields(body, fields[])` | Array of missing field names (empty if all present). |
| `validateId(id, fieldName?)` | Error message string, or `null` if valid positive integer. |
| `validateIntegerFields(body, fields[])` | Array of field names that aren't integers. |
| `validateDateFormat(str, "YYYYMMDD" \| "YYYY-MM-DD")` | Boolean. |
| `asyncHandler(fn)` | Wraps async route handlers so unhandled errors flow to `next()`. |

## Usage

```js
const {
  sendSuccess,
  sendValidationError,
  handleRouteError,
  asyncHandler,
  validateRequiredFields,
} = require("@ibetoni/api-utils");

router.post("/items", asyncHandler(async (req, res) => {
  const missing = validateRequiredFields(req.body, ["name", "price"]);
  if (missing.length) return sendValidationError(res, `Missing: ${missing.join(", ")}`);

  try {
    const item = await db.insert(req.body);
    return sendSuccess(res, item, 201);
  } catch (err) {
    return handleRouteError(res, err, "items-create", { _entity: "item" });
  }
}));
```

## Migration notes

- `puminet5api/utils/apiResponseHandler.js` and `puminet5api/utils/validation.js` are now thin shims that re-export from this package — existing 148 callers keep working unchanged.
- New code anywhere should `require("@ibetoni/api-utils")` directly.
- Sentry is required as `@ibetoni/sentry` (peer-of-sorts via direct dependency). When `SENTRY_DSN` is unset, `handleRouteError` still sends the response — Sentry calls become no-ops.
