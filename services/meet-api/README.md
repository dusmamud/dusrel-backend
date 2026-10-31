# meet-api — FUTURE (scope doc only, no code yet)

Purpose (future): Meet ka backend — room aur token, media nahi.

Karega (jab banega): room create/list, LiveKit token issue (JWT,
kam expiry), participant auth check.

Nahi karega: video/audio stream chalana, khud ka WebRTC SFU banana.
Media LiveKit SFU se hoga, jo VPS-only infra hai.

Dependencies (future): `packages/auth`, `packages/db` (meet
schema), `packages/api-contracts`, LiveKit server (infra).

Deploy (future): Render ya VPS Docker for API; LiveKit media
server VPS-only.
