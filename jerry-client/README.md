# @ibetoni/jerry-client

Shared provider-side ("operator") API catalog + offer-lifecycle logic for the
Jerry tarjouspyyntö flow. Consumed by **puminet4** (`/tarjouspyynnot`) and
**betonijerry** (`/tarjouspyynnot` operator pages). Framework-free plain JS.

## Why transport injection

The package does NOT fetch. Each FE supplies a transport so it keeps its own
auth headers, error philosophy and telemetry:

- puminet4: wraps `apiQuery`/`apiMutate` (+ `API_CONTEXTS.TARJOUSPYYNNOT`)
- betonijerry: wraps `fetch` + `jsonOrThrow` (throws with `.status`; callers
  handle 401 → logout)

```js
import { createTarjouspyyntoApi } from "@ibetoni/jerry-client";
const api = createTarjouspyyntoApi({ query, mutate });
await api.listProviderRequests("avoimet"); // → { counts, requests }
```

`query(path, { fallback })` is a GET; it may throw OR resolve `fallback` on
error — the FE decides. `mutate(path, { method, body })` resolves
`{ success, error?, data }`.

## Lifecycle helpers

`PROVIDER_TABS` / `normalizeCounts` (tab strip + counts), `deriveOfferLifecycle`
(won/ended + Finnish reason labels for the detail view), `isOfferDraft` /
`isOfferLocked` (component-local status flags), `eurosToCents` / `centsToEuros`
/ `isSubmittablePrice` (mirrors backend 1..99 999 900 bound), `defaultValidUntil`
(+7 days, local calendar), `offerStateLabel` (provider pill labels).

Backend source of truth: `puminet5api/routes/pumppuRequestRoutes.js`
(provider-list / provider-detail / POST offers). Spec:
`docs/superpowers/specs/2026-06-04-betonijerry-operator-tarjouspyynnot-design.md`.

## Tests

`npm run test --workspace=@ibetoni/jerry-client` (vitest, hoisted from the
workspace root).
