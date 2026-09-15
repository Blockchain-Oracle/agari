# Agari Docs

The step-by-step guide to Agari: a stock-price Up/Down prediction market on Solana devnet, source-led ported from [Masayume](https://github.com/Blockchain-Oracle/masayume). This site is a fresh fork of `masayume-docs` (no shared Git history), rewritten fact by fact for Agari.

**Status:** not deployed yet. This repository has no GitHub remote configured and the site has no public URL — both are pending the user's go at S16 (`Q-S15-1` in the main Agari tree's `docs/plan/decisions.md`).

## Find your next step

| Start with | Guide |
| --- | --- |
| Get oriented | [Quickstart](content/docs/start/quickstart.mdx) |
| Place and follow a call | [Your first call](content/docs/trading/first-trade.mdx) |
| Understand the trading calendar | [Sessions and lanes](content/docs/trading/sessions-and-lanes.mdx) |
| Trade in advance of the open | [Pre-open calls](content/docs/trading/pre-open-calls.mdx) |
| See how the parts connect | [Architecture](content/docs/architecture/overview.mdx) |
| Check what needs a wallet, a key or a running service | [Availability](content/docs/help/availability.mdx) |

## Run locally

Use Node.js 22+ and `pnpm@11.24.0`.

```sh
pnpm install
pnpm dev
```

Open [localhost:3153](http://localhost:3153). The site renders independently of the trading app, wallets, databases and paid services — it is static documentation content.

```sh
pnpm typecheck
pnpm build
```

## What changed from the Masayume fork

- Every content page under `content/docs/` is being rewritten fact-by-fact for Agari (Solana devnet, not Somnia; `agari-events`/`agari-vault`, not DreamDEX/EventVault; tUSDC, not tUSDC+STT). See the main Agari tree's stage plan (`docs/plan/stage-15-public-story.md`, box 15c) for the exact rewrite order and what was left unrewritten when time ran out.
- The interactive `Architecture` diagram widget, the annotated `GuideShot` screenshot component and the `Walkthrough` video-scrubber component were cut for this port (`lib/diagrams.json`, `lib/guides.ts`, `components/architecture.tsx`, `components/guide-shot.tsx`, `components/walkthrough.tsx`, and their backing `scripts/*.mjs` generators are removed). Architecture pages use prose and tables instead; real Agari screenshots are placed directly under `public/` per page.
- `evidence/` (Masayume's own dated review/capture archive, ~281 MB) and `public/{videos,guides,brand,diagrams,repo-assets}` (Masayume-branded screenshots, demo clips and artwork) are removed — none of it is Agari material.
- `scripts/check-content.mjs` (a Masayume-specific verifier requiring a sibling source checkout and `evidence/source-coverage.json`) is removed; the gate here is `pnpm typecheck && pnpm build`.
- `games/`, `agents/` and `builders/` each collapse to one honest "after the hackathon" page, since S8–S12 and S14 are deferred past the 2026-09-18 hackathon deadline (`D-084` in the main tree).
