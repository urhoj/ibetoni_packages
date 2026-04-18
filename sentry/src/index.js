const Sentry = require("@sentry/node");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { SENTRY_REDACT_FIELDS, SENTRY_REDACTED_PLACEHOLDER } = require("@ibetoni/constants/sentry");

let enabled = false;

/**
 * Recursively walk `value` and replace any field whose (lowercased) name
 * contains a substring from SENTRY_REDACT_FIELDS with a placeholder.
 * Mutates in place and also returns the value for chaining.
 *
 * Guards against cycles via a WeakSet; primitives are returned as-is.
 */
function redactSensitiveFields(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => redactSensitiveFields(item, seen));
    return value;
  }

  for (const key of Object.keys(value)) {
    const lower = key.toLowerCase();
    if (SENTRY_REDACT_FIELDS.some((field) => lower.includes(field))) {
      value[key] = SENTRY_REDACTED_PLACEHOLDER;
    } else {
      redactSensitiveFields(value[key], seen);
    }
  }
  return value;
}

function readReleaseFile() {
  try {
    const filePath = path.join(process.cwd(), "release.txt");
    if (fs.existsSync(filePath)) {
      const sha = fs.readFileSync(filePath, "utf8").trim();
      if (sha) return sha;
    }
  } catch {
    // ignore — release file is optional
  }
  return null;
}

function computeRelease() {
  if (process.env.SENTRY_RELEASE) return process.env.SENTRY_RELEASE;
  const version = process.env.npm_package_version;
  const sha = readReleaseFile();
  const shortSha = sha ? sha.slice(0, 8) : null;
  if (version && shortSha) return `${version}+${shortSha}`;
  return version || shortSha || undefined;
}

function init(options = {}) {
  const config = {
    dsn: process.env.SENTRY_DSN,
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.WEBSITE_SLOT_NAME ||
      process.env.NODE_ENV ||
      "development",
    release: computeRelease(),
    enabled: process.env.SENTRY_ENABLED !== "false",
    debug: process.env.SENTRY_DEBUG === "true",
    serverName: process.env.SENTRY_SERVER_NAME || os.hostname(),
    service: "unknown",
    ...options,
  };

  enabled = config.enabled;

  if (!enabled) {
    console.log("Sentry is disabled via configuration");
    return;
  }
  if (!config.dsn) {
    console.error("Sentry DSN not configured. Set SENTRY_DSN in environment or Azure App Settings.");
    enabled = false;
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: config.tracesSampleRate ?? 0,
    debug: config.debug,
    serverName: config.serverName,
    initialScope: {
      tags: { service: config.service, version: config.release || "1.0.0" },
    },
    integrations: config.integrations || [],
    beforeSend(event) {
      if (config.environment === "production" && event.exception) {
        const error = event.exception.values[0];
        if (error && error.type === "ValidationError") return null;
      }
      redactSensitiveFields(event.request);
      redactSensitiveFields(event.extra);
      redactSensitiveFields(event.contexts);
      if (config.beforeSend) return config.beforeSend(event);
      return event;
    },
    ...(config.beforeSendTransaction && { beforeSendTransaction: config.beforeSendTransaction }),
    ...(config.sendDefaultPii !== undefined && { sendDefaultPii: config.sendDefaultPii }),
  });

  console.log(`Sentry initialized for ${config.environment} environment`);
}

function applyContextToScope(scope, context) {
  if (context.user) scope.setUser(context.user);
  if (context.tags) Object.keys(context.tags).forEach((k) => scope.setTag(k, context.tags[k]));
  if (context.extra) Object.keys(context.extra).forEach((k) => scope.setExtra(k, context.extra[k]));
}

function captureException(error, context = {}) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    applyContextToScope(scope, context);
    if (context.level) scope.setLevel(context.level);
    Sentry.captureException(error);
  });
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Report a swallowed error to Sentry with `console.error` logging.
 *
 * Use in catch blocks that return null/false/[]/{success:false} or swallow
 * the error — those failures are invisible in production without this.
 *
 * Enrichment applied automatically:
 * - level = "warning" (distinguishes swallowed errors from unhandled crashes)
 * - fingerprint = [feature, op] when both tags are present (stable grouping)
 * - non-Error values are wrapped in `new Error(...)` so stack traces survive
 */
function captureError(error, context = {}) {
  console.error(error);
  if (!enabled) return;

  const normalized =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : safeStringify(error));

  const { tags, extra, user } = context;

  Sentry.withScope((scope) => {
    scope.setLevel("warning");
    if (user) scope.setUser(user);
    if (tags) Object.keys(tags).forEach((k) => scope.setTag(k, tags[k]));
    if (extra) Object.keys(extra).forEach((k) => scope.setExtra(k, extra[k]));
    const operation = tags?.operation ?? tags?.op;
    if (tags?.feature && operation) {
      scope.setFingerprint([tags.feature, operation]);
    }
    Sentry.captureException(normalized);
  });
}

function captureMessage(message, level = "info", context = {}) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    applyContextToScope(scope, context);
    scope.setLevel(level);
    Sentry.captureMessage(message);
  });
}

function addBreadcrumb(breadcrumb) {
  if (!enabled) return;
  Sentry.addBreadcrumb(breadcrumb);
}

function setUser(user) {
  if (!enabled) return;
  Sentry.setUser(user);
}

function isEnabled() {
  return enabled;
}

module.exports = {
  Sentry,
  init,
  captureException,
  captureError,
  captureMessage,
  addBreadcrumb,
  setUser,
  isEnabled,
};
