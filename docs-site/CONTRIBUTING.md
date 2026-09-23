# Contributing to Agari Docs

This Fumadocs site lives at `docs-site/` inside the Agari app repository. The app source it documents is the rest of the same checkout; `integration/w1` is the branch that deploys. Read the app's `docs/plan/STATUS.md`, current stage and decisions before changing product claims.

## Local work

Use Node.js 22+ and pnpm 11.24:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
pnpm check
```

The docs app runs on port 3153. `NEXT_PUBLIC_DOCS_URL` sets canonical and sitemap URLs; it defaults to the public `https://docs.useagari.xyz`. `NEXT_PUBLIC_APP_URL` sets external app links and may point to the public app or a local dev server.

`pnpm check` reads the app from the parent directory (`AGARI_SOURCE_DIR` overrides it). The one pin is `revision` in `lib/site.ts`: the check fails if that commit is missing or not an ancestor of `HEAD`, and warns with the app commits made since it. When the app advances, read those commits, their code and acceptance evidence, update the affected guides, then advance `revision` (and `reviewed`). Do not advance the pin just to silence the warning.

## Update a guide

1. Edit `content/docs/**/*.mdx` and add new pages to their folder's `meta.json`.
2. Trace behavior to the application code, decision and acceptance ledger. The [source map](content/docs/builders/source-map.mdx) is the starting inventory; verify the exact files for the page you change.
3. Keep devnet calls, paper desk practice, mainnet-fork rehearsal and mainnet transactions distinct. A route or build is not proof of a live transaction.
4. Link docs pages with `/section/page` paths and app routes with `<AppLink href="/route">`. Run `pnpm check`, then inspect changed pages at desktop and phone sizes.
5. Record any new screenshot or video in `public/captures/provenance-YYYY-MM-DD.json`: route, date, viewport, wallet/network state and what was actually exercised. Never copy Masayume's media into Agari's pages.

The `GuideCapture` component expands an original capture and states its signed-out condition. `TourVideo` provides captions, chapters and a transcript. The current clip is a silent edit of actual public screenshots. A continuous recording of a connected-wallet trade still needs its own consent, capture and transaction proof; do not label this tour as one.

## Deployment

The docs deploy to Coolify (application `agari-docs` in the `agari` project) from `integration/w1`, built by `docs-site/Dockerfile` and served at `https://docs.useagari.xyz`. After a deploy, verify the root, a nested guide, search, video/captions, theme and sitemap at that URL.
