# Agari · 上がり

Agari is a stock-price Up/Down prediction market on Solana, built as a source-led port of [Masayume](https://github.com/Blockchain-Oracle/masayume) (`reference/masayume` @ `68f7a09`). Pick a **Window** on a listed stock or ETF, call Up or Down before it locks, and see it settle from a signed price print recorded on-chain — no custodian, no off-chain ledger deciding the outcome. Trading uses **tUSDC**, a devnet test token; nothing here moves real money. Your wallet signs every order; the server and its operator keys never hold user funds and never see a user's private key.

The venue is Agari's own Anchor order book (`agari-events`, a from-scratch rebuild of DreamDEX's Event Contracts semantics — see `docs/plan/00-plan.md` §3.0 for why it isn't a fork of Manifest, Phoenix or OpenBook), plus a Trading Balance / bounded-permission vault (`agari-vault`) for tap-trading. Prices come from Pyth, RedStone and Switchboard On-Demand, verified on-chain at an exact timestamp — never "latest".

**Status: devnet only, mid-build.** Sessions S0–S7, S13 and S18 of the build plan are shipped or shipping this week; S8–S12 and S14 (Earn, agents, specialist tickets, X trading, games programs, yield) are deferred past the 2026-09-18 hackathon deadline (`D-084`) and render an honest "coming soon" state in the app rather than a half-built flow. See [Honest limitations](#honest-limitations) below.

## Find your way

| What you want to do | Start here |
| --- | --- |
| Browse listed Windows and make a call | [`/markets`](web/src/app/markets) |
| Understand sessions, lanes, halts, voids and money | [`/how-it-works`](web/src/app/how-it-works) |
| Watch it work | [`/demo`](web/src/app/demo) (recording pending, `D-097`; the proof table there is live) |
| Read the pitch | [`/pitch`](web/src/app/pitch) |
| Install the PWA | [`/download`](web/src/app/download) |
| Check service health | [`/status`](web/src/app/status) |
| Read the on-chain proof feed | [`/proof`](web/src/app/proof) |
| Step-by-step documentation | `agari-docs` — deployed URL pending the user's go at S16 (`Q-S15-1`) |

The app is not deployed publicly yet; every route above exists in this repository and runs at `pnpm dev` on `localhost:3000`. The public devnet deploy is an S16 decision.

## Proven on-chain

Every row below is a confirmed devnet transaction from `docs/plan/acceptance.md` (the append-only evidence ledger — it also records the handful of failed attempts before each fix). "Not yet" means the step genuinely hasn't happened, not that it failed.

| Group | What happened | Evidence |
| --- | --- | --- |
| Programs & deploys | `agari-events` deployed (SBPF v0, 764,200 B, sha256 `310e14d7…c44309`) | [tx](https://explorer.solana.com/tx/535nHdsRyvVbmuKVHPsuaBV9HCVEcfkTRbZnk2Gpr35DSnC8SAsFzkDJnm4qW6L6EKptVSrNzuhHkwzQ56hKRpQS?cluster=devnet) |
| Programs & deploys | `agari-events` IDL published on-chain via Program Metadata | [tx](https://explorer.solana.com/tx/5pCH4S2N24d2AosHyMmsMoNXHHLStE3tAECoScozUQnXnHJEpvhmGTRGHFbNpc1hkZHtD1C8u9DPAcveKgyDceSp?cluster=devnet) |
| Programs & deploys | `agari-vault` program id reserved; deploy is tonight's devnet sequence, not yet run as of this snapshot | not yet (`D-096`) |
| Venue init | Config + roller/attestor/RedStone-signer authorities set in one transaction | [tx](https://explorer.solana.com/tx/4RxMzWFikKUDruS1yzDdWHxqQBfTU24UuquZ4kziob96FHBQWCQk74hhCSYTrPN5ZAFGuZS1RnMGwugtZJoPLqT9?cluster=devnet) |
| Venue init | tUSDC test-collateral mint created (6 dp, faucet-controlled, no freeze authority) | [tx](https://explorer.solana.com/tx/5rY6qb3UC4QfARwtsJzF17bTdBAbZiCwY6DfpUWmZRGEGvBodz3cPdDmtchpDxPxu7p6E7MNMnSXohiHoGBeLSdU?cluster=devnet) |
| Venue init | Treasury token account opened | [tx](https://explorer.solana.com/tx/36XXfigF9LvNbMN6H3pNgTEk7bw94CjsmPhbcQqTrGiRMxZsHByY5FBS2u2ZtqJd7xgqmHxvZFvjU9uAwGMwmNew?cluster=devnet) |
| Venue init | Roller, settler, price-relay and maker roles funded (4.0 / 2.5 / 0.3 / 0.2 SOL) | [roller tx](https://explorer.solana.com/tx/5rTVMnqRTNoVG7BKzp9giBxcMag6eX2QpWwyd4sfRoUj1DVB8CAZDSZx8N7anHoRTqyJngkX79kkKZVAzndbLCEw?cluster=devnet) |
| Series | TSLA-5m and NVDA-5m Series + policy versions registered | [tx](https://explorer.solana.com/tx/3gqWrR3Pn5e9kbNCuURUL3J6hAUZcEEdsRnr6fpa1yzh7HDYn6svRju2Jka8o27FYPyA2qzcnhCdatjGhewWyzLm?cluster=devnet) |
| Series | 25 further Series + 50 order books registered across AAPL, MSFT, META, AMZN, GOOGL, QQQ, VOO and TSLA/NVDA's 15m/60m cadences (13.569 SOL rent, all confirmed) | [`scripts/deploy/addresses.devnet.json`](scripts/deploy/addresses.devnet.json) — 27 Series total; every one of the 54 order books has its own confirmed transaction in `docs/plan/acceptance.md` |
| Faucet | Devnet SOL top-up through the running app's faucet | [tx](https://explorer.solana.com/tx/5WpKEWoPiXn2EvM2NwiyG3mgmp3rzfkzJiA8yPECbKJJdK2jQctAQYHZ929kvF4hQPooJ7AbPcP71iH9jP43RBiG?cluster=devnet) |
| Faucet | tUSDC mint through the same faucet claim (10,000 tUSDC) | [tx](https://explorer.solana.com/tx/23Ge127UJi8JJeGx7BV5XBB2qEw94TrEygbEW7dosHwdAjN4MGNTaZ322TTWfXjj9WvkTf1AqJGFN3fFxmG5Qu5R?cluster=devnet) |
| Calls & fills | TSLA Window opened (5m cadence, Pyth-primary + RedStone-check policy) | [tx](https://explorer.solana.com/tx/3tMvXbgGmHGXjsYJXTEZ1pTPzgbBKgAeokvv9wngbvDbwr2n9C8ZSjSCZVruqtdvUCx6oZWg9NiQfjzxFUQhPe4V?cluster=devnet) |
| Calls & fills | Mint-pair fill (`BUY_YES` × `BUY_NO`) | [tx](https://explorer.solana.com/tx/5n12bZvvyxk8DA8ja4Sh5DzDGziGALoDPdK2CHRK9jPHCTJPfzwg7gZPfoRz9bNcur3ySxpfgxKCYTcYkfmnGMaN?cluster=devnet) |
| Calls & fills | Direct YES fill | [tx](https://explorer.solana.com/tx/5eyinbbRXKEW2nYYHRVJLBpqiQrU2hKDu36KVjEAUEUn6QeYsLQyy2bZANgdmuHJZPoaYbbmJwyUdJAPLGy62hCn?cluster=devnet) |
| Calls & fills | Burn-pair fill (`SELL_NO` × `SELL_YES`) | [tx](https://explorer.solana.com/tx/3N2iJLzyc5vdv6WcX6EFEQ5yGPdXGbVTZe9aesfrN3UM7JqqY28rtsMztESuuwWfhVDn8dZVuxXhpa3oKKaki3CH?cluster=devnet) |
| Settlement & claims | Cross-check settle: TSLA → Up (Pyth 358.20432 → 358.75, confirmed by RedStone within `max_divergence_bps`) | [tx](https://explorer.solana.com/tx/xjKyBjRk51GitA35CZoP6fKd9huZ15EMH5RPmv8Lkj6XCKYn71zUDFfJaQPHyyresAX4Es13UCFGs4GSogvmzwt?cluster=devnet) |
| Settlement & claims | Void `CrossCheckDivergence` (attested price 1% off RedStone) | [tx](https://explorer.solana.com/tx/24R75m6PE6NohCTE1Z6t3oQvReGP628DVdUsEMM3kKs7gHFWmhTeA32QUKvJEWeWeUW8VzN8VSdQo2rrkCebHYaj?cluster=devnet) |
| Settlement & claims | Void `MissingPrint` (NVDA, no print posted within the admission window) | [tx](https://explorer.solana.com/tx/3p3AwjvW66Y24cV97pPYH4CR7ftXeuFH7GYBeWXhsVCmf1htuSpoYXTNz1nSL7kZhPdmBw1wGB1sFmPQpMM2G1WH?cluster=devnet) |
| Settlement & claims | Redeem paid out exactly the seat-derived expectation | [tx](https://explorer.solana.com/tx/3VFzTVV7FJkaksFDrQtsuJFfaT437SKBx6Gwd93fPLnken3Fuv7tDjpYNq3rA5nQtTKppincNuwWWoDhcJR1SURg?cluster=devnet) |
| Proof replay | Replay payer role funded | [tx](https://explorer.solana.com/tx/5LyDHno6qXYhrCXyBj8eL3YFiaw7d3aSeutzGLReRB2rkam8uyF5Pk4f1Dsc6m9CaBL9Jn4qJFfZHT2CdghV6CF4?cluster=devnet) — the replay itself has not run yet: not yet |
| Grants | Not yet: `Grant` lives in `agari-vault`, which has not deployed to devnet as of this snapshot | not yet (`D-096`, `D-091`) |

Every individual transaction — including the ones above that summarize several, and every failed attempt along the way — is in [`docs/plan/acceptance.md`](docs/plan/acceptance.md).

## Programs

| Program | Program id | Notes |
| --- | --- | --- |
| `agari-events` | [`cDcHZiQ1WYAHbSjxMoju86fbC8azrtQg7dzrWKynANH`](https://explorer.solana.com/address/cDcHZiQ1WYAHbSjxMoju86fbC8azrtQg7dzrWKynANH?cluster=devnet) | The order book. Deployed, IDL published (Program Metadata). Upgrade due tonight per `D-096`. |
| `agari-vault` | [`84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9`](https://explorer.solana.com/address/84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9?cluster=devnet) | Trading Balance and bounded grants. Deploy is tonight's sequence. |

- **IDL: pending (`D-096`)** — an on-chain IDL for both programs, published after tonight's devnet upgrade sequence.
- **Verifiable build: pending (`D-096`)** — `anchor build --verifiable` for both programs, with the deployed binaries' sha256, the exact build command and explorer links recorded here once it reproduces the deployed bytes (or the measured hash and toolchain, honestly, if it doesn't reproduce before the deadline).

Venue config: [`42GFppq2YX3LVet2mLEb6EKs1MzmUY38ds3F9VRrqvQ3`](https://explorer.solana.com/address/42GFppq2YX3LVet2mLEb6EKs1MzmUY38ds3F9VRrqvQ3?cluster=devnet). tUSDC mint: [`5i61C4kHUGjRiRoeSuRXY49bkpyCaHq5FYBjT8q82DpA`](https://explorer.solana.com/address/5i61C4kHUGjRiRoeSuRXY49bkpyCaHq5FYBjT8q82DpA?cluster=devnet). The full Series and order-book map is [`scripts/deploy/addresses.devnet.json`](scripts/deploy/addresses.devnet.json).

## Trust assumptions

- **Prices are verified on-chain, not trusted from an API.** TSLA/QQQ/VOO check a Pyth pull-oracle update (Wormhole-guardian verified) during the Pyth trial (`≈ 2026-09-27`); the other seven names check ≥ 3 of 5 configured RedStone signers (all 5 required for the first 5 minutes after the print's timestamp, an anti-selection rule); the 24/7 token lane checks ≥ 3 distinct Switchboard On-Demand oracle signatures from one pinned queue. TSLA additionally cross-checks Pyth against RedStone and voids the Window if they diverge past 25 bps.
- **Roles, not custody.** A roller lists and rolls Windows; a price-relay posts the signed prints; a seed maker quotes both sides of the book; `public_settle_window` and `public_void_expired` are permissionless — anyone (in practice, an ops cranker) can call them once the on-chain conditions are met. None of these roles can move a user's funds; they operate the venue's clock and its price feed.
- **The sponsor role pays fees only.** For session-key tap-trading (`S7`), a `sponsor` key co-signs as fee payer against an exact instruction allowlist, after simulating, under per-address/per-device/global daily lamport caps — never as a second signer on a transfer, never as the payer of an `init`, and never for a deposit.
- **Upgrade authority is a single devnet key today.** The deployer key that funded and deployed `agari-events` also holds its upgrade authority; there is no multisig or timelock on devnet. The pending verifiable build (`D-096`) lets anyone check the deployed bytes against this source, which is the check available in place of trusting the authority.
- **What the server holds:** operator role keypairs (roller, settler, price-relay, maker, sponsor, faucet mint authority) live outside the repository in `~/.config/agari/devnet/`, never in git. **What the server never holds:** a user's wallet private key. Every order, deposit and withdrawal is signed by the user's own wallet or, for tap-trading, by a session key the user's wallet granted and that never leaves the browser.

## Honest limitations

- **Devnet only, tUSDC only.** Nothing here moves mainnet value; tUSDC is a faucet-minted test token with no market value.
- **Pyth is on a 14-day trial** covering only TSLA, QQQ and VOO among equities, ending `≈ 2026-09-27`. After it, TSLA moves to a RedStone-primary policy version registered in advance (no redeploy); QQQ and VOO pause with an honest "no signed source" state unless a Stork key or similar is granted.
- **RedStone and Switchboard licence terms for redistribution are unverified**, disclosed rather than assumed favorable.
- **Alpaca** supplies the NYSE calendar, clock and historical bars for the UI — it is not a price-truth source for settlement.
- **S8–S12 and S14 are deferred past the 2026-09-18 deadline** (`D-084`): Earn (maker vault), agents/strategies, specialist tickets (Range, Boost, Parlay, Private), trade-from-X, the games programs, and yield/inverse-position add-ons. Their web surfaces exist and render an honest "not live" state; they are not wired to a deployed program yet.
- **Not audited.** No external security review or bug bounty has run against `agari-events` or `agari-vault`. The security checklist the programs were built against is `docs/plan/00-plan.md` §3.4; LiteSVM and Surfpool-fork test coverage is recorded per stage in `docs/plan/acceptance.md`, but that is not a substitute for an audit.
- **No native app.** Solana Mobile / Seeker support is PWA-only for now (`Q-006`); `/native-auth` renders an honest "not available" state (`L-19`, Blocked).
- **Public source-licensing terms are still an open question** (`Q-007`) — see `THIRD_PARTY_NOTICES.md`.

## Why Solana

- **Sub-second block times and low fees** make a 5-minute settlement Window and per-fill accounting practical at the transaction counts this venue produces (a 10-fill IOC measured at 29,938 compute units on a devnet-fork profile — see `docs/plan/acceptance.md`, 2026-09-14 15:16).
- **The upgradeable BPF loader** lets a devnet-stage program ship fixes without a full redeploy and re-registration of every Series, which a hackathon build needs.
- **Existing, composable price oracles are already live on Solana devnet**: Pyth's pull-oracle receiver, Switchboard On-Demand, and RedStone's public signed-package gateway. Agari verifies all three in-program rather than trusting an off-chain relay's read of them.
- **Anchor's account model** makes the lock scope of a trade explicit: a fill write-locks only one Window's `{market, book, ledger, mvault}`, so independent Windows and lanes trade in parallel without a shared mutex.

## Run locally

Requires **Node.js** and **pnpm** (`pnpm add`/`pnpm dlx` only — no npm/yarn/bun lockfiles).

```sh
pnpm install
pnpm dev            # web on localhost:3000
```

Gates, run from the repo root:

```sh
pnpm typecheck && pnpm invariants   # fast gate
pnpm build                          # web build
NO_DNA=1 anchor build --arch v0     # program build (needs Anchor + Surfpool on PATH)
```

A local server browses `/markets` and every story page with no environment file. Funded and server-backed features need their own keys; the variable **names** (never values) are in [`.env.example`](.env.example) (root: Pyth, Alpaca, Finnhub, Helius, Jupiter, Stork) and [`web/.env.example`](web/.env.example) (Solana RPC URLs, `DATABASE_URL` for the local Room/social store, the AI provider for Sensei, sponsor and faucet role keys, X integration, game-room settings). Role keypairs are never committed; they live in `~/.config/agari/devnet/` locally, one file per role.

## Architecture

| Path | What lives here |
| --- | --- |
| [`anchor/programs/agari-events`](anchor/programs/agari-events) | The order-book program: matching, book, ledger, print verification, settlement |
| [`anchor/programs/agari-vault`](anchor/programs/agari-vault) | Trading Balance, bounded grants, tap-trading |
| [`packages/core`](packages/core) | Pure Solana-shaped types, calendar, session words, copy — no `@solana/*` imports |
| [`packages/markets`](packages/markets) | The only package that imports `@solana/*`, `@pythnetwork/*`, `@switchboard-xyz/*` and sends transactions: deploy/drive scripts, session keys, the indexer's on-chain reads |
| [`packages/clients`](packages/clients) | Generated Codama TypeScript clients for both programs |
| [`packages/db`](packages/db) | Postgres schema and queries (the Room, games, sponsor-cosign ledger) |
| [`packages/brain`](packages/brain) | Sensei's prompts and decision checks, model-agnostic via the Vercel AI SDK |
| [`services/ops`](services/ops) | The always-on off-chain actors: window-roller, price-relay, settler, indexer, market-maker, halt-watch, x-relay, game actors — one process, single writer per key |
| [`web`](web) | The Next.js app (App Router), the Masayume-ported UI |
| [`scripts/deploy`](scripts/deploy), [`scripts/drive`](scripts/drive) | Ensure-style devnet deploy scripts and rehearsal drives |

## Lineage

Agari is a source-led port of [Masayume](https://github.com/Blockchain-Oracle/masayume) (`reference/masayume` @ `68f7a09`), the only design authority for this build: Somnia → Solana, BTC/ETH → US stocks and ETFs, brand → Agari, plus the additive features `docs/plan/00-plan.md` records. Source and asset attribution is in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
