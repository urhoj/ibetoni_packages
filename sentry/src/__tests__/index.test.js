import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// index.js is CommonJS and calls `Sentry.<fn>` on the @sentry/node module
// object at call time, so spying on that same CJS object intercepts it — an
// ESM `import` binding or a vi.mock specifier would not (same as api-utils).
import { createRequire } from "module";
const nodeRequire = createRequire(import.meta.url);
const Sentry = nodeRequire("@sentry/node");
const sentry = nodeRequire("../index.js");

const DSN = "https://public@o0.ingest.sentry.io/0";

function fakeScope() {
  return {
    setLevel: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setExtra: vi.fn(),
    setFingerprint: vi.fn(),
  };
}

let scope;
let initSpy;

beforeEach(() => {
  scope = fakeScope();
  initSpy = vi.spyOn(Sentry, "init").mockImplementation(() => {});
  vi.spyOn(Sentry, "withScope").mockImplementation((cb) => cb(scope));
  vi.spyOn(Sentry, "captureException").mockImplementation(() => {});
  vi.spyOn(Sentry, "captureMessage").mockImplementation(() => {});
  vi.spyOn(Sentry, "addBreadcrumb").mockImplementation(() => {});
  vi.spyOn(Sentry, "setUser").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  sentry.init({ dsn: DSN, enabled: true, environment: "test" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The beforeSend hook init() registered — it is where redaction runs. */
function beforeSend() {
  return initSpy.mock.calls.at(-1)[0].beforeSend;
}

describe("init", () => {
  it("disables every helper when enabled=false", () => {
    initSpy.mockClear();
    sentry.init({ dsn: DSN, enabled: false });
    sentry.captureError(new Error("x"));
    sentry.captureException(new Error("x"));
    sentry.captureMessage("x");
    sentry.addBreadcrumb({ message: "x" });
    sentry.setUser({ id: 1 });
    expect(initSpy).not.toHaveBeenCalled();
    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
    expect(Sentry.setUser).not.toHaveBeenCalled();
  });

  it("disables itself when no DSN is configured", () => {
    initSpy.mockClear();
    sentry.init({ dsn: undefined, enabled: true });
    sentry.captureException(new Error("x"));
    expect(initSpy).not.toHaveBeenCalled();
    expect(Sentry.withScope).not.toHaveBeenCalled();
  });

  it("captureError still logs to console when disabled", () => {
    sentry.init({ dsn: DSN, enabled: false });
    const err = new Error("logged");
    sentry.captureError(err);
    expect(console.error).toHaveBeenCalledWith(err);
  });
});

describe("beforeSend redaction", () => {
  it("redacts sensitive keys at any depth, case-insensitively, inside arrays", () => {
    const event = {
      request: { headers: { Authorization: "Bearer abc", accept: "json" } },
      extra: { body: { user: { Password: "p", name: "n" } }, list: [{ apiKey: "k", ok: 1 }] },
      contexts: { session: { refreshToken: "t" }, auth: { userId: 1 } },
    };
    const out = beforeSend()(event);
    expect(out.request.headers).toEqual({ Authorization: "[REDACTED]", accept: "json" });
    expect(out.extra.body.user).toEqual({ Password: "[REDACTED]", name: "n" });
    expect(out.extra.list[0]).toEqual({ apiKey: "[REDACTED]", ok: 1 });
    expect(out.contexts.session.refreshToken).toBe("[REDACTED]");
    // A matching key replaces the whole subtree, not just its leaves.
    expect(out.contexts.auth).toBe("[REDACTED]");
  });

  it("survives a circular object", () => {
    const extra = { password: "p" };
    extra.self = extra;
    const out = beforeSend()({ extra });
    expect(out.extra.password).toBe("[REDACTED]");
    expect(out.extra.self).toBe(out.extra);
  });

  it("leaves events without request/extra/contexts untouched", () => {
    const event = { message: "plain" };
    expect(beforeSend()(event)).toEqual({ message: "plain" });
  });

  it("drops ValidationError exceptions in production only", () => {
    const event = () => ({ exception: { values: [{ type: "ValidationError" }] } });
    expect(beforeSend()(event())).not.toBeNull();
    sentry.init({ dsn: DSN, enabled: true, environment: "production" });
    expect(beforeSend()(event())).toBeNull();
  });

  it("chains a caller-supplied beforeSend after redaction", () => {
    const custom = vi.fn((e) => ({ ...e, custom: true }));
    sentry.init({ dsn: DSN, enabled: true, beforeSend: custom });
    const out = beforeSend()({ extra: { token: "t" } });
    expect(custom.mock.calls[0][0].extra.token).toBe("[REDACTED]");
    expect(out.custom).toBe(true);
  });
});

describe("captureError", () => {
  it("sets level warning and a [feature, op] fingerprint", () => {
    const err = new Error("boom");
    sentry.captureError(err, { tags: { feature: "grid", op: "save" } });
    expect(scope.setLevel).toHaveBeenCalledWith("warning");
    expect(scope.setFingerprint).toHaveBeenCalledWith(["grid", "save"]);
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });

  it("accepts `operation` as the op tag", () => {
    sentry.captureError(new Error("x"), { tags: { feature: "grid", operation: "load" } });
    expect(scope.setFingerprint).toHaveBeenCalledWith(["grid", "load"]);
  });

  it("does not set a fingerprint without both feature and op", () => {
    sentry.captureError(new Error("x"), { tags: { feature: "grid" } });
    expect(scope.setFingerprint).not.toHaveBeenCalled();
  });

  it("lets an explicit context.fingerprint win over the default (fb#2645)", () => {
    sentry.captureError(new Error("x"), {
      tags: { feature: "grid", op: "save" },
      fingerprint: ["custom", "key"],
    });
    expect(scope.setFingerprint).toHaveBeenCalledTimes(1);
    expect(scope.setFingerprint).toHaveBeenCalledWith(["custom", "key"]);
  });

  it("wraps a string or object in an Error", () => {
    sentry.captureError("plain string");
    sentry.captureError({ code: 42 });
    const [first, second] = Sentry.captureException.mock.calls.map((c) => c[0]);
    expect(first).toBeInstanceOf(Error);
    expect(first.message).toBe("plain string");
    expect(second).toBeInstanceOf(Error);
    expect(second.message).toBe('{"code":42}');
  });

  it("falls back to String() for a value JSON cannot serialize", () => {
    const circular = {};
    circular.self = circular;
    sentry.captureError(circular);
    expect(Sentry.captureException.mock.calls[0][0].message).toBe("[object Object]");
  });
});

describe("captureException / captureMessage", () => {
  const context = {
    user: { id: 7 },
    tags: { module: "asiakas", operation: "save" },
    extra: { asiakasId: 27 },
    fingerprint: ["slow-query", "proc"],
  };

  function expectContextApplied() {
    expect(scope.setUser).toHaveBeenCalledWith({ id: 7 });
    expect(scope.setTag).toHaveBeenCalledWith("module", "asiakas");
    expect(scope.setTag).toHaveBeenCalledWith("operation", "save");
    expect(scope.setExtra).toHaveBeenCalledWith("asiakasId", 27);
    expect(scope.setFingerprint).toHaveBeenCalledWith(["slow-query", "proc"]);
  }

  it("captureException applies user/tags/extra/fingerprint and an optional level", () => {
    const err = new Error("x");
    sentry.captureException(err, { ...context, level: "fatal" });
    expectContextApplied();
    expect(scope.setLevel).toHaveBeenCalledWith("fatal");
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });

  it("captureException sets no level unless asked", () => {
    sentry.captureException(new Error("x"));
    expect(scope.setLevel).not.toHaveBeenCalled();
  });

  it("captureMessage applies the context and defaults level to info", () => {
    sentry.captureMessage("hello", undefined, context);
    expectContextApplied();
    expect(scope.setLevel).toHaveBeenCalledWith("info");
    expect(Sentry.captureMessage).toHaveBeenCalledWith("hello");
  });
});
