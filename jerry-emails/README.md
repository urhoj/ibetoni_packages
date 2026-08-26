# @ibetoni/jerry-emails

BetoniJerry transactional email **content**: the fi/en template builders and the
copy table behind them. Pure functions — no transport, no database, no I/O.

## Why it is a package

The builders were in `puminet5api/modules/betonijerry/`, which is fine while
puminet5api is the only thing that sends BetoniJerry mail. It is not going to
stay that way: `puminet7-functions-app` runs the nightly Betonijerry GC and will
eventually need to send customer-facing mail from the same brand with the same
copy (fb#506). The alternative was a second Finnish copy of the templates in
another repo — see the comment in that repo's `alertMailService.js`, which
reasons about exactly this and accepts a local constant only because the value
in question is a single string, not a whole template set.

## Usage

```js
const { providerNewRequest, wrapJerryLayout } = require("@ibetoni/jerry-emails");

const { subject, html, text } = providerNewRequest({
  kayttokohde: "Laatta", totalM3: 12, maskedAddress: "Sarkatie, 01720 Vantaa",
  operatorUrl: "https://betonijerry.fi/tarjouspyynnot/esikatselu?token=...",
}, "fi");
```

Every builder takes a trailing `lang` (`"fi" | "en"`, default `"fi"`) and returns
`{ subject, html, text }`.

## Two rules that are easy to break

**Builders return a FRAGMENT, never a document.** The `<html>` wrapper and brand
header are added once, centrally, by `wrapJerryLayout` in the
sender (`puminet5api/modules/betonijerry/jerryEmail.js`). A builder that wraps
itself gets wrapped again on the way out, and every real outbound email arrives
double-wrapped. The test suite asserts `not.toContain("<html")` on every builder
for this reason.

**Language is resolved from `COPY`, not from a whitelist elsewhere.** A template
can only render a language it has copy for, so `COPY` is the authority: adding a
language means adding it to `copy.js`, and nothing else needs to know. Anything
`COPY` does not have falls back to `fi`.

## Who addresses which language

Customer templates take `pumppuRequest.language`; provider templates take the
recipient's `UI_LANGUAGE` person setting. They are different sources and must not
be unified — a provider's UI preference says nothing about the language the
customer filled the wizard in.

## Tests

`npm test` (vitest). The suite is the merge of the two jest suites this module
had in puminet5api — cross-template invariants (Finnish default, no diacritics in
English output, per-language subjects/html, no self-wrapping) plus the
per-template content contracts, including the PII guards: `providerNewRequest`
and `providerOfferRejected` must never leak customer name or phone.
