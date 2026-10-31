# mail-api — Dockerfile (v1 slice)
#
# Node 24 + pnpm 12, workspace build. v1 me single-stage image hai
# (auth-api ke Dockerfile wali hi baat: sahi hona pehle, chhota
# hona baad me; pnpm deploy / multi-stage runner agle step me).
#
# Run: docker compose (services/mail-server/docker-compose.yml) se,
# ya repo root se: docker build -f services/mail-api/Dockerfile
#   -t dusrel-mail-api . && docker run -p 3002:3002
#   -e MAIL_JWT_SECRET=... dusrel-mail-api
# (Build context repo root hona chahiye, service folder nahi.)
# MAIL_JWT_SECRET wahi hona chahiye jo auth-api me AUTH_JWT_SECRET
# hai, warna mail-api tokens verify nahi karega.

FROM node:24-slim

ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config ./packages/config
COPY packages/utils ./packages/utils
COPY packages/auth ./packages/auth
COPY packages/address ./packages/address
COPY packages/api-contracts ./packages/api-contracts
COPY packages/db ./packages/db
COPY services/mail-api ./services/mail-api

RUN pnpm install --frozen-lockfile
# Sirf service ka build kaafi NAHI hai (auth-api wali hi baat):
# deps ki dist/ gitignored hai, fresh image me pehle deps build
# hone chahiye warna TS2307 se build fail hota hai. pnpm -r build
# CI wali hi order me sab build karta hai.
RUN pnpm -r build

WORKDIR /app/services/mail-api
EXPOSE 3002
CMD ["node", "dist/src/index.js"]
