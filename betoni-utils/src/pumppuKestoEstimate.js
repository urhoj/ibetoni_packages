/**
 * Default pumppuKesto (whole on-site time, minutes) for a pour of `m3`.
 *
 * Power-law fit of on-site hours vs pumped m3, least squares in hours on 4404
 * invoiced Kalle Urho Oy (asiakasId 8) keikkas, 1–150 m3, R² 0.46 (2026-09-12).
 * The medians sit on round hours, so this encodes the dispatcher's rule of
 * thumb rather than a measured actual. Used as a suggestion / fallback only —
 * never over a value a dispatcher set. Refit per tenant by passing another `fit`.
 *
 * @param {number|string} m3 total ordered concrete
 * @param {{a:number,b:number,floorMin:number,stepMin:number}} [fit]
 * @returns {number|null} minutes snapped to `stepMin`, at least `floorMin`; null when m3 is unknown or not positive
 */
const PUMPPU_KESTO_FIT = { a: 1.185, b: 0.405, floorMin: 60, stepMin: 15 };

function estimatePumppuKesto(m3, fit = PUMPPU_KESTO_FIT) {
  const x = Number(m3);
  if (!Number.isFinite(x) || x <= 0) return null;
  const minutes = 60 * fit.a * Math.pow(x, fit.b);
  return Math.max(fit.floorMin, Math.round(minutes / fit.stepMin) * fit.stepMin);
}

module.exports = { estimatePumppuKesto, PUMPPU_KESTO_FIT };
