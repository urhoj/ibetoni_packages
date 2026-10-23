# @ibetoni/keikka-validation

Shared rule engine for Keikkavalidointi: the warnings in the grid reminders drawer (puminet4) and in `ib keikka validate` (puminet5api). CommonJS, consumed by both. Tests: `npm test` (vitest).

## Files

- `src/keikkaValidator.js`: `validateKeikka(keikka, options)` and the rules. Returns `{ isValid, issues, dismissedIssues, summary }`, where `issues` are the active warnings and `isValid` / `summary` count only those. Also `isMissingAsiakas(asiakasId)`: no customer, or the Betomik order-book placeholder Tuntematon asiakas (`UNKNOWN_ASIAKAS_ID` 1486), which the asiakas rules and the order step's customer row both treat as missing.
- `src/validationRuleDefinitions.js`: the rule registry (names, categories, default priority and enabled state). The settings UI and the reminders drawer read it, so a new rule appears in both automatically.
- `src/settings.js`: merges a tenant's saved rule settings with the defaults (key union, fail-open).
- `src/dismissal.js`: per-order dismissal of a warning (fb#2802).
- `src/weatherThresholds.js`: frost and heat limits.

## Per-order dismissal

A dismissal is a `dbo.stepLog` row of type `VALIDATION_DISMISSED_STEP_LOG_TYPE` (34) whose `data2` is `{ issueId, fingerprint }`. `validateKeikka` moves an issue to `dismissedIssues` when a row on the same keikka matches its `id` and `getIssueFingerprint(issue)`, which is `issue.dismissKey ?? issue.message`. A rule whose message does not name what it depends on must set `dismissKey` or reword its message. The weather rules use their id, so a dismissal survives forecast changes.

Orders dated before the (UTC) start of the day `DISMISS_WINDOW_DAYS` (30) days ago get no warnings at all (`isOutsideDismissWindow`); the nightly SQL cleanup purges their dismissals with the same day boundary.

Dismissal exports: `VALIDATION_DISMISSED_STEP_LOG_TYPE`, `DISMISS_WINDOW_DAYS`, `getIssueFingerprint`, `buildDismissalData`, `parseDismissal`, `isOutsideDismissWindow`. `src/index.js` lists every export (rule definitions, settings merge, weather thresholds, priority/category helpers).

Full design: `puminet5api/docs/tech/features/keikka-validation/KEIKKA_VALIDATION_SYSTEM.md`.
