const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

// Regression (fb#1820): POST /api/admin/tyomaa-combinator/merge deletes the
// secondary worksite, but TYOMAA_MERGE had no case in invalidateCrossEntity —
// it fell to `default`, whose entity is `params.entityType || "default"`, and
// the combinator extractor sets no entityType. The sweep pattern was therefore
// `default:*:<owner>*`, which names no key, so `tyomaa:search:<owner>:…` kept
// listing the deleted worksite until its 10-minute TTL. Pin: a tyomaa merge
// sweeps the same entities a tyomaa delete does.

const { test, finish } = require("./_harness");

function newMgr() {
  const mgr = new UniversalCacheManager();
  const entities = [];
  const patterns = [];
  mgr.invalidate = async (_op, entityType) => { entities.push(entityType); return 1; };
  mgr.invalidateByPattern = async (p) => { patterns.push(p); return 1; };
  return { mgr, entities, patterns };
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

  // fb#2373: the merge re-points keikkas, but the keikka entity sweep never
  // reaches `keikka:listByAsiakases:*` (CLI keikka list/stats keys), so
  // `keikka list --worksite <main|secondary>` served the pre-merge rows until TTL.
  await test("TYOMAA_MERGE sweeps the keikka list prefix (fb#2373)", async () => {
    const { mgr, patterns } = newMgr();
    await mgr.invalidateCrossEntity("TYOMAA_MERGE", { asiakasId: 27, mainTyomaaId: 3399, secondaryTyomaaId: 3604 });
    assert.ok(patterns.includes("keikka:listByAsiakases:*"), `no keikka list sweep: ${JSON.stringify(patterns)}`);
  });

  finish("\nAll tyomaa merge invalidation tests passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
