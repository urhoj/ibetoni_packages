/**
 * keikkaTila ids for orders that are finished: no further planning edits, and
 * background recomputes (betoniMatka/pumppuMatka fan-out) must not touch them.
 * 8 Peruttu · 9/12/13 Toimitettu · 10 Poistettu · 100 Valmis
 * (documented in keikka-validation keikkaValidator.js:614).
 */
export const KEIKKA_DONE_TILA_IDS = Object.freeze([8, 9, 10, 12, 13, 100]);
