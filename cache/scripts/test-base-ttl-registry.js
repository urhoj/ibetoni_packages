/**
 * fb#1538 — BASE_TTL is not just a TTL table, it is the INVALIDATION ALLOWLIST.
 *
 * puminet5api's routes/cli/cacheCliRoutes.js builds VALID_ENTITIES from
 * `Object.keys(cacheManager.BASE_TTL)` — deliberately, "so the allowlist never
 * drifts". The consequence is easy to miss when adding a cached route: an entity
 * name passed to universalCacheMiddleware but never registered here still CACHES
 * fine (it falls through to `default`), so nothing looks wrong — but no operator
 * can ever invalidate it. `ib dev cache invalidate <entity>` answers "Unknown
 * entityType", and the only way to clear a stale family becomes a raw glob with
 * --force-prod against production.
 *
 * That is what happened to asiakasPersonSetting: two GET routes cached under it
 * for as long as they have existed, and it was never invalidatable.
 *
 * This test cannot live in puminet5api's cache.test.js, which mocks BASE_TTL
 * with a 5-key double — an assertion there would test the double and could only
 * be made green by editing the double. Here BASE_TTL is the real object.
 */
const assert = require("assert");
const UniversalCacheManager = require("../src/UniversalCacheManager");

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ok  ${name}`); }
  catch (e) { failures++; console.error(`  FAIL ${name}\n       ${e.message}`); }
}

async function main() {
  console.log("BASE_TTL invalidation-allowlist tests:");
  const { BASE_TTL } = new UniversalCacheManager({});

  // A CURATED SUBSET of the entity names puminet5api passes to
  // universalCacheMiddleware — not a mirror of it. This package cannot import
  // puminet5api's routes, so the EXHAUSTIVE check lives on the consumer side:
  // puminet5api `npm run audit:cache-entities` greps every middleware call site
  // against the real BASE_TTL (fb#1542). This list pins the ones that were once
  // cached-but-uninvalidatable, so a rename here goes red before it ships.
  const CACHED_BY_API = [
    "asiakasPersonSetting", // asiakasPersonSettingRoutes.js — role grants (fb#1538)
    "person",
    "asiakas",
    "vehicle",
    "sijainti",
    "keikka",
    "attachment",
    // fb#1542 — the four that fell through to `default` and answered
    // "Unknown entityType" to `ib dev cache invalidate`.
    "holidays",         // holidayRoutes.js — PLURAL; the key was registered singular
    "ilmoitustaulu",    // ilmoitustauluRoutes.js
    "subscription",     // subscription.js
    "subscriptionItems", // subscriptionItems.js
  ];

  for (const entity of CACHED_BY_API) {
    await test(`${entity} is registered (and therefore invalidatable)`, () => {
      assert.ok(
        Object.prototype.hasOwnProperty.call(BASE_TTL, entity),
        `BASE_TTL has no '${entity}' key — it will cache under the 'default' TTL but ` +
          "VALID_ENTITIES in cacheCliRoutes.js is derived from these keys, so " +
          `\`ib dev cache invalidate ${entity}\` will answer "Unknown entityType"`
      );
      assert.strictEqual(
        typeof BASE_TTL[entity], "number",
        `BASE_TTL.${entity} must be a number of seconds`
      );
    });
  }

  // fb#1542: HOLIDAY_SYNC invalidated `holiday` (singular) while every route
  // cached under `holidays`, so the weekly sync swept a name nothing wrote and
  // the 24h TTL was the only thing clearing the holiday cache.
  await test("every entity invalidateCrossEntity names is a BASE_TTL key", async () => {
    const seen = [];
    const mgr = new UniversalCacheManager({});
    mgr.invalidate = async (_op, entity) => { seen.push(entity); return 0; };
    mgr.invalidateByPattern = async () => 0;
    await mgr.invalidateCrossEntity("HOLIDAY_SYNC", {});
    assert.ok(seen.includes("holidays"), `HOLIDAY_SYNC invalidated ${JSON.stringify(seen)} — not 'holidays'`);
    for (const e of seen) {
      assert.ok(Object.prototype.hasOwnProperty.call(BASE_TTL, e), `HOLIDAY_SYNC targets unregistered entity '${e}'`);
    }
  });

  await test("default is still present (the fallback the unregistered relied on)", () => {
    assert.strictEqual(typeof BASE_TTL.default, "number");
  });

  console.log(failures === 0 ? "\nAll tests passed" : `\n${failures} test(s) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
