# Agari Docs

Step-by-step guides for [Agari](https://useagari.xyz): devnet Up/Down calls, PreStocks baskets, paper desk practice, and the architecture behind each path. The site takes its navigation and media patterns from Masayume Docs, with Agari-specific words, screenshots, program boundaries and evidence.

**Source reviewed:** Agari at app commit `86a37ee` on 23 September 2026. The site lives in the app's own repository at `docs-site/` and deploys from `integration/w1` to [docs.useagari.xyz](https://docs.useagari.xyz). The app is live at [useagari.xyz](https://useagari.xyz). Connected captures document the live browser observed that day; its deployed commit was not independently identified.

## Start with the right guide

| Goal | Guide |
| --- | --- |
| Make a tUSDC test-money call | [Quickstart](content/docs/start/quickstart.mdx) |
| Understand the five PreStocks groups | [Baskets](content/docs/trading/baskets.mdx) |
| Draft a paper desk | [Build a desk](content/docs/agents/desk.mdx) |
| Inspect a connected ticket, balance or desk | [Baskets](content/docs/trading/baskets.mdx), [Portfolio](content/docs/trading/portfolio.mdx), [Desk](content/docs/agents/desk.mdx) |
| Compare devnet and mainnet program status | [Programs](content/docs/architecture/programs.mdx) |
| Read the drawn architecture | [Venue](content/docs/architecture/overview.mdx), [Desk](content/docs/architecture/desk.mdx), [Price paths](content/docs/architecture/price-sources.mdx) |
| Audit a settled print | [Proof](content/docs/trading/proof.mdx) |
| Trace claims to code and proof | [Source map](content/docs/builders/source-map.mdx) |
| See how PreStocks and Pyth are used | [PreStocks and Pyth in Agari](content/docs/architecture/prestocks-and-pyth.mdx) |
| Check prerequisites and open limitations | [Availability](content/docs/help/availability.mdx) |

The guides now include three [connected-browser recordings](public/videos/connected-basket-ticket-2026-09-23.mp4): a basket ticket preview, Portfolio and a paper desk. They contain real timestamped UI frames, chapter navigation, captions, masked account labels, pointer cues and detail zoom. The basket recording stops before Buy; no new signature or transaction was made in any recording. The [connected capture manifest](public/captures/provenance-connected-2026-09-23.json) and each video's JSON companion state the route and capture method. Raw frames are retained locally in ignored `evidence/raw-video/`; `scripts/render-connected-walkthroughs.mjs` and `scripts/process-connected-captures.mjs` describe the media treatment.

The earlier [signed-out captures](public/captures/provenance-2026-09-23.json) remain in onboarding and the desk studio with explicit dated captions. They came from app commit `c412501`, before the S22 desk redesign and S23 basket cards. Their [20-second public-screen tour](public/videos/baskets-to-practice-2026-09-23.mp4) is retained as historical evidence and is no longer the guide's walkthrough. A complete transaction demo still needs an owner-run recording; these connected guides deliberately stop before consequential actions.

The three diagrams are rendered from [Agari architecture data](lib/architecture.json) with `node scripts/export-architecture.mjs`; the live diagrams also expose each stage's authority boundary. [Connected-session issue notes](evidence/live-issues-2026-09-23.md) document discrepancies found during capture.

## Run locally

Use Node.js 22+ and `pnpm@11.24.0`:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open [localhost:3153](http://localhost:3153). The docs render without a running app, wallet, database or provider key. Set `NEXT_PUBLIC_APP_URL` to your app origin; the default in `lib/site.ts` points to the deployed public app.

```sh
pnpm check
```

`check` validates the docs links, navigation, media and app routes against the app source in the parent directory, then typechecks and builds. It fails if the reviewed revision (`site.revision` in `lib/site.ts`) is missing or not an ancestor of `HEAD`, and prints a warning listing app commits made since it. Those commits are the list to review: update the guides they affect, then advance the revision. [Contributing](CONTRIBUTING.md) explains the capture and review workflow.

## Evidence and limits

Predict and Cover use tUSDC on **Solana devnet**. A desk starts in paper practice; the `agari-desk` program passed a 31-check mainnet-fork rehearsal, but its **mainnet deployment is still pending** at this review. Pyth's OpenAI and Anthropic valuation-index feeds were denied to the trial key, so those valuation lanes are not listed. Current route and feed health belongs to the [app's Status page](https://useagari.xyz/status), not to this dated snapshot.
