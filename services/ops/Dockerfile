# The ops service — one long-running Node process (AD-8): the duel room, the matchmaker, the projector,
# the settler, the maker and the keepers. Built from the repo root.
#   build:   install the workspace, bundle the service's own TypeScript (it and every @agari package) to JavaScript
#            once (scripts/build.mjs), then `pnpm deploy` a production install.
#   runtime: the bundle, config/, the reply-card fonts and production node_modules, run by `node` as one process — it
#            was pnpm → sh → tsx → node, compiling TypeScript at runtime. The heap is capped under the container's limit.
#
#   fly deploy --config services/ops/fly.toml --dockerfile services/ops/Dockerfile .
#
# One instance only, ever: every actor is a single writer over its own key, and two copies of this image
# would race nonces (AD-4). fly.toml pins one machine that never auto-stops.
FROM node:22-slim AS build
ENV NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=1
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

WORKDIR /app

# The workspace's manifests first, every member's, so the lockfile's importer set matches and the install
# layer is cached until a dependency changes.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY web/package.json ./web/
COPY scripts/package.json ./scripts/
COPY packages/brain/package.json ./packages/brain/
COPY packages/clients/package.json ./packages/clients/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/markets/package.json ./packages/markets/
COPY services/ops/package.json ./services/ops/
RUN pnpm install --frozen-lockfile --filter "@agari/ops..."

# The sources the service actually runs: its own, and the five packages it imports. `clients` is the
# generated Codama client; packages/markets imports it, and leaving it out builds an image that dies on
# boot with ERR_MODULE_NOT_FOUND @agari/clients. The reference had no such package, so the port lost it.
COPY packages/brain ./packages/brain
COPY packages/clients ./packages/clients
COPY packages/core ./packages/core
COPY packages/db ./packages/db
COPY packages/markets ./packages/markets
COPY services/ops ./services/ops

# The check fails the build if the flat install holds a different version of a package than the bundle was built
# against (scripts/build.mjs --check).
RUN pnpm --filter @agari/ops build \
    && pnpm --filter @agari/ops deploy --prod --legacy --config.node-linker=hoisted /out \
    && node services/ops/scripts/build.mjs --check /out

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app/services/ops
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/config ./config
COPY --from=build /out/src/actors/x-relay/reply-card-assets ./src/actors/x-relay/reply-card-assets

# The deck journal — the second copy of every sealed deck's reveal material — lives on the mounted volume.
ENV GAME_DECK_JOURNAL=/data/deck-journal.jsonl \
    GAME_ROOM_HOST=0.0.0.0 \
    GAME_ROOM_PORT=8787
EXPOSE 8787
# The heap is set under the container's memory limit (Node sizes it from the container otherwise). ops ran at ~260 MB on
# 16 Oct; 1 GB is about four times that, under Coolify's 1.5 GB limit. Growth past it restarts ops instead of swapping
# the whole 8 GB host.
CMD ["node", "--max-old-space-size=1024", "--import", "./dist/bundle/register.mjs", "dist/bundle/main.mjs"]
