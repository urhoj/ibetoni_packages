import { describe, it, expect } from "vitest";
import * as t from "../index.js";
// index.js deliberately does not re-export the copy table (nothing outside the
// package consumes it). The parity test below is the one legitimate reader, so
// it reaches into the module directly rather than widening the public surface.
import { COPY } from "../copy.js";

// Merged from the two jest suites that covered this module while it lived in
// puminet5api (modules/betonijerry/__tests__/ and test/betonijerry/). They were
// NOT duplicates: the first covers cross-template invariants parametrically, the
// second the per-template content contracts. Both are preserved verbatim below
// apart from the import and one entity spelling, noted at its assertion.
//
// `templates` is kept as an alias so the parametric block reads unchanged.
const templates = t;

const CUSTOMER = ["customerNoSupply", "customerOfferReceived", "customerProviderDeclined", "customerPourConfirmed", "customerProviderViewed"];
const PROVIDER = ["providerNewRequest", "providerOfferAccepted", "providerOfferRejected"];
const ALL = [...CUSTOMER, ...PROVIDER];

// Field names below were READ OUT OF THE TEMPLATES, not invented. An earlier draft of this
// plan used `customerUrl` (the real field is `valutUrl`, consumed by 5 of the 8 builders) and
// asserted on `pourTime`, which does not exist at all — the real field is `scheduledAt`. With
// those wrong, every template still renders (missing fields fall back to "—") and the tests
// still pass, while proving almost nothing. Verify any field you add against the source.
//
// Per-builder requirements, verified 2026-08-12:
//   providerNewRequest        kayttokohde maskedAddress operatorUrl pumppuAika requiredLinja
//                             requiredPuomi totalM3
//   customerNoSupply          address valutUrl
//   customerOfferReceived     priceCents providerName valutUrl
//   providerOfferAccepted     address customerName customerPhone operatorUrl totalM3
//   providerOfferRejected     kayttokohde maskedAddress operatorUrl totalM3
//   customerProviderDeclined  hasOtherProviders providerName reason valutUrl
//   customerPourConfirmed     address providerName scheduledAt totalM3 valutUrl
//   customerProviderViewed    providerName valutUrl
const sample = {
    kayttokohde: "Anturat",
    totalM3: 12,
    pumppuAika: "11.08.2026 klo 10.00",
    maskedAddress: "Helsinki",
    address: "Esimerkkikatu 1, 00100 Helsinki",
    requiredPuomi: 28,
    requiredLinja: null,
    operatorUrl: "https://betonijerry.fi/tarjouspyynnot/1",
    valutUrl: "https://betonijerry.fi/valut/1",
    providerName: "Testi Oy",
    customerName: "Matti Meikäläinen",
    customerPhone: "+358401234567",
    priceCents: 123400,
    hasOtherProviders: true,
    reason: "Kalusto varattu",
    scheduledAt: new Date("2026-08-11T11:30:00Z"),
};

