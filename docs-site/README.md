# Agari Docs

Step-by-step guides for [Agari](https://useagari.xyz): devnet Up/Down calls, PreStocks baskets, paper desk practice, and the architecture behind each path. The site takes its navigation and media patterns from Masayume Docs, with Agari-specific words, screenshots, program boundaries and evidence.

**Source reviewed:** Agari at app commit `ee12d79` on 23 September 2026. The site lives in the app's own repository at `docs-site/` and deploys from `integration/w1` to [docs.useagari.xyz](https://docs.useagari.xyz). The app is live at [useagari.xyz](https://useagari.xyz).

## Start with the right guide

| Goal | Guide |
| --- | --- |
| Make a tUSDC test-money call | [Quickstart](content/docs/start/quickstart.mdx) |
| Understand the five PreStocks groups | [Baskets](content/docs/trading/baskets.mdx) |
| Draft a paper desk | [Build a desk](content/docs/agents/desk.mdx) |
| Compare devnet and mainnet program status | [Programs](content/docs/architecture/programs.mdx) |
| Trace claims to code and proof | [Source map](content/docs/builders/source-map.mdx) |
| See how PreStocks and Pyth are used | [PreStocks and Pyth in Agari](content/docs/architecture/prestocks-and-pyth.mdx) |
| Check prerequisites and open limitations | [Availability](content/docs/help/availability.mdx) |

The [20-second public-screen tour](public/videos/baskets-to-practice-2026-09-23.mp4) is assembled from [dated Agari captures](public/captures/provenance-2026-09-23.json). It stops before wallet connection; it is not a live transaction recording. The captures were taken at app commit `c412501`, before the S22 desk redesign and the S23 basket cards, so they show the earlier layouts. Agari's application demo recording remains pending in its stage plan.

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
