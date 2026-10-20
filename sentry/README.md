# @ibetoni/sentry

Shared Sentry (`@sentry/node`) initialization and capture helpers for the Node.js services. CommonJS, single file: `src/index.js`.

## Consumers

- `puminet5api` — `config/sentry/instrument.js` calls `init()`; `config/sentry/utils.js` re-exports the helpers.
- `puminet7-functions-app` — same layout under `src/config/sentry/` (`instrument.js` calls `init({ service: "puminet7-functions-app" })`, `utils.js` re-exports the package).
- `@ibetoni/api-utils` (`handleRouteError`) and `@ibetoni/cache` report through it.
- The frontends do NOT use it at runtime (they use `@sentry/react`). `puminet4/src/index.jsx` keeps its own copy of `redactSensitiveFields` that mirrors the one here — change both together.

## API

| Export | Purpose |
|---|---|
| `init(options)` | Configure from env (`SENTRY_DSN`, `SENTRY_ENVIRONMENT` / `WEBSITE_SLOT_NAME` / `NODE_ENV`, `SENTRY_RELEASE`, `SENTRY_ENABLED`, `SENTRY_DEBUG`, `SENTRY_SERVER_NAME`); `options` override. `enabled: false` or no DSN → every helper below is a no-op. |
| `captureException(error, context)` | Backend module (non-route) swallows — pass `{ tags: { module, operation } }` (fb#1497). Optional `context.level`. |
| `captureError(error, context)` | Swallowed-error reporting with enrichment: always `console.error`s, level `warning`, fingerprint `[tags.feature, tags.operation ?? tags.op]` unless `context.fingerprint` is given (that wins, fb#2645), non-Error values wrapped in `new Error(...)`. |
| `captureMessage(message, level = "info", context)` | Message event. |
| `addBreadcrumb`, `setUser` | Thin pass-throughs, no-op when disabled. |
| `Sentry` | The raw `@sentry/node` module. |

`context` is `{ user, tags, extra, fingerprint }` for all capture helpers. `fingerprint` (string[]) replaces Sentry's stack-based grouping, e.g. one issue per stored procedure (`["slow-query", procedure]`, fb#2622).

Backend route catch blocks use `handleRouteError` from `@ibetoni/api-utils`, not these helpers directly.

## Behaviour set by `init`

- `beforeSend` redacts every key of `event.request` / `event.extra` / `event.contexts` whose lowercased name CONTAINS a `SENTRY_REDACT_FIELDS` substring (`@ibetoni/constants/sentry`) — the whole value is replaced with `[REDACTED]`, subtree included (so a key named `auth` hides its children). Cycle-safe.
- In `production`, `ValidationError` exceptions are dropped.
- `traceLifecycle: "static"` (v11 streams spans by default, which would make `beforeSendTransaction` a no-op).
- `sendDefaultPii !== true` → `SENTRY_RESTRICTIVE_DATA_COLLECTION` (the v10 `sendDefaultPii: false` equivalent).

## Tests

```
npm test --workspace=@ibetoni/sentry
```

`src/__tests__/index.test.js` (vitest) spies on the `@sentry/node` CJS module object via `createRequire` — a `vi.mock` specifier does not intercept the package's `require()`.
