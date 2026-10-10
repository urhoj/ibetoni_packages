/**
 * Geo / proximity constants shared by the Address Information Dashboard
 * (puminet4 pages/map/osoitetiedot + puminet5api modules/address).
 *
 * DASHBOARD_CLOSE_RADIUS_M — "CLOSE" bucketing + default search radius for
 * the dashboard's sijainti/vehicles/cameras panels. Tunable; FE and BE must
 * share one value or bucketing desynchronizes from the query radius.
 */
export const DASHBOARD_CLOSE_RADIUS_M = 2000;

/**
 * /tilanne GPS staleness, in minutes (fb#1175). The backend
 * (puminet5api modules/dashboard/dayBoardDerive.js) buckets a vehicle as
 * `ei_signaalia` and the frontend (puminet4 pages/tilanne) ghosts it on the
 * map; both must agree or a truck is a solid dot inside an "Ei signaalia"
 * group. Engine off gets the longer window: a parked tracker reports only
 * every 30-90 min and its last fix is still where the truck is (fb#1067).
 */
export const GPS_STALE_MIN = 30;
export const GPS_STALE_ENGINE_OFF_MIN = 120;
