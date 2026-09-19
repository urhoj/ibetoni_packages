const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

// Regression (fb#1820): POST /api/admin/tyomaa-combinator/merge deletes the
// secondary worksite, but TYOMAA_MERGE had no case in invalidateCrossEntity —
// it fell to `default`, whose entity is `params.entityType || "default"`, and
// the combinator extractor sets no entityType. The sweep pattern was therefore
// `default:*:<owner>*`, which names no key, so `tyomaa:search:<owner>:…` kept
// listing the deleted worksite until its 10-minute TTL. Pin: a tyomaa merge
// sweeps the same entities a tyomaa delete does.

let failures = 0;
function test(name, fn) {
  return (async () => {
    try { await fn(); console.log(`  ok  ${name}`); }
    catch (e) { failures++; console.error(`  FAIL ${name}\n       ${e.message}`); }
  })();
}

function newMgr() {
  const mgr = new UniversalCacheManager();
  const entities = [];
  mgr.invalidate = async (_op, entityType) => { entities.push(entityType); return 1; };
  mgr.invalidateByPattern = async () => 1;
  return { mgr, entities };
}

async function main() {
  console.log("tyomaa merge invalidation tests:");

  await test("TYOMAA_MERGE sweeps tyomaa (search/list keys) like TYOMAA_DELETE, not the dead `default` entity", async () => {
    const { mgr, entities } = newMgr();
    // Exactly what createCombinatorRouter's mergeParamsExtractor sends: no entityType.
    await mgr.invalidateCrossEntity("TYOMAA_MERGE", {
      asiakasId: 27,
      mainTyomaaId: 3373,
      secondaryTyomaaId: 3380,
      affectedEntities: ["tyomaa", "keikka", "person", "grid"],
    });
    for (const e of ["tyomaa", "keikka", "person", "grid"]) {
      assert.ok(entities.includes(e), `expected a ${e} sweep, got ${JSON.stringify(entities)}`);
    }
    assert.ok(!entities.includes("default"), `swept the dead 'default' entity: ${JSON.stringify(entities)}`);
  });

  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  console.log("\nAll tyomaa merge invalidation tests passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
