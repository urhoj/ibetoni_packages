const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

// Regression: the four compliance-date families wiped the ENTIRE grid cache
// (ib feedback #761).
//
// VEHICLE_DATE_* / PERSON_DATE_* / TYOMAA_DATE_* / ASIAKAS_DATE_* each called
// invalidateGridSmart(). That method has no *_DATE_* case, so every one of them
// fell through to its `default:` branch -> invalidate(op, "grid", {asiakasId})
// -> pattern `grid:v7tenant:${dateKey || "*"}:*`. The route params extractors
// (puminet5api/routes/*DateRoutes.js) carry NO date field at all, so dateKey was
// always null and the pattern was always `grid:v7tenant:*:*` — every tenant, at
// every date, on a 3600 s TTL, for the hottest read path in the product.
//
// It was also unnecessary: grid_keikkaList2_v7tenant_arrays references no
// *Date or *RequiredDateType table, so compliance dates never render on the
// grid. SIJAINTI_DATE_* (cb2519f43) already omitted the call for this reason.
//
// These tests pin the SHAPE of each family, not just the absence of "grid":
// the entity + its *RequiredDateType + the complianceDashboard sweep must
// survive, and PERSON/TYOMAA must keep the SEPARATE keikka invalidation that
// the order views genuinely depend on.

let failures = 0;
function test(name, fn) {
  return (async () => {
    try { await fn(); console.log(`  ok  ${name}`); }
    catch (e) { failures++; console.error(`  FAIL ${name}\n       ${e.message}`); }
  })();
}

// Manager with the invalidation sinks stubbed. invalidateGridSmart is NOT
// stubbed separately — it is left to run for real, so a reintroduced call
// reaches its actual `default:` branch and lands as a scoped {entityType:
// "grid"} call. That is the branch which built `grid:v7tenant:*:*` in
// production, so the assertions catch the real defect and not a proxy for it.
function newMgr() {
  const mgr = new UniversalCacheManager();
  const patterns = [];
  const scopedCalls = [];
  mgr.invalidateByPattern = async (p) => { patterns.push(p); return 1; };
  mgr.invalidate = async (op, entityType) => { scopedCalls.push({ op, entityType }); return 1; };
  return { mgr, patterns, scopedCalls };
}

const VERBS = ["CREATE", "UPDATE", "DELETE", "DISMISS", "UNDISMISS"];

// Mirrors the real params extractors in puminet5api/routes/*DateRoutes.js —
// note that NONE of them carries a date, which is why the grid pattern could
// never narrow to a single day.
const FAMILIES = [
  {
    prefix: "VEHICLE_DATE",
    params: { asiakasId: 8, entityType: "vehicleDate", vehicleId: 53, vehicleDateTypeId: 4 },
    scoped: ["vehicle", "vehicleDate", "vehicleRequiredDateType"],
    sweeps: ["complianceDashboard:*"],
  },
  {
    prefix: "PERSON_DATE",
    params: { asiakasId: 8, entityType: "personDate", personId: 10, personDateTypeId: 4 },
    // keikka is deliberate: order views show person compliance status.
    scoped: ["keikka", "person", "personDate", "personRequiredDateType"],
    sweeps: ["complianceDashboard:*"],
  },
  {
    prefix: "TYOMAA_DATE",
    params: { asiakasId: 8, entityType: "tyomaaDate", tyomaaId: 77, tyomaaDateTypeId: 4 },
    // keikka is deliberate: order views show tyomaa compliance status.
    scoped: ["keikka", "tyomaa", "tyomaaDate", "tyomaaRequiredDateType"],
    sweeps: ["complianceDashboard:*"],
  },
  {
    prefix: "ASIAKAS_DATE",
    params: { ownerAsiakasId: 8, asiakasId: 62, entityType: "asiakasDate", asiakasDateTypeId: 4 },
    scoped: ["asiakas", "asiakasDate", "asiakasRequiredDateType"],
    sweeps: ["complianceDashboard:*"],
  },
];

