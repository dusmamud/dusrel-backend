# chat-api — FUTURE (scope doc only, no code yet)

Purpose (future): Chat ka backend — rooms, messages, presence.

Karega (jab banega): WebSocket connections, room/message handling,
media ke liye R2 presigned URL pattern.

Nahi karega: apna custom chat crypto banana (E2EE ke liye standard
protocol baad me evaluate hoga), files ka storage khud chalana.

Dependencies (future): `packages/auth`, `packages/db` (chat
schema), `packages/api-contracts`.

Deploy (future): Persistent service — VPS ya Render Web Service.
Workers par long-lived socket ka dawa nahi karna.
