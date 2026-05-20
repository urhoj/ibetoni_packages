// @ibetoni/messaging-ui — shared chat/message-thread React components.
// Consumed by puminet4 (provider-side, in TarjouspyyntoDetailModal) and
// betonijerry (customer-side, in OfferCard's chat dialog).
//
// Re-export only the public surface so tree-shaking can drop everything else.

export { default as MessageThread } from "./MessageThread.jsx";
