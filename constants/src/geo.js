/**
 * Geo / proximity constants shared by the Address Information Dashboard
 * (puminet4 pages/map/osoitetiedot + puminet5api modules/address).
 *
 * DASHBOARD_CLOSE_RADIUS_M — "CLOSE" bucketing + default search radius for
 * the dashboard's sijainti/vehicles/cameras panels. Tunable; FE and BE must
 * share one value or bucketing desynchronizes from the query radius.
 */
export const DASHBOARD_CLOSE_RADIUS_M = 2000;
