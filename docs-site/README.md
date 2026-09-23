# Agari Docs

Step-by-step guides for [Agari](https://useagari.xyz): devnet Up/Down calls, PreStocks baskets, paper desk practice, and the architecture behind each path. The site takes its navigation and media patterns from Masayume Docs, with Agari-specific words, screenshots, program boundaries and evidence.

**Source reviewed:** Agari `integration/w1` at `c412501` on 23 September 2026. In the local app repository, `main` was 820 commits behind that branch and `origin/HEAD` pointed to `integration/w1`. This docs site is a **separate Git repository** on `main`, with no remote configured at this review. Its public docs URL is not verified. The app is live at [useagari.xyz](https://useagari.xyz).

## Start with the right guide

| Goal | Guide |
| --- | --- |
| Make a tUSDC test-money call | [Quickstart](content/docs/start/quickstart.mdx) |
| Understand the five PreStocks groups | [Baskets](content/docs/trading/baskets.mdx) |
| Draft a paper desk | [Build a desk](content/docs/agents/desk.mdx) |
| Compare devnet and mainnet program status | [Programs](content/docs/architecture/programs.mdx) |
| Trace claims to code and proof | [Source map](content/docs/builders/source-map.mdx) |
| Check prerequisites and open limitations | [Availability](content/docs/help/availability.mdx) |

The [20-second public-screen tour](public/videos/baskets-to-practice-2026-09-23.mp4) is assembled from [dated Agari captures](public/captures/provenance-2026-09-23.json). It stops before wallet connection; it is not a live transaction recording. Agari's application demo recording remains pending in its stage plan.

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

`check` validates the local docs links, navigation, media and pinned sibling Agari source, then typechecks and builds. Point `AGARI_SOURCE_DIR` at an `integration/w1` checkout if it is elsewhere. A source-revision failure means review the new code and update the guides before advancing the pin. [Contributing](CONTRIBUTING.md) explains the capture and review workflow.

## Evidence and limits

Predict and Cover use tUSDC on **Solana devnet**. A desk starts in paper practice; the `agari-desk` program passed a 31-check mainnet-fork rehearsal, but its **mainnet deployment is still pending** at this review. Pyth's OpenAI and Anthropic valuation-index feeds were denied to the trial key, so those valuation lanes are not listed. Current route and feed health belongs to the [app's Status page](https://useagari.xyz/status), not to this dated snapshot.
