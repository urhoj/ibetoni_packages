// PumiNet Oy — the company operating betoni.online (system-admin Fennoa surfaces).
const PUMINET = Object.freeze({
  OWNER_ASIAKAS_ID: 26,
  // Recipient of the maintainer heads-up mails: the new-CLI-feedback digest
  // (modules/feedback/feedbackEmail.js) and new support escalations
  // (modules/messaging/supportEmail.js). Both declared their own `const
  // NOTIFY_PERSON_ID = 10` — same person, two sources of truth, and the two
  // flows are already documented as mirrors of each other.
  MAINTAINER_PERSON_ID: 10,
});

export { PUMINET };
