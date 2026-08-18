// Pure content builders + formatters for BetoniJerry transactional emails.
// No I/O, no transport, no database — the sender (puminet5api's
// modules/betonijerry/jerryEmail.js) wraps these with the brand layout and the
// demo disclaimer, and owns the SendGrid category.
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

// Shared brand chrome. `disclaimerHtml` (demo banner) is injected by jerryEmail.
function wrapJerryLayout(contentHtml, disclaimerHtml = "", lang = "fi") {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="${normalizeLang(lang)}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f5f5f5;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f5f5;"><tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,.07);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);padding:36px 30px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:30px;font-weight:700;">BetoniJerry</h1></td></tr>
<tr><td style="padding:40px;color:#1a202c;font-size:16px;line-height:1.6;">${disclaimerHtml}${contentHtml}</td></tr>
<tr><td style="background:#FEF9E7;padding:28px 40px;text-align:center;border-top:1px solid #f0e6c8;">
<p style="margin:0;color:#a0aec0;font-size:11px;">© ${year} BetoniJerry</p></td></tr>
</table></td></tr></table></body></html>`;
}

function wrapJerryText(contentText, disclaimerText = "") {
  return `BetoniJerry\n\n${disclaimerText}${contentText}\n\n— BetoniJerry`;
}

function cta(url, label) {
  return `<p style="margin:28px 0 0 0;"><a href="${url}" style="background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

// --- #1 provider: new request (masked, NO customer PII) ---
function providerNewRequest(d, lang = "fi") {
  const c = copyFor(normalizeLang(lang), "providerNewRequest");
  const lines = [
    `<strong>${c.labels.kayttokohde}:</strong> ${escapeHtml(d.kayttokohde || "—")}`,
    `<strong>${c.labels.maara}:</strong> ${escapeHtml(d.totalM3)} m³`,
    d.pumppuAika ? `<strong>${c.labels.pumppausaika}:</strong> ${escapeHtml(d.pumppuAika)}` : null,
    `<strong>${c.labels.sijainti}:</strong> ${escapeHtml(d.maskedAddress || "—")}`,
    d.requiredPuomi ? `<strong>${c.labels.puomi}:</strong> ${escapeHtml(d.requiredPuomi)} m` : null,
    d.requiredLinja ? `<strong>${c.labels.linja}:</strong> ${escapeHtml(d.requiredLinja)} m` : null,
  ].filter(Boolean).map((l) => `<p style="margin:6px 0;">${l}</p>`).join("");
  const html = `<h2 style="margin:0 0 16px;font-size:22px;">${c.heading}</h2>
<p style="margin:0 0 16px;">${c.intro}</p>${lines}${cta(d.operatorUrl, c.cta)}`;
  // text/plain mirrors the HTML order (heading → intro → details → CTA). It
  // used to substitute the one-line `c.contactHint` for `c.intro`, so the two
  // MIME parts said materially different things: the HTML carried the pricing-
  // privacy guarantee and the call to quote, the text part carried neither.
  // `c.contactHint` is left defined in ./copy.js — unused here now, but
  // the in-flight English tier-1 plan still references it.
  const text = `${c.heading}.\n\n${c.intro}\n\n${c.labels.kayttokohde}: ${d.kayttokohde || "—"}\n${c.labels.maara}: ${d.totalM3} m³\n${c.labels.sijainti}: ${d.maskedAddress || "—"}\n\n${c.ctaTextPrefix}: ${d.operatorUrl}`;
  return { subject: c.subject, html, text };
}

// --- #2 customer: no providers found ---
function customerNoSupply(d, lang = "fi") {
  const c = copyFor(normalizeLang(lang), "customerNoSupply");
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
  const c = copyFor(normalizeLang(lang), "providerOfferAccepted");
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
  const c = copyFor(normalizeLang(lang), "providerOfferRejected");
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
  const c = copyFor(normalizeLang(lang), "customerProviderDeclined");
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
  const c = copyFor(normalizeLang(lang), "customerProviderViewed");
  const name = d.providerName || c.defaultProviderName;
  const subject = `${name}${c.subjectSuffix}`;
  const html = `<h2 style="margin:0 0 16px;font-size:22px;">${escapeHtml(name)}${c.headingSuffix}</h2>
<p style="margin:0 0 16px;"><strong>${escapeHtml(name)}</strong> ${c.interestedSuffix}</p>
<p style="margin:0 0 16px;">${c.body2}</p>${cta(d.valutUrl, c.cta)}`;
  const text = `${name} ${c.interestedSuffix}\n${c.textBody2}\n\n${d.valutUrl}`;
  return { subject, html, text };
}

module.exports = {
  formatEuroFromCents, formatPourTime, wrapJerryLayout, wrapJerryText,
  providerNewRequest, customerNoSupply, customerOfferReceived,
  providerOfferAccepted, providerOfferRejected, customerProviderDeclined,
  customerPourConfirmed, customerProviderViewed,
};
