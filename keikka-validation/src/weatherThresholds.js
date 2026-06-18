export const SEVERE_COLD_THRESHOLD = -15;
export const SEVERE_HOT_THRESHOLD = 28;

export function isSevereCold(temp) {
  if (temp === null || temp === undefined) return false;
  return temp < SEVERE_COLD_THRESHOLD;
}

export function isSevereHot(temp) {
  if (temp === null || temp === undefined) return false;
  return temp >= SEVERE_HOT_THRESHOLD;
}
