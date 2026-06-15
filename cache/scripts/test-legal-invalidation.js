const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

// Regression: legal-document writes invalidate nothing. Legal docs are cached
// under GLOBAL keys (legalDocument:current:*, :versions:*, :types, :get:*) with
// no asiakasId segment, but invalidateCrossEntity had no LEGAL_DOCUMENT_* case
// so it fell to default -> `legalDocument:*:<asiakasId>*`, which matches none of
// them. Reads then stayed stale until the 24h TTL (root cause of ib feedback
// #38 part 1). The fix sweeps the whole legalDocument namespace.

let failures = 0;
function test(name, fn) {
  return (async () => {
    try { await fn(); console.log(`  ok  ${name}`); }
    catch (e) { failures++; console.error(`  FAIL ${name}\n       ${e.message}`); }
  })();
}

// Manager with the two invalidation sinks stubbed: invalidateByPattern records
// the raw patterns swept; invalidate records the scoped (default-branch) calls
// we want to prove are NOT used for legal writes.
function newMgr() {
  const mgr = new UniversalCacheManager();
  const patterns = [];
  const scopedCalls = [];
  mgr.invalidateByPattern = async (p) => { patterns.push(p); return 1; };
  mgr.invalidate = async (op, entityType) => { scopedCalls.push({ op, entityType }); return 1; };
  return { mgr, patterns, scopedCalls };
}

async function main() {
  console.log("legal-document cross-entity invalidation tests:");

  for (const op of ["LEGAL_DOCUMENT_UPDATE", "LEGAL_DOCUMENT_CREATE", "LEGAL_DOCUMENT_DELETE"]) {
    await test(`${op} sweeps global legalDocument:* (not the scoped default)`, async () => {
      const { mgr, patterns, scopedCalls } = newMgr();
      // params as the middleware builds them: caller ownerAsiakasId + entityType.
      const count = await mgr.invalidateCrossEntity(op, { asiakasId: 8, entityType: "legalDocument" });
      assert.ok(patterns.includes("legalDocument:*"),
        `expected sweep of "legalDocument:*", got ${JSON.stringify(patterns)}`);
      assert.ok(!patterns.some((p) => p.includes(":8")),
        `must not build an asiakasId-scoped pattern, got ${JSON.stringify(patterns)}`);
      assert.strictEqual(scopedCalls.length, 0,
        `must not fall through to the scoped default invalidate(), got ${JSON.stringify(scopedCalls)}`);
      assert.ok(count >= 1, "should report invalidated keys");
    });
  }

  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  console.log(`\nAll tests passed`);
}
main();
