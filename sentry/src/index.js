const Sentry = require("@sentry/node");
const fs = require("fs");
const os = require("os");
const path = require("path");

let enabled = false;

function readReleaseFile() {
  try {
    const filePath = path.join(process.cwd(), "release.txt");
    if (fs.existsSync(filePath)) {
      const sha = fs.readFileSync(filePath, "utf8").trim();
      if (sha) return sha;
    }
  } catch {}
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
  captureMessage,
  addBreadcrumb,
  setUser,
  isEnabled,
};
