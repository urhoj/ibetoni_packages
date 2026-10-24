const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

const { test, finish } = require("./_harness");

async function main() {
  console.log("getOrCompute singleflight tests:");

  // Stub the Redis LAYER (not get/set) so the real get()/set()/getOrCompute()
  // code paths run against an in-memory store. This is deliberate: stubbing
  // get/set directly would mask bugs like a missing set() method (which
  // getOrCompute calls internally). withRedis(op, fallback) normally hands a
  // redis client to `op`; here we hand it a Map-backed fake.
  function newMgr() {
    const mgr = new UniversalCacheManager();
    const store = new Map();
    const fakeRedis = {
      get: async (k) => (store.has(k) ? store.get(k) : null),
      setex: async (k, _ttl, v) => { store.set(k, v); return "OK"; },
      del: async (k) => (store.delete(k) ? 1 : 0),
    };
    mgr.withRedis = async (op, fallback) => {
      try { return await op(fakeRedis); } catch { return fallback; }
    };
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

  await test("invalidation during a compute: no re-cache, later caller does not join (fb#2826)", async () => {
    const mgr = newMgr();
    let release;
    const gate = new Promise((r) => { release = r; });
    const first = mgr.getOrCompute("k6", "data", async () => { await gate; return { v: "old" }; }, 60);
    await new Promise((r) => setImmediate(r)); // let the first caller register in _inflight
    mgr.invalidationGeneration++; // what every invalidation does first
    const second = mgr.getOrCompute("k6", "data", async () => ({ v: "new" }), 60);
    release();
    assert.deepStrictEqual(await first, { v: "old" });
    assert.deepStrictEqual(await second, { v: "new" });
    assert.deepStrictEqual(await mgr.get("k6", "data"), { v: "new" });
  });

  await test("a producer that throws synchronously rejects with its own error and is not kept (fb#2871)", async () => {
    const mgr = newMgr();
    const boom = () => { throw new Error("boom"); };
    await assert.rejects(mgr.getOrCompute("k7", "data", boom, 60), /boom/);
    assert.strictEqual(mgr._inflight.size, 0);
  });

  finish();
}
main();
