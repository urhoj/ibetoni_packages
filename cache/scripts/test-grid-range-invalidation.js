/**
 * fb#3029 — a date-pinned grid sweep must also clear the multi-day keys whose range covers the date.
 *
 * Multi-day grid keys sit under their START date: `list` mode
 * (grid:v7tenant:{start}:{csv}:list:{end}:p..:h..a..) and the /oma upcoming list
 * (grid:v7tenant:{start}:{owner}:upcoming:{end}:d..:..). A dated write with no resolved gridScope
 * (a PERSON_PVM / KEIKKA_COPY / PALKKI_* route write whose scope lookup found nothing) swept only
 * `grid:v7tenant:{writeDate}:*`, so an edit on day 3 of a cached week never reached that week's
 * entry and it stayed stale until TTL.
 *
 * Real manager and real invalidateCrossEntity → invalidateGridSmart → invalidate; only the Redis
 * layer is faked (same shape as test-namespace.js), so the key filter that actually runs is tested.
 */
const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");
const { test, finish } = require("./_harness");

function newMgr() {
  const store = new Map();
  const client = {
    get: async (k) => (store.has(k) ? store.get(k) : null),
    setex: async (k, _ttl, v) => { store.set(k, v); return "OK"; },
    del: async (...ks) => ks.flat().filter((k) => store.delete(k)).length,
    scan: async (_cursor, _m, pattern) => {
      const rx = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
      return ["0", [...store.keys()].filter((k) => rx.test(k))];
    },
  };
  const mgr = new UniversalCacheManager({ keyNamespace: "aaaa1111" });
  mgr.withRedis = async (op, fallback) => {
    try { return await op(client); } catch { return fallback; }
  };
  return { mgr, store };
}

const KEYS = {
  dayOfWrite: "grid:v7tenant:20261029:27:grid:p10:h1a0",
  otherDay: "grid:v7tenant:20261030:27:grid:p10:h1a0",
  listCovering: "grid:v7tenant:20261027:8,27:list:20261102:p10:h1a0",
  listBefore: "grid:v7tenant:20261020:8,27:list:20261026:p10:h1a0",
  upcomingCovering: "grid:v7tenant:20261027:27:upcoming:20261102:d316:s",
  upcomingEndsOnDate: "grid:v7tenant:20261023:27:upcoming:20261029:d316:s",
  upcomingAfter: "grid:v7tenant:20261030:27:upcoming:20261105:d316:s",
  notGrid: "grid:staticData:27",
};

async function seed(mgr) {
  for (const k of Object.values(KEYS)) await mgr.set(k, { k }, 60);
}
const left = (mgr, store) => [...store.keys()].map((k) => mgr.stripNamespace(k)).sort();

async function main() {
  console.log("grid date-range invalidation tests:");

  await test("a dated KEIKKA_UPDATE with no gridScope clears the day's keys AND every multi-day key covering it", async () => {
    const { mgr, store } = newMgr();
    await seed(mgr);
    // Route-shaped (createKeikkaParamsExtractor): the date rides in the body.
    await mgr.invalidateCrossEntity("KEIKKA_UPDATE", {
      asiakasId: 27, entityType: "keikka", entityId: 5, body: { keikkaId: 5, pumppuAika: "20261029" },
    });
    assert.deepStrictEqual(
      left(mgr, store),
      [KEYS.listBefore, KEYS.notGrid, KEYS.otherDay, KEYS.upcomingAfter].sort(),
    );
  });

  await test("the Betomik sync shape (date outside the body) sweeps every grid key, upcoming included", async () => {
    const { mgr, store } = newMgr();
    await seed(mgr);
    // modules/betomikOrderbook/syncSql.js invalidateKeikka: invalidateGridSmart reads the date from
    // `body` only, so this lands on the no-date sweep. Pinned so a "fix" that starts reading
    // params.pumppuAika there does not silently narrow it to one day without the range filter.
    await mgr.invalidateCrossEntity("KEIKKA_UPDATE", {
      asiakasId: 27, entityType: "keikka", entityId: 5, pumppuAika: "20261029", body: { keikkaId: 5 },
    });
    assert.deepStrictEqual(left(mgr, store), [KEYS.notGrid]);
  });

  await test("a dated PALKKI_UPDATE takes the same path", async () => {
    const { mgr, store } = newMgr();
    await seed(mgr);
    await mgr.invalidateGridSmart("PALKKI_UPDATE", { timeStart: "20261031" }, { asiakasId: 27 });
    // 20261031 lies in listCovering, upcomingCovering and upcomingAfter (20261030..20261105).
    assert.deepStrictEqual(
      left(mgr, store),
      [KEYS.dayOfWrite, KEYS.listBefore, KEYS.notGrid, KEYS.otherDay, KEYS.upcomingEndsOnDate].sort(),
    );
  });

  await test("a numeric dateKey matches single-day keys too (formatGridDate passes numbers through)", async () => {
    const { mgr, store } = newMgr();
    await seed(mgr);
    await mgr._invalidateGridDate(mgr.formatGridDate(20261029));
    assert.ok(!left(mgr, store).includes(KEYS.dayOfWrite));
  });

  await test("ASIAKAS_MERGE sweeps every cached palkki-type list (the merge re-owns grid_palkkiTypes)", async () => {
    const { mgr, store } = newMgr();
    await seed(mgr);
    await mgr.invalidateCrossEntity("ASIAKAS_MERGE", { asiakasId: 27, entityId: 30 });
    assert.ok(!left(mgr, store).includes(KEYS.notGrid));
  });

  await test("a range key with a malformed end segment is matched on its start date only", async () => {
    const { mgr, store } = newMgr();
    await mgr.set("grid:v7tenant:20261027:27:list:garbage:p10:h1a0", {}, 60);
    await mgr._invalidateGridDate("20261029");
    assert.strictEqual(store.size, 1);
    await mgr._invalidateGridDate("20261027");
    assert.strictEqual(store.size, 0);
  });

  await test("no date still sweeps every grid:v7tenant key, nothing else", async () => {
    const { mgr, store } = newMgr();
    await seed(mgr);
    await mgr.invalidate("GRID_UPDATE", "grid", { asiakasId: 27 });
    assert.deepStrictEqual(left(mgr, store), [KEYS.notGrid]);
  });

  await test("a resolved gridScope still wins over the date (tenant-scoped, every date)", async () => {
    const { mgr, store } = newMgr();
    await seed(mgr);
    await mgr.set("grid:v7tenant:20261029:8:grid:p11:h1a0", {}, 60);
    await mgr.invalidate("KEIKKA_UPDATE", "grid", { pumppuAika: "20261029", gridScope: { tenants: [27] } });
    assert.deepStrictEqual(left(mgr, store), ["grid:v7tenant:20261029:8:grid:p11:h1a0", KEYS.notGrid].sort());
  });

  finish("\nAll grid date-range invalidation tests passed");
}
main();
