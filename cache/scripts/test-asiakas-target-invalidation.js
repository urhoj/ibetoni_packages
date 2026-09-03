const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

// Regression (ib feedback #1270): routes/asiakasRoutes.js createAsiakasParamsExtractor
// sets params.asiakasId to the CALLER's active tenant (req.user.ownerAsiakasId) and
// params.entityId to the customer actually being written (req.params.asiakasId /
// req.body.asiakasId). invalidateCrossEntity's ASIAKAS_UPDATE/CREATE/DELETE case only
// ever swept params.asiakasId, so a system admin editing a DIFFERENT company's asiakas
// settings while active on their own left that company's asiakas:*-namespaced cache
// untouched until TTL (BASE_TTL x 4.0 = up to 8h).
//
// These tests pin the SHAPE of the fix: both tenants get swept when they differ, no
// extra sweep appears when they coincide (the normal path), and the pre-existing
// asiakasLinks linkedAsiakasId sweep keeps working alongside it.

let failures = 0;
function test(name, fn) {
  return (async () => {
    try { await fn(); console.log(`  ok  ${name}`); }
    catch (e) { failures++; console.error(`  FAIL ${name}\n       ${e.message}`); }
  })();
}

// invalidateCrossEntity is the method under test; its own `invalidate` calls are
// stubbed to record which {entityType, asiakasId} pairs it dispatched, mirroring
// test-date-invalidation.js's approach. `invalidateByPattern` is also stubbed —
// invalidateCrossEntity's post-switch authz-sweep epilogue (AUTHZ_SWEPT_FAMILIES)
// calls it directly for every "asiakas*" operation, and left for real it reaches
// getClient() and a genuine Redis connection attempt (see test-authz-invalidation.js).
function newMgr() {
  const mgr = new UniversalCacheManager();
  const calls = [];
  mgr.invalidate = async (_operation, entityType, p = {}) => {
    calls.push({ entityType, asiakasId: p.asiakasId });
    return 1;
  };
  mgr.invalidateByPattern = async () => 1;
  const asiakasIds = () => calls.filter((c) => c.entityType === "asiakas").map((c) => c.asiakasId).sort();
  return { mgr, asiakasIds };
}

async function main() {
  console.log("asiakas cache invalidation target-vs-caller tests:");

  await test("ASIAKAS_UPDATE sweeps only the caller's tenant when entityId matches it", async () => {
    const { mgr, asiakasIds } = newMgr();
    await mgr.invalidateCrossEntity("ASIAKAS_UPDATE", { asiakasId: 8, entityId: 8 });
    assert.deepStrictEqual(asiakasIds(), [8],
      `expected exactly one sweep for asiakasId 8, got ${JSON.stringify(asiakasIds())}`);
  });

  for (const op of ["ASIAKAS_UPDATE", "ASIAKAS_CREATE", "ASIAKAS_DELETE"]) {
    await test(`${op} sweeps BOTH the caller's tenant and the edited customer when they differ`, async () => {
      const { mgr, asiakasIds } = newMgr();
      // system admin, active on company 8, editing company 62 (fb#1270 scenario)
      await mgr.invalidateCrossEntity(op, { asiakasId: 8, entityId: 62 });
      assert.deepStrictEqual(asiakasIds(), [8, 62].sort(),
        `expected sweeps for both tenants, got ${JSON.stringify(asiakasIds())}`);
    });
  }

  await test("ASIAKAS_UPDATE does not sweep a second time when entityId is absent", async () => {
    const { mgr, asiakasIds } = newMgr();
    // routes with no extractor (keikkaLaskutusRoutes.js, personPvmRoutes.js) carry no entityId
    await mgr.invalidateCrossEntity("ASIAKAS_UPDATE", { asiakasId: 8 });
    assert.deepStrictEqual(asiakasIds(), [8],
      `expected exactly one sweep, got ${JSON.stringify(asiakasIds())}`);
  });

  await test("asiakasLinks: entityId and linkedAsiakasId sweeps compose without dropping either", async () => {
    const { mgr, asiakasIds } = newMgr();
    // createAsiakasLinksParamsExtractor: entityId = the link owner (== caller here),
    // linkedAsiakasId = the other side of the link.
    await mgr.invalidateCrossEntity("ASIAKAS_UPDATE", { asiakasId: 8, entityId: 8, linkedAsiakasId: 30 });
    assert.deepStrictEqual(asiakasIds(), [8, 30].sort(),
      `expected sweeps for the caller and the linked customer, got ${JSON.stringify(asiakasIds())}`);
  });

  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  console.log(`\nAll tests passed`);
}
main();
