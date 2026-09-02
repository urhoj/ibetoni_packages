const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

// The pre-cache read gates in puminet5api (middleware/require*ReadAccess) memoise
// TARGET-side lookups — "who owns tyomaa 123", "is sijainti 45 public", "is the
// ecofleet module on for company 8" — under authz:<kind>:<family>:<id>[...]
// (puminet5api/modules/cache/authzLookupCache.js). Those facts change only through
// the family's own write op, so invalidateCrossEntity sweeps them by op family +
// entity id after the per-op switch. These tests pin that sweep so an op refactor
// cannot silently leave a transferred entity readable by its old tenant.

let failures = 0;
function test(name, fn) {
  return (async () => {
    try { await fn(); console.log(`  ok  ${name}`); }
    catch (e) { failures++; console.error(`  FAIL ${name}\n       ${e.message}`); }
  })();
}

// Invalidation sinks stubbed: invalidateByPattern records the raw patterns swept.
function newMgr() {
  const mgr = new UniversalCacheManager();
  const patterns = [];
  mgr.invalidateByPattern = async (p) => { patterns.push(p); return 1; };
  mgr.invalidate = async () => 1;
  mgr.invalidateGridSmart = async () => 1;
  return { mgr, patterns };
}

async function main() {
  console.log("authz lookup-cache invalidation tests:");

  const CASES = [
    ["TYOMAA_UPDATE", { asiakasId: 8, entityId: 123 }, "authz:*:tyomaa:123*"],
    ["TYOMAA_DELETE", { asiakasId: 8, entityId: 123 }, "authz:*:tyomaa:123*"],
    ["VEHICLE_UPDATE", { asiakasId: 8, entityId: 45 }, "authz:*:vehicle:45*"],
    ["SIJAINTI_UPDATE", { asiakasId: 8, sijaintiId: 183, entityId: 183 }, "authz:*:sijainti:183*"],
    ["ASIAKAS_UPDATE", { asiakasId: 8, entityId: 1360 }, "authz:*:asiakas:1360*"],
    ["PERSON_UPDATE", { asiakasId: 8, personId: 42, entityId: 42 }, "authz:*:person:42*"],
    ["PERSON_TENANT_UPDATE", { asiakasId: 8, personId: 42, entityId: 42 }, "authz:*:person:42*"],
  ];
  for (const [op, params, expected] of CASES) {
    await test(`${op} sweeps ${expected}`, async () => {
      const { mgr, patterns } = newMgr();
      await mgr.invalidateCrossEntity(op, params);
      assert.ok(patterns.includes(expected), `expected "${expected}", got ${JSON.stringify(patterns)}`);
    });
  }

  await test("ASIAKAS_UPDATE without an entityId falls back to a wildcard, never the WRITER's asiakasId", async () => {
    const { mgr, patterns } = newMgr();
    await mgr.invalidateCrossEntity("ASIAKAS_UPDATE", { asiakasId: 8 });
    assert.ok(patterns.includes("authz:*:asiakas:*"), `expected wildcard, got ${JSON.stringify(patterns)}`);
    assert.ok(!patterns.includes("authz:*:asiakas:8*"), "writer tenant must not be mistaken for the target");
  });

  await test("ASIAKAS_MERGE sweeps every cached asiakas owner", async () => {
    const { mgr, patterns } = newMgr();
    await mgr.invalidateCrossEntity("ASIAKAS_MERGE", { asiakasId: 8 });
    assert.ok(patterns.includes("authz:*:asiakas:*"), JSON.stringify(patterns));
  });

  await test("a keikka write does not sweep authz keys (no keikka owner is cached)", async () => {
    const { mgr, patterns } = newMgr();
    await mgr.invalidateCrossEntity("KEIKKA_UPDATE", { asiakasId: 8, keikkaId: 500, entityId: 500 });
    assert.ok(!patterns.some((p) => p.startsWith("authz:")), JSON.stringify(patterns));
  });

  await test("SIJAINTI_LATLNG_UPDATE stays narrow (runs in a loop; no authz sweep)", async () => {
    const { mgr, patterns } = newMgr();
    await mgr.invalidateCrossEntity("SIJAINTI_LATLNG_UPDATE", { sijaintiId: 183, entityId: 183 });
    assert.ok(!patterns.some((p) => p.startsWith("authz:")), JSON.stringify(patterns));
  });

  if (failures) {
    console.error(`\n${failures} failing`);
    process.exit(1);
  }
  console.log("\nall authz invalidation tests passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
