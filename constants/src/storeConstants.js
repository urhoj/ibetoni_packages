/**
 * @ibetoni/constants/store (ESM mirror of storeConstants.cjs)
 */

export const STORE_INQUIRY_STATUS_BY_ID = {
  1: "Uusi",
  2: "Yhteydessä",
  3: "Varattu",
  4: "Toimitettu",
  5: "Suljettu",
};

export const STORE_INQUIRY_STATUS_BY_NAME = Object.fromEntries(
  Object.entries(STORE_INQUIRY_STATUS_BY_ID).map(([id, name]) => [name, Number(id)]),
);

export const STORE_CONDITION_BY_ID = {
  1: "Uusi",
  2: "Käytetty",
  3: "Avattu pakkaus",
  4: "Naarmuinen",
};

export const STORE_CONDITION_BY_NAME = Object.fromEntries(
  Object.entries(STORE_CONDITION_BY_ID).map(([id, name]) => [name, Number(id)]),
);

export const STORE_ASIAKAS_SETTING_HAS_BETONI_STORE = 36;
