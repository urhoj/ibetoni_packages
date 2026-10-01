const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

// fb#2007: GET /api/betoni/laatu/search is cached under `betoni:laatu:search:<q>` —
// one key spans EVERY supplier's grades, so no supplier-scoped sweep can reach it.
// Pin: every grade write sweeps the whole search family, even a supplier-scoped one.

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
  console.log("betoniLaatu invalidation tests:");

  for (const op of ["BETONI_LAATU_UPDATE", "BETONI_LAATU_CREATE"]) {
    await test(`${op} on one supplier sweeps its list AND every search key`, async () => {
      const { mgr, patterns } = newMgr();
      await mgr.invalidateCrossEntity(op, { asiakasId: 26, betoniToimittajaAsiakasId: 26 });
      assert.ok(patterns.includes("betoni:laatu:list:26"), `no list sweep in ${JSON.stringify(patterns)}`);
      assert.ok(patterns.includes("betoni:laatu:search:*"), `no search sweep in ${JSON.stringify(patterns)}`);
    });
  }

  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  console.log("\nAll betoniLaatu invalidation tests passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
