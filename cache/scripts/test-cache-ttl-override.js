// fb#2500: cache(key, data, entity, baseTtlSeconds) — the caller's base TTL replaces
// the entity BASE_TTL and gets the same multiplier + 7-day cap; absent → entity TTL.
const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

const { test, finish } = require("./_harness");

function newMgr() {
  const mgr = new UniversalCacheManager();
  mgr.ttls = [];
  const fakeRedis = { setex: async (_k, ttl) => { mgr.ttls.push(ttl); return "OK"; } };
  mgr.withRedis = async (op, fallback) => { try { return await op(fakeRedis); } catch { return fallback; } };
  return mgr;
}
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) <= Math.ceil(expected * 0.05), `${actual} not within 5% of ${expected}`);

async function main() {
  console.log("cache() TTL override tests:");

  await test("caller base TTL is honoured, scaled like an entity base", async () => {
    const mgr = newMgr();
    await mgr.cache("k", { a: 1 }, "keikka", 300);
    const expected = mgr._scaleTtl(300, "keikka");
    assert.ok(expected < mgr.TTL.keikka, "a 300 s base must be shorter than the keikka default");
    near(mgr.ttls[0], expected);
  });

  await test("no override keeps the entity TTL", async () => {
    const mgr = newMgr();
    await mgr.cache("k", { a: 1 }, "keikka");
    near(mgr.ttls[0], mgr.TTL.keikka);
  });

  // fb#2545: a string / sub-second / non-finite override must never reach setex.
  for (const [label, ttl, entity] of [
    ["string on an excluded entity", "30", "ecofleet"],
    ["sub-second", 0.1, "keikka"],
    ["NaN", NaN, "keikka"],
    ["negative", -5, "keikka"],
    ["Infinity", Infinity, "keikka"],
  ]) {
    await test(`invalid override (${label}) falls back to a positive integer TTL`, async () => {
      const mgr = newMgr();
      await mgr.cache("k", { a: 1 }, entity, ttl);
      assert.ok(Number.isInteger(mgr.ttls[0]) && mgr.ttls[0] >= 1, `got ${JSON.stringify(mgr.ttls[0])}`);
      near(mgr.ttls[0], mgr.TTL[entity]);
    });
  }

  await test("a 1 s base on an excluded entity never jitters below 1", async () => {
    const mgr = newMgr();
    for (let i = 0; i < 50; i++) await mgr.cache("k", { a: 1 }, "ecofleet", 1);
    assert.ok(mgr.ttls.every((t) => t >= 1), `min ${Math.min(...mgr.ttls)}`);
  });

  await test("_scaleTtl: excluded entity keeps base, cap at 7 days", async () => {
    const mgr = newMgr();
    assert.strictEqual(mgr._scaleTtl(30, "ecofleet"), 30);
    assert.strictEqual(mgr._scaleTtl(10 * 604800, "keikka"), 604800);
  });

  finish();
}

main();
