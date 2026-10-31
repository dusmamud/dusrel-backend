# auth-api — Dockerfile (v1 slice)
#
# Node 24 + pnpm 12, workspace build. v1 me single-stage image hai
# (install + build + run ek hi image me) — sahi hona pehle, chhota
# hona baad me. Image size optimize karna (pnpm deploy / multi-stage
# runner) agle tooling step me hoga.
#
# Run: docker compose (services/mail-server/docker-compose.yml) se,
# ya repo root se: docker build -f services/auth-api/Dockerfile
#   -t dusrel-auth-api . && docker run -p 3001:3001
#   -e AUTH_JWT_SECRET=... dusrel-auth-api
# (Build context repo root hona chahiye, service folder nahi.)
# Production me AUTH_JWT_SECRET env se hi do, image me kabhi mat dalo.

FROM node:24-slim

ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

WORKDIR /app

# Workspace root files (pnpm workspaces ko root package.json +
# lockfile + workspace file chahiye, warna workspace links nahi banenge).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config ./packages/config
COPY packages/utils ./packages/utils
COPY packages/auth ./packages/auth
COPY packages/api-contracts ./packages/api-contracts
COPY packages/db ./packages/db
COPY services/auth-api ./services/auth-api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @dusrel/auth-api build

WORKDIR /app/services/auth-api
EXPOSE 3001
CMD ["node", "dist/src/index.js"]
