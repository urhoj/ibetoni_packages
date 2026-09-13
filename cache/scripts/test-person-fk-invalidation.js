const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

// Regression (ib feedback #1683): GET /api/person/getForeignKeys/:personId/:ownerAsiakasId
// is cached under `person:foreignKeys:get:<personId>:<ownerAsiakasId>` — keyed by the
// OWNER in the path, not by the caller's tenant. PERSON_PREFS_UPDATE's generic person
// sweep is `person:*:<callerTenant>*` (params.asiakasId = req.user.ownerAsiakasId), so
// a cross-tenant write (active on 8, writing owner 27 — the Betomik driver-nickname
// shape) left the read cached until TTL: `ib person fk list` answered [] after an
// insert, and a second `set` inserted a duplicate. Pin: the operation sweeps the FK
// read key for that person, whatever the caller's tenant.

let failures = 0;
function test(name, fn) {
  return (async () => {
    try { await fn(); console.log(`  ok  ${name}`); }
    catch (e) { failures++; console.error(`  FAIL ${name}\n       ${e.message}`); }
  })();
}

function newMgr() {
  const mgr = new UniversalCacheManager();
  const patterns = [];
  mgr.invalidate = async () => 1;
  mgr.invalidateByPattern = async (p) => { patterns.push(p); return 1; };
  return { mgr, patterns };
}

async function main() {
  console.log("person foreign-key read invalidation tests:");

  await test("PERSON_PREFS_UPDATE sweeps person:foreignKeys:get:<personId>:* for a cross-tenant write", async () => {
    const { mgr, patterns } = newMgr();
    await mgr.invalidateCrossEntity("PERSON_PREFS_UPDATE", { asiakasId: 8, entityId: 6354 });
    assert.ok(patterns.includes("person:foreignKeys:get:6354:*"),
      `expected the FK read sweep, got ${JSON.stringify(patterns)}`);
  });

  await test("PERSON_PREFS_UPDATE without a personId adds no FK sweep", async () => {
    const { mgr, patterns } = newMgr();
    await mgr.invalidateCrossEntity("PERSON_PREFS_UPDATE", { asiakasId: 8 });
    assert.ok(!patterns.some((p) => p.startsWith("person:foreignKeys:")),
      `unexpected FK sweep in ${JSON.stringify(patterns)}`);
  });

  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  console.log("\nAll person foreign-key invalidation tests passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