describe("jerry email templates", () => {
    // NOTE on the brief's original test: it asserted `out.html` (the raw builder
    // return value) `toContain("<html lang=\"fi\"")`. That doesn't match the actual
    // architecture — builders return a content FRAGMENT (`<h2>...<p>...`), never a
    // full document; the `<html lang="...">` wrapper is only added later, centrally,
    // by `wrapJerryLayout()` in jerryEmail.js#sendJerryEmail. Wrapping inside every
    // builder would double-wrap real outbound mail once jerryEmail.js wraps again.
    // Confirmed with the orchestrator before diverging from the brief text: keep the
    // builder/wrapper separation, and test the `<html lang>` tagging directly against
    // `wrapJerryLayout` (below) instead of against builder output. The per-builder
    // language checks here still assert on real rendered content (diacritics +
    // differing subjects), so a template that silently stayed Finnish still fails.
    it.each(ALL)("%s returns subject/html/text in Finnish by default", (name) => {
        const out = templates[name](sample);
        expect(out.subject).toBeTruthy();
        expect(out.html).toBeTruthy();
        expect(out.text).toBeTruthy();
        // Regression guard for the builder/wrapper split itself: a builder must
        // never self-wrap. If one ever does, `sendJerryEmail` wraps AGAIN on top
        // (wrapJerryLayout is only meant to run once, centrally) and every real
        // outbound email gets a nested <html>/<body>/header/footer.
        expect(out.html).not.toContain("<html");
    });

    it.each(ALL)("%s returns English content when lang is en", (name) => {
        // customerName is PII passed straight through, never translated — by design
        // it can legitimately contain diacritics (the shared `sample.customerName`,
        // "Matti Meikäläinen", does). Swap in a diacritic-free name for this one
        // assertion so it tests the template's OWN copy, not incidental fixture data.
        const d = { ...sample, customerName: "Matti Testaaja" };
        const out = templates[name](d, "en");
        // No Finnish diacritics anywhere in English output — the cheapest
        // catch for a template whose copy was only half-translated.
        expect(out.subject).not.toMatch(/[äöÄÖ]/);
        expect(out.text).not.toMatch(/[äöÄÖ]/);
        expect(out.html).not.toContain("<html"); // same double-wrap guard, en path
    });

    it.each(ALL)("%s produces different subjects per language", (name) => {
        expect(templates[name](sample, "en").subject).not.toBe(templates[name](sample, "fi").subject);
    });

    it.each(ALL)("%s produces different html per language", (name) => {
        expect(templates[name](sample, "en").html).not.toBe(templates[name](sample, "fi").html);
    });

    it("wrapJerryLayout tags the document with the requested language", () => {
        expect(templates.wrapJerryLayout("<p>x</p>")).toContain("<html lang=\"fi\"");
        expect(templates.wrapJerryLayout("<p>x</p>", "fi")).toContain("<html lang=\"fi\"");
        expect(templates.wrapJerryLayout("<p>x</p>", "en")).toContain("<html lang=\"en\"");
    });

    it("wrapJerryLayout falls back to Finnish for an unknown language", () => {
        expect(templates.wrapJerryLayout("<p>x</p>", "de")).toContain("<html lang=\"fi\"");
    });

    it("copyFor is safe on prototype-key languages (falls back to Finnish)", () => {
        const ctor = templates.customerOfferReceived(sample, "constructor");
        const fi = templates.customerOfferReceived(sample, "fi");
        expect(ctor.subject).toBe(fi.subject);
    });

    it("customerOfferReceived falls back to Finnish content for an unknown language", () => {
        const de = templates.customerOfferReceived(sample, "de");
        const fi = templates.customerOfferReceived(sample, "fi");
        expect(de.subject).toBe(fi.subject);
        expect(de.html).toBe(fi.html);
    });

    it("formats the pour time per language", () => {
        // `scheduledAt` — NOT `pourTime`. `sample` already carries it.
        const fi = templates.customerPourConfirmed(sample, "fi");
        const en = templates.customerPourConfirmed(sample, "en");
        expect(fi.text).toContain("klo");
        expect(en.text).not.toContain("klo");
    });
});

describe("formatters", () => {
  it("formats euros from cents with NBSP grouping", () => {
    expect(t.formatEuroFromCents(199900)).toBe("1 999 €");
    expect(t.formatEuroFromCents(50000)).toBe("500 €");
    expect(t.formatEuroFromCents(null)).toBe("");
    expect(t.formatEuroFromCents("nope")).toBe("");
  });
  // Pinned to an explicit UTC instant, NOT `new Date(2026, 6, 4, 8, 5)`. The old
  // fixture was local-to-the-runner, so getHours() round-tripped it on every
  // machine and the suite stayed green while production (a UTC process) mailed
  // customers a pour time three hours early.
  it("formats pour time in Helsinki, not the process zone", () => {
    // 05:05Z = 08:05 Helsinki (summer, +3)
    expect(t.formatPourTime(new Date("2026-07-04T05:05:00Z"))).toBe("04.07.2026 klo 08.05");
    // 06:05Z = 08:05 Helsinki (winter, +2) — same wall clock, different offset
    expect(t.formatPourTime(new Date("2026-01-04T06:05:00Z"))).toBe("04.01.2026 klo 08.05");
    expect(t.formatPourTime(new Date("2026-07-04T05:05:00Z"), "en")).toBe("4 Jul 2026 at 08.05");
  });
  it("returns empty for missing or invalid pour time", () => {
    expect(t.formatPourTime("not-a-date")).toBe("");
    expect(t.formatPourTime(null)).toBe("");
  });
});

