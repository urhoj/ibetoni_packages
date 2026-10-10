# @ibetoni/prh-utils

Shared PRH (Finnish business registry / YTJ) status classification.

Single source of truth for mapping PRH v3 open-data company records →
`{ ok, dead, caution, unknown }`. Used by both:

- the nightly dead-customer sweep (`puminet7-functions-app` → `prhSweep`), and
- the on-demand "PRH-tarkistus" button check (`puminet5api` → asiakas `prh-check` route).

Keeping the logic here guarantees the two paths never **classify** differently. They do not
**fetch** the same way, though: the sweep uses this package's `fetchPrhCompany`, which calls
`avoindata.prh.fi` directly with no fallback, while `prh-check` fetches through puminet5api's
`prhService.searchByBusinessId`, which falls back to the EU VAT register (VIES) for sole traders.
A sole trader still classifies as `unknown` on both paths: the sweep gets `null`, and a VIES record
has empty `companySituations` / `registeredEntries`. Details: `puminet5api/modules/vies/README.md`
→ "Not used by the nightly dead-customer sweep".

## API

```js
const { PRH_STATUS, classifyPrhStatus, fetchPrhCompany } = require("@ibetoni/prh-utils");
```

- `classifyPrhStatus(company)` → `{ status, situation }` where `status` is one of
  `PRH_STATUS.{OK,DEAD,CAUTION,UNKNOWN}`. `company` needs `companySituations[]` and
  `registeredEntries[]` (as returned by the PRH v3 `/companies` endpoint). Top-level
  `status` is `"2"` for healthy AND dead companies — never used for classification.
- `fetchPrhCompany(businessId, { fetchImpl })` → minimal `{ businessId, status,
  companySituations, registeredEntries }` or `null` on 404. Throws on network errors
  (caller should treat as `unknown`).
- `PRH_STATUS` — frozen enum of status strings.

`no-ytunnus` is a caller-side state (empty Y-tunnus) and is not produced by
`classifyPrhStatus`.

## Test

```
npm test --workspace=@ibetoni/prh-utils
```
