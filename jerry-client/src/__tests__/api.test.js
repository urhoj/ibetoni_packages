import { describe, it, expect, vi } from "vitest";
import { createTarjouspyyntoApi } from "../api.js";

function mockTransport() {
    return { query: vi.fn(() => Promise.resolve(null)), mutate: vi.fn(() => Promise.resolve({ success: true, data: {} })) };
}

describe("createTarjouspyyntoApi", () => {
    it("builds provider-list path with encoded tab", async () => {
        const t = mockTransport();
        await createTarjouspyyntoApi(t).listProviderRequests("tarjotut");
        expect(t.query).toHaveBeenCalledWith(
            "/api/pumppuRequests/provider-list?tab=tarjotut", { fallback: null });
    });
    it("defaults tab to avoimet", async () => {
        const t = mockTransport();
        await createTarjouspyyntoApi(t).listProviderRequests();
        expect(t.query.mock.calls[0][0]).toBe("/api/pumppuRequests/provider-list?tab=avoimet");
    });
    it("counts, detail, attachments are GET paths", async () => {
        const t = mockTransport();
        const api = createTarjouspyyntoApi(t);
        await api.getProviderCounts();
        await api.getProviderDetail(42);
        await api.listOfferAttachments(7);
        expect(t.query.mock.calls.map((c) => c[0])).toEqual([
            "/api/pumppuRequests/provider-counts",
            "/api/pumppuRequests/42/provider-detail",
            "/api/attachments/pumppuOffer/list/7",
        ]);
        expect(t.query.mock.calls[2][1]).toEqual({ fallback: [] });
    });
    it("submitOffer POSTs the body; sendOffer POSTs empty body", async () => {
        const t = mockTransport();
        const api = createTarjouspyyntoApi(t);
        await api.submitOffer(42, { priceCents: 75000 });
        await api.sendOffer(42, 555);
        expect(t.mutate).toHaveBeenNthCalledWith(1,
            "/api/pumppuRequests/42/offers", { method: "POST", body: { priceCents: 75000 } });
        expect(t.mutate).toHaveBeenNthCalledWith(2,
            "/api/pumppuRequests/42/offers/555/send", { method: "POST", body: {} });
    });
    it("confirmOffer + settings round out the catalog", async () => {
        const t = mockTransport();
        const api = createTarjouspyyntoApi(t);
        await api.confirmOffer(42, 555, { scheduledAt: "2026-06-10T08:00:00Z" });
        await api.getJerryProviderSettings();
        await api.saveJerryProviderSettings({ maintainsOrderInfo: true });
        expect(t.mutate).toHaveBeenNthCalledWith(1,
            "/api/pumppuRequests/42/offers/555/confirm",
            { method: "POST", body: { scheduledAt: "2026-06-10T08:00:00Z" } });
        expect(t.query).toHaveBeenCalledWith("/api/jerry-provider-settings", { fallback: null });
        expect(t.mutate).toHaveBeenNthCalledWith(2,
            "/api/jerry-provider-settings", { method: "PUT", body: { maintainsOrderInfo: true } });
    });
    it("throws on missing ids instead of building /undefined/ paths", () => {
        const t = mockTransport();
        const api = createTarjouspyyntoApi(t);
        expect(() => api.getProviderDetail(undefined)).toThrow(/pumppuRequestId/);
        expect(() => api.sendOffer(42, null)).toThrow(/pumppuOfferId/);
        expect(t.query).not.toHaveBeenCalled();
        expect(t.mutate).not.toHaveBeenCalled();
    });
});
