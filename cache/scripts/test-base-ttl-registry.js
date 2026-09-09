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
function test(name, fn) {
  try { fn(); console.log(`  ok  ${name}`); }
  catch (e) { failures++; console.error(`  FAIL ${name}\n       ${e.message}`); }
}

function main() {
  console.log("BASE_TTL invalidation-allowlist tests:");
  const { BASE_TTL } = new UniversalCacheManager({});

  // Entity names puminet5api passes to universalCacheMiddleware. Each one MUST
  // be registered, or it is cached-but-uninvalidatable. Add to this list when a
  // new cached entity is introduced.
  const CACHED_BY_API = [
    "asiakasPersonSetting", // asiakasPersonSettingRoutes.js — role grants (fb#1538)
    "asiakasPerson",
    "person",
    "asiakas",
    "vehicle",
    "sijainti",
    "keikka",
    "attachment",
  ];

  for (const entity of CACHED_BY_API) {
    test(`${entity} is registered (and therefore invalidatable)`, () => {
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

  test("default is still present (the fallback the unregistered relied on)", () => {
    assert.strictEqual(typeof BASE_TTL.default, "number");
  });

  console.log(failures === 0 ? "\nAll tests passed" : `\n${failures} test(s) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