describe("wrapJerryLayout", () => {
  it("wraps content in the brand chrome", () => {
    const html = t.wrapJerryLayout("<p>Hei</p>");
    expect(html).toContain("BetoniJerry");
    expect(html).toContain("<p>Hei</p>");
  });
});

describe("providerNewRequest (#1) — no customer PII", () => {
  const out = t.providerNewRequest({
    kayttokohde: "Laatta", totalM3: 12, pumppuAika: "huomenna",
    maskedAddress: "Sarkatie, 01720 Vantaa", requiredPuomi: 28, requiredLinja: null,
    operatorUrl: "https://betoni.online/tarjouspyynnot",
    customerName: "Salainen Asiakas", customerPhone: "+358401234567",
  });
  it("has the Finnish subject + masked address + CTA, and no phone field", () => {
    // The subject names the job now. It used to be one constant string for every
    // request, so a provider holding several could not tell them apart, search
    // them, or stop Gmail collapsing them into a single thread.
    expect(out.subject).toBe("Tarjouspyyntö: 12 m³, Laatta, Vantaa – BetoniJerry");
    expect(out.html).toContain("Sarkatie, 01720 Vantaa");
    expect(out.html).toContain("https://betoni.online/tarjouspyynnot");
    expect(out.html).toContain("12");
  });
  it("never leaks customer PII into html or text", () => {
    expect(out.html).not.toContain("Salainen Asiakas");
    expect(out.html).not.toContain("+358401234567");
    expect(out.text).not.toContain("Salainen Asiakas");
    expect(out.text).not.toContain("+358401234567");
  });
});

describe("customerOfferReceived (#3)", () => {
  const out = t.customerOfferReceived({
    providerName: "Pumppu Oy", priceCents: 199900,
    address: "Sarkatie 7, 01720 Vantaa", valutUrl: "https://betonijerry.fi/valut/5",
  });
  it("shows provider name, formatted price, and the valut CTA", () => {
    expect(out.subject).toBe("Sait uuden tarjouksen – BetoniJerry");
    expect(out.html).toContain("Pumppu Oy");
    expect(out.html).toContain("1 999 €");
    expect(out.html).toContain("https://betonijerry.fi/valut/5");
  });
});

describe("providerOfferAccepted (#4) — full reveal", () => {
  const out = t.providerOfferAccepted({
    customerName: "Matti Meikäläinen", customerPhone: "+358401234567",
    address: "Sarkatie 7, 01720 Vantaa", totalM3: 12, pumppuRequestId: 5,
    operatorUrl: "https://betoni.online/tarjouspyynnot",
  });
  it("reveals customer name + phone + full address and tells the provider to call", () => {
    expect(out.subject).toContain("hyväksyttiin");
    expect(out.html).toContain("Matti Meikäläinen");
    expect(out.html).toContain("+358401234567");
    expect(out.html).toContain("Sarkatie 7, 01720 Vantaa");
    expect(out.html.toLowerCase()).toContain("soita");
  });
});

