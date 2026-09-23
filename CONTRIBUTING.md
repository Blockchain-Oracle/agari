# Contributing to Agari Docs

This is a separate Fumadocs repository. The application source reviewed for these pages is `/Users/abu/dev/hackathon/agari-wt/w1` on `integration/w1`. Do not use the older `stocklana/main` checkout as current behavior. Read the app's `docs/plan/STATUS.md`, current stage and decisions before changing product claims.

## Local work

Use Node.js 22+ and pnpm 11.24:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
pnpm check
```

The docs app runs on port 3153. `NEXT_PUBLIC_DOCS_URL` sets canonical and sitemap URLs; use the local origin until the docs deployment is verified. `NEXT_PUBLIC_APP_URL` sets external app links and may point to the public app or a local dev server.

`pnpm check` requires the sibling Agari checkout at the pinned revision. Set `AGARI_SOURCE_DIR` if it is elsewhere. If the app advances, fetch and read its new STATUS, diff, relevant consumers and acceptance evidence before changing the revision in `lib/site.ts`, `scripts/check-content.mjs`, the source-map page and README. Do not update a pin just to turn the check green.

## Update a guide

1. Edit `content/docs/**/*.mdx` and add new pages to their folder's `meta.json`.
2. Trace behavior to the application code, decision and acceptance ledger. The [source map](content/docs/builders/source-map.mdx) is the starting inventory; verify the exact files for the page you change.
3. Keep devnet calls, paper desk practice, mainnet-fork rehearsal and mainnet transactions distinct. A route or build is not proof of a live transaction.
4. Link docs pages with `/section/page` paths and app routes with `<AppLink href="/route">`. Run `pnpm check`, then inspect changed pages at desktop and phone sizes.
5. Record any new screenshot or video in `public/captures/provenance-YYYY-MM-DD.json`: route, date, viewport, wallet/network state and what was actually exercised. Never copy Masayume's media into Agari's pages.

The `GuideCapture` component expands an original capture and states its signed-out condition. `TourVideo` provides captions, chapters and a transcript. The current clip is a silent edit of actual public screenshots. A continuous recording of a connected-wallet trade still needs its own consent, capture and transaction proof; do not label this tour as one.

## Deployment

This checkout had no Git remote and no verified docs URL at the 23 September review. The user previously approved a separate docs project on the app's docs subdomain; the exact domain and deployment are still separate steps. Before publishing, configure the real `NEXT_PUBLIC_DOCS_URL`, build, then verify the root, a nested guide, search, video/captions, theme and sitemap at the actual URL. Keep unpublished local origins out of public metadata.
