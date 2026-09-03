/**
 * authzKeys — the ONE definition of the `authz:` lookup-memo key shape, shared by the
 * code that WRITES those keys and the code that SWEEPS them, so the two cannot drift.
 *
 * WHY (fb#1261): `puminet5api/modules/cache/authzLookupCache.js` built the keys from
 * three template literals and `invalidateCrossEntity` built the sweep glob from a
 * fourth, in a different repo. Nothing tied them together, and both suites asserted
 * hand-typed strings — so renaming a segment on either side left BOTH green while the
 * sweep silently became a no-op. That fails OPEN: these keys gate authorization (the
 * pre-cache read gates in `middleware/require*ReadAccess.js`), not freshness, so a
 * missed sweep leaves an entity whose owner was just reassigned readable by its old
 * tenant for the full 600 s backstop TTL.
 *
 * CONTRACT  `authzSweepGlob(family, id)` MUST match every `authzKey(*, family, id, *)`.
 *           Pinned by `scripts/test-authz-invalidation.js`, which glob-matches keys the
 *           builder produced instead of comparing hand-typed strings.
 */

/** Namespace every authz lookup-memo key lives under. */
const AUTHZ_PREFIX = "authz";

/**
 * Build one lookup-memo key: `authz:<kind>[.<qualifier>]:<family>:<id>`.
 *
 * THE INVARIANT: the target id is ALWAYS the final segment, and any per-key
 * qualifier (the module name) rides the `kind` segment as `module.ecofleet`
 * rather than trailing the id. That is what lets `authzSweepGlob` be an EXACT
 * match instead of a prefix one — see there for why that matters.
 *
 * @param {string} kind - the fact being memoised: `owner` | `row` | `module`
 * @param {string} family - op family the sweep keys on (asiakas|tyomaa|vehicle|sijainti|person)
 * @param {number|string} id - the TARGET entity id (never the writer's tenant)
 * @param {string} [qualifier] - optional discriminator (the module name, for kind `module`)
 * @returns {string}
 */
const authzKey = (kind, family, id, qualifier) =>
  `${AUTHZ_PREFIX}:${kind}${qualifier === undefined ? "" : `.${qualifier}`}:${family}:${Number(id)}`;

/**
 * Build the sweep glob for one family + target entity.
 *
 * Exact in the id segment, deliberately. A trailing `*` here would be a PREFIX
 * match, so sweeping entity 12 would also clear 123, 124, 1200… — safe (over-
 * invalidation never under-invalidates) but wasteful, and it silently widened
 * every sweep on a low-numbered tenant. The id-last invariant in `authzKey`
 * removes the need for it: nothing trails the id, so nothing has to be globbed
 * past. Each pattern costs a full Redis SCAN, so one exact pattern also beats
 * emitting an extra one to reach suffixed keys.
 *
 * @param {string} family
 * @param {number|string} [entityId] - absent/falsy → whole-family wildcard, never a skip
 * @returns {string}
 */
const authzSweepGlob = (family, entityId) =>
  `${AUTHZ_PREFIX}:*:${family}:${entityId || "*"}`;

module.exports = { AUTHZ_PREFIX, authzKey, authzSweepGlob };
