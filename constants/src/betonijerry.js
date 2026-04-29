/**
 * BetoniJerry umbrella tenant constants.
 *
 * Every customer registered via betonijerry.fi has `ownerAsiakasId = 1349`.
 * This is how betonijerry-originated data is identified across the codebase
 * (single column, indexed, reuses every existing piece of code that filters
 * by `ownerAsiakasId`).
 *
 * Spec: docs/superpowers/specs/2026-04-29-betonijerry-backend-consolidation-design.md §3.3
 *
 * @type {Readonly<{ OWNER_ASIAKAS_ID: 1349, OWNER_PERSON_ID: 6233 }>}
 */
const BETONIJERRY = Object.freeze({
  OWNER_ASIAKAS_ID: 1349,
  OWNER_PERSON_ID: 6233,
});

export { BETONIJERRY };
