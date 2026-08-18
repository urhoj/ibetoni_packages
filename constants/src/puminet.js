// PumiNet Oy — the company operating betoni.online (system-admin Fennoa surfaces).
const PUMINET = Object.freeze({
  OWNER_ASIAKAS_ID: 26,
  // Recipient of the maintainer heads-up mail for new support escalations
  // (modules/messaging/supportEmail.js). It had a twin in the new-CLI-feedback
  // digest (modules/feedback/feedbackEmail.js) — both declared their own `const
  // NOTIFY_PERSON_ID = 10`, same person, two sources of truth — until 2026-08-18,
  // when feedback moved to an opt-in developer push and that mail was deleted.
  MAINTAINER_PERSON_ID: 10,
  // The same human as MAINTAINER_PERSON_ID, as a literal address, because three
  // fire-and-forget alert paths need a recipient without an await:
  // asiakasCombinator's large-merge alert (which had no env escape hatch at all
  // and carried a TODO asking for exactly this constant), auth/registrationMonitor
  // and betonijerry/previewAccessAlert. The latter two keep their
  // `process.env.ADMIN_EMAIL ||` override — only the duplicated fallback literal
  // is centralised. Deliberately NOT getPersonEmail(MAINTAINER_PERSON_ID): that
  // trades a free literal for a DB round-trip inside an alert path whose whole
  // point is not to fail.
  MAINTAINER_EMAIL: "juha.urho@gmail.com",
});

export { PUMINET };
