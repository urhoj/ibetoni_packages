// Shared message-append dedupe for both delivery paths (poll + socket).
//
// Dedupe by messageId is load-bearing on the poll path: the ?since= bookmark
// is millisecond-truncated (JS Date / JSON) while message.createdAt is
// DATETIME2(7), so `createdAt > @since` re-returns the last message(s) on
// every poll. Without this filter the thread grows by a duplicate each cycle.
// The socket path needs the same guard for a message that arrives both via
// the optimistic append and the broadcast.
//
// Returns `prev` unchanged (same reference) when nothing is new, so a React
// setState with this result is a no-op re-render-wise.
export function appendUnique(prev, incoming) {
    const seen = new Set(prev.map((m) => m.messageId));
    const fresh = incoming.filter((m) => !seen.has(m.messageId));
    return fresh.length ? [...prev, ...fresh] : prev;
}
