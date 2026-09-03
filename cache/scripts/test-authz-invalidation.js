const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");
const { AUTHZ_PREFIX, authzKey, authzSweepGlob } = require("../src/authzKeys");

// The pre-cache read gates in puminet5api (middleware/require*ReadAccess) memoise
// TARGET-side lookups — "who owns tyomaa 123", "is sijainti 45 public", "is the
// ecofleet module on for company 8" — under authz:<kind>:<family>:<id>[...]
// (puminet5api/modules/cache/authzLookupCache.js). Those facts change only through
// the family's own write op, so invalidateCrossEntity sweeps them by op family +
// entity id after the per-op switch. These tests pin that sweep so an op refactor
// cannot silently leave a transferred entity readable by its old tenant.
//
// Expectations are BUILT with authzSweepGlob rather than hand-typed, and the final
// block glob-matches the emitted sweep against keys authzKey produced (fb#1261).
// Hand-typed strings on both sides is what let the writer and the sweeper drift
// apart with every suite still green.

// Redis glob → RegExp. Only `*` is used by authzSweepGlob; everything else is
// matched literally, so a segment rename shows up as a miss rather than a fluke.
const globMatches = (glob, key) =>
  new RegExp(`^${glob.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*")}$`).test(key);

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
    ["TYOMAA_UPDATE", { asiakasId: 8, entityId: 123 }, authzSweepGlob("tyomaa", 123)],
    ["TYOMAA_DELETE", { asiakasId: 8, entityId: 123 }, authzSweepGlob("tyomaa", 123)],
    ["VEHICLE_UPDATE", { asiakasId: 8, entityId: 45 }, authzSweepGlob("vehicle", 45)],
    ["SIJAINTI_UPDATE", { asiakasId: 8, sijaintiId: 183, entityId: 183 }, authzSweepGlob("sijainti", 183)],
    ["ASIAKAS_UPDATE", { asiakasId: 8, entityId: 1360 }, authzSweepGlob("asiakas", 1360)],
    ["PERSON_UPDATE", { asiakasId: 8, personId: 42, entityId: 42 }, authzSweepGlob("person", 42)],
    ["PERSON_TENANT_UPDATE", { asiakasId: 8, personId: 42, entityId: 42 }, authzSweepGlob("person", 42)],
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
    assert.ok(patterns.includes(authzSweepGlob("asiakas")), `expected wildcard, got ${JSON.stringify(patterns)}`);
    assert.ok(!patterns.includes(authzSweepGlob("asiakas", 8)), "writer tenant must not be mistaken for the target");
  });

  await test("ASIAKAS_MERGE sweeps every cached asiakas owner", async () => {
    const { mgr, patterns } = newMgr();
    await mgr.invalidateCrossEntity("ASIAKAS_MERGE", { asiakasId: 8 });
    assert.ok(patterns.includes(authzSweepGlob("asiakas")), JSON.stringify(patterns));
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

  for (const op of ["VEHICLE_DATE_UPDATE", "PERSON_DATE_CREATE", "SIJAINTI_DATE_DELETE"]) {
    await test(`${op} does not sweep authz keys (a date op never changes an owner)`, async () => {
      const { mgr, patterns } = newMgr();
      await mgr.invalidateCrossEntity(op, { asiakasId: 8, entityId: 77 });
      assert.ok(!patterns.some((p) => p.startsWith("authz:")), JSON.stringify(patterns));
    });
  }

  for (const op of ["ASIAKAS_MERGE", "PERSON_MERGE"]) {
    await test(`${op} sweeps the WHOLE authz namespace (a merge re-points every family)`, async () => {
      const { mgr, patterns } = newMgr();
      await mgr.invalidateCrossEntity(op, { asiakasId: 8 });
      assert.ok(patterns.includes(`${AUTHZ_PREFIX}:*`), JSON.stringify(patterns));
    });
  }

  // ---------------------------------------------------------------------------
  // The cross-repo contract (fb#1261). Everything above compares the emitted sweep
  // to another authzSweepGlob() call, so it would stay green if the shape moved.
  // These cases instead assert that the glob invalidateCrossEntity actually emits
  // MATCHES the keys authzLookupCache actually writes — the one thing that must
  // hold, and the one thing two suites of hand-typed strings never checked.
  // Key shapes mirror puminet5api/modules/cache/authzLookupCache.js.
  const WRITTEN_KEYS = [
    ["owner", authzKey("owner", "tyomaa", 123), "tyomaa", 123, "TYOMAA_UPDATE"],
    ["row", authzKey("row", "sijainti", 183), "sijainti", 183, "SIJAINTI_UPDATE"],
    ["owner", authzKey("owner", "asiakas", 1360), "asiakas", 1360, "ASIAKAS_UPDATE"],
    ["module", authzKey("module", "asiakas", 1360, "ecofleet"), "asiakas", 1360, "ASIAKAS_UPDATE"],
  ];

  for (const [kind, key, family, id, op] of WRITTEN_KEYS) {
    await test(`${op} emits a sweep that MATCHES the ${kind} key ${key}`, async () => {
      const { mgr, patterns } = newMgr();
      await mgr.invalidateCrossEntity(op, { asiakasId: 8, entityId: id });
      const authzPatterns = patterns.filter((p) => p.startsWith(`${AUTHZ_PREFIX}:`));
      assert.ok(
        authzPatterns.some((p) => globMatches(p, key)),
        `no emitted pattern reaches "${key}"; swept ${JSON.stringify(authzPatterns)}`,
      );
    });
  }

  await test("a sweep does not reach another family's or another entity's keys", async () => {
    const key = authzKey("owner", "tyomaa", 123);
    assert.ok(!globMatches(authzSweepGlob("vehicle", 123), key), "wrong family must not match");
    assert.ok(!globMatches(authzSweepGlob("tyomaa", 456), key), "wrong entity must not match");
    // The whole-family wildcard is the no-entityId fallback: broad, but still scoped.
    assert.ok(globMatches(authzSweepGlob("tyomaa"), key), "family wildcard must reach the family");
    assert.ok(!globMatches(authzSweepGlob("vehicle"), key), "family wildcard must stay in its family");
  });

  await test("a merge sweeps every key shape at once", async () => {
    const { mgr, patterns } = newMgr();
    await mgr.invalidateCrossEntity("ASIAKAS_MERGE", { asiakasId: 8 });
    for (const [, key] of WRITTEN_KEYS) {
      assert.ok(
        patterns.some((p) => globMatches(p, key)),
        `merge left "${key}" behind; swept ${JSON.stringify(patterns)}`,
      );
    }
  });

  if (failures) {
    console.error(`\n${failures} failing`);
    process.exit(1);
  }
  console.log("\nall authz invalidation tests passed");
}

main().catch((e) => { console.error(e); process.exit(1); });
