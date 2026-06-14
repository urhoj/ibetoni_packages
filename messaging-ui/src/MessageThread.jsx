// @ibetoni/messaging-ui — MessageThread
//
// Self-contained chat thread renderer shared by puminet4 (provider-side
// inside TarjouspyyntoDetailModal) and betonijerry (customer-side inside
// OfferCard's chat dialog). Both apps pass their own auth token, API
// base URL, and (optionally) a Socket.IO client — the component never
// imports app-specific globals.
//
// Behaviour:
// - On mount, fetch full message list via REST.
// - Listen to `message:new` on the passed `socket` (if any) and append.
// - If no socket, poll the REST endpoint every 8 s while mounted.
// - Composer sends via POST; optimistic append on success.
// - Auto-scroll to bottom on new message, both incoming and outgoing.
// - On mount + each new message arrival, POST /:threadId/read so the unread
//   badge clears.
//
// Spec: docs/superpowers/specs/2026-05-20-tarjous-messaging-design.md §7 + §9

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert, Avatar, Box, CircularProgress, IconButton, Stack, TextField, Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import PropTypes from "prop-types";

const POLL_INTERVAL_MS = 8000;
const PROFILE_INITIALS_RE = /\b([A-ZÅÄÖ])/g;

function initialsFrom(name) {
    if (!name) return "?";
    const m = name.match(PROFILE_INITIALS_RE);
    return (m ? m.slice(0, 2).join("") : name.slice(0, 2)).toUpperCase();
}

function formatTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("fi-FI", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function MessageThread({
    threadId, currentPersonId, token, apiBaseUrl, socket = null,
    height = 480,
}) {
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const listRef = useRef(null);
    const lastSeenIsoRef = useRef(null);

    const authHeaders = useMemo(
        () => (token ? { Authorization: `Bearer ${token}` } : {}),
        [token],
    );

    // Pull initial messages + bookmark the latest createdAt for delta polling.
    const fetchAll = useCallback(async () => {
        if (!threadId) return;
        setLoading(true);
        try {
            const res = await fetch(
                `${apiBaseUrl}/api/messages/threads/${threadId}/messages?limit=500`,
                { headers: authHeaders },
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const list = await res.json();
            setMessages(Array.isArray(list) ? list : []);
            const last = Array.isArray(list) && list.length ? list[list.length - 1].createdAt : null;
            if (last) lastSeenIsoRef.current = last;
        } catch (e) {
            setError(e.message || "Lataus epäonnistui");
        } finally {
            setLoading(false);
        }
    }, [threadId, apiBaseUrl, authHeaders]);

    // Delta pull — used by polling when no socket is available.
    const fetchSince = useCallback(async () => {
        if (!threadId || !lastSeenIsoRef.current) return;
        try {
            const res = await fetch(
                `${apiBaseUrl}/api/messages/threads/${threadId}/messages?since=${encodeURIComponent(lastSeenIsoRef.current)}`,
                { headers: authHeaders },
            );
            if (!res.ok) return;
            const newer = await res.json();
            if (Array.isArray(newer) && newer.length) {
                setMessages((prev) => {
                    // Dedupe by messageId. The ?since= bookmark is millisecond-
                    // truncated (JS Date / JSON) while message.createdAt is
                    // DATETIME2(7), so `createdAt > @since` re-returns the last
                    // message(s) on every poll. Without this filter the thread
                    // grows by a duplicate each cycle (the socket path already
                    // dedupes the same way).
                    const seen = new Set(prev.map((m) => m.messageId));
                    const fresh = newer.filter((m) => !seen.has(m.messageId));
                    return fresh.length ? [...prev, ...fresh] : prev;
                });
                lastSeenIsoRef.current = newer[newer.length - 1].createdAt;
            }
        } catch {
            // silent — next poll retries
        }
    }, [threadId, apiBaseUrl, authHeaders]);

    // Mark thread read — fire-and-forget.
    const markRead = useCallback(() => {
        if (!threadId) return;
        fetch(`${apiBaseUrl}/api/messages/threads/${threadId}/read`, {
            method: "POST",
            headers: { ...authHeaders, "Content-Type": "application/json" },
        }).catch(() => {});
    }, [threadId, apiBaseUrl, authHeaders]);

    // Initial load — wrapped so react-hooks/set-state-in-effect doesn't
    // flag the synchronous setLoading inside fetchAll.
    useEffect(() => {
        async function run() {
            await fetchAll();
            markRead();
        }
        run();
    }, [fetchAll, markRead]);

    // Live updates: socket if available, polling otherwise.
    useEffect(() => {
        if (!threadId) return undefined;
        if (socket) {
            const handler = (payload) => {
                if (payload?.threadId !== threadId) return;
                setMessages((prev) => {
                    if (prev.some((m) => m.messageId === payload.message.messageId)) return prev;
                    return [...prev, payload.message];
                });
                lastSeenIsoRef.current = payload.message.createdAt;
                markRead();
            };
            socket.on("message:new", handler);
            return () => socket.off("message:new", handler);
        }
        const id = setInterval(fetchSince, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [threadId, socket, fetchSince, markRead]);

    // Auto-scroll to bottom whenever messages change.
    useEffect(() => {
        const el = listRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages]);

    const handleSend = async () => {
        const body = draft.trim();
        if (!body || sending) return;
        setSending(true);
        setError(null);
        try {
            const res = await fetch(
                `${apiBaseUrl}/api/messages/threads/${threadId}/messages`,
                {
                    method: "POST",
                    headers: { ...authHeaders, "Content-Type": "application/json" },
                    body: JSON.stringify({ body }),
                },
            );
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody.message || `HTTP ${res.status}`);
            }
            const created = await res.json();
            setMessages((prev) => [...prev, created]);
            lastSeenIsoRef.current = created.createdAt;
            setDraft("");
        } catch (e) {
            setError(e.message || "Viestin lähetys epäonnistui");
        } finally {
            setSending(false);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!threadId) {
        return (
            <Alert severity="info">
                Keskustelu avautuu kun tarjousluonnos on tallennettu.
            </Alert>
        );
    }

    return (
        <Stack spacing={1} sx={{ height, display: "flex" }}>
            <Box
                ref={listRef}
                sx={{
                    flex: 1,
                    overflowY: "auto",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    p: 1.5,
                    bgcolor: "background.default",
                    minHeight: 200,
                }}
            >
                {loading && <CircularProgress size={20} />}
                {!loading && messages.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                        Ei viestejä vielä. Aloita keskustelu alla olevasta kentästä.
                    </Typography>
                )}
                <Stack spacing={1.5}>
                    {messages.map((m) => {
                        const isMine = m.senderPersonId === currentPersonId;
                        const isSystem = m.kind === "system";
                        if (isSystem) {
                            return (
                                <Typography
                                    key={m.messageId}
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ textAlign: "center", fontStyle: "italic" }}
                                >
                                    {m.body} · {formatTime(m.createdAt)}
                                </Typography>
                            );
                        }
                        const fullName = `${m.personFirstName || ""} ${m.personLastName || ""}`.trim();
                        return (
                            <Stack
                                key={m.messageId}
                                direction={isMine ? "row-reverse" : "row"}
                                spacing={1}
                                sx={{ alignItems: "flex-end" }}
                            >
                                <Avatar sx={{ width: 28, height: 28, fontSize: "0.75rem" }}>
                                    {initialsFrom(fullName || m.senderAsiakasNimi)}
                                </Avatar>
                                <Box
                                    sx={{
                                        maxWidth: "75%",
                                        bgcolor: isMine ? "primary.main" : "action.hover",
                                        color: isMine ? "primary.contrastText" : "text.primary",
                                        borderRadius: 2,
                                        px: 1.5,
                                        py: 0.75,
                                    }}
                                >
                                    <Typography variant="caption" sx={{ display: "block", opacity: 0.85 }}>
                                        {fullName || "?"}{m.senderAsiakasNimi ? ` · ${m.senderAsiakasNimi}` : ""}
                                    </Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                        {m.body}
                                    </Typography>
                                    <Typography variant="caption" sx={{ display: "block", opacity: 0.65, mt: 0.25 }}>
                                        {formatTime(m.createdAt)}
                                    </Typography>
                                </Box>
                            </Stack>
                        );
                    })}
                </Stack>
            </Box>

            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

            <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
                <TextField
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Kirjoita viesti… (Enter lähettää, Shift+Enter rivinvaihto)"
                    multiline
                    maxRows={4}
                    fullWidth
                    size="small"
                    disabled={sending}
                />
                <IconButton
                    color="primary"
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    aria-label="Lähetä viesti"
                >
                    <SendIcon />
                </IconButton>
            </Stack>
        </Stack>
    );
}

MessageThread.propTypes = {
    threadId: PropTypes.number,
    currentPersonId: PropTypes.number.isRequired,
    token: PropTypes.string.isRequired,
    apiBaseUrl: PropTypes.string.isRequired,
    socket: PropTypes.object,
    height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