describe("providerOfferRejected (#5) — losing provider, no PII", () => {
  const out = t.providerOfferRejected({
    kayttokohde: "Laatta", totalM3: 12, maskedAddress: "Sarkatie, 01720 Vantaa",
    operatorUrl: "https://betoni.online/tarjouspyynnot",
    customerName: "Salainen Asiakas", customerPhone: "+358401234567",
  });
  it("has the Finnish subject + masked address + CTA", () => {
    expect(out.subject).toBe("Tarjoustasi ei valittu tällä kertaa – BetoniJerry");
    expect(out.html).toContain("Sarkatie, 01720 Vantaa");
    expect(out.html).toContain("https://betoni.online/tarjouspyynnot");
  });
  it("never leaks customer PII", () => {
    expect(out.html).not.toContain("Salainen Asiakas");
    expect(out.html).not.toContain("+358401234567");
    expect(out.text).not.toContain("+358401234567");
  });
});

describe("customerProviderDeclined", () => {
  it("names the provider + reason and links to valut (others may still offer)", () => {
    const out = t.customerProviderDeclined({
      providerName: "Pumppu Oy", reason: "Kalusto varattu", hasOtherProviders: true,
      valutUrl: "https://betonijerry.fi/valut/5",
    });
    expect(out.subject).toContain("ei tarjoa");
    expect(out.html).toContain("Pumppu Oy");
    expect(out.html).toContain("Kalusto varattu");
    expect(out.html).toContain("https://betonijerry.fi/valut/5");
    expect(out.html).toContain("Muut");
  });
  it("signals when no other providers remain", () => {
    const out = t.customerProviderDeclined({
      providerName: "Pumppu Oy", reason: "", hasOtherProviders: false,
      valutUrl: "https://betonijerry.fi/valut/5",
    });
    expect(out.html).not.toContain("Perustelu");
    expect(out.html).toContain("muita pumppausyrityksiä ei ole vastannut");
  });
});

describe("customerPourConfirmed (#6)", () => {
  const out = t.customerPourConfirmed({
    // Explicit UTC instant: 05:00Z is 08:00 in Helsinki. This is the mail that
    // tells a customer when their concrete arrives, so the hour has to be the
    // one the operator agreed, not the one the server happens to run in.
    providerName: "Pumppu Oy", scheduledAt: new Date("2026-07-04T05:00:00Z"),
    address: "Sarkatie 7, 01720 Vantaa", totalM3: 12, keikkaId: 999,
    valutUrl: "https://betonijerry.fi/valut/5",
  });
  it("confirms the pour with provider + formatted time", () => {
    expect(out.subject).toBe("Pumppaus on vahvistettu – BetoniJerry");
    expect(out.html).toContain("Pumppu Oy");
    expect(out.html).toContain("04.07.2026 klo 08.00");
  });
});

describe("customerNoSupply (#2)", () => {
  it("no_supply names the address and links to valut", () => {
    const out = t.customerNoSupply({ address: "Sarkatie 7, 01720 Vantaa", valutUrl: "https://betonijerry.fi/valut/5" });
    expect(out.subject).toContain("Emme löytäneet");
    expect(out.html).toContain("https://betonijerry.fi/valut/5");
  });
});

describe("customerProviderViewed (#7) — provider viewed, transparency email", () => {
  const out = t.customerProviderViewed({
    providerName: "Pumppu <Oy>", valutUrl: "https://betonijerry.fi/valut/5",
  });
  it("names the company in subject + body, says tietoja tarkasteltiin, links to valut", () => {
    expect(out.subject).toBe("Pumppu <Oy> kiinnostui tarjouspyynnöstänne – BetoniJerry");
    expect(out.html).toContain("Pumppu &lt;Oy&gt;");
    expect(out.html).toContain("tarkasteli tietojanne");
    expect(out.html).toContain("https://betonijerry.fi/valut/5");
    expect(out.text).toContain("kiinnostui tarjouspyynnöstänne");
    expect(out.text).toContain("https://betonijerry.fi/valut/5");
  });
  it("falls back to a generic company name", () => {
    const o = t.customerProviderViewed({ valutUrl: "https://x" });
    expect(o.subject).toContain("Pumppausyritys");
  });
});

