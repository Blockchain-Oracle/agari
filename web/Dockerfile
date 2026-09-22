# The web app — Next.js 16 built from the repo root, so the workspace packages it imports as TypeScript source are
# present, and started exactly as `pnpm --filter web start` does.
#
#   docker build -f web/Dockerfile .
#
# Layered for the deploy train (S16): the install layer is keyed on the manifests and the lockfile alone, so a
# code-only push reuses it; the pnpm store and Next's compiler cache persist between builds as BuildKit cache
# mounts. Nixpacks rebuilt its Nix environment and re-downloaded every package on every deploy, which on a
# 2-vCPU host was twenty minutes before a line of Agari was compiled.
FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
WORKDIR /app

# Every workspace member's manifest, so the lockfile's importer set matches and this layer is cached until a
# dependency changes.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY web/package.json ./web/
COPY scripts/package.json ./scripts/
COPY packages/brain/package.json ./packages/brain/
COPY packages/clients/package.json ./packages/clients/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/markets/package.json ./packages/markets/
COPY services/ops/package.json ./services/ops/
RUN --mount=type=cache,id=agari-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "web..."

# The sources. `.dockerignore` keeps node_modules, .next, data and the reference out of the context. Web reads
# beyond its own tree at build and at request time: the packages, `scripts/deploy/addresses.devnet.json`,
# `services/ops/config` and a few ops modules, so the tree comes whole rather than as a list that goes stale.
COPY . .

# `NEXT_PUBLIC_*` values are inlined here, so the deploy passes them as build arguments (Coolify injects every
# build-time variable as an ARG in front of this line).
RUN --mount=type=cache,id=agari-next-cache,target=/app/web/.next/cache \
    pnpm --filter web build

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
