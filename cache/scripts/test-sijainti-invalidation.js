const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

// Regression: sijainti writes left geocode read keys stale (ib feedback #322).
//
// 1. `geocode:cli:<owner>:<hash>` (GET /api/cli/sijainti/list = `ib sijainti
//    list`) was shaped to fall under the generic `geocode:*:<asiakasId>*` glob;
//    fb#93 replaced that glob with explicit key shapes and silently dropped it,
//    so NO sijainti write cleared the CLI list for up to the 1 h geocode TTL.
// 2. SIJAINTI_LATLNG_UPDATE exists so the data-layer writer
//    (geoCodeSql.updateSijaintiLatLng) can invalidate itself on the paths that
//    never reach the route middleware — WITHOUT SIJAINTI_UPDATE's asiakas /
//    keikka / grid fan-out, which degrades to a cross-tenant wipe when called
//    in a loop with no asiakasId.

let failures = 0;
function test(name, fn) {
  return (async () => {
    try { await fn(); console.log(`  ok  ${name}`); }
    catch (e) { failures++; console.error(`  FAIL ${name}\n       ${e.message}`); }
  })();
}

// Manager with the invalidation sinks stubbed: invalidateByPattern records the
// raw patterns swept; invalidate / invalidateGridSmart record the scoped calls
// we assert on (present for SIJAINTI_UPDATE, absent for the latlng-only op).
function newMgr() {
  const mgr = new UniversalCacheManager();
  const patterns = [];
  const scopedCalls = [];
  mgr.invalidateByPattern = async (p) => { patterns.push(p); return 1; };
  mgr.invalidate = async (op, entityType) => { scopedCalls.push({ op, entityType }); return 1; };
  mgr.invalidateGridSmart = async (op) => { scopedCalls.push({ op, entityType: "grid" }); return 1; };
  return { mgr, patterns, scopedCalls };
}

const GEOCODE_READ_KEYS = (id) => [
  `geocode:sijainti:${id}`,
  "geocode:sijaintiList:*",
  "geocode:closest:*",
  "geocode:cli:*",
];

async function main() {
  console.log("sijainti cross-entity invalidation tests:");

  for (const op of ["SIJAINTI_UPDATE", "SIJAINTI_CREATE", "SIJAINTI_DELETE"]) {
    await test(`${op} sweeps every geocode read key incl. geocode:cli:*`, async () => {
      const { mgr, patterns } = newMgr();
      await mgr.invalidateCrossEntity(op, { asiakasId: 8, sijaintiId: 183 });
      for (const expected of GEOCODE_READ_KEYS(183)) {
        assert.ok(patterns.includes(expected),
          `expected sweep of "${expected}", got ${JSON.stringify(patterns)}`);
      }
    });
  }

  await test("SIJAINTI_UPDATE falls back to a wildcard row key with no id", async () => {
    const { mgr, patterns } = newMgr();
    await mgr.invalidateCrossEntity("SIJAINTI_UPDATE", { asiakasId: 8 });
    assert.ok(patterns.includes("geocode:sijainti:*"),
      `expected wildcard row sweep, got ${JSON.stringify(patterns)}`);
  });

  await test("SIJAINTI_UPDATE accepts entityId as the row id", async () => {
    const { mgr, patterns } = newMgr();
    await mgr.invalidateCrossEntity("SIJAINTI_UPDATE", { asiakasId: 8, entityId: 42 });
    assert.ok(patterns.includes("geocode:sijainti:42"),
      `expected "geocode:sijainti:42", got ${JSON.stringify(patterns)}`);
  });

  await test("SIJAINTI_LATLNG_UPDATE sweeps exactly the geocode read keys", async () => {
    const { mgr, patterns } = newMgr();
    const count = await mgr.invalidateCrossEntity("SIJAINTI_LATLNG_UPDATE", {
      sijaintiId: 183, entityId: 183,
    });
    assert.deepStrictEqual(patterns.sort(), GEOCODE_READ_KEYS(183).sort(),
      `unexpected pattern set: ${JSON.stringify(patterns)}`);
    assert.ok(count >= 1, "should report invalidated keys");
  });

  await test("SIJAINTI_LATLNG_UPDATE does NOT fan out to asiakas/keikka/grid", async () => {
    const { mgr, patterns, scopedCalls } = newMgr();
    // No asiakasId — exactly how the loop callers invoke it. Under
    // SIJAINTI_UPDATE this would degrade to `asiakas:*:**` + `grid:v7tenant:*:*`.
    await mgr.invalidateCrossEntity("SIJAINTI_LATLNG_UPDATE", { sijaintiId: 183 });
    assert.strictEqual(scopedCalls.length, 0,
      `must not fan out to scoped entities, got ${JSON.stringify(scopedCalls)}`);
    assert.ok(patterns.every((p) => p.startsWith("geocode:")),
      `must touch only the geocode namespace, got ${JSON.stringify(patterns)}`);
  });

  await test("no sijainti op sweeps the coordinate-keyed distance/metrics keys", async () => {
    for (const op of ["SIJAINTI_UPDATE", "SIJAINTI_LATLNG_UPDATE"]) {
      const { mgr, patterns } = newMgr();
      await mgr.invalidateCrossEntity(op, { asiakasId: 8, sijaintiId: 183 });
      assert.ok(!patterns.some((p) => p.startsWith("geocode:distance") || p.startsWith("geocode:metrics")),
        `${op} must leave distance/metrics keys alone, got ${JSON.stringify(patterns)}`);
    }
  });

  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  console.log(`\nAll tests passed`);
}
main();