describe("providerNewRequest (#1) — open-details copy", () => {
  const out = t.providerNewRequest({
    kayttokohde: "Laatta", totalM3: 12, maskedAddress: "Sarkatie, 01720 Vantaa",
    operatorUrl: "https://betonijerry.fi/tarjouspyynnot",
  });
  // fb#1268: contact details follow the BID now, not a login. Promising them
  // "by logging in" was both untrue after the change and the reason the funnel
  // stalled — the old copy handed the lead away before any commitment.
  it("tells the provider the contact details come with the offer, in html AND text", () => {
    expect(out.html).toContain("kun olet lähettänyt tarjouksen");
    expect(out.text).toContain("kun olet lähettänyt tarjouksen");
  });
  it("says replying needs no login, in html AND text", () => {
    expect(out.html).toContain("kirjautumista ei tarvita");
    expect(out.text).toContain("kirjautumista ei tarvita");
  });
  it("no longer promises reveal only on acceptance", () => {
    expect(out.html).not.toContain("asiakas hyväksyy sen");
  });
  // Pricing is treated as confidential in the Finnish concrete pumping trade.
  // Providers who assume rivals can see their number simply do not quote, so
  // the guarantee has to be stated at the moment of the ask.
  it("states that the price is private to the customer, in html AND text", () => {
    expect(out.html).toContain("pumppuyritykset eivät näe sitä");
    expect(out.text).toContain("pumppuyritykset eivät näe sitä");
  });
  // The old copy actively invited the bypass ("Voit vastata asiakkaalle myös
  // suoraan") and demoted quoting to an optional extra ("lisäksi"), which made
  // offerCount 0 the rational outcome. Don't reintroduce either.
  it("does not invite the provider to answer the customer directly instead", () => {
    expect(out.html).not.toContain("myös suoraan");
    expect(out.text).not.toContain("myös suoraan");
  });
});

describe("providerNewRequest (#1) — link capability is per RECIPIENT, not policy", () => {
  const base = {
    kayttokohde: "Laatta", totalM3: 12, maskedAddress: "Sarkatie, 01720 Vantaa",
    operatorUrl: "https://betonijerry.fi/tarjouspyynnot",
  };
  // A preview token minted without a personId — every recipient resolved via
  // offerNotificationEmail (shared inbox) or laskutusEmail — is refused by
  // POST /preview/offer. Telling that cohort "kirjautumista ei tarvita" was a
  // promise the page broke only AFTER they had filled in and submitted a price.
  it("tells a recipient who cannot bid by link that offering needs a sign-in", () => {
    const out = t.providerNewRequest({ ...base, canBidWithLink: false });
    expect(out.html).toContain("vaatii kirjautumisen");
    expect(out.text).toContain("vaatii kirjautumisen");
    expect(out.html).not.toContain("kirjautumista ei tarvita");
    expect(out.text).not.toContain("kirjautumista ei tarvita");
  });
  it("keeps the no-login promise for a recipient who can bid by link", () => {
    const out = t.providerNewRequest({ ...base, canBidWithLink: true });
    expect(out.html).toContain("kirjautumista ei tarvita");
    expect(out.text).toContain("kirjautumista ei tarvita");
  });
  // Default-ALLOW. If the backend ships before this package — or an older caller
  // simply omits the field — the inverted default would tell EVERY provider to
  // log in, which is both untrue and the copy that suppresses quotes outright.
  it("defaults to the no-login promise when the flag is absent", () => {
    const out = t.providerNewRequest(base);
    expect(out.html).toContain("kirjautumista ei tarvita");
  });
});

