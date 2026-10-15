const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");
const { test, finish } = require("./_harness");

// `ib person get` caches under the READER's company — person:get:{owner}:{id}:cli,
// or person:get:self:{owner}:{id}:cli for a self read (puminet5api
// routes/cli/personGetKeyGen.js). The row carries the person's roles in that
// company and is visible only to companies that own the person or hold an
// asiakasPerson membership, so role, membership and owner writes must reach every
// company's copy, not just the writer's tenant (fb#2602).

const globMatches = (glob, key) =>
  new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(key);

function newMgr() {
  const mgr = new UniversalCacheManager();
  const patterns = [];
  mgr.invalidateByPattern = async (p) => { patterns.push(p); return 1; };
  mgr.invalidate = async () => 1;
  mgr.invalidateGridSmart = async () => 1;
  return { mgr, patterns };
}

const KEYS = ["person:get:1360:42:cli", "person:get:self:27:42:cli"];

async function main() {
  console.log("person cli get invalidation tests:");

  const OPS = [
    "ASIAKAS_PERSON_SETTING_CREATE",
    "ASIAKAS_PERSON_SETTING_DELETE",
    "PERSON_UPDATE",
  ];
  for (const op of OPS) {
    await test(`${op} reaches every company's ib person get copy`, async () => {
      const { mgr, patterns } = newMgr();
      await mgr.invalidateCrossEntity(op, { asiakasId: 8, personId: 42, entityId: 42 });
      for (const key of KEYS) {
        assert.ok(patterns.some((p) => globMatches(p, key)), `${key} not swept; got ${JSON.stringify(patterns)}`);
      }
    });
  }

  await test("the sweep is exact in the person segment (42 does not reach 142 or 420)", async () => {
    const { mgr, patterns } = newMgr();
    await mgr.invalidateCrossEntity("ASIAKAS_PERSON_SETTING_CREATE", { asiakasId: 8, personId: 42 });
    const glob = patterns.find((p) => p.startsWith("person:get:"));
    assert.ok(!globMatches(glob, "person:get:8:142:cli"), "142 must not be swept");
    assert.ok(!globMatches(glob, "person:get:8:420:cli"), "420 must not be swept");
  });

  finish("\nall person cli get invalidation tests passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
