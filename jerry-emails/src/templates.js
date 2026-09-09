// Pure content builders + formatters for BetoniJerry transactional emails.
// No I/O, no transport, no database — the sender (puminet5api's
// modules/betonijerry/jerryEmail.js) wraps these with the brand layout and
// owns the SendGrid category.
//
// Every builder takes a trailing `lang` ("fi" | "en", default "fi") and sources its
// copy from ./copy.js — control flow here never branches on language, only
// which copy object is looked up. Customer templates are addressed by
// pumppuRequest.language; provider templates by the recipient's UI_LANGUAGE setting
// (wired in Task 13, not here).
const { COPY, copyFor } = require("./copy");
// Internal only - deliberately NOT re-exported. This package does not own HTML
// escaping; @ibetoni/utils does, and every caller that needs it imports it there.
const { escapeHtml } = require("@ibetoni/utils");

// Language normalization is derived from the copy table itself rather than from
// the backend's shared normalizeLanguage. That is the honest boundary for this
// package: a template can only render a language it HAS copy for, so COPY is the
// authority on what "supported" means here, and adding a language to COPY is the
// single edit that enables it. Behaviour today is identical - COPY holds exactly
// fi and en, the same pair the backend whitelist carries.
function normalizeLang(lang) {
  return Object.hasOwn(COPY, lang) ? lang : "fi";
}

function formatEuroFromCents(cents, lang = "fi") {
  if (cents == null || !Number.isFinite(Number(cents))) return "";
  const euros = Math.round(Number(cents) / 100);
  if (normalizeLang(lang) === "en") {
    return `€${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(euros)}`;
  }
  const grouped = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return `${grouped}\u00A0€`;
}

function formatPourTime(date, lang = "fi") {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  if (normalizeLang(lang) === "en") {
    const month = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d);
    return `${d.getDate()} ${month} ${d.getFullYear()} at ${pad(d.getHours())}.${pad(d.getMinutes())}`;
  }
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} klo ${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

// Finnish writes decimals with a COMMA. Every numeric field these emails carry
// (totalM3, requiredPuomi, requiredLinja, pumppuKesto) is a SQL `decimal`, so
// mssql hands us 3 or 7.5 and a bare interpolation printed "7.5 m³" into Finnish
// copy. Latent while the fixtures were whole numbers; wrong on the first half-cube.
function formatFiNumber(value, lang = "fi") {
  if (value == null) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  // decimal(8,2) at most — trim the trailing zeros a raw String() would keep.
  const s = String(Math.round(n * 100) / 100);
  return normalizeLang(lang) === "en" ? s : s.replace(".", ",");
}

// Date-only, in Helsinki. Deliberately NOT formatPourTime: that one reads
// `d.getHours()` in the PROCESS zone, which is UTC on Azure. Every date these
// emails show is a UTC datetime2 (`expiresAt` is SYSUTCDATETIME() + 14 d), so a
// naive read lands on the wrong day for anything stamped late in the evening.
// Output matches betonijerry's own formatSentDate (DD.MM.YYYY, "—" on bad input)
// so the email and the preview page print the same date the same way.
function formatFiDate(date, lang = "fi") {
  // `new Date(null)` is the EPOCH, not an invalid date — without this guard a
  // null expiresAt/createdAt prints "01.01.1970" into a live email.
  if (date == null) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const p = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Helsinki", day: "2-digit", month: "2-digit", year: "numeric",
  }).formatToParts(d)) p[part.type] = part.value;
  return normalizeLang(lang) === "en"
    ? `${p.day}/${p.month}/${p.year}`
    : `${p.day}.${p.month}.${p.year}`;
}

// "Vanha Porvoontie, 01490 Vantaa" -> "Vantaa"; "Helsinki" -> "Helsinki".
// Used for the subject line only, so a provider can tell two open requests apart
// in the inbox. Returns "" when the address yields nothing town-shaped.
function townFromMaskedAddress(address) {
  if (!address) return "";
  const segments = String(address).split(",");
  return segments[segments.length - 1].replace(/^\s*\d{5}\s*/, "").trim();
}

