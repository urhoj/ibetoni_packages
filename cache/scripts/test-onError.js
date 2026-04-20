/**
 * Regression test for the injectable onError hook.
 *
 * Run: npm --workspace=@ibetoni/cache test
 *
 * Exercises the _emitError/setErrorHandler path without touching Redis.
 * Constructor does not open a connection, so a bare instance is safe.
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

console.log("onError hook regression tests:");

test("constructor onError is invoked with error and context", () => {
  const calls = [];
  const mgr = new UniversalCacheManager({
    onError: (err, ctx) => calls.push({ err, ctx }),
  });
  const err = new Error("boom");
  mgr._emitError(err, { operationType: "scan keys", pattern: "keikka:*" });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].err, err);
  assert.deepStrictEqual(calls[0].ctx, { operationType: "scan keys", pattern: "keikka:*" });
});

test("setErrorHandler replaces the handler", () => {
  const first = [];
  const second = [];
  const mgr = new UniversalCacheManager({ onError: (e, c) => first.push(c) });
  mgr._emitError(new Error("a"), { operationType: "x" });
  mgr.setErrorHandler((e, c) => second.push(c));
  mgr._emitError(new Error("b"), { operationType: "y" });
  assert.strictEqual(first.length, 1);
  assert.strictEqual(second.length, 1);
  assert.strictEqual(first[0].operationType, "x");
  assert.strictEqual(second[0].operationType, "y");
});

test("setErrorHandler with non-function clears the handler", () => {
  const calls = [];
  const mgr = new UniversalCacheManager({ onError: (e, c) => calls.push(c) });
  mgr.setErrorHandler(null);
  mgr._emitError(new Error("silent"), { operationType: "z" });
  assert.strictEqual(calls.length, 0);
});

test("no handler → _emitError is a no-op (does not throw)", () => {
  const mgr = new UniversalCacheManager();
  mgr._emitError(new Error("no listener"), { operationType: "x" });
});

test("handler exceptions are swallowed (never propagate to cache path)", () => {
  const mgr = new UniversalCacheManager({
    onError: () => {
      throw new Error("handler crashed");
    },
  });
  mgr._emitError(new Error("original"), { operationType: "batch delete" });
});

test("non-function onError in constructor is ignored", () => {
  const mgr = new UniversalCacheManager({ onError: "not a function" });
  mgr._emitError(new Error("silent"), { operationType: "x" });
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll tests passed`);
