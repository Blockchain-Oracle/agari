# Contributing to Agari Docs

This repository is the documentation site for Agari, a stock-price Up/Down prediction market on Solana devnet. It is a fresh fork of `masayume-docs` (`git init`, no shared history) being rewritten fact by fact — see the main Agari tree's `docs/plan/stage-15-public-story.md` (box 15c) for the rewrite priority order and what was left for later when time ran out.

## Run locally

Use Node.js 22 or newer and `pnpm@11.24.0`.

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3153`. This site runs independently: it does not need the Agari web app, a database, wallet keys, an AI provider or the ops service to render its pages.

Set these public origins in `.env.local`:

```dotenv
NEXT_PUBLIC_DOCS_URL=http://localhost:3153
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`NEXT_PUBLIC_DOCS_URL` supplies canonical links and the sitemap. `NEXT_PUBLIC_APP_URL` supplies buttons that open the Agari app (`AppLink`). Neither has a real deployed value yet (`Q-S15-1` in the main tree's `docs/plan/decisions.md`); `lib/site.ts` falls back to `localhost` origins rather than inventing a domain.

## Check the content

```sh
pnpm typecheck
pnpm build
```

Masayume's own content checker (`scripts/check-content.mjs`) required a sibling application checkout and `evidence/source-coverage.json`; both are removed from this fork, since they described Masayume's routes and revisions, not Agari's. There is no equivalent automated fact-checker here yet — every fact in a rewritten page should be checked by hand against the main Agari tree (`docs/plan/acceptance.md`, `docs/plan/decisions.md`, `scripts/deploy/addresses.devnet.json`) before it is written, the same way this fork's first rewrite pass was done.

## Edit a guide

1. Add or edit an MDX page in `content/docs`. Give it a clear `title` and a short `description`. The `sources` frontmatter field still exists in the page schema (`source.config.ts`) but nothing renders it in this fork — there is no public Agari repository yet to link to, so don't populate it until one exists.
2. Add its slug to the folder's `meta.json`. Link documentation pages with normal Markdown links and Agari app destinations with `<AppLink href="/markets">Markets</AppLink>`.
3. Every fact must trace to the main Agari tree: a confirmed row in `docs/plan/acceptance.md`, a dated `docs/plan/decisions.md` entry, or code you actually read. If a fact is unknown or pending, write "not yet" — do not invent a value, a screenshot state or a URL.
4. Run the checks and open the page at desktop and phone sizes, in both themes.

## What this fork removed

Masayume's docs shipped three content-authoring subsystems this fork does not carry forward, because rebuilding them accurately for Agari's much smaller, still-shipping surface was not the priority for this pass:

- **`Architecture` interactive diagrams** (`lib/diagrams.json`, `components/architecture.tsx`, `scripts/export-diagrams.mjs`, `public/diagrams/*.svg`) — removed. Architecture pages here use prose and tables instead.
- **`GuideShot` annotated screenshots** (`lib/guides.ts`, `components/guide-shot.tsx`, `public/guides/*`) — removed, along with every Masayume screenshot it pointed at. Agari pages that show a screenshot use a plain image captured from the running Agari app and saved directly under `public/`, with a caption in the MDX prose instead of `x/y` annotation coordinates.
- **`Walkthrough` video player** (`components/walkthrough.tsx`, `scripts/render-walkthroughs.mjs`, `public/videos/*`) — removed, along with Masayume's demo clips. No Agari walkthrough video exists yet.

If a future pass wants any of these back, rebuild them against Agari's own captures rather than restoring the deleted Masayume data — the component code in Git history (this fork's first commit) still shows the mechanism.

## Deploy to its own host

Not yet done. No Vercel project, GitHub connection or production domain exists for this repository (`Q-S15-1`). When the user gives the go-ahead: create the project, connect this repository's `main` branch, set `NEXT_PUBLIC_DOCS_URL` to the real docs domain and `NEXT_PUBLIC_APP_URL` to the deployed Agari app's domain, then rebuild so canonical URLs match. After deployment, verify the root page, a nested guide, search, theme switching and the sitemap on the actual domain before calling it done.

## Keep the README honest

Keep `README.md` short: user-facing instructions belong in `content/docs`; maintainer procedures belong here. Do not add a hero banner or artwork URL pointing at a docs domain that isn't live — Masayume's own README did this by pointing image sources at its already-deployed docs host, which this fork cannot do honestly yet.
