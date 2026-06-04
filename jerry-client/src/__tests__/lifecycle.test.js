import { describe, it, expect } from "vitest";
import {
    PROVIDER_TABS, PROVIDER_TAB_KEYS, normalizeCounts,
    deriveOfferLifecycle, isOfferDraft, isOfferLocked,
    eurosToCents, centsToEuros, isSubmittablePrice,
    defaultValidUntil, offerStateLabel,
} from "../lifecycle.js";

describe("tabs + counts", () => {
    it("exposes the four provider tabs in order", () => {
        expect(PROVIDER_TAB_KEYS).toEqual(["avoimet", "tarjotut", "voitetut", "paattyneet"]);
        expect(PROVIDER_TABS.find((t) => t.key === "paattyneet").label).toBe("Päättyneet");
    });
    it("normalizeCounts fills all five keys with numbers", () => {
        expect(normalizeCounts()).toEqual({
            avoimet: 0, tarjotut: 0, voitetut: 0, voitetutActionRequired: 0, paattyneet: 0,
        });
        expect(normalizeCounts({ avoimet: "3", voitetutActionRequired: 1 }).avoimet).toBe(3);
    });
});

describe("price helpers", () => {
    it("round-trips euros and cents", () => {
        expect(eurosToCents("750")).toBe(75000);
        expect(centsToEuros(80000)).toBe("800");
        expect(centsToEuros(null)).toBe("");
    });
    it("isSubmittablePrice bounds 1..99_999_900", () => {
        expect(isSubmittablePrice(0)).toBe(false);
        expect(isSubmittablePrice(1)).toBe(true);
        expect(isSubmittablePrice(99_999_900)).toBe(true);
        expect(isSubmittablePrice(99_999_901)).toBe(false);
        expect(isSubmittablePrice(NaN)).toBe(false);
    });
    it("defaultValidUntil is now + 7 days as YYYY-MM-DD", () => {
        expect(defaultValidUntil(new Date("2026-06-04T10:00:00Z"))).toBe("2026-06-11");
    });
});

describe("offer status flags", () => {
    it("draft when null or draft", () => {
        expect(isOfferDraft(null)).toBe(true);
        expect(isOfferDraft("draft")).toBe(true);
        expect(isOfferDraft("pending")).toBe(false);
    });
    it("locked once final", () => {
        expect(isOfferLocked(null)).toBe(false);
        expect(isOfferLocked("pending")).toBe(false);
        expect(isOfferLocked("accepted")).toBe(true);
        expect(isOfferLocked("rejected")).toBe(true);
    });
});

describe("deriveOfferLifecycle", () => {
    const NOW = new Date("2026-06-04T10:00:00Z");
    const open = { status: "open", expiresAt: "2026-06-10T00:00:00Z" };

    it("won when own offer accepted or confirmed", () => {
        const r = deriveOfferLifecycle({ request: { status: "accepted" }, ownOffer: { status: "accepted" }, now: NOW });
        expect(r.isWon).toBe(true);
        expect(r.isEnded).toBe(false);
    });
    it("lost to other provider", () => {
        const r = deriveOfferLifecycle({ request: { status: "accepted" }, ownOffer: { status: "pending" }, now: NOW });
        expect(r.isEnded).toBe(true);
        expect(r.endedReasonLabel).toBe("Asiakas valitsi toisen tarjouksen");
    });
    it("parent expired by time while open", () => {
        const r = deriveOfferLifecycle({
            request: { status: "open", expiresAt: "2026-06-01T00:00:00Z" },
            ownOffer: null, now: NOW,
        });
        expect(r.isEnded).toBe(true);
        expect(r.endedReasonLabel).toBe("Tarjouspyyntö vanhentunut");
    });
    it("own offer withdrawn / expired / rejected labels", () => {
        expect(deriveOfferLifecycle({ request: open, ownOffer: { status: "withdrawn" }, now: NOW }).endedReasonLabel).toBe("Tarjous peruttu");
        expect(deriveOfferLifecycle({ request: open, ownOffer: { status: "expired" }, now: NOW }).endedReasonLabel).toBe("Tarjous vanhentunut");
        expect(deriveOfferLifecycle({ request: open, ownOffer: { status: "rejected" }, now: NOW }).endedReasonLabel).toBe("Asiakas valitsi toisen tarjouksen");
    });
    it("no_supply label", () => {
        const r = deriveOfferLifecycle({ request: { status: "no_supply" }, ownOffer: null, now: NOW });
        expect(r.endedReasonLabel).toBe("Toimittajaa ei löytynyt");
    });
    it("live open request is neither won nor ended", () => {
        const r = deriveOfferLifecycle({ request: open, ownOffer: { status: "pending" }, now: NOW });
        expect(r).toMatchObject({ isWon: false, isEnded: false, endedReasonLabel: null, isDraft: false });
    });
});

describe("offerStateLabel", () => {
    it("maps provider offer states to Finnish", () => {
        expect(offerStateLabel("pending")).toBe("Tarjottu");
        expect(offerStateLabel("confirmed")).toBe("Vahvistettu");
        expect(offerStateLabel("none")).toBe(null);
    });
});
