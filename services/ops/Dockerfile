# The ops service — one long-running Node process (AD-8): the duel room, the matchmaker, the projector,
# the settler, the maker and the keepers. Built from the repo root so the workspace packages it imports
# as TypeScript source are present; run through tsx exactly as `pnpm --filter @masayume/ops start` does.
#
#   fly deploy --config services/ops/fly.toml --dockerfile services/ops/Dockerfile .
#
# One instance only, ever: every actor is a single writer over its own key, and two copies of this image
# would race nonces (AD-4). fly.toml pins one machine that never auto-stops.
FROM node:22-slim AS runtime
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
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/markets/package.json ./packages/markets/
COPY services/ops/package.json ./services/ops/
RUN pnpm install --frozen-lockfile --filter "@masayume/ops..."

# The sources the service actually runs: its own, and the four packages it imports.
COPY packages/brain ./packages/brain
COPY packages/core ./packages/core
COPY packages/db ./packages/db
COPY packages/markets ./packages/markets
COPY services/ops ./services/ops

# The deck journal — the second copy of every sealed deck's reveal material — lives on the mounted volume.
ENV GAME_DECK_JOURNAL=/data/deck-journal.jsonl \
    GAME_ROOM_HOST=0.0.0.0 \
    GAME_ROOM_PORT=8787
EXPOSE 8787
CMD ["pnpm", "--filter", "@masayume/ops", "start"]
