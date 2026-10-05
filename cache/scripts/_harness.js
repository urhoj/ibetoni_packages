/**
 * Shared runner for the standalone test-*.js scripts in this folder (fb#1033).
 * Each script stays runnable on its own: `node scripts/test-<name>.js`.
 *
 *   const { test, finish } = require("./_harness");
 *   await test("does X", async () => { ... });
 *   finish("\nAll X tests passed"); // exits 1 if any test failed
 */
let failures = 0;

// A synchronous fn is reported synchronously, so top-level scripts that call
// test() without await still print in order before finish().
function test(name, fn) {
  const pass = () => console.log(`  ok  ${name}`);
  const fail = (e) => { failures++; console.error(`  FAIL ${name}\n       ${e.message}`); };
  try {
    const result = fn();
    if (typeof result?.then === "function") return result.then(pass, fail);
    pass();
  } catch (e) { fail(e); }
  return Promise.resolve();
}

function finish(passMessage = "\nAll tests passed") {
  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  console.log(passMessage);
}

module.exports = { test, finish };