async function main() {
  console.log("compliance-date cross-entity invalidation tests:");

  for (const fam of FAMILIES) {
    for (const verb of VERBS) {
      const op = `${fam.prefix}_${verb}`;

      // THE fb#761 REGRESSION. A single vehicle-date edit must not evict the
      // cached grid of every other tenant. Asserted on the raw pattern because
      // that is what actually reached Redis in production.
      await test(`${op} does not wipe the cross-tenant grid cache`, async () => {
        const { mgr, patterns, scopedCalls } = newMgr();
        await mgr.invalidateCrossEntity(op, fam.params);
        const gridSweeps = patterns.filter((p) => p.startsWith("grid:"));
        assert.deepStrictEqual(gridSweeps, [],
          `must not sweep any grid key, got ${JSON.stringify(gridSweeps)}`);
        assert.ok(!scopedCalls.some((c) => c.entityType === "grid"),
          `must not invalidate the grid entity, got ${JSON.stringify(scopedCalls)}`);
      });

      // Exact sets, not `includes`: an EXTRA member is the regression this
      // file exists to catch, and `includes` would miss every one of them.
      await test(`${op} sweeps exactly ${fam.scoped.join(" + ")}`, async () => {
        const { mgr, patterns, scopedCalls } = newMgr();
        await mgr.invalidateCrossEntity(op, fam.params);
        assert.deepStrictEqual(scopedCalls.map((c) => c.entityType).sort(), [...fam.scoped].sort(),
          `unexpected scoped invalidations: ${JSON.stringify(scopedCalls)}`);
        assert.deepStrictEqual(patterns.sort(), [...fam.sweeps].sort(),
          `unexpected pattern sweeps: ${JSON.stringify(patterns)}`);
      });
    }
  }

  // The class-wide guard, so a future "make it consistent with its siblings"
  // edit that re-adds the call cannot silently restore the global wipe. The
  // *_REQUIRED_DATE_TYPE_* ops (routes/*RequiredDateTypeRoutes.js) never render
  // on the grid either, so the guard covers them too (fb#1207).
  const INERT = [
    ...FAMILIES.map((fam) => [`${fam.prefix}_UPDATE`, fam.params]),
    ...["PERSON", "VEHICLE", "SIJAINTI"].map((e) => [`${e}_REQUIRED_DATE_TYPE_CREATE`, { asiakasId: 8 }]),
  ];
  for (const [op, params] of INERT) {
    await test(`invalidateGridSmart is inert for ${op}`, async () => {
      const { mgr, patterns, scopedCalls } = newMgr();
      const count = await mgr.invalidateGridSmart(op, {}, params);
      assert.strictEqual(count, 0, `expected 0 invalidated, got ${count}`);
      assert.deepStrictEqual(patterns, [], `expected no sweeps, got ${JSON.stringify(patterns)}`);
      assert.deepStrictEqual(scopedCalls, [], `expected no scoped calls, got ${JSON.stringify(scopedCalls)}`);
    });
  }

  // Guard the guard: the /_DATE_/ test must not swallow the ops that legitimately
  // DO invalidate the grid. KEIKKA_UPDATE with a date narrows to that one day.
  await test("invalidateGridSmart still narrows KEIKKA_UPDATE to its own date", async () => {
    const { mgr, scopedCalls } = newMgr();
    await mgr.invalidateGridSmart("KEIKKA_UPDATE", { pumppuAika: "2026-08-30T09:00:00.000Z" },
      { asiakasId: 8 });
    assert.ok(scopedCalls.some((c) => c.entityType === "grid"),
      `KEIKKA_UPDATE must still invalidate the grid, got ${JSON.stringify(scopedCalls)}`);
  });

  // fb#1031: the guard is anchored, so a hypothetical KEIKKA_DATE_* op is not swallowed.
  await test("the _DATE_ guard is anchored — a hypothetical KEIKKA_DATE_UPDATE still reaches the grid path", async () => {
    const { mgr, scopedCalls } = newMgr();
    await mgr.invalidateGridSmart("KEIKKA_DATE_UPDATE", { pumppuAika: "2026-08-30T09:00:00.000Z" },
      { asiakasId: 8 });
    assert.ok(scopedCalls.some((c) => c.entityType === "grid"),
      `KEIKKA_DATE_UPDATE must not be swallowed by the compliance-date guard, got ${JSON.stringify(scopedCalls)}`);
  });

  if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
  console.log(`\nAll tests passed`);
}
main();