// Shared brand chrome.
function wrapJerryLayout(contentHtml, lang = "fi") {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="${normalizeLang(lang)}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f5f5f5;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f5;"><tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,.07);overflow:hidden;">
<tr><td bgcolor="#D97706" style="background-color:#D97706;background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);padding:36px 30px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:30px;font-weight:700;">BetoniJerry</h1></td></tr>
<tr><td style="padding:40px;color:#1a202c;font-size:16px;line-height:1.6;">${contentHtml}</td></tr>
<tr><td bgcolor="#FEF9E7" style="background-color:#FEF9E7;padding:28px 40px;text-align:center;border-top:1px solid #f0e6c8;">
<p style="margin:0;color:#4b5563;font-size:11px;">© ${year} BetoniJerry</p></td></tr>
</table></td></tr></table></body></html>`;
}

function wrapJerryText(contentText) {
  return `BetoniJerry\n\n${contentText}\n\n— BetoniJerry`;
}

// Outlook's Word engine ignores `background:linear-gradient(...)` entirely and
// paints NOTHING, so a white label on a gradient-only button rendered white on
// white — the primary action was invisible. `bgcolor` + `background-color` give
// it a real fill. The label is #1a202c rather than #fff because white on this
// amber is ~2.15:1; the dark label is ~7.6:1 and keeps the brand colour intact.
function cta(url, label) {
  return `<p style="margin:28px 0 0 0;"><a href="${escapeHtml(url)}" bgcolor="#F59E0B" style="background-color:#F59E0B;background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);color:#1a202c;padding:14px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:700;">${escapeHtml(label)}</a></p>`;
}

// Low-emphasis companion action. Deliberately a plain link, not a second button:
// declining must be reachable from the mail (the copy promises it, and it is the
// signal that closes the loop for the customer) without competing with the quote.
function secondaryLink(url, label) {
  return `<p style="margin:14px 0 0 0;"><a href="${escapeHtml(url)}" style="color:#92400E;font-size:14px;">${escapeHtml(label)}</a></p>`;
}

// Inbox preview line. Sits first in the content fragment so clients that show a
// snippet get the job facts instead of the opening sentence of the body copy.
function preheader(text) {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;">${escapeHtml(text)}</div>`;
}

// --- #1 provider: new request (masked, NO customer PII) ---
// Facts first, prose second: this is a job card, not a letter. A pump operator
// triages it on "how much, where, what boom, by when" — burying those under
// onboarding copy is what made the old version unreadable on a phone.
function providerNewRequest(d, lang = "fi") {
  const l = normalizeLang(lang);
  const c = copyFor(l, "providerNewRequest");

  // DEFAULT-ALLOW. An absent flag means an older caller, not "cannot bid" — the
  // inverted default would tell every provider they must log in, which is both
  // wrong and the exact copy that suppresses quotes.
  const canBid = d.canBidWithLink !== false;

  // ONE row list feeds both MIME parts. They used to be written out separately
  // and had silently drifted: the text/plain half omitted Puomi and Linja, i.e.
  // the two fields that decide which machine can take the job.
  const rows = [
    [c.labels.kayttokohde, d.kayttokohde || "—"],
    [c.labels.maara, `${formatFiNumber(d.totalM3, l)} m³`],
    d.pumppuAika ? [c.labels.pumppausaika, d.pumppuAika] : null,
    d.pumppuKesto ? [c.labels.kesto, `${formatFiNumber(d.pumppuKesto, l)} h`] : null,
    [c.labels.sijainti, d.maskedAddress || "—"],
    d.requiredPuomi ? [c.labels.puomi, `${formatFiNumber(d.requiredPuomi, l)} m`] : null,
    d.requiredLinja ? [c.labels.linja, `${formatFiNumber(d.requiredLinja, l)} m`] : null,
    d.expiresAt ? [c.labels.respondBy, formatFiDate(d.expiresAt, l)] : null,
  ].filter(Boolean);

  // Every request used to carry a byte-identical subject, so a provider holding
  // several open requests could not tell them apart, search them, or stop Gmail
  // collapsing them into one thread.
  const facts = [
    d.totalM3 != null ? `${formatFiNumber(d.totalM3, l)} m³` : null,
    d.kayttokohde || null,
    townFromMaskedAddress(d.maskedAddress) || null,
  ].filter(Boolean);
  const subject = facts.length
    ? `${c.subjectPrefix}${facts.join(", ")}${c.subjectSuffix}`
    : c.subject;

  const footer = d.pumppuRequestId
    ? c.footerLine.replace("{id}", d.pumppuRequestId).replace("{date}", formatFiDate(d.createdAt, l))
    : "";
  const linkLine = canBid ? c.linkLineCanBid : c.linkLineNeedsLogin;

  const rowsHtml = rows
    .map(([k, v]) => `<p style="margin:6px 0;"><strong>${k}:</strong> ${escapeHtml(v)}</p>`)
    .join("");
  const html = `${preheader(facts.join(" · "))}<h2 style="margin:0 0 16px;font-size:22px;">${c.heading}</h2>
${rowsHtml}
<p style="margin:20px 0 0 0;">${linkLine}</p>
<p style="margin:8px 0 0 0;">${c.trustLine}</p>
<p style="margin:8px 0 0 0;">${c.contactLine}</p>${cta(d.operatorUrl, c.cta)}${
    d.declineUrl ? secondaryLink(d.declineUrl, c.declineCta) : ""
  }${footer ? `<p style="margin:24px 0 0 0;color:#4b5563;font-size:12px;">${escapeHtml(footer)}</p>` : ""}`;

  const text = `${c.heading}.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${linkLine}\n${c.trustLine}\n${c.contactLine}\n\n${c.ctaTextPrefix}: ${d.operatorUrl}${
    d.declineUrl ? `\n${c.declineTextPrefix}: ${d.declineUrl}` : ""
  }${footer ? `\n\n${footer}` : ""}`;

  return { subject, html, text };
}

