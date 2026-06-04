// @ibetoni/jerry-client — pure offer-lifecycle logic shared by puminet4's
// /tarjouspyynnot and betonijerry's operator pages. No fetch, no React.
//
// Sources of truth ported here (keep in sync conceptually, not by import):
// - tab keys + counts shape: puminet5api PROVIDER_COUNTS_SQL / provider-list
// - won/ended derivation: puminet4 TarjouspyyntoDetailModal (2026-05-21 spec)
// - draft/locked + price bounds: puminet4 OfferForm / POST /offers validation

export const PROVIDER_TABS = [
    { key: "avoimet",    label: "Avoimet" },
    { key: "tarjotut",   label: "Tarjotut" },
    { key: "voitetut",   label: "Voitetut" },
    { key: "paattyneet", label: "Päättyneet" },
];

export const PROVIDER_TAB_KEYS = PROVIDER_TABS.map((t) => t.key);

export function normalizeCounts(counts) {
    return {
        avoimet:                Number(counts?.avoimet || 0),
        tarjotut:               Number(counts?.tarjotut || 0),
        voitetut:               Number(counts?.voitetut || 0),
        voitetutActionRequired: Number(counts?.voitetutActionRequired || 0),
        paattyneet:             Number(counts?.paattyneet || 0),
    };
}

// Mirrors POST /:id/offers backend validation (1..99_999_900).
export const MAX_PRICE_CENTS = 99_999_900;

/** @param {number|string} euros — decimal separator must be "."; normalise Finnish "7,50" input with .replace(",", ".") before calling. */
export function eurosToCents(euros) {
    return Math.round(Number(euros) * 100);
}

// Form-seed/display only: rounds to whole euros (matches OfferForm's historical seed).
export function centsToEuros(cents) {
    const n = Number(cents);
    return cents != null && Number.isFinite(n) ? String(Math.round(n / 100)) : "";
}

export function isSubmittablePrice(priceCents) {
    return Number.isFinite(priceCents) && priceCents > 0 && priceCents <= MAX_PRICE_CENTS;
}

// Default offer validity: +7 days on the caller's LOCAL calendar, formatted
// YYYY-MM-DD for <input type="date">. Local formatting (not toISOString)
// avoids the UTC off-by-one in the late-evening/early-night local window.
export function defaultValidUntil(now = new Date()) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
}

// Offer-level flags — usable with a component's *local* status state
// (which changes after save/send), independent of the request row.
export function isOfferDraft(status) {
    return status === "draft" || status == null;
}

export function isOfferLocked(status) {
    return status != null && status !== "draft" && status !== "pending";
}

// Provider-side offer-state labels (myOfferState on provider-list rows and
// pumppuOffer.status share the same vocabulary; "none" → null = no pill).
export const OFFER_STATE_LABELS_FI = {
    draft:     "Luonnos",
    pending:   "Tarjottu",
    accepted:  "Hyväksytty",
    confirmed: "Vahvistettu",
    rejected:  "Ei valittu",
    withdrawn: "Peruttu",
    expired:   "Vanhentunut",
};

export function offerStateLabel(state) {
    return OFFER_STATE_LABELS_FI[state] ?? null;
}

/**
 * Request-level lifecycle for the detail view.
 * @param {{ request: object|null, ownOffer: object|null, now?: Date }} args
 * @returns {{ isWon, isEnded, endedReasonLabel, isDraft, isOfferLocked: boolean }}
 */
export function deriveOfferLifecycle({ request, ownOffer, now = new Date() }) {
    // Known pumppuRequest statuses today: open | accepted | expired | no_supply.
    const ownOfferStatus = ownOffer?.status ?? null;
    const isWon = ownOfferStatus === "accepted" || ownOfferStatus === "confirmed";

    const reqStatus = request?.status;
    const reqExpiresAt = request?.expiresAt ? new Date(request.expiresAt) : null;
    const parentExpiredByTime =
        reqStatus === "open" && reqExpiresAt && reqExpiresAt.getTime() < now.getTime();
    const lostToOther = reqStatus === "accepted" && !isWon;
    const ownOfferEnded =
        ownOfferStatus === "rejected" || ownOfferStatus === "withdrawn" || ownOfferStatus === "expired";
    const isEnded = !isWon && (
        reqStatus === "expired" ||
        reqStatus === "no_supply" ||
        Boolean(parentExpiredByTime) ||
        ownOfferEnded ||
        lostToOther
    );

    let endedReasonLabel = null;
    if (isEnded) {
        if (ownOfferStatus === "rejected") endedReasonLabel = "Asiakas valitsi toisen tarjouksen";
        else if (ownOfferStatus === "withdrawn") endedReasonLabel = "Tarjous peruttu";
        else if (ownOfferStatus === "expired") endedReasonLabel = "Tarjous vanhentunut";
        else if (lostToOther) endedReasonLabel = "Asiakas valitsi toisen tarjouksen";
        else if (reqStatus === "no_supply") endedReasonLabel = "Toimittajaa ei löytynyt";
        else endedReasonLabel = "Tarjouspyyntö vanhentunut";
    }

    return {
        isWon,
        isEnded,
        endedReasonLabel,
        isDraft: isOfferDraft(ownOfferStatus),
        isOfferLocked: isOfferLocked(ownOfferStatus),
    };
}
