# drive-api — FUTURE (scope doc only, no code yet)

Purpose (future): Drive files ka backend — folders, files, sharing.

Karega (jab banega): file/folder metadata, R2 presigned
upload/download URL, sharing link create/revoke, password + expiry
(baad me), E2EE files (client encrypt, R2 me ciphertext — alag
security doc ke baad).

Nahi karega: file content ko API server se stream karna as default,
mail dekhna, chat chalana.

Dependencies (future): `packages/auth`, `packages/db` (drive
schema), `packages/api-contracts`, R2.

Deploy (future): Render ya VPS Docker, stateless API.