// --- #2 customer: no providers found ---
function customerNoSupply(d, lang = "fi") {
  const c = copyFor(lang, "customerNoSupply");
  const html = `<h2 style="margin:0 0 16px;font-size:22px;">${c.heading}</h2>
<p style="margin:0 0 16px;">${c.introPrefix}<strong>${escapeHtml(d.address || "")}</strong>${c.introSuffix}</p>${cta(d.valutUrl, c.cta)}`;
  const text = `${c.textPrefix}${d.address || ""}${c.textSuffix}\n\n${d.valutUrl}`;
  return { subject: c.subject, html, text };
}

// --- #3 customer: offer received ---
function customerOfferReceived(d, lang = "fi") {
  const l = normalizeLang(lang);
  const c = copyFor(l, "customerOfferReceived");
  const price = formatEuroFromCents(d.priceCents, l);
  const providerNameHtml = escapeHtml(d.providerName || c.defaultProviderName);
  const html = `<h2 style="margin:0 0 16px;font-size:22px;">${c.heading}</h2>
<p style="margin:0 0 8px;"><strong>${providerNameHtml}</strong> ${c.sentVerb}${price ? `${c.priceLead}<strong>${price}</strong>` : ""}.</p>
<p style="margin:0 0 16px;">${c.intro2}</p>${cta(d.valutUrl, c.cta)}`;
  const text = `${d.providerName || c.defaultProviderName} ${c.sentVerb}${price ? `${c.priceLead}${price}` : ""}. ${c.textTail}: ${d.valutUrl}`;
  return { subject: c.subject, html, text };
}

// --- #4 provider: accepted (full reveal) ---
function providerOfferAccepted(d, lang = "fi") {
  const c = copyFor(lang, "providerOfferAccepted");
  const html = `<h2 style="margin:0 0 16px;font-size:22px;">${c.heading}</h2>
<p style="margin:0 0 16px;">${c.leadPrefix}<strong>${c.callToAction}</strong>${c.leadSuffix}</p>
<p style="margin:6px 0;"><strong>${c.labels.asiakas}:</strong> ${escapeHtml(d.customerName || "—")}</p>
<p style="margin:6px 0;"><strong>${c.labels.puhelin}:</strong> ${escapeHtml(d.customerPhone || "—")}</p>
<p style="margin:6px 0;"><strong>${c.labels.osoite}:</strong> ${escapeHtml(d.address || "—")}</p>
<p style="margin:6px 0;"><strong>${c.labels.maara}:</strong> ${escapeHtml(d.totalM3)} m³</p>${cta(d.operatorUrl, c.cta)}`;
  const text = `${c.textHeading} ${c.callToAction}${c.leadSuffix}\n${c.labels.asiakas}: ${d.customerName || "—"}\n${c.labels.puhelin}: ${d.customerPhone || "—"}\n${c.labels.osoite}: ${d.address || "—"}\n${c.labels.maara}: ${d.totalM3} m³`;
  return { subject: c.subject, html, text };
}

// --- #5 provider: offer NOT selected (sibling auto-rejected on accept) ---
// Masked — no customer PII (the provider lost, so no reveal). Closes the loop so a
// losing offer doesn't silently go idle in the provider's inbox.
function providerOfferRejected(d, lang = "fi") {
  const c = copyFor(lang, "providerOfferRejected");
  const lines = [
    d.kayttokohde ? `<strong>${c.labels.kayttokohde}:</strong> ${escapeHtml(d.kayttokohde)}` : null,
    d.totalM3 != null ? `<strong>${c.labels.maara}:</strong> ${escapeHtml(d.totalM3)} m³` : null,
    d.maskedAddress ? `<strong>${c.labels.sijainti}:</strong> ${escapeHtml(d.maskedAddress)}` : null,
  ].filter(Boolean).map((l) => `<p style="margin:6px 0;">${l}</p>`).join("");
  const html = `<h2 style="margin:0 0 16px;font-size:22px;">${c.heading}</h2>
<p style="margin:0 0 16px;">${c.body}</p>${lines}${d.operatorUrl ? cta(d.operatorUrl, c.cta) : ""}`;
  const text = `${c.textLead}${d.maskedAddress ? `\n${c.labels.sijainti}: ${d.maskedAddress}` : ""}${d.operatorUrl ? `\n\n${c.textCtaPrefix}: ${d.operatorUrl}` : ""}`;
  return { subject: c.subject, html, text };
}

