const assert = require("assert");

// fb#1211: invalidateGridSmart's `default:` swept every tenant's grid for ANY op
// nobody had thought of (the fb#761 shape). Every op that reaches the sweep is now
// a named case; an unlisted op still sweeps (fresh beats stale) but reports to
// Sentry so it gets a case of its own. Stub captureError BEFORE the manager loads:
// it destructures the import at require time.
const sentry = require("@ibetoni/sentry");
const reported = [];
sentry.captureError = (error, context) => reported.push({ message: error.message, context });

const UniversalCacheManager = require("../src/UniversalCacheManager");
const { test, finish } = require("./_harness");

function newMgr() {
  const mgr = new UniversalCacheManager();
  const scopedCalls = [];
  mgr.invalidateByPattern = async () => 1;
  mgr.invalidate = async (op, entityType) => { scopedCalls.push({ op, entityType }); return 1; };
  return { mgr, scopedCalls };
}

const LISTED = [
  "KEIKKA_CREATE", "KEIKKA_DELETE", "KEIKKA_BULK_UPDATE", "GRID_UPDATE",
  "ATTACHMENT_UPDATE", "VEHICLE_CREATE", "VEHICLE_UPDATE", "VEHICLE_DELETE",
];

async function main() {
  for (const op of LISTED) {
    await test(`${op} sweeps the grid without reporting`, async () => {
      reported.length = 0;
      const { mgr, scopedCalls } = newMgr();
      await mgr.invalidateGridSmart(op, {}, { asiakasId: 8 });
      assert.deepStrictEqual(scopedCalls, [{ op, entityType: "grid" }]);
      assert.deepStrictEqual(reported, []);
    });
  }

  await test("an unlisted op still sweeps the grid and reports its name to Sentry", async () => {
    reported.length = 0;
    const { mgr, scopedCalls } = newMgr();
    await mgr.invalidateGridSmart("DATE_TYPE_UPDATE", {}, { asiakasId: 8 });
    assert.deepStrictEqual(scopedCalls, [{ op: "DATE_TYPE_UPDATE", entityType: "grid" }]);
    assert.strictEqual(reported.length, 1);
    assert.match(reported[0].message, /DATE_TYPE_UPDATE/);
    assert.deepStrictEqual(reported[0].context.fingerprint, ["cache", "grid-unlisted-op", "DATE_TYPE_UPDATE"]);
  });

  await test("compliance-date ops still return 0 without sweeping or reporting", async () => {
    reported.length = 0;
    const { mgr, scopedCalls } = newMgr();
    assert.strictEqual(await mgr.invalidateGridSmart("VEHICLE_DATE_UPDATE", {}, { asiakasId: 8 }), 0);
    assert.deepStrictEqual(scopedCalls, []);
    assert.deepStrictEqual(reported, []);
  });

  finish("\nAll grid-smart allowlist tests passed");
}
main();
