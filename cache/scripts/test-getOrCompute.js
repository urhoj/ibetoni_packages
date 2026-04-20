const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

let failures = 0;
function test(name, fn) {
  return (async () => {
    try { await fn(); console.log(`  ok  ${name}`); }
    catch (e) { failures++; console.error(`  FAIL ${name}\n       ${e.message}`); }
  })();
}

async function main() {
  console.log("getOrCompute singleflight tests:");

  // Fake Redis: in-memory Map stand-in via monkey-patching get/set
  function newMgr() {
    const mgr = new UniversalCacheManager();
    const store = new Map();
    mgr.get = async (key) => (store.has(key) ? store.get(key) : null);
    mgr.set = async (key, value) => { store.set(key, value); return true; };
    return mgr;
  }

  await test("first caller runs producer, second caller reuses inflight promise", async () => {
    const mgr = newMgr();
    let calls = 0;
    const producer = async () => {
      calls++;
      await new Promise(r => setTimeout(r, 10));
      return { n: calls };
    };
    const [a, b] = await Promise.all([
      mgr.getOrCompute("k1", "data", producer, 60),
      mgr.getOrCompute("k1", "data", producer, 60),
    ]);
    assert.strictEqual(calls, 1, "producer should run once");
    assert.deepStrictEqual(a, { n: 1 });
    assert.deepStrictEqual(b, { n: 1 });
  });

  await test("cache hit returns without running producer", async () => {
    const mgr = newMgr();
    await mgr.set("k2", { cached: true });
    let calls = 0;
    const result = await mgr.getOrCompute("k2", "data", async () => { calls++; return { cached: false }; }, 60);
    assert.strictEqual(calls, 0);
    assert.deepStrictEqual(result, { cached: true });
  });

  await test("inflight map clears after producer resolves", async () => {
    const mgr = newMgr();
    await mgr.getOrCompute("k3", "data", async () => ({ x: 1 }), 60);
    assert.strictEqual(mgr._inflight.size, 0);
  });

  await test("inflight map clears after producer rejects", async () => {
    const mgr = newMgr();
    const err = new Error("producer failed");
    await assert.rejects(
      mgr.getOrCompute("k4", "data", async () => { throw err; }, 60),
      /producer failed/
    );
    assert.strictEqual(mgr._inflight.size, 0);
  });

  await test("rejection propagates to all waiters", async () => {
    const mgr = newMgr();
    const producer = async () => { throw new Error("shared failure"); };
    const results = await Promise.allSettled([
      mgr.getOrCompute("k5", "data", producer, 60),
      mgr.getOrCompute("k5", "data", producer, 60),
    ]);
    assert.strictEqual(results[0].status, "rejected");
    assert.strictEqual(results[1].status, "rejected");
    assert.strictEqual(results[0].reason.message, "shared failure");
  });

  await test("different keys run producers independently", async () => {
    const mgr = newMgr();
    let aCalls = 0, bCalls = 0;
    await Promise.all([
      mgr.getOrCompute("a", "data", async () => { aCalls++; return 1; }, 60),
      mgr.getOrCompute("b", "data", async () => { bCalls++; return 2; }, 60),
    ]);
    assert.strictEqual(aCalls, 1);
    assert.strictEqual(bCalls, 1);
  });

  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  console.log(`\nAll tests passed`);
}
main();