// --- provider decline: customer notified a provider will not offer ---
// The request may stay open for other providers; this closes the loop for the
// customer so a declining provider isn't an invisible non-response.
function customerProviderDeclined(d, lang = "fi") {
  const c = copyFor(lang, "customerProviderDeclined");
  const providerNameHtml = escapeHtml(d.providerName || c.defaultProviderName);
  const reason = d.reason ? `<p style="margin:0 0 16px;">${c.reasonLabel}: <em>${escapeHtml(d.reason)}</em></p>` : "";
  const tail = d.hasOtherProviders
    ? `<p style="margin:0 0 16px;">${c.tailOthers}</p>`
    : `<p style="margin:0 0 16px;">${c.tailNone}</p>`;
  const html = `<h2 style="margin:0 0 16px;font-size:22px;">${c.heading}</h2>
<p style="margin:0 0 8px;"><strong>${providerNameHtml}</strong> ${c.declinedSuffix}</p>${reason}${tail}${cta(d.valutUrl, c.cta)}`;
  const text = `${d.providerName || c.defaultProviderName} ${c.textSuffix}${d.reason ? `\n${c.reasonLabel}: ${d.reason}` : ""}\n\n${d.valutUrl}`;
  return { subject: c.subject, html, text };
}

// --- #6 customer: pour confirmed ---
function customerPourConfirmed(d, lang = "fi") {
  const l = normalizeLang(lang);
  const c = copyFor(l, "customerPourConfirmed");
  const when = formatPourTime(d.scheduledAt, l);
  const providerNameHtml = escapeHtml(d.providerName || c.defaultProviderName);
  const html = `<h2 style="margin:0 0 16px;font-size:22px;">${c.heading}</h2>
<p style="margin:0 0 16px;"><strong>${providerNameHtml}</strong> ${c.confirmedVerb}${when ? `${c.whenLead}<strong>${when}</strong>` : ""}.</p>
<p style="margin:6px 0;"><strong>${c.labels.osoite}:</strong> ${escapeHtml(d.address || "—")}</p>
<p style="margin:6px 0;"><strong>${c.labels.maara}:</strong> ${escapeHtml(d.totalM3)} m³</p>${cta(d.valutUrl, c.cta)}`;
  const text = `${d.providerName || c.defaultProviderName} ${c.confirmedVerb}${when ? `${c.whenLead}${when}` : ""}.\n${c.labels.osoite}: ${d.address || "—"}\n\n${d.valutUrl}`;
  return { subject: c.subject, html, text };
}

// --- #7 customer: a provider company viewed the request (open-details model) ---
// Transparency-as-marketing: fired once per provider company, on their first
// authenticated open of provider-detail (the view-claim in pumppuRequestRoutes).
// Names the company; carries no provider contact details — the provider
// contacts the customer, not the other way around.
function customerProviderViewed(d, lang = "fi") {
  const c = copyFor(lang, "customerProviderViewed");
  const name = d.providerName || c.defaultProviderName;
  const subject = `${name}${c.subjectSuffix}`;
  const html = `<h2 style="margin:0 0 16px;font-size:22px;">${escapeHtml(name)}${c.headingSuffix}</h2>
<p style="margin:0 0 16px;"><strong>${escapeHtml(name)}</strong> ${c.interestedSuffix}</p>
<p style="margin:0 0 16px;">${c.body2}</p>${cta(d.valutUrl, c.cta)}`;
  const text = `${name} ${c.interestedSuffix}\n${c.textBody2}\n\n${d.valutUrl}`;
  return { subject, html, text };
}

module.exports = {
  formatEuroFromCents, formatPourTime, formatFiNumber, formatFiDate,
  wrapJerryLayout, wrapJerryText,
  providerNewRequest, customerNoSupply, customerOfferReceived,
  providerOfferAccepted, providerOfferRejected, customerProviderDeclined,
  customerPourConfirmed, customerProviderViewed,
};
