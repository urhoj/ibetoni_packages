const SEVERE_COLD_THRESHOLD = -15;
const SEVERE_HOT_THRESHOLD = 28;

function isSevereCold(temp) {
  if (temp === null || temp === undefined) return false;
  return temp < SEVERE_COLD_THRESHOLD;
}

function isSevereHot(temp) {
  if (temp === null || temp === undefined) return false;
  return temp >= SEVERE_HOT_THRESHOLD;
}

module.exports = { SEVERE_COLD_THRESHOLD, SEVERE_HOT_THRESHOLD, isSevereCold, isSevereHot };
