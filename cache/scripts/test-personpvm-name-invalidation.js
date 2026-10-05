const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

// Regression: GET /api/personPvm/list/:asiakasId (proc personPvm_list) EMBEDS
// personFirstName/personLastName, cached as `personpvm:list:<owner>:…` for 1 h.
// The Grid driver panel renders the name from that row whenever the driver has
// a personPvm row for the day (GridKuskitDriver: `lomaData_currentDriver || driver`),
// so a rename via POST /api/person/set painted the fresh roster name and then
// "reverted" the moment LomaContext loaded — PERSON_UPDATE swept person/keikka/
// asiakas/tyomaa/grid but never personpvm. Pin: person writes sweep personpvm too.

const { test, finish } = require("./_harness");

function newMgr() {
  const mgr = new UniversalCacheManager();
  const entities = [];
  mgr.invalidate = async (_op, entityType) => { entities.push(entityType); return 1; };
  mgr.invalidateByPattern = async () => 1;
  return { mgr, entities };
}

async function main() {
  console.log("personpvm name invalidation tests:");

  for (const op of ["PERSON_UPDATE", "PERSON_DELETE"]) {
    await test(`${op} sweeps the personpvm entity (list payload carries the person's name)`, async () => {
      const { mgr, entities } = newMgr();
      await mgr.invalidateCrossEntity(op, { asiakasId: 8, entityType: "person", entityId: 316 });
      assert.ok(entities.includes("personpvm"), `expected a personpvm sweep, got ${JSON.stringify(entities)}`);
    });
  }

  finish("\nAll personpvm name invalidation tests passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
