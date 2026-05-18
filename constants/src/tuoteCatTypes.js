// Single source of truth for tuoteCatTypes lookups.
// The DB table dbo.tuoteCatTypes remains canonical for SQL JOINs, but FE/BE
// label lookups import from here to avoid hot-path queries.

export const TUOTE_CAT_TYPE_BY_ID = Object.freeze({
  1: 'Tuote',
  2: 'Betoni',
  3: 'Ajoneuvo',
  4: 'Betonilisä',
  5: 'Betonitarvike',
  6: 'Käsityökalu (sähkö)',
  7: 'Paineilmatyökalu',
  8: 'Renkaat',
  9: 'Käsityökalu (manuaalinen)',
});

export const TUOTE_CAT_TYPE_BY_NAME = Object.freeze(
  Object.fromEntries(
    Object.entries(TUOTE_CAT_TYPE_BY_ID).map(([id, name]) => [name, Number(id)])
  )
);

export const KNOWN_TUOTE_CAT_TYPE_IDS = Object.freeze(
  Object.keys(TUOTE_CAT_TYPE_BY_ID).map(Number)
);
