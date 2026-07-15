/**
 * Regression test for _reportPingError escalate-if-sustained logic (NODE-EXPRESS-58).
 *
 * Run: npm --workspace=@ibetoni/cache test
 *
 * A normal Azure Redis failover fast-fails ("Stream isn't writeable",
 * enableOfflineQueue:false — fb#160) for a few seconds. That transient must NOT
 * reach Sentry; only a SUSTAINED (>30s) outage should. We use
 * `_lastPingErrorReportAt` as the observable proxy: it is written ONLY when the
 * Sentry-escalation branch runs. Constructor opens no connection, so a bare
 * instance is safe (no Redis touched).
 */
const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures++;
    console.error(`  FAIL ${name}`);
    console.error(`       ${e.message}`);
  }
}

// Silence the intentional console.warn/console.error breadcrumbs during the run.
const origWarn = console.warn;
const origError = console.error;
function quiet(fn) {
  console.warn = () => {};
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.warn = origWarn;
    console.error = origError;
  }
}

console.log("_reportPingError escalate-if-sustained tests:");

test("transient blip (fresh streak) does NOT escalate to Sentry", () => {
  const mgr = new UniversalCacheManager();
  quiet(() => mgr._reportPingError(new Error("Stream isn't writeable")));
  // Streak just started (~0s < 30s) → no Sentry report.
  assert.strictEqual(mgr._lastPingErrorReportAt, 0);
  // But the streak clock has started.
  assert.ok(mgr._pingErrorStreakStartedAt > 0);
});

test("sustained outage (>30s streak) escalates to Sentry once", () => {
  const mgr = new UniversalCacheManager();
  // Simulate an outage that began 40s ago.
  mgr._pingErrorStreakStartedAt = Date.now() - 40 * 1000;
  quiet(() => mgr._reportPingError(new Error("Stream isn't writeable")));
  assert.ok(
    mgr._lastPingErrorReportAt > 0,
    "expected _lastPingErrorReportAt to be set on sustained outage"
  );
});

test("second sustained ping within 5min is throttled (no re-report)", () => {
  const mgr = new UniversalCacheManager();
  mgr._pingErrorStreakStartedAt = Date.now() - 40 * 1000;
  quiet(() => mgr._reportPingError(new Error("Stream isn't writeable")));
  const firstReportAt = mgr._lastPingErrorReportAt;
  assert.ok(firstReportAt > 0);
  // Immediate second sustained failure — inside the 5min throttle window.
  quiet(() => mgr._reportPingError(new Error("Stream isn't writeable")));
  assert.strictEqual(
    mgr._lastPingErrorReportAt,
    firstReportAt,
    "throttled report must not advance _lastPingErrorReportAt"
  );
});

test("recovery reset (streak=0) makes the next outage measure fresh", () => {
  const mgr = new UniversalCacheManager();
  // Old sustained streak.
  mgr._pingErrorStreakStartedAt = Date.now() - 40 * 1000;
  // Simulate onReady recovery clearing the streak.
  mgr._pingErrorStreakStartedAt = 0;
  quiet(() => mgr._reportPingError(new Error("Stream isn't writeable")));
  // Fresh streak (~0s) → transient again, no escalation.
  assert.strictEqual(mgr._lastPingErrorReportAt, 0);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll tests passed`);
