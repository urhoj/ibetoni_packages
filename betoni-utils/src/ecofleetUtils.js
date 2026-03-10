/**
 * getText - Extract _text value from an xml-js compact-mode node property.
 * Returns null when the node is absent or has no text content.
 */
const getText = (obj) => (obj?._text ?? null);

/**
 * HAVERSINE_DISTANCE_M - SQL fragment computing great-circle distance in metres.
 * Requires query parameters: @lat (Decimal 10,8), @lng (Decimal 11,8)
 * Requires table columns:    lat, lng
 * Clamps the ACOS argument to [-1, 1] to guard against floating-point overflow.
 */
const HAVERSINE_DISTANCE_M = `6371000 * ACOS(CASE
  WHEN COS(RADIANS(@lat)) * COS(RADIANS(lat)) * COS(RADIANS(lng) - RADIANS(@lng)) + SIN(RADIANS(@lat)) * SIN(RADIANS(lat)) > 1 THEN 1
  WHEN COS(RADIANS(@lat)) * COS(RADIANS(lat)) * COS(RADIANS(lng) - RADIANS(@lng)) + SIN(RADIANS(@lat)) * SIN(RADIANS(lat)) < -1 THEN -1
  ELSE COS(RADIANS(@lat)) * COS(RADIANS(lat)) * COS(RADIANS(lng) - RADIANS(@lng)) + SIN(RADIANS(@lat)) * SIN(RADIANS(lat))
END)`;

module.exports = { getText, HAVERSINE_DISTANCE_M };
