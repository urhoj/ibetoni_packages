# @ibetoni/messaging-ui

Shared chat / message-thread React components used by `puminet4` (provider-side, mounted in `TarjouspyyntoDetailModal`) and `betonijerry` (customer-side, mounted in `OfferCard`'s chat dialog).

## Exports

- `MessageThread` — list + composer + optional Socket.IO live updates / 8-second polling fallback. App-agnostic: takes `threadId`, `currentPersonId`, `token`, `apiBaseUrl`, and an optional `socket`.

## Usage

```jsx
import { MessageThread } from "@ibetoni/messaging-ui";

<MessageThread
    threadId={42}
    currentPersonId={user.personId}
    token={token}
    apiBaseUrl={import.meta.env.VITE_SERVER_URL}
    socket={socket} // optional — falls back to polling
    height={420}
/>
```

The backend REST endpoints the component consumes live at `/api/messages/threads/*` in `puminet5api/routes/messageRoutes.js`.

## Peer dependencies

`react`, `@mui/material`, `@mui/icons-material`, `prop-types`. The consuming app supplies all of them.

## Spec

`docs/superpowers/specs/2026-05-20-tarjous-messaging-design.md` (workspace root).
