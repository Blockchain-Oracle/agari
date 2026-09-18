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
| Programs & deploys | `agari-events` upgraded in place to the 813,328 B build (dump sha256 `2e4bf8cc…2efc54fe` equals the local build); adds pre-open post-only rests and the `PreOpenTakerRefused` rule | [tx](https://explorer.solana.com/tx/2qRw9u5ZGbaZhjaeZeHaim3M5kw81TPJkYfUMbDeGku7VzdF67zzqXypVptkJjAKBqutzWJEtHFsSKQ2pjMtJp5k?cluster=devnet) |
| Programs & deploys | `agari-vault` deployed (SBPF v0, 519,296 B, dump sha256 `b6eab3a1…0cde61af` equals the local build) | [tx](https://explorer.solana.com/tx/42p43jqnerGtbkEgtAx94mk2eWXgrfVjkfop7D6KEpxUsPJye3tN1cqELATccUXZM5iuQ5NH8iFmws13GxoBNj25?cluster=devnet) |
| Programs & deploys | `agari-vault` initialised (VaultConfig and its venue seat) | [tx](https://explorer.solana.com/tx/2WRP4Lg3tS2JfCoL2DxVRS2gjDkBxbza3okaDu4143PgtRZuP7XCFoHbeSXNmWQV3YFqJEFUUAbcihi2tcNB554f?cluster=devnet) |
| Programs & deploys | IDLs on-chain for both programs via Program Metadata; both equal the deployed build's IDL | events [tx](https://explorer.solana.com/tx/1cZqsBEvhBaFuwjAiUrbZPSbPp53bTXEhdXkPhkCWNuWuEqHo1epcADXGsYAGcBMxKozkAVZ8HcsJB558dpj128?cluster=devnet) · vault [tx](https://explorer.solana.com/tx/4qR46domLXZoamZJxsMUdUknFPi9eUbW5vDA1PSpvLGPUR3YiGdCh7avPKryS1ggdoAM5bHc1jkdumYeto1eugYP?cluster=devnet) |
| Venue init | Config + roller/attestor/RedStone-signer authorities set in one transaction | [tx](https://explorer.solana.com/tx/4RxMzWFikKUDruS1yzDdWHxqQBfTU24UuquZ4kziob96FHBQWCQk74hhCSYTrPN5ZAFGuZS1RnMGwugtZJoPLqT9?cluster=devnet) |
| Venue init | tUSDC test-collateral mint created (6 dp, faucet-controlled, no freeze authority) | [tx](https://explorer.solana.com/tx/5rY6qb3UC4QfARwtsJzF17bTdBAbZiCwY6DfpUWmZRGEGvBodz3cPdDmtchpDxPxu7p6E7MNMnSXohiHoGBeLSdU?cluster=devnet) |
| Venue init | Authorities updated: the vault's seat, the Switchboard queue and a minimum of 3 oracles for the token lane | [tx](https://explorer.solana.com/tx/2YQANpekYuTht75jegMTvjBSWvCa5nFUPg1djY6oU9eByWyq9Png5UJSVejsKoywcq4j98UxSj2GNarqLJ7iU93e?cluster=devnet) |
| Venue init | Treasury token account opened | [tx](https://explorer.solana.com/tx/36XXfigF9LvNbMN6H3pNgTEk7bw94CjsmPhbcQqTrGiRMxZsHByY5FBS2u2ZtqJd7xgqmHxvZFvjU9uAwGMwmNew?cluster=devnet) |
| Venue init | Roller, settler, price-relay and maker roles funded (4.0 / 2.5 / 0.3 / 0.2 SOL) | [roller tx](https://explorer.solana.com/tx/5rTVMnqRTNoVG7BKzp9giBxcMag6eX2QpWwyd4sfRoUj1DVB8CAZDSZx8N7anHoRTqyJngkX79kkKZVAzndbLCEw?cluster=devnet) |
| Series | TSLA-5m and NVDA-5m Series + policy versions registered | [tx](https://explorer.solana.com/tx/3gqWrR3Pn5e9kbNCuURUL3J6hAUZcEEdsRnr6fpa1yzh7HDYn6svRju2Jka8o27FYPyA2qzcnhCdatjGhewWyzLm?cluster=devnet) |
| Series | 25 further Series + 50 order books registered across AAPL, MSFT, META, AMZN, GOOGL, QQQ, VOO and TSLA/NVDA's 15m/60m cadences (13.569 SOL rent, all confirmed) | [`scripts/deploy/addresses.devnet.json`](scripts/deploy/addresses.devnet.json) — 27 Series total; every one of the 54 order books has its own confirmed transaction in `docs/plan/acceptance.md` |
| Series | 7 Monday Gap Series (TSLA, NVDA, AAPL, META, GOOGL, QQQ, VOO), Friday close to Monday open, one order book each | [tx](https://explorer.solana.com/tx/421muY4paeAsEyKFK3ir7uTEGkhKAvyzgcQcoay6pEs51NW92DN4q6HavUNyEVAYYghdMNKzsfYTyrpjWXpx1x3C?cluster=devnet) (TSLA-gap; the other six are in the ledger) |
| Series | TSLAx token Series at 5m, 15m and 60m on Switchboard, trading around the clock, two order books each | [tx](https://explorer.solana.com/tx/5DtCMzqcgBR6BAYWwSMXXKHvwJaNrLqLvn2o7nukepRmjqDgd9KmEXnAuGwG2jibnRkHatbBHoWkDXjTn2vzLuwF?cluster=devnet) (TSLAx-5m) |
| Faucet | Devnet SOL top-up through the running app's faucet | [tx](https://explorer.solana.com/tx/5WpKEWoPiXn2EvM2NwiyG3mgmp3rzfkzJiA8yPECbKJJdK2jQctAQYHZ929kvF4hQPooJ7AbPcP71iH9jP43RBiG?cluster=devnet) |
| Faucet | tUSDC mint through the same faucet claim (10,000 tUSDC) | [tx](https://explorer.solana.com/tx/23Ge127UJi8JJeGx7BV5XBB2qEw94TrEygbEW7dosHwdAjN4MGNTaZ322TTWfXjj9WvkTf1AqJGFN3fFxmG5Qu5R?cluster=devnet) |
| Calls & fills | TSLA Window opened (5m cadence, Pyth-primary + RedStone-check policy) | [tx](https://explorer.solana.com/tx/3tMvXbgGmHGXjsYJXTEZ1pTPzgbBKgAeokvv9wngbvDbwr2n9C8ZSjSCZVruqtdvUCx6oZWg9NiQfjzxFUQhPe4V?cluster=devnet) |
| Calls & fills | Mint-pair fill (`BUY_YES` × `BUY_NO`) | [tx](https://explorer.solana.com/tx/5n12bZvvyxk8DA8ja4Sh5DzDGziGALoDPdK2CHRK9jPHCTJPfzwg7gZPfoRz9bNcur3ySxpfgxKCYTcYkfmnGMaN?cluster=devnet) |
| Calls & fills | Direct YES fill | [tx](https://explorer.solana.com/tx/5eyinbbRXKEW2nYYHRVJLBpqiQrU2hKDu36KVjEAUEUn6QeYsLQyy2bZANgdmuHJZPoaYbbmJwyUdJAPLGy62hCn?cluster=devnet) |
| Calls & fills | Burn-pair fill (`SELL_NO` × `SELL_YES`) | [tx](https://explorer.solana.com/tx/3N2iJLzyc5vdv6WcX6EFEQ5yGPdXGbVTZe9aesfrN3UM7JqqY28rtsMztESuuwWfhVDn8dZVuxXhpa3oKKaki3CH?cluster=devnet) |
| Calls & fills | Pre-open call rests on a Window listed before the open: post-only UP at 55¢, 1,000 lots, expiring 90 s after the bell (`D-088`) | [tx](https://explorer.solana.com/tx/36owo367GjDTEFn9pSyqjbLU581ic8awpuusA3zxPYoBpHFdbY32rVtyHnb5ioFR3BVL3KSTX8ZYuPreA9hX5RCq?cluster=devnet) |
| Calls & fills | A taker on the same listed Window is refused on-chain with `PreOpenTakerRefused` (6121) | [tx](https://explorer.solana.com/tx/5mjWBsNeQKZP1HXsoAXMe5u18aABssr7SkNgxDbqzw3XmcVKazHCiS7bWD4JYVBW15AwQfw9rAp1EhpX2MBtXY9u?cluster=devnet) (landed failed, by design) |
| Settlement & claims | Cross-check settle: TSLA → Up (Pyth 358.20432 → 358.75, confirmed by RedStone within `max_divergence_bps`) | [tx](https://explorer.solana.com/tx/xjKyBjRk51GitA35CZoP6fKd9huZ15EMH5RPmv8Lkj6XCKYn71zUDFfJaQPHyyresAX4Es13UCFGs4GSogvmzwt?cluster=devnet) |
| Settlement & claims | Void `CrossCheckDivergence` (attested price 1% off RedStone) | [tx](https://explorer.solana.com/tx/24R75m6PE6NohCTE1Z6t3oQvReGP628DVdUsEMM3kKs7gHFWmhTeA32QUKvJEWeWeUW8VzN8VSdQo2rrkCebHYaj?cluster=devnet) |
| Settlement & claims | Void `MissingPrint` (NVDA, no print posted within the admission window) | [tx](https://explorer.solana.com/tx/3p3AwjvW66Y24cV97pPYH4CR7ftXeuFH7GYBeWXhsVCmf1htuSpoYXTNz1nSL7kZhPdmBw1wGB1sFmPQpMM2G1WH?cluster=devnet) |
| Settlement & claims | Redeem paid out exactly the seat-derived expectation | [tx](https://explorer.solana.com/tx/3VFzTVV7FJkaksFDrQtsuJFfaT437SKBx6Gwd93fPLnken3Fuv7tDjpYNq3rA5nQtTKppincNuwWWoDhcJR1SURg?cluster=devnet) |
| Proof replay | Replay payer role funded | [tx](https://explorer.solana.com/tx/5LyDHno6qXYhrCXyBj8eL3YFiaw7d3aSeutzGLReRB2rkam8uyF5Pk4f1Dsc6m9CaBL9Jn4qJFfZHT2CdghV6CF4?cluster=devnet) — the replay itself has not run yet: not yet |
| Grants | Not yet: `agari-vault` is deployed and initialised, but no Grant has been exercised on devnet yet | not yet (`D-091`) |
| Pre-IPO (PreStocks) | `PRE-OPENAI-5m` Series registered: attested primary on the PreStocks catalogue, feed id `prestocks-v1:OPENAI`, 60 s bars, no cross-check (`D-101`) | [tx](https://explorer.solana.com/tx/4qnTvyXYbPu5YAaC9bA8HoNaVPKonvM5noicktdg2CfTqwhioy8BNowfwJ9mDvH6EKAD5u6JLJN1WSFifVprqZMB?cluster=devnet) |
| Pre-IPO (PreStocks) | An OpenAI Up/Down Window opened, printed at both boundaries from PreStocks (open $1,078.17, close $1,082.44, each signed by the venue's attestor) and settled **UP** | open [tx](https://explorer.solana.com/tx/3QMV96z4MAf6JqU2GNo8PiA88nKBZwCdEkfRaJTTNmPHcieJbVStbPeXepvM2TVr6uRWjucjacWK55Zt2WfCzwi8?cluster=devnet), open print [tx](https://explorer.solana.com/tx/3TpzPwc25Cem1ZwJsHVsXbePCRb9jBhTA5b4pQqhFZPwkZNCvrHQLFjq4CTUrUoiSLMTpDHSkBYkqDFmkt5jPR4e?cluster=devnet), close print [tx](https://explorer.solana.com/tx/4DzdJmHXci4iK9Ew7munu3NZorkr78ByzB4m5d3ASpYGyKdupdvWw8NYb3yyRbhxnkTYduQZTn3sDfNH9r2mrDzd?cluster=devnet), settle [tx](https://explorer.solana.com/tx/2d85SoqfWxYibwg8Qy86Pwnt3ujZs4BsJjfg4MfiE9SsD8Cj8A9CN6WgH9p5Tu3m91KvczRHPSoks1y4TjCdpXDS?cluster=devnet) |

Every individual transaction — including the ones above that summarize several, and every failed attempt along the way — is in [`docs/plan/acceptance.md`](docs/plan/acceptance.md).

## Programs

| Program | Program id | Notes |
| --- | --- | --- |
| `agari-events` | [`cDcHZiQ1WYAHbSjxMoju86fbC8azrtQg7dzrWKynANH`](https://explorer.solana.com/address/cDcHZiQ1WYAHbSjxMoju86fbC8azrtQg7dzrWKynANH?cluster=devnet) | The order book. Upgraded in place on 2026-09-15 to 813,328 B (dump sha256 `2e4bf8cc…2efc54fe` equals the local build). |
| `agari-vault` | [`84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9`](https://explorer.solana.com/address/84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9?cluster=devnet) | Trading Balance and bounded grants. Deployed and initialised on 2026-09-15 (519,296 B, dump sha256 `b6eab3a1…0cde61af` equals the local build). |

- **IDL: on-chain** through Program Metadata: `agari-events` [`97VcCVSs…`](https://explorer.solana.com/address/97VcCVSsLZ22ES2XtkSYWsgyoz7jwTQtLDgdSHML5JRH?cluster=devnet), `agari-vault` [`54LqFBmc…`](https://explorer.solana.com/address/54LqFBmc51qe2KsuHGUTwgAbA1qgdqzfgZhr5FXKBhDS?cluster=devnet). Both fetch back equal to `anchor/target/idl/*.json` of the deployed build.
- **Verifiable build: not reproduced yet (`D-096`).** The deployed programs were built on the host, and their dumped on-chain bytes equal these files:
  - Command: `NO_DNA=1 anchor build --arch v0`, with anchor-cli 1.2.0, solana-cli 3.1.10 and platform-tools v1.52.
  - `agari-events`: 813,328 B, sha256 `2e4bf8cce4ceffb8387496f37752cb41a18edeb47e3cd911e241579f2efc54fe`.
  - `agari-vault`: 519,296 B, sha256 `b6eab3a1776b283440d701a87fdb095106cb6c454cb6779249087f030cde61af`.
- **The same source through the verifiable image gives different bytes, because the toolchain differs:**
  - Command: `NO_DNA=1 anchor build --verifiable --arch v0`, in `quay.io/ottersec/anchor:v1.2.0@sha256:54e9bbc858586177159b136ba757d52a84832f2fe98e64224a4e104f71cfbb4d`, with solana-cli 4.1.2, cargo-build-sbf 4.1.0 and platform-tools v1.54.
  - `agari-events`: 812,784 B, sha256 `2afce01c0b65f5c9cd8cb0f55a00d6a1350af5b72934e0db4074b9bff44c4a2c`.
  - `agari-vault`: 520,256 B, sha256 `ddf4e64890aa15467e0aa4f35ef8b739a73f9ed991f04b34c3aba17f2e677724`.
  - Redeploying the verifiable build and uploading its verification is planned for S17.

Venue config: [`42GFppq2YX3LVet2mLEb6EKs1MzmUY38ds3F9VRrqvQ3`](https://explorer.solana.com/address/42GFppq2YX3LVet2mLEb6EKs1MzmUY38ds3F9VRrqvQ3?cluster=devnet). tUSDC mint: [`5i61C4kHUGjRiRoeSuRXY49bkpyCaHq5FYBjT8q82DpA`](https://explorer.solana.com/address/5i61C4kHUGjRiRoeSuRXY49bkpyCaHq5FYBjT8q82DpA?cluster=devnet). The full Series and order-book map is [`scripts/deploy/addresses.devnet.json`](scripts/deploy/addresses.devnet.json).

## Trust assumptions

- **Prices are verified on-chain, not trusted from an API.** TSLA/QQQ/VOO check a Pyth pull-oracle update (Wormhole-guardian verified) during the Pyth trial (`≈ 2026-09-27`); the other seven names check ≥ 3 of 5 configured RedStone signers (all 5 required for the first 5 minutes after the print's timestamp, an anti-selection rule); the 24/7 token lane checks ≥ 3 distinct Switchboard On-Demand oracle signatures from one pinned queue. TSLA additionally cross-checks Pyth against RedStone and voids the Window if they diverge past 25 bps.
- **Pre-IPO prints are attested by the venue, not by PreStocks.** The PreStocks catalogue is unsigned and carries no timestamp, so Agari signs each boundary price with its `price-attestor` key over a 158-byte `agari-print-v1` message naming the program, cluster, market, boundary, feed and bar; the program verifies that signature against `config.attestors` through the ed25519 precompile before it records the print (`D-100`).
- **Roles, not custody.** A roller lists and rolls Windows; a price-relay posts the signed prints; a seed maker quotes both sides of the book; `public_settle_window` and `public_void_expired` are permissionless — anyone (in practice, an ops cranker) can call them once the on-chain conditions are met. None of these roles can move a user's funds; they operate the venue's clock and its price feed.
- **The sponsor role pays fees only.** For session-key tap-trading (`S7`), a `sponsor` key co-signs as fee payer against an exact instruction allowlist, after simulating, under per-address/per-device/global daily lamport caps — never as a second signer on a transfer, never as the payer of an `init`, and never for a deposit.
- **Upgrade authority is a single devnet key today.** The deployer key that funded and deployed `agari-events` and `agari-vault` also holds both programs' upgrade authority; there is no multisig or timelock on devnet. The pending verifiable build (`D-096`) lets anyone check the deployed bytes against this source, which is the check available in place of trusting the authority.
- **What the server holds:** operator role keypairs (roller, settler, price-relay, maker, sponsor, faucet mint authority) live outside the repository in `~/.config/agari/devnet/`, never in git. **What the server never holds:** a user's wallet private key. Every order, deposit and withdrawal is signed by the user's own wallet or, for tap-trading, by a session key the user's wallet granted and that never leaves the browser.

## Honest limitations

- **Devnet only, tUSDC only.** Nothing here moves mainnet value; tUSDC is a faucet-minted test token with no market value.
- **Pyth is on a 14-day trial** covering only TSLA, QQQ and VOO among equities, ending `≈ 2026-09-27`. After it, TSLA moves to a RedStone-primary policy version registered in advance (no redeploy); QQQ and VOO pause with an honest "no signed source" state unless a Stork key or similar is granted.
- **RedStone and Switchboard licence terms for redistribution are unverified**, disclosed rather than assumed favorable.
- **Alpaca** supplies the NYSE calendar, clock and historical bars for the UI — it is not a price-truth source for settlement.
- **S8–S12 and S14 are deferred past the 2026-09-18 deadline** (`D-084`): Earn (maker vault), agents/strategies, specialist tickets (Range, Boost, Parlay, Private), trade-from-X, the games programs, and yield/inverse-position add-ons. Their web surfaces exist and render an honest "not live" state; they are not wired to a deployed program yet.
- **The Pre-IPO lane is single-source by construction.** No second venue publishes a pre-IPO mark for OpenAI, so `PRE-OPENAI-5m` runs attested-primary with no cross-check (`D-101`). It settles on Agari's own signature over the PreStocks price, and it has none of the divergence protection the equity lanes rely on. PreStocks' `markPrice` and `tokenPrice` also differ materially — 11% apart when the lane was proven — and the lane deliberately prints the token price, the only one a holder can realise.
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
