/**
 * @ibetoni/constants/store
 *
 * Betoni.store v1 — RFQ inquiry status + listing condition reference data
 * + the asiakasSettingTypeId that enables a tenant for the public store.
 *
 * Source-of-truth for the *_BY_ID maps: dbo.storeInquiryStatusTypes and
 * dbo.storeConditionTypes (seeded in scripts/sql/migrations/053-betoni-store-schema.sql).
 * Keep this map and the seed rows in sync.
 */

const STORE_INQUIRY_STATUS_BY_ID = {
  1: "Uusi",
  2: "Yhteydessä",
  3: "Varattu",
  4: "Toimitettu",
  5: "Suljettu",
};

const STORE_INQUIRY_STATUS_BY_NAME = Object.fromEntries(
  Object.entries(STORE_INQUIRY_STATUS_BY_ID).map(([id, name]) => [name, Number(id)]),
);

const STORE_CONDITION_BY_ID = {
  1: "Uusi",
  2: "Käytetty",
  3: "Avattu pakkaus",
  4: "Naarmuinen",
};

const STORE_CONDITION_BY_NAME = Object.fromEntries(
  Object.entries(STORE_CONDITION_BY_ID).map(([id, name]) => [name, Number(id)]),
);

const STORE_ASIAKAS_SETTING_HAS_BETONI_STORE = 36;

module.exports = {
  STORE_INQUIRY_STATUS_BY_ID,
  STORE_INQUIRY_STATUS_BY_NAME,
  STORE_CONDITION_BY_ID,
  STORE_CONDITION_BY_NAME,
  STORE_ASIAKAS_SETTING_HAS_BETONI_STORE,
};