describe("providerNewRequest (#1) — both MIME parts carry the same job", () => {
  const out = t.providerNewRequest({
    pumppuRequestId: 412, kayttokohde: "Anturat", totalM3: 7.5,
    pumppuKesto: 2.5, maskedAddress: "Vanha Porvoontie, 01490 Vantaa",
    requiredPuomi: 27, requiredLinja: 40,
    createdAt: new Date("2026-09-09T05:00:00Z"),
    expiresAt: new Date("2026-09-23T05:00:00Z"),
    operatorUrl: "https://betonijerry.fi/tarjouspyynnot/esikatselu?token=abc",
    declineUrl: "https://betonijerry.fi/tarjouspyynnot/esikatselu?token=abc&action=decline",
  });
  // The two parts were written out separately and had drifted: text/plain
  // omitted Puomi and Linja — the two fields that decide which machine can take
  // the job — so a plain-text reader saw a job they could not size.
  it.each([
    ["Puomi", "27 m"],
    ["Linja", "40 m"],
    ["Kesto (arvio)", "2,5 h"],
    ["Määrä", "7,5 m³"],
    ["Vastaa viimeistään", "23.09.2026"],
  ])("carries %s in html AND text", (label, value) => {
    expect(out.html).toContain(label);
    expect(out.html).toContain(value);
    expect(out.text).toContain(label);
    expect(out.text).toContain(value);
  });
  it("offers the decline action alongside the quote CTA", () => {
    expect(out.html).toContain("action=decline");
    expect(out.text).toContain("action=decline");
    expect(out.html).toContain("En tarjoa tähän");
  });
  it("identifies the request so the mail is searchable and matches the page", () => {
    expect(out.html).toContain("Pyyntö #412");
    expect(out.text).toContain("Pyyntö #412");
  });
  it("falls back to the generic subject when there are no facts to name", () => {
    const bare = t.providerNewRequest({ operatorUrl: "https://x" });
    expect(bare.subject).toBe("Uusi tarjouspyyntö alueellasi – BetoniJerry");
  });
});

// fi and en are two hand-maintained tables and nothing compared their KEYS. The
// existing guards cannot catch a missing en key: `en.subject !== fi.subject`
// passes when en.subject is undefined, and the diacritics guard only fires if
// the untranslated Finnish happens to contain ä/ö. A key added to fi alone
// renders the literal "undefined" into an English-preference provider's inbox.
describe("copy table fi/en key parity", () => {
  const keyPaths = (obj, prefix = "") =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? keyPaths(v, `${prefix}${k}.`)
        : [`${prefix}${k}`]);

  it("en defines exactly the keys fi defines", () => {
    const fi = keyPaths(COPY.fi).sort();
    const en = keyPaths(COPY.en).sort();
    expect(en).toEqual(fi);
  });

  it("no copy value is empty in either language", () => {
    for (const lang of ["fi", "en"]) {
      for (const path of keyPaths(COPY[lang])) {
        const value = path.split(".").reduce((o, k) => o[k], COPY[lang]);
        expect(typeof value === "string" && value.length > 0).toBe(true);
      }
    }
  });
});

describe("formatFiNumber / formatFiDate", () => {
  it("writes Finnish decimals with a comma and English with a dot", () => {
    expect(t.formatFiNumber(7.5)).toBe("7,5");
    expect(t.formatFiNumber(7.5, "en")).toBe("7.5");
    expect(t.formatFiNumber(3)).toBe("3");
    expect(t.formatFiNumber(27.0)).toBe("27");
  });
  it("returns empty for missing or non-numeric input", () => {
    expect(t.formatFiNumber(null)).toBe("");
    expect(t.formatFiNumber(undefined)).toBe("");
    expect(t.formatFiNumber("nope")).toBe("");
  });
  // The dates these emails show are UTC datetime2 values and the process zone is
  // UTC on Azure. 22:30 UTC is already the NEXT day in Helsinki, so a naive read
  // prints the wrong deadline.
  it("renders the Helsinki calendar day, not the UTC one", () => {
    expect(t.formatFiDate(new Date("2026-09-22T22:30:00Z"))).toBe("23.09.2026");
    expect(t.formatFiDate(new Date("2026-09-23T05:00:00Z"))).toBe("23.09.2026");
  });
  it("returns a dash for missing or invalid input", () => {
    expect(t.formatFiDate(null)).toBe("—");
    expect(t.formatFiDate("not-a-date")).toBe("—");
  });
});
