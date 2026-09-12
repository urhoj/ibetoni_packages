// Power-law fit of on-site hours vs pumped m3, least squares in hours on 4404
// invoiced Kalle Urho Oy (asiakasId 8) keikkas, 1–150 m3, R² 0.46 (2026-09-12).
// Encodes the dispatcher's rule of thumb; refit per tenant by overriding a/b.
const PUMPPU_KESTO_FIT = { a: 1.185, b: 0.405, floorMin: 60, stepMin: 15 };

function estimatePumppuKesto(m3, fit = PUMPPU_KESTO_FIT) {
  const x = Number(m3);
  if (!(x > 0)) return null;
  const minutes = 60 * fit.a * Math.pow(x, fit.b);
  return Math.max(fit.floorMin, Math.round(minutes / fit.stepMin) * fit.stepMin);
}

module.exports = { estimatePumppuKesto, PUMPPU_KESTO_FIT };
