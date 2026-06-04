// Endpoint catalog for the provider-side tarjouspyyntö surface.
// The transport is INJECTED so each FE keeps its own auth/error/telemetry stack:
//
//   transport = {
//     query:  (path, { fallback }) => Promise<data>,   // GET. MAY throw (betonijerry)
//                                                      // or resolve `fallback` on error (puminet4).
//     mutate: (path, { method, body }) => Promise<{ success, error?, data }>,
//   }
//
// This file owns path building + body shaping for BOTH frontends — a wire-shape
// change is a one-file edit here.

// Programmer-error guard: an undefined/null id would otherwise build
// silent "/undefined/" paths. Fail fast instead.
const reqd = (v, name) => {
    if (v == null) throw new TypeError(`${name} required`);
    return v;
};

export function createTarjouspyyntoApi({ query, mutate }) {
    return {
        listProviderRequests: (tab = "avoimet") =>
            query(`/api/pumppuRequests/provider-list?tab=${encodeURIComponent(tab)}`, { fallback: null }),

        getProviderCounts: () =>
            query("/api/pumppuRequests/provider-counts", { fallback: null }),

        getProviderDetail: (pumppuRequestId) =>
            query(`/api/pumppuRequests/${reqd(pumppuRequestId, "pumppuRequestId")}/provider-detail`, { fallback: null }),

        submitOffer: (pumppuRequestId, body) =>
            mutate(`/api/pumppuRequests/${reqd(pumppuRequestId, "pumppuRequestId")}/offers`, { method: "POST", body }),

        sendOffer: (pumppuRequestId, pumppuOfferId) =>
            mutate(`/api/pumppuRequests/${reqd(pumppuRequestId, "pumppuRequestId")}/offers/${reqd(pumppuOfferId, "pumppuOfferId")}/send`, { method: "POST", body: {} }),

        confirmOffer: (pumppuRequestId, pumppuOfferId, body) =>
            mutate(`/api/pumppuRequests/${reqd(pumppuRequestId, "pumppuRequestId")}/offers/${reqd(pumppuOfferId, "pumppuOfferId")}/confirm`, { method: "POST", body }),

        listOfferAttachments: (pumppuOfferId) =>
            query(`/api/attachments/pumppuOffer/list/${reqd(pumppuOfferId, "pumppuOfferId")}`, { fallback: [] }),

        getJerryProviderSettings: () =>
            query("/api/jerry-provider-settings", { fallback: null }),

        saveJerryProviderSettings: (body) =>
            mutate("/api/jerry-provider-settings", { method: "PUT", body }),
    };
}
