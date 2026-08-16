/**
 * fb#614 — per-build cache key namespace.
 *
 * The bug: staging and production are two App Service slots on ONE Redis. With
 * no build dimension in the key, whichever slot answered a key first pinned that
 * response body for both slots for the whole TTL — so a staging check could be
 * reading production's payload (and vice versa), and a payload-narrowing security
 * fix kept serving the wide pre-fix body it inherited from the other slot.
 *
 * Two managers with different stamps here ARE those two slots: same fake Redis,
 * different deployed commit.
 */
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
  console.log("cache key namespace tests:");

  // One shared store = one Redis. Stub the Redis LAYER, not get/set, so the real
  // key-building code runs (matches test-getOrCompute.js).
  function newRedis() {
    const store = new Map();
    return {
      store,
      client: {
        get: async (k) => (store.has(k) ? store.get(k) : null),
        setex: async (k, _ttl, v) => { store.set(k, v); return "OK"; },
        del: async (...ks) => ks.filter((k) => store.delete(k)).length,
        scan: async (_cursor, _m, pattern) => {
          const rx = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
          return ["0", [...store.keys()].filter((k) => rx.test(k))];
        },
      },
    };
  }

  function newMgr(stamp, redis) {
    const mgr = new UniversalCacheManager({ keyNamespace: stamp });
    mgr.withRedis = async (op, fallback) => {
      try { return await op(redis.client); } catch { return fallback; }
    };
    return mgr;
  }

  await test("entries are stored under r:<stamp>:<logical key>", async () => {
    const redis = newRedis();
    const mgr = newMgr("aaaa1111", redis);
    await mgr.set("geocode:cli:8:abc", { shape: "new" }, 60);
    assert.deepStrictEqual([...redis.store.keys()], ["r:aaaa1111:geocode:cli:8:abc"]);
  });

  await test("fb#614: a build never reads another build's cached payload", async () => {
    const redis = newRedis();
    const staging = newMgr("6da20787", redis);
    const production = newMgr("370fd2d8", redis);

    // Staging answers the fresh key first and caches ITS payload shape.
    await staging.set("geocode:cli:8:limit11", { isPublic: true }, 60);

    // Before the fix, production returned staging's body here.
    assert.strictEqual(await production.get("geocode:cli:8:limit11", "geocode"), null);
    assert.deepStrictEqual(await staging.get("geocode:cli:8:limit11", "geocode"), { isPublic: true });
  });

  await test("invalidation still clears EVERY build's copy (shared SQL database)", async () => {
    const redis = newRedis();
    const staging = newMgr("6da20787", redis);
    const production = newMgr("370fd2d8", redis);

    await staging.set("geocode:cli:8:x", { v: "staging" }, 60);
    await production.set("geocode:cli:8:x", { v: "production" }, 60);
    assert.strictEqual(redis.store.size, 2, "both builds cached their own copy");

    // A write on ONE slot must not leave the other serving a stale body.
    const deleted = await production.invalidateByPattern("geocode:cli:*");
    assert.strictEqual(deleted, 2, "sweep must reach both namespaces");
    assert.strictEqual(await staging.get("geocode:cli:8:x", "geocode"), null);
    assert.strictEqual(await production.get("geocode:cli:8:x", "geocode"), null);
  });

  await test("an already-physical pattern is swept as-is (copy-paste from `cache keys`)", async () => {
    const redis = newRedis();
    const staging = newMgr("6da20787", redis);
    const production = newMgr("370fd2d8", redis);
    await staging.set("keikka:get:5:8", { v: 1 }, 60);
    await production.set("keikka:get:5:8", { v: 2 }, 60);

    // Physical glob → only that one build's copy; no double-prefixing.
    assert.strictEqual(await production.invalidateByPattern("r:6da20787:keikka:get:*"), 1);
    assert.strictEqual(await staging.get("keikka:get:5:8", "keikka"), null);
    assert.deepStrictEqual(await production.get("keikka:get:5:8", "keikka"), { v: 2 });
  });

  await test("stripNamespace maps a physical key back to its logical name", async () => {
    const mgr = newMgr("aaaa1111", newRedis());
    assert.strictEqual(mgr.stripNamespace("r:aaaa1111:keikka:get:5"), "keikka:get:5");
    // Untouched: an unnamespaced operational key, and a logical key merely starting with "r".
    assert.strictEqual(mgr.stripNamespace("rl:jwt-login:1.2.3.4"), "rl:jwt-login:1.2.3.4");
    assert.strictEqual(mgr.stripNamespace("reminder:list:8"), "reminder:list:8");
  });

  await test("clearAllCache sweeps both namespaced and legacy keys, sparing excluded ones", async () => {
    const redis = newRedis();
    const mgr = newMgr("aaaa1111", redis);

    await mgr.set("grid:v7tenant:20260816:8", { rows: [] }, 60);   // namespaced cache entry
    redis.store.set("grid:v7tenant:20260101:8", "{}");              // pre-fix, unprefixed
    redis.store.set("grid:last-update:8:20260816", "1755300000000"); // operational — must survive
    redis.store.set("r:aaaa1111:grid:last-update:8:20260817", "x");  // ditto, even if namespaced

    const deleted = await mgr.clearAllCache();
    assert.strictEqual(deleted, 2, "both grid payload entries cleared");
    assert.deepStrictEqual(
      [...redis.store.keys()].sort(),
      ["grid:last-update:8:20260816", "r:aaaa1111:grid:last-update:8:20260817"],
    );
  });

  await test("stamp resolution: env override wins, and is never empty", async () => {
    const prevNs = process.env.CACHE_NAMESPACE;
    const prevRel = process.env.SENTRY_RELEASE;
    try {
      process.env.CACHE_NAMESPACE = "1.26.0+6da2:07*87";
      assert.strictEqual(new UniversalCacheManager().keyNamespace, "r:1.26.0+6da2_07_87:");

      delete process.env.CACHE_NAMESPACE;
      process.env.SENTRY_RELEASE = "1.26.0+370fd2d8";
      assert.strictEqual(new UniversalCacheManager().keyNamespace, "r:1.26.0+370fd2d8:");

      // No stamp source at all (dev): still namespaced, so every key stays
      // inside the r:*: invalidation glob.
      delete process.env.SENTRY_RELEASE;
      assert.strictEqual(new UniversalCacheManager().keyNamespace, "r:dev:");
    } finally {
      if (prevNs === undefined) delete process.env.CACHE_NAMESPACE; else process.env.CACHE_NAMESPACE = prevNs;
      if (prevRel === undefined) delete process.env.SENTRY_RELEASE; else process.env.SENTRY_RELEASE = prevRel;
    }
  });

  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  console.log(`\nAll tests passed`);
}
main();
