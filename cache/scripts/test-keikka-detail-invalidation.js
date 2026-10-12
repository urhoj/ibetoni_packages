const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

// fb#2496: which writes evict the cached order detail (`keikka:get:<keikkaId>:...`,
// served by keikka_get_v2 and the CLI keikka get), and how widely.
//
// 1. invalidate(op, "keikka", params) read params.entityId as a keikkaId whatever the
//    entity, so a person/vehicle/tyomaa extractor swept ONE unrelated order
//    (keikka:get:<tyomaaId>:*) and missed every real one.
// 2. Writes to a row shared by many orders (customer, worksite, vehicle, person,
//    sijainti) must sweep EVERY order detail: the key carries only the keikkaId. A
//    keikkaId in such a request does not bound the change: tyomaa /set sends
//    body.keikkaId while rewriting the global tyomaa row, and ASIAKAS_UPDATE swept
//    order details only when a keikkaId was present, so a rename stayed stale.
// 3. Writes whose data neither order detail renders (compliance dates, products)
//    must not sweep them at all.

const { test, finish } = require("./_harness");

function newMgr() {
  const mgr = new UniversalCacheManager();
  const patterns = [];
  mgr.invalidateByPattern = async (p) => { patterns.push(p); return 1; };
  // invalidate() runs for real; any path that reaches Redis would open a live
  // client and keep the process alive, so cut it off at the entry points.
  mgr.getClient = async () => null;
  mgr.withRedis = async (_op, fallback = null) => fallback;
  const detail = () => patterns.filter((p) => p.startsWith("keikka:get:"));
  return { mgr, detail, patterns };
}

async function main() {
  console.log("keikka order-detail invalidation tests:");

  await test("a non-keikka entityId is never read as a keikkaId (sweeps all, not keikka:get:<tyomaaId>)", async () => {
    const { mgr, detail } = newMgr();
    await mgr.invalidate("TYOMAA_UPDATE", "keikka", { asiakasId: 27, entityType: "tyomaa", entityId: 3373 });
    assert.deepStrictEqual(detail(), ["keikka:get:*"]);
  });

  await test("a keikka op still sweeps only its own order", async () => {
    const { mgr, detail } = newMgr();
    await mgr.invalidate("KEIKKA_UPDATE", "keikka", { asiakasId: 27, entityType: "keikka", entityId: 500 });
    assert.deepStrictEqual(detail(), ["keikka:get:500:*"]);
  });

  await test("an untyped entityId (query-runner path) still counts as the keikkaId", async () => {
    const { mgr, detail } = newMgr();
    await mgr.invalidate("UPDATE", "keikka", { entityId: 9 });
    assert.deepStrictEqual(detail(), ["keikka:get:9:*"]);
  });

  await test("KEIKKA_PERSON_UPDATE (person extractor + keikkaId) stays scoped to its order", async () => {
    const { mgr, detail } = newMgr();
    await mgr.invalidateCrossEntity("KEIKKA_PERSON_UPDATE", { asiakasId: 27, entityType: "person", entityId: 10, keikkaId: 500 });
    assert.deepStrictEqual(detail(), ["keikka:get:500:*"]);
  });

  // Shared rows: each must sweep every order detail, and never just one id.
  const SHARED = [
    ["ASIAKAS_UPDATE without a keikkaId (customer rename)", "ASIAKAS_UPDATE", { asiakasId: 27, entityType: "asiakas", entityId: 62 }],
    ["TYOMAA_UPDATE whose body carries a keikkaId", "TYOMAA_UPDATE", { asiakasId: 27, entityType: "tyomaa", entityId: 3373, body: { keikkaId: 500 } }],
    ["VEHICLE_UPDATE", "VEHICLE_UPDATE", { asiakasId: 27, entityType: "vehicle", entityId: 53 }],
    ["PERSON_UPDATE from an order dialog", "PERSON_UPDATE", { asiakasId: 27, entityType: "person", entityId: 10, keikkaId: 500 }],
    ["PERSON_DELETE", "PERSON_DELETE", { asiakasId: 27, entityType: "person", entityId: 10 }],
    ["PERSON_MERGE", "PERSON_MERGE", { asiakasId: 27, entityId: 10 }],
    ["SIJAINTI_UPDATE", "SIJAINTI_UPDATE", { asiakasId: 27, entityType: "geocode", sijaintiId: 7 }],
    ["ASIAKAS_MERGE", "ASIAKAS_MERGE", { asiakasId: 27, mainAsiakasId: 62, secondaryAsiakasId: 63 }],
  ];
  for (const [name, op, params] of SHARED) {
    await test(`${name} sweeps every order detail`, async () => {
      const { mgr, detail } = newMgr();
      await mgr.invalidateCrossEntity(op, params);
      assert.ok(detail().includes("keikka:get:*"), `no keikka:get:* sweep: ${JSON.stringify(detail())}`);
      assert.deepStrictEqual(detail().filter((p) => p !== "keikka:get:*"), [],
        `swept a single order instead: ${JSON.stringify(detail())}`);
    });
  }

  // fb#2508: Historiakartta pins (keikka:listByAsiakases:pins:*) carry asiakasNimi and
  // vehicleNimi/No/RegNo, so customer and vehicle writes sweep the list prefix too.
  for (const [op, params] of [
    ["ASIAKAS_UPDATE", { asiakasId: 27, entityType: "asiakas", entityId: 62 }],
    ["VEHICLE_UPDATE", { asiakasId: 27, entityType: "vehicle", entityId: 53 }],
  ]) {
    await test(`${op} sweeps the keikka list/pins prefix`, async () => {
      const { mgr, patterns } = newMgr();
      await mgr.invalidateCrossEntity(op, params);
      assert.ok(patterns.includes("keikka:listByAsiakases:*"), `no list sweep: ${JSON.stringify(patterns)}`);
    });
  }

  // Not rendered on any cached order detail: no sweep at all.
  const INERT = [
    ["PERSON_DATE_UPDATE", { asiakasId: 27, entityType: "personDate", personId: 10 }],
    ["TYOMAA_DATE_UPDATE", { asiakasId: 27, entityType: "tyomaaDate", tyomaaId: 3373 }],
    ["TUOTE_UPDATE", { asiakasId: 27, entityType: "tuote", entityId: 4 }],
  ];
  for (const [op, params] of INERT) {
    await test(`${op} does not touch order details`, async () => {
      const { mgr, detail } = newMgr();
      await mgr.invalidateCrossEntity(op, params);
      assert.deepStrictEqual(detail(), []);
    });
  }

  finish("\nAll keikka order-detail invalidation tests passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
