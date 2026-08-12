/**
 * BetoniJerry umbrella tenant constants (CommonJS).
 * Source of truth: ./betonijerry.js (ESM). Mirror manually if either changes.
 */
const BETONIJERRY = Object.freeze({
  OWNER_ASIAKAS_ID: 1349,
  OWNER_PERSON_ID: 6233,
});

/**
 * The 18 cities that have a betonijerry.fi SEO landing page, with the probe
 * coordinate used to decide which providers cover them.
 *
 * This is the JOIN KEY between puminet5api (which computes coverage from sijainti
 * depots) and betonijerry's src/cityPages/cities.js (which owns the Finnish copy).
 * Slugs MUST stay in sync with that file. Adding a city here without adding it there
 * yields coverage for a page that does not exist (harmless); the reverse yields a page
 * that can never list providers (a silent content bug).
 *
 * Coordinates are city-centre probes, matching `ib jerry coverage`.
 */
const BETONIJERRY_CITIES = Object.freeze([
  Object.freeze({ slug: "helsinki", name: "Helsinki", lat: 60.1699, lng: 24.9384 }),
  Object.freeze({ slug: "espoo", name: "Espoo", lat: 60.2055, lng: 24.6559 }),
  Object.freeze({ slug: "vantaa", name: "Vantaa", lat: 60.2941, lng: 25.0400 }),
  Object.freeze({ slug: "tampere", name: "Tampere", lat: 61.4978, lng: 23.7610 }),
  Object.freeze({ slug: "jyvaskyla", name: "Jyväskylä", lat: 62.2426, lng: 25.7473 }),
  Object.freeze({ slug: "lahti", name: "Lahti", lat: 60.9827, lng: 25.6612 }),
  Object.freeze({ slug: "hameenlinna", name: "Hämeenlinna", lat: 60.9959, lng: 24.4643 }),
  Object.freeze({ slug: "mikkeli", name: "Mikkeli", lat: 61.6886, lng: 27.2723 }),
  Object.freeze({ slug: "kouvola", name: "Kouvola", lat: 60.8681, lng: 26.7042 }),
  Object.freeze({ slug: "kotka", name: "Kotka", lat: 60.4664, lng: 26.9459 }),
  Object.freeze({ slug: "porvoo", name: "Porvoo", lat: 60.3932, lng: 25.6639 }),
  Object.freeze({ slug: "lappeenranta", name: "Lappeenranta", lat: 61.0587, lng: 28.1887 }),
  Object.freeze({ slug: "oulu", name: "Oulu", lat: 65.0121, lng: 25.4651 }),
  Object.freeze({ slug: "turku", name: "Turku", lat: 60.4518, lng: 22.2666 }),
  Object.freeze({ slug: "kuopio", name: "Kuopio", lat: 62.8924, lng: 27.6770 }),
  Object.freeze({ slug: "pori", name: "Pori", lat: 61.4851, lng: 21.7973 }),
  Object.freeze({ slug: "joensuu", name: "Joensuu", lat: 62.6010, lng: 29.7636 }),
  Object.freeze({ slug: "rovaniemi", name: "Rovaniemi", lat: 66.5039, lng: 25.7294 }),
]);

module.exports = { BETONIJERRY, BETONIJERRY_CITIES };
