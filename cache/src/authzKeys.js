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
 * Build one lookup-memo key. `family` sits in the third segment and `id` in the
 * fourth because that is where `authzSweepGlob` matches them — the two are one
 * definition on purpose.
 *
 * @param {string} kind - the fact being memoised: `owner` | `row` | `module`
 * @param {string} family - op family the sweep keys on (asiakas|tyomaa|vehicle|sijainti|person)
 * @param {number|string} id - the TARGET entity id (never the writer's tenant)
 * @param {string} [suffix] - optional trailing segment (the module name, for kind `module`)
 * @returns {string}
 */
const authzKey = (kind, family, id, suffix) =>
  `${AUTHZ_PREFIX}:${kind}:${family}:${Number(id)}${suffix === undefined ? "" : `:${suffix}`}`;

/**
 * Build the sweep glob for one family + target entity. The trailing `*` is what
 * reaches `authzKey`'s optional suffix (`authz:module:asiakas:8:ecofleet`); it also
 * over-matches id prefixes (sweeping id 12 clears 123 too), which is deliberate —
 * over-invalidation fails CLOSED, a missed sweep does not.
 *
 * @param {string} family
 * @param {number|string} [entityId] - absent/falsy → whole-family wildcard, never a skip
 * @returns {string}
 */
const authzSweepGlob = (family, entityId) =>
  `${AUTHZ_PREFIX}:*:${family}:${entityId ? `${entityId}*` : "*"}`;

module.exports = { AUTHZ_PREFIX, authzKey, authzSweepGlob };
