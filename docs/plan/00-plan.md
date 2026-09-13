# Agari (上がり) — Build Plan

> Status: **revision r2 for approval** (plan mode, 2026-09-13): consistency pass after the affordable price-source redesign (`C:13`).
>
> This file is mirrored at `docs/plan/00-plan.md` in the Agari repo (`/Users/abu/dev/hackathon/stocklana`) and re-synced right after approval. From S0 on it changes only through `docs/plan/decisions.md`.
>
> **What r2 changes (for review):**
> 1. **Price policies became dated, immutable versions on each Series** (P§3.1). Each Window references one version, so a lane changes source on a date without a redeploy. The roller never lists a Window that no version fully covers, e.g. QQQ/VOO after the Pyth trial.
> 2. **Both boundaries of a Window use the same source** (needed for a fair close ≥ open). The boundary kind is still set per boundary.
> 3. **Three manipulation gaps closed** (PD-1):
>    - A RedStone poster could pick a favourable 3-of-5 signer subset → all 5 signers are required at first.
>    - Switchboard quotes carry no timestamp → a short, clock-bounded admission window.
>    - Anyone could settle before the cross-check print lands → settlement waits for it, up to a short bound.
> 4. **PD-7 amended.** `MarketResult` is reclaimed after a retention period once nothing references it. Permanent results at ≈ 2,600 Windows/day would cost ≈ 4 devnet SOL a day.
> 5. **Budget and compute corrected.** Devnet SOL rises to ≈ 55–65 (48 series, ≈ 87 books, Window churn, reclaiming Pyth update accounts). Print compute now includes RedStone signature recovery.
> 6. **Oracle adapters sit inside `packages/markets`**, keeping one chain boundary; web3.js-1 SDKs are contained there.
> 7. **Tests, security and gates now cover every print source** (P§8, P§3.4, S2/S3/S6, P§7.4). A Pyth trial archiver starts in S0 (time-sensitive). Stale facts are fixed: Privy is set, `PD-1…PD-8`, `C:06`–`C:13` are written, rested-age filter instead of same-slot.
>
> Path shorthand:
> - `M:` = `reference/masayume/` (symlink to `/Users/abu/dev/hackathon/sommina-events`, commit `68f7a09`)
> - `C:` = `context/`
> - `R:` = `reference/`
> - `P§` = a section of this plan

## 0. Context

**Why.** Abu is entering the Solana **Stocklana** hackathon:
- $100k prize, one main track, no bounty tracks, no required SDK.
- Submissions close Fri 2026-09-18 16:00 ET; judging runs to 10-02.
- Judges ask four things: a real user and problem, a working end-to-end demo, why Solana, and execution quality.

Abu said deadlines are not the constraint: "architect well; I'm using AI agents".

**What.** **Agari** is a consumer stock-price prediction market on Solana, built as a source-led port of Abu's product **Masayume** (github.com/Blockchain-Oracle/masayume = local `68f7a09`).
- Masayume is the **minimum baseline**. Every capability carries over: markets, ticket, Range, Boost, Parlay, Private, Earn, games, agents/copy, trade-from-X, Sensei, Reels, rooms, leaderboard, stats.
- Allowed deviations: Somnia → Solana, BTC/ETH → US stocks and ETFs, brand → Agari, plus additive features.
- User add-ons: betting against stocks, yield, deeper social trading.

**Who it's for (Stocklana brief: make owning and using tokenized stocks better).**

The first user is a **tokenized-stock holder** (xStocks, Ondo, Backpack) whose stock trades on Solana while US exchanges are mostly closed; about 63% of tokenized-stock volume happens then. Today they can only change exposure by selling. Agari lets them:
1. **Protect a holding without selling it.** Holdings-aware Down and Monday-Gap tickets, sized to their real **mainnet** xStock position (read-only), available 24/7 and over weekends.
2. **Express a short-horizon view on the stock they already own.** 5m–60m Windows in session and the token lane off-hours, with capped risk.
3. **Follow and copy other holders.** Per-ticker rooms, leaderboards, agents, trade-from-X.

The first compelling demo (M2) leads with this holder journey. Full Masayume parity remains the scope.

**User-approved decisions (2026-09-13):**
1. **Authority.** Masayume is the design authority. Yosuku is lineage only: its engine is DeepBook Predict's house vault and is **not** a source for Agari.
2. **Engine.** A DreamDEX-style **Event Contracts order book**, which is exactly what Masayume ran on. Evidence is in P§2.3. It is built as **our own Anchor CLOB** (P§3.0).
3. **Brand.** Agari (上がり), meaning "rising" and "a winning hand". `agari.xyz` / `agari.fun` looked unregistered in a DNS lookup (not a guarantee).
4. **Sign-in.** Privy from Stage 1 (social login and embedded Solana wallets), with external Wallet Standard wallets through the same seam.
5. **Prices (revised 2026-09-13; the user can't afford Pyth's paid plans).**
   - Signed prices at exact T per the PD-1 matrix.
   - Pyth trial for TSLA/QQQ/VOO until ≈ 09-27.
   - RedStone ($0) for single names.
   - Switchboard Surge for the 24/7 token lane.
   - Attested "demo data" only as a last resort.
   - Chainlink Data Streams as the production path.
6. **Market calendar.** Stock-market-hours lanes plus weekend "Monday Gap" and 24/7 xStock-token lanes. Devnet test collateral only; US geofence and disclaimers.
7. **Build rules.**
   - Tests are **not a deliverable**; add targeted tests only where money or settlement correctness is in doubt.
   - Files ≤ 300–400 lines.
   - Research every library with Context7 first.
   - Performance-first libraries.
   - Stages must be resumable across context resets.
   - Sequencing is never scope-cutting.

**Planner decisions flagged for user review** (taken to unblock design; approving this plan approves them):
- **PD-1: Affordable price policy, in dated versions, frozen per Window** (revised after `C:13`; the user can't pay Pyth's $500 crypto-only / $2,500+ equities plans).
  - **Versions.** Each Series holds up to 8 **immutable** policy versions: `{valid_from_ts, valid_until_ts, primary: PrintPolicy, check: PrintPolicy | None, max_divergence_bps, check_admission_sec}` (layout in P§3.1).
    - The roller picks the highest version whose validity covers **both** boundaries of a Window and stores its index in the Window.
    - If no version covers a Window, the roller doesn't list it, and the lane shows an honest "paused: no signed source" state.
    - Phase switches are versions registered in advance: no redeploy, no manual action on the day, no effect on listed Windows.
  - **One source per Window.** Both boundaries use the primary source, so close ≥ open compares like with like. Boundary kind (Intraday / SessionOpen / SessionClose) is still set per boundary from the calendar.
  - **The prints themselves are always verified on-chain at exact T, never "latest". The first valid print wins** (`PrintAlreadyRecorded`):

    | Source | On-chain check |
    |---|---|
    | **Pyth** | `PriceUpdateV2`, Full verification, feed id, uniqueness `prev_publish_time < T ≤ publish_time ≤ T + grace_sec` (**default 5 s**), confidence `≤ max_conf_bps` (default 50).<br>- **Trial key (14 days, ends ≈ 2026-09-27) covers only TSLA, QQQ and VOO among equities.** Verified 2026-09-13: the TSLA Friday 16:00 ET update has `publish_time == T` and `prev_publish_time == T − 1`; feeds publish until 20:00 ET.<br>- Post to the receiver that matches the SDK feature (default `rec5EK…`, or `pro-compatible` `rec2HH…`); otherwise the `Account<PriceUpdateV2>` owner check fails. D-002 decides.<br>- The relay reclaims each update account's rent (≈ 0.0013 SOL) after recording |
    | **RedStone** ($0, public gateway, no key) | Signed data packages verified in-program (secp256k1). Each authorised signer signs its own value; the print is the **median of distinct signers' values**.<br>- **Anti-selection rule:** for the first `strict_sec` after T (default 5 min), **all 5 configured signers** are required. After that, ≥ 3 distinct signers suffice (liveness). A poster therefore can't pick a favourable 3-of-5 subset while the honest relay can post all 5.<br>- Feed id checked; **package timestamp == T·1000** (10 s grid).<br>- Covers TSLA, NVDA, AAPL, AMZN, GOOGL, META, MSFT (+ `---EXTENDED`/`---24_7`); **no ETFs**.<br>- Gateway history ≈ 24 h, so ops fetches at T + 10–15 s, **archives the packages**, and may post later (T is the reference, not the clock). Licence UNVERIFIED, disclosed |
    | **Switchboard On-Demand** (≈ $0.002/quote) | **24/7 token lane** only: Surge `TSLAX/USD`-style tasks.<br>- Quotes carry a slot, not a timestamp, and Surge has no historical mode. So admission is **clock-bounded**: `T + min_delay_sec ≤ now ≤ T + admission_sec` (defaults 10 s / 60 s) and `clock.slot − quote.slot ≤ max_slot_age` (default 20 ≈ 8 s). The quote was therefore observed after T and within about a minute of it; the label says so.<br>- Checks: pinned feed hash, pinned queue pubkey, ≥ `switchboard_min_oracles` (3) **distinct** oracle indices, SlotHashes.<br>- Crate `switchboard-on-demand` with `default-features=false, features=["solana-v3"]` + the ed25519 instruction-index workaround (`C:13` §2.5) |
    | **Attested** (native ed25519 keeper) | Last resort, only by user opt-in (D-entry). Labelled "demo data" |

  - **Phases** (as policy versions; D-003 records exact timestamps):
    - **Now → Fri 09-25 close:** TSLA = Pyth primary + RedStone check. QQQ/VOO = Pyth. NVDA/AAPL/MSFT/META/AMZN/GOOGL = RedStone.
    - **After the trial (≈ 09-27 → 10-02 judging):**
      - TSLA switches to RedStone primary. Its version starts Fri 09-25, so the 09-25 Gap Window, which closes Monday, is already RedStone.
      - **QQQ/VOO default to paused** with an honest state; attested "demo data" only if the user opts in. They come back if Stork grants a key (a Stork source would be a new policy source, recorded as a D-entry).
      - The Pyth trial archive powers a **proof replay** (S5): an archived signed blob is posted to the devnet receiver and shown next to the print that settled that historical Window. Past-T markets are never listed.
    - **Production:** Chainlink Data Streams ($150/stream/mo; xStocks' own oracle) plus RedStone or Pyth as the check source.
  - **Session close (16:00/13:00):** the value is "oracle price at 16:00:00 ET", **never** called the official close. The official close is shown alongside when known (a label, not an on-chain rule).
  - **Cross-check** (where a version has a `check` source; TSLA during the trial):
    - The relay posts check prints for both boundaries.
    - `public_settle_window` waits until the check prints exist **or** `check_admission_sec` (default 120 s) has passed after the close boundary (`CrossCheckPending` otherwise). An early settler can't skip the check.
    - If either boundary diverges beyond `max_divergence_bps` (default 25), the Window **voids** with reason `CrossCheckDivergence`.
    - If check prints are missing after that bound, it settles single-source and is flagged in `MarketResult`.
  - **Token lane:** Switchboard Surge (TEE oracles over CEX ticks), with attested Jupiter median-of-3 as fallback. Low caps; labelled "TSLAx token price". Pin mints: impostor "TSLAx" tokens exist.
  - **Not adopted from `C:13`:** "void on exact tie", since PD-3 keeps DreamDEX's close ≥ open → Up for fidelity; and "void if > 10 bps from the official close", since the official close isn't verifiable on-chain.
  - **Optional user actions** (cheap, non-blocking): email `sales@stork.network` for a hackathon key (adds SPY/QQQ 24/5). **No Pyth trial-extension request** (user, 2026-09-13). The Polymarket × Pyth package ($0 for 30 days, then $99/mo) is the user's call.
- **PD-2: Reserve pricing defence in depth** (same-slot exclusion alone is insufficient). Parlay/Range pricing and Boost knock-out decisions use:
  - (a) only book orders that have **rested ≥ `min_rest_slots` (~20 s)**;
  - (b) a **house-conservative bound against an independent oracle fair-value model** (spot vs open, σ, time left): take the less favourable to the house-taker, and refuse with `PriceDisagreement` when book and model diverge beyond a band;
  - (c) Masayume's margin, exposure, payout and expiry caps, unchanged.

  Adversarial cross-slot tests are required (P§8). Honest users see no difference except refusals on manipulated books.
- **PD-6: Print admission deadline.**
  - A print for boundary T is admissible only while `now ≤ T + admission_sec` of the Window's policy. Attested and Switchboard prints also need `now ≥ T + min_delay_sec`.
  - **Default admission per source:**
    - Intraday Pyth / RedStone / attested: 15 min.
    - Gap-lane opening print: until the Gap Window's `lock_at`. RedStone is fetched and archived Friday, within its ≈ 24 h retention.
    - Switchboard: 60 s.
  - `public_void_expired` is allowed only when a required print is missing **and** `now > T + admission_sec`.
  - The clock makes the two mutually exclusive; tests cover both transaction orders at each source's deadline.
- **PD-7: Closure never loses claims (amended r2).**
  - Settlement writes a `MarketResult` PDA (≈ 180 B: series, policy version, prints, payout vector, void reason, single-source flag).
  - Products read results from it and register as **dependents** of a Window via CPI; they release only after capturing the result.
  - `Market` **and** `MarketResult` close together only when the Ledger is closed, `dependents == 0` and `result_retention_sec` has elapsed (default 6 h). Nothing on-chain can still reference them; the indexer keeps the history.
  - **Why not permanent:** ≈ 2,600 Windows/day × 0.0016 SOL ≈ 4 devnet SOL/day.
  - A late product claim after cleanup is a tested scenario.
- **PD-8: Ledger admission.**
  - Growable Ledger (96 seats, grown on demand up to 1,024).
  - Refundable per-seat bond (e.g. 0.25 tUSDC); empty-seat eviction.
  - PROGRAM seats pre-allocated; the vault seat aggregates any number of Trading-Balance users.
  - `LedgerFull` is an honest refusal that offers the Trading Balance route.
- **PD-3: Tie rule.** Close ≥ open → Up, exactly as DreamDEX. Stock ties at $0.01 granularity are more frequent; the maker's fair value accounts for it and the UI explains it.
- **PD-4: Private claim verification** stays off-chain against the on-chain desk key, as in Masayume.
- **PD-5: Arena escrow.** Solana has no ERC-20 allowance, so the arena escrows `pot + perCardCap × deckSize` at create/join. Unspent budget goes back to `creditOf`.

**Open user questions (recorded as `Q-###` in S0; defaults apply until answered; nothing is Excluded without an answer):**

| Q | Question | Default until answered |
|---|---|---|
| Q-001 ✅ answered 2026-09-13 | Does Agari owe **Masayume's own unfinished items**? | **Yes, build them**, in Masayume's design language:<br>- L-11 editorial landing page (S15)<br>- L-23 site and per-ticker OG images (S15)<br>- L-35 plain-position cash-out (S7)<br>- L-56 paid Memory Market (S9)<br>- L-57 Reversion preset (S9)<br>- L-71 game profile / achievements / friends (S12a)<br>- Range takes (S10b)<br>- Lifecycle notifications (S13)<br>- Fear & Greed / sentiment cell, as a real equity sentiment source or an honest unavailable state (S13)<br>- Range band on the hero chart (S10b)<br>- Duel home-tile sparkline (S12b) |
| Q-002 ✅ answered 2026-09-13 | Do the routes and rails **Masayume removed on 2026-09-04** stay removed? | **Stay removed.** `/social` (internal copy board), `/waitlist` (founder waitlist), `/creators` (X creator guide), `/creator/studio` + `/creator/recover` (card studio needing builder fees), `/studio` (founder posting tool), `/fund` page + card/bridge rows in Add money, the dead `/claims` link, and the creator earnings pool row (Y-01…Y-05, Y-18) |
| Q-003 ✅ answered 2026-09-13 | Yosuku-only extras never in Masayume | **Not built** (recorded in `parity.md`):<br>- Y-07 agent/MCP tx-builder + npm SDK + MCP server<br>- Y-08 Polymarket rail + multi-coin ticker (the Fear/Greed cell is built under Q-001)<br>- Y-09 Sensei MemWal memory<br>- Y-10 TEE-attested agent<br>- Y-11 name-service handle<br>- Y-12 encrypted rooms<br>- Y-13 TheBell widget<br>- Y-15 `/agent` showcase<br><br>Covered elsewhere: Y-06 docs moved to the docs site (L-20); Y-14 OG images built via L-23; Y-16 Trading Balance modal covered by vault controls; Y-17 native app Blocked |
| Q-004 | "Bet against stocks" depth: A-1b inverse position (own reserve) and/or **Phoenix stock perps via builder codes** (mainnet-only venue, no devnet) | A-1a (Down/Boost-on-Down/hedge) and A-1c (fade) built. A-1b built in S10c after approval. Phoenix recorded as mainnet-only, not built on devnet |
| Q-005 | Yield (A-2a): Kamino / Jupiter Lend are **mainnet-only** | Honest "mainnet only" state + design; Earn reserves (real devnet yield from spreads/fees) are the yield |
| Q-006 | Solana Mobile / Seeker (Mobile Wallet Adapter) beyond the PWA install page | PWA only (Masayume parity); MWA via Privy noted as additive |
| Q-007 | Public repo licensing for Yosuku-derived CSS (Masayume `THIRD_PARTY_NOTICES.md`) | Keep repo private until answered |
| Q-008 | Agari X account + X API consumer keys; US geofence method; corporate-action data source | **X keys are not a blocker** (user, 2026-09-13): build S11 as planned with the rettiwt key already available (@masayume_app), and test once the user creates the Agari X account and supplies keys. Geofence at S15; corporate actions at S6 |

**Research files (done 2026-09-13).** `C:06`–`C:13` are written in the repo's `context/`, so a fresh agent can open them:
- `C:06-dreamdex-engine-spec.md`: DreamDEX Event Contracts implementation-grade spec from SDK ABIs, docs and Masayume fork runs.
- `C:07-solana-orderbook-options.md`: Manifest / Phoenix / OpenBook / Monaco / build-own comparison with sources.
- `C:08-engine-and-programs-review.md`: the 26 corrections, account/instruction spec, CPI map, security results (now reflected in P§3).
- `C:09-masayume-web-explorer.md`: stack, design tokens, shell, component families, data layer, API routes, env vars, invariants, packages.
- `C:10-masayume-contracts-services-explorer.md`: contract semantics, formulas and launch params, ports, ops actors, lifecycle, env names.
- `C:11-solana-reference-patterns.md`: magicblock, templates, anchor 1.x, pyth, switchboard, kora, actions, program-examples, adopt/adapt/avoid.
- `C:12-stage-roadmap-source.md`: the roadmap agent's full output (the source of P§7).
- `C:13-affordable-equity-price-sources.md`: price-source research behind PD-1.

**Post-approval immediate actions (planner, before S0):**
1. Re-sync this file to `docs/plan/00-plan.md`.
2. Update memory `stocklana-hackathon-project.md`, whose price, Privy and Pyth lines are stale: dated price-policy versions, PD-7 amendment, Privy set, budget ≈ 55–65 SOL.

## 1. Verified facts (2026-09-13)

| Item | Fact |
|---|---|
| Keys (`.env.local`, gitignored) | **Pyth:** Demo trial (14 days, ≈ 13 left on 09-13), 25 feeds; the only equities are **TSLA, QQQ, VOO**. Verified: Hermes latest + exact-T historical + Pro history. NVDA/AAPL etc. return 403. After the trial: Starter $500/mo crypto only; Pro from $2,500/mo (unaffordable). **Alpaca paper:** IEX trades, 1-min bars, clock, calendar OK. **Finnhub:** quote, market status, earnings OK. **Helius:** devnet RPC OK. **Privy:** app id + secret set. **OpenAI:** key + `AI_MODEL=openai/gpt-5.4`, copied from Masayume's Fly ops machine. **Database:** local Postgres 16, `postgres://abu@localhost:5432/agari` (local-first per user). **X:** rettiwt key (@masayume_app) copied; X API consumer keys pending, **not a blocker**. **DFlow:** not needed |
| Price sources (researched, `C:13`) | **RedStone** public signed packages ($0): TSLA, NVDA, AAPL, AMZN, GOOGL, META, MSFT; 5 signer packages per 10 s timestamp; ~24 h history; `rust-sdk v4.0.0` targets anchor 1.0 / solana-program 3 (SBF build UNVERIFIED). Its own Solana adapter can't serve past T (3-min age limit), so we verify in-program. Feed semantics (`TSLA` vs `---EXTENDED` at 09:30 open) UNVERIFIED. **Switchboard On-Demand:** ≈ $0.002/quote; `solana-v3` feature compiles with Anchor 1.2 (the `anchor` feature fails). The crate verifier doesn't pin the queue, dedupe oracles or enforce the sample count, so we do. Surge `TSLAX/USD` quote observed with 2 oracle signatures (≥ 3 UNVERIFIED). **Chainlink Data Streams:** from $150/stream/mo, no free tier (production path). No free, fresh Pyth equity push feeds on Solana (only GLXY is sponsored, mainnet). Every free market-data API forbids public redistribution. The 16:00 bar ≠ official close |
| Rent (devnet, measured) | **5,080 lamports/byte including the 128-byte header**: 1 KB ≈ 0.00585 SOL; 57,024 B ≈ **0.290 SOL** |
| Toolchain | rustc 1.98.1, solana-cli 3.1.10 (Agave), cargo-build-sbf 3.1.10, **anchor-cli 1.1.2** (avm), **surfpool 1.5.0**, node 25.9, pnpm 11.24, yarn 1.22, bun 1.3. New shells need `~/.local/share/solana/install/active_release/bin`, `~/.avm/bin` and `~/.surfpool/bin` on PATH. `solana-dev` agent skill installed. About 21 GB disk free |
| Crates | anchor-lang/anchor-spl 1.2.0 (1.1.2 installed); pyth-solana-receiver-sdk **2.0.0** (anchor ^1.0.2 ✓); session-keys 3.1.1 (<2 ✓); ephemeral-rollups-sdk 0.17.0 (^1.0 ✓); switchboard-on-demand 0.13.0 (`default-features=false, features=["solana-v3"]` passes `cargo check` with Anchor 1.2; pin `solana-program` 3.0.0, since unpinned resolves 5.0.0; SBF build UNVERIFIED); `redstone` rust-sdk v4.0.0 (git, `solana` feature; SBF UNVERIFIED); solana-instructions-sysvar 3.0.1; **pyth-lazer-solana-contract 0.8.0 requires anchor ^0.31 ✗**; lib-sokoban 0.3.3 (bytemuck only ✓); litesvm 0.16.0 |
| JS packages (latest versions from the npm registry; installed with **pnpm**) | next 16.3.5, react 19.3, @solana/kit 8.3.0, @anchor-lang/core 1.2.0, codama 1.10.2, @codama/nodes-from-anchor 1.5.5, @codama/renderers-js 2.4.0, @privy-io/react-auth 3.42.0, @tanstack/react-query 5.102.8, @pythnetwork/hermes-client 3.1.0, @pythnetwork/pyth-solana-receiver 0.16.0 (web3.js 1), @switchboard-xyz/on-demand 3.10.6 (web3.js 1, bundles anchor 0.31; S6), @solana/actions 1.6.6, @solana-program/token 0.16.1, zod 4.6.4, motion 13.2.0, lightweight-charts 5.2.1, tailwindcss 4.3.3, drizzle-orm 0.45.2, zustand 5.0.15 |
| Pyth on devnet | Receiver `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ` and push program `pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT` are executable. The upgraded generation (`rec2HH…`, `pyt2F…`) is also deployed; the receiver SDK's `pro-compatible` feature selects it. Receiver fee 0, 3 signatures, guardian set identical to mainnet. Archived signed blobs re-verify later (no receiver staleness rule) until the router set rotates (UNVERIFIED) |
| Frontend guidance (solana-dev skill) | Kit plugin client (`walletSigner` + `solanaRpc`) + `@solana/react` (`@solana/react/query` TanStack adapters). **Do not** use `@solana/client`/`@solana/react-hooks` (framework-kit) or wallet-adapter. `NO_DNA=1` for anchor and surfpool |
| References (in `R:`) | masayume (symlink), yosuku (symlink, `3c56ef5`), yosuku-blockchain-oracle (`9f0af31`), dreamdex-markets-sdk / bot-kit / docs (symlinks), solana-templates (`fbafa61`), anchor (`905a5f3`), program-examples, pyth-examples, switchboard-examples, kora, solana-actions, magicblock-engine-examples, solora-anchor, stocklana-baskets. Stage 0 adds phoenix-v1, sokoban, ctf-exchange and BetDexLabs/protocol |

## 2. Architecture

### 2.1 System view (Masayume's shape, Solana substrate)

```text
Agari web (fork of Masayume web: routes · components · tokens · states)       Privy (auth + embedded wallets)
      │ hooks: @agari/markets/react (same names as @masayume/markets/react)          │ kit TransactionSigner seam
      ▼                                                                               ▼
packages/core  (pure domain: lifecycle, sessions, tickers, pricing math mirrors, games, projections, ports)
      │ ports: MarketsProvider · Submitter  (signatures unchanged; 0x primitives → base58)
      ▼
packages/markets  (the ONLY chain boundary)
  read runtime: @solana/kit rpc + subscriptions (Helius) · Codama decoders · indexer API client · book coordinator
  submitter sessions: one per authority (Privy/wallet · session key · runner · X executor · maker · keeper · desk · settler)
      │                                   │                                   │
      ▼                                   ▼                                   ▼
Agari programs (devnet)          Indexer projections (Postgres/Neon)   Price sources
 agari-events (engine)            markets · fills · orders · candles     Pyth Hermes (trial: TSLA/QQQ/VOO)
 vault · strategy · parlay        positions · tallies · arena · x        RedStone signed packages (single stocks, $0)
 range · leverage · maker         social                                 Switchboard Surge (xStock tokens) · attested (last resort)
 private · arena(+season)                                                Alpaca calendar + Pyth schedule (sessions)
      ▲                                   ▲
      └──── services/ops (Fly, single-writer actors): window-roller · price-relay · settler · indexer ·
            market-maker · leverage-keeper · strategy-runner · x-relay · game-room · matchmaker · duel-projector · duel-settler
```

**Data authority** (Masayume's rules):
- **Chain:** Window lifecycle, book, fills, seats, balances, grants, reserves, games.
- **Postgres (primary off-chain state):** takes, rooms, profiles, X links, runner health.
- **Rebuildable projections:** history, leaderboard, candles, traction.
- **Never financial authority:** live UI streams.

**Realtime:**
- The browser subscribes to Book, Ledger and Market accounts through one coordinator (Masayume `runtime/coordinator.ts` pattern: one normalized book per market, re-render only on real change).
- Spot price arrives over SSE from price-relay.
- Masayume's polling constants remain as fallbacks.

### 2.2 Market calendar

| Lane | Basis and print source | Cadences | Trades | Settles |
|---|---|---|---|---|
| **Regular** | Signed oracle price at exact T (PD-1). TSLA: Pyth + RedStone check during the trial. QQQ/VOO: Pyth during the trial. Single names: RedStone. After the trial: TSLA on RedStone; QQQ/VOO paused by default (attested "demo data" by opt-in). Session close labelled "oracle price at 16:00:00 ET" | 5m · 15m · 60m, back-to-back, aligned to the ET clock. No Window expires after 16:00 (13:00 on early closes) | 09:30–16:00 ET on NYSE sessions (Alpaca `/v2/calendar`) | Exact-T rule per source. Void 0.5/0.5 when no print is admitted by `T + admission_sec` (PD-6; a Pyth confidence breach during a halt means no print), or on cross-check divergence |
| **Gap** ("Monday Gap") | Opening = Friday 16:00:00 ET signed price; closing = Monday 09:30:00 ET signed price. Both from the **same policy version**, taken at the first regular print, not the official opening cross. A Pyth blob is archived at once; a RedStone package is fetched and archived Friday, then posted before `lock_at`. Only listed when one version covers Friday **and** Monday: the 09-25 weekend uses RedStone, and QQQ/VOO get no Gap after the trial. RedStone `TSLA` feed behaviour at 09:30:00 must be verified on a real Monday first (S6) | One per weekend. `lock_at` = Sunday 20:00 ET | Fri 16:00 → Sun 20:00 ET | Monday open; a holiday Monday → next session |
| **24/7 token** | xStock token price: Switchboard Surge task (e.g. `TSLAX/USD`, TEE oracles over CEX ticks) observed 10–60 s after T. Fallback: attested Jupiter Price v3 median of 3 samples around T. Verified mints only; ScaledUiAmount basis documented | 5m · 15m · 60m, continuous | Always, labelled "TSLAx token price (observed ≤ 60 s after T)" | Same rules |

**Tickers:**
- **Launch set (chosen by affordable signed sources):**
  - **TSLA:** Pyth trial + RedStone cross-check.
  - **NVDA, AAPL, MSFT, META, AMZN, GOOGL:** RedStone.
  - **QQQ, VOO:** Pyth trial; after it, paused by default (attested "demo data" only by opt-in).
- **Deferred until a signed source exists:** SPY, COIN, MSTR. They return via Stork (if a key is granted) or Chainlink in production.
- **Token lane:** TSLAx, NVDAx, SPYx, QQQx (verified mints pinned; Switchboard Surge symbols exist for all four).
- Each ticker carries Pyth feed id, RedStone feed id, Surge symbol, Alpaca symbol, verified xStock mint and logo mark in `core/market/tickers.ts`. The per-ticker source matrix and version dates live in `services/ops/config/price-sources.json` (D-003), mirrored on-chain as Series policy versions.
- **Series count:** 27 Regular (9 × 3 cadences) + 12 token (4 × 3) + up to 9 Gap = **48**. At full cadence that is ≈ **2,600 Windows/day**: 9 × ≈ 110 per session day + 4 × 408 per day.

### 2.3 Engine evidence (why an order book)

**DreamDEX Event Contracts** (Masayume's venue).

Sources:
- `M:reference/dreamdex-docs/{trading/event-contracts*.md, developers/event-contracts*.md}`
- Context7 `/websites/dreamdex_io`
- SDK ABIs `M:reference/markets-sdk/package/src/*`

What they establish:
- "Fair Odds: prices come from a live on-chain order book, not a house line."
- One YES-quoted book per window; four crossing paths including **mint-a-pair** ("two opposite-side buyers need no seller and no market maker").
- Complete sets; auto-rolled windows; multi-source oracle settlement with voids at 0.5; zero fees.
- Liquidity comes from traders plus bots: the official dreamBot Kit `ec-maker`, and Masayume's `MarketMakerVault` + maker actor.
- No DreamDEX Solidity source is public. Matching internals are reconstructed from SDK ABIs and comments, the docs, and Masayume fork runs (`M:context/41,43,44,48`).

## 3. On-chain programs

### 3.0 Build vs reuse → **own Anchor order book**

| Option | Verdict |
|---|---|
| CPI into **Manifest** (live on devnet; GPL-3.0; pinocchio + solana 2.2.1; slot expiry; no close-market) | ✗ No native mint-a-pair. A wrapper would pre-mint sets (2.6× capital lock) and need a post-fill crank. Anyone can call core `Swap`, so **window close is unenforceable**. Markets can't be closed (≈ 2.9 SOL/day per ticker for per-window markets). GPL linking |
| **Phoenix v1** (MIT since 2026-05, frozen, solana 1.14) / **OpenBook v2** (unmaintained, Anchor 0.28, crank) | ✗ Same mint-a-pair and cut-off problems; 2–3+ SOL per market; seat approval or event heap |
| **Own Anchor CLOB with DreamDEX's four-path matcher** | ✓ Faithful semantics; window end enforced in matching; recyclable books; typed CPI for products; one Codama kit client |

**Borrow, license-clean:**
- Phoenix v1 (MIT): matching loop, order packets, `self_trade_behavior`, `match_limit`, crankless trader state.
- lib-sokoban (MIT/Apache): slab node allocator.
- Polymarket `ctf-exchange` (MIT): `MatchType {COMPLEMENTARY, MINT, MERGE}`.
- BetDexLabs/Monaco (Apache): price ladder and cross-matching.
- Manifest (GPL): ideas only. Its Certora property list becomes the invariant checklist.

### 3.1 `agari-events` — DreamDEX Event Contracts rebuilt

**Semantics (must match DreamDEX):**

1. **Kinds and prices.**
   - `0 BUY_YES`, `1 SELL_YES`, `2 BUY_NO`, `3 SELL_NO`. Price is **always YES ticks**.
   - **Bid side:** BUY_YES@p, SELL_NO@p. **Ask side:** SELL_YES@p, BUY_NO@p.

   | Cross | Path | Cash | Book effect |
   |---|---|---|---|
   | BUY_YES × SELL_YES | DIRECT_YES | Buyer pays `lots·P` | YES moves |
   | SELL_NO × BUY_NO | DIRECT_NO | Buyer pays `lots·(1000−P)` | NO moves |
   | BUY_YES × BUY_NO | **MINT_PAIR** | `lots·P` + `lots·(1000−P)` | Pair minted; `backing += lots` |
   | SELL_NO × SELL_YES | **BURN_PAIR** | Sellers paid `lots·P` and `lots·(1000−P)` | Pair burned; `backing −= lots` |

2. **Fills.** A fill executes at the **maker's price**; the taker's excess escrow is refunded. Priority is price-time.
3. **Exact grid.** With 6-dp USDC: `tick = lot = 1,000 base units` (0.001). Prices are `price_ticks: u16 ∈ 1..=999`; sizes are `lots: u64`. Cash = `lots × ticks` exactly, the pair sum equals `lots × 1000`, and void 0.5 is exact. `admin_register_series` rejects grids where `lot_base × tick_base % 10^dec ≠ 0`.
4. **Order types.**
   - **Normal:** the remainder rests. If `max_fills` is exhausted while the remainder still crosses, the **remainder is cancelled**, never rested crossed.
   - **IOC:** reverts `ImmediateOrCancelNoFill` on zero fill; a partial fill cancels the rest.
   - **FOK:** reverts unless fully filled.
   - **PostOnly:** reverts `PostOnlyWouldCross`, **after** first skipping or evicting expired top-of-book orders.
   - **Self-match:** CancelTaker or CancelMaker.
   - **Expiry:** mandatory; `now < expire_ts ≤ lock_at`. Trading is allowed only while `trading_start ≤ now < lock_at`.
5. **Sells** escrow the outcome balance (no naked shorts). `mint_complete_set` / `merge_complete_set` work in Trading only. Invariant: `ΣYES == ΣNO == backing`.
6. **Lifecycle.** `Listed → Trading → Locked → Resolved | Voided`, derived from `trading_start`/`lock_at`/`expiry` plus resolution.
   - Locked allows cancels only.
   - Payout vector denominator 10⁷; win 1, loss 0, void 0.5.
   - Up wins when close ≥ open (PD-3).
7. **Fill reporting.** One batched `OrderExecuted{fills ≤ 32, evicted}` event per placement, plus `set_return_data(PlaceResult)`.

**Accounts.** Sizes include the discriminator; rent = (size + 128) × 5,080 lamports.

| Account | Kind / seeds | Key fields | Size ≈ rent |
|---|---|---|---|
| `GlobalConfig` | PDA `["config"]` | admin, `mode` (Normal/ReduceOnly/Halted; never blocks cancel, redeem or withdraw), collateral_mint, token_program (= SPL Token; **Token-2022 collateral rejected**), treasury, `rollers[4]`, `attestors[4]` (ed25519), `redstone_signers[5]` (20-byte EVM addresses, from RedStone's adapter `config.rs`) + `redstone_threshold` (3), `switchboard_queue` (pinned pubkey) + `switchboard_min_oracles` (3), `program_authorities[8]` (**seat PDAs** of vault/maker/leverage/arena/desk), `result_retention_sec` (PD-7), bump, `_reserved[64]` | 760 B ≈ 0.0045 |
| `Series` | PDA `["series", ticker u16, cadence u32, basis u8]` | `basis` (Regular/Gap/Token24x7).<br>**`policy_versions[8]`** (PD-1, append-only, immutable once written): `{valid_from_ts, valid_until_ts, primary: PrintPolicy, check: PrintPolicy (source None = no check), max_divergence_bps u16, check_admission_sec u32}`.<br>**`PrintPolicy`** ≈ 51 B:<br>- `source u8` (None/Pyth/RedStone/Switchboard/Attested)<br>- `feed_id [u8;32]` (Pyth feed id / RedStone data-feed id / Switchboard feed hash / attested source hash)<br>- `grace_sec u16` (Pyth), `min_delay_sec u16` (Switchboard; attested correction cutoff), `admission_sec u32`, `strict_sec u32` (RedStone all-signers window), `bar_len_sec u16` (attested), `max_conf_bps u16` (Pyth), `max_slot_age u16` (Switchboard)<br>Other fields: grid (`lot_base`, `tick_base`, `min_lots`), `settlement_window_sec`, `min_rest_slots` (PD-2), `seat_bond` (PD-8), `fills_cap`, `evictions_cap`, `next_index`, `last_expiry`, `free_books[4]`, bump, `_reserved` | ≈ 1,400 B ≈ 0.0078 |
| `Market` (the Window) | PDA `["market", series, index u64]` | `trading_start`, `lock_at`, `expiry`, **`policy_version u8`** (frozen at listing; versions are immutable), `open_kind`/`close_kind` (Intraday/SessionOpen/SessionClose), `open`/`close`/`check_open`/`check_close` `Print{price i64, expo i32, source_ts i64, source u8, signers u8}` (normalized to expo −8 with checked i128), `payout_yes/no u32`, `dependents u32` (PD-7), `backing_lots`, `book`, `ledger`, `mvault`, `volume_cash`, `volume_lots`, `trade_count`, `last_price`, `last_trade_ts`, `event_seq`, `rent_payer`, bumps, `_reserved`. **MarketId = this address** | ≈ 420 B ≈ 0.0028 |
| `Book` | **Keypair account**, zero-copy, **recycled per series** (created top-level with System `createAccount` + `#[account(zero)]`/`load_init`; PDAs can't be created > 10,240 B) | Header: market, series, `generation u32`, `next_seq`, `order_count`, `free_head`, `bid_bits/ask_bits [u64;16]`. `bids/asks: [Level{head,tail u32, live_lots u64}; 1000]`. `nodes: [OrderNode{lots, seq, expire_ts, placed_slot, price u16, seat u16, kind u8, flags u8, prev/next u32}; 256 or 512]`. **Order handle = (node_idx, seq)** (ABA-safe) | 512 nodes: 57,024 B ≈ **0.290 SOL**; 256 nodes ≈ 0.23 SOL |
| `Ledger` | PDA `["ledger", market]`: zero-copy header + **growable seat slab** (bytemuck slice after the header). Created with 96 seats (≤ 10,240 B) in `roller_open_window`; `public_grow_ledger` reallocs +150 seats per call up to 1,024; the payer funds rent (PD-8) | Header: market, `capacity`, `seats_used`, `open_seats`, `rent_payer`. `Seat{owner, credit, locked_cash, yes_free, yes_locked, no_free, no_locked, bond u64; open_orders u16 (cap 16), flags (PROGRAM)}` | 96 seats ≈ 0.045 SOL; 1,024 ≈ 0.39 SOL (refundable) |
| `MarketResult` | PDA `["result", market]`; closes with `Market` after retention (PD-7) | series, `policy_version`, the four `Print`s, `payout_yes/no`, `void_reason` (None/MissingPrint/CrossCheckDivergence), `single_source` flag, `resolved_ts`. A stable, small layout for products | ≈ 180 B ≈ 0.0016 |
| `mvault` | Token account `["mvault", market]`, authority = market PDA | Per-Window USDC. Isolates write locks; closed with the Ledger | 165 B ≈ 0.0015 |

**Instructions** (`subject_verb_object`; w = writable, S = signer):

| Instruction | Accounts / signer | Checks → effects |
|---|---|---|
| `admin_init_config`, `admin_register_series`, `admin_add_book` (book pre-created in the same tx), `admin_set_mode`, `admin_set_authorities` (rollers, attestors, RedStone signers + threshold, Switchboard queue + min oracles, program authorities) | admin S | Grid divisibility, feed id, authorities |
| `admin_add_policy_version(version)` | admin S; w series | Appends one PD-1 version. Existing versions are never modified. `valid_from < valid_until`. Source-specific fields present (`grace_sec` for Pyth, `strict_sec` for RedStone, …). Check source ≠ primary source. Registered ahead of phase dates (`scripts/deploy/set-policies.mjs`, ensure-style) |
| `roller_open_window(index, trading_start, lock_at, expiry, policy_version)` | roller S (in `config.rollers`), payer S; w series, market (init), ledger (init), mvault (init), book | `index == next_index`; `trading_start ≥ last_expiry`; cadence alignment (Regular/Token); `lock_at ≤ expiry`; max horizon. **The chosen version's validity covers both boundaries**, and it's the highest such version (`SourceNotCovered` otherwise). Free book → bind (`generation++`); **pre-allocate PROGRAM seats**; boundary kinds from the calendar → `WindowOpened` |
| **Print instructions, shared rules** | `which ∈ {Open, Close, CheckOpen, CheckClose}` | Source == `version.primary.source` (or `.check` for Check*). Slot empty (`PrintAlreadyRecorded`: first valid wins). PD-6 admission from that policy. Price normalized to expo −8 with checked i128 → `PrintRecorded{source, signers}` |
| `public_record_print_pyth(which)` | anyone; r `Account<PriceUpdateV2>` (owner = the receiver pinned by the SDK feature) | `VerificationLevel::Full`; feed id; **`prev_publish_time < T ≤ publish_time ≤ T + grace_sec`**; `publish_time ≤ now + 2`; `conf × 10⁴ ≤ |price| × max_conf_bps`. **CU ≈ 20–40k** |
| `public_record_print_attested(which, price, expo, bar_start_ts, fetched_at_ts)` | anyone; r Instructions sysvar | **Admission `T + min_delay_sec ≤ now`** (correction cutoff). `feed_id` (source hash) and `bar_start_ts == T − bar_len_sec` match the policy; `fetched_at_ts ≥ T + min_delay_sec`. Ed25519 instruction at `current − 1`: `num_signatures == 1`, all offsets point into that instruction, pubkey ∈ `attestors`. Message = `"agari-print-v1" ‖ program_id ‖ cluster_tag ‖ market ‖ which ‖ boundary_ts ‖ price ‖ expo ‖ source_ts ‖ feed_id ‖ bar_start_ts ‖ bar_len_sec ‖ fetched_at_ts`. Bar end == boundary. Not CPI (stack height == transaction level). **CU ≈ 15–30k** |
| `public_record_print_redstone(which, packages)` | anyone | **One package per signer** (≈ 142 B each; 5 packages ≈ 720 B, so the transaction is ≈ 1.1 KB of 1,232 B; S2 measures it, fallback is an ALT). Each package: feed id == policy; **timestamp == T·1000**; recovered signer ∈ `redstone_signers`. **Dedupe by recovered address**, so a malleated signature can't count twice. Distinct count must be `== 5` while `now < T + strict_sec`, and `≥ redstone_threshold` afterwards. Value = median of distinct signers' values. Uses `redstone` rust-sdk v4.0.0 helpers with T as the reference time, or a ~100-line in-crate verifier if its SBF build fails (S2 spike decides). **CU ≈ 140–170k for 5** (`secp256k1_recover` ≈ 25k each) |
| `public_record_print_switchboard(which)` (S6, token lane) | anyone; r Instructions sysvar, SlotHashes sysvar, queue | **Admission `T + min_delay_sec ≤ now ≤ T + admission_sec`**. Ed25519 instruction program id checked; each record's index is 0xFFFF or current (`C:13` §2.5 workaround). Queue pubkey == `switchboard_queue`. `QuoteVerifier::verify`. **Distinct** oracle indices ≥ `switchboard_min_oracles`. `clock.slot − quote.slot ≤ max_slot_age`. Feed hash == policy `feed_id`. **CU ≈ 30–60k** (profile) |
| `public_copy_open_from_prev` | anyone; r prev market | Only if `prev.expiry == trading_start`, prev has a close print, and **both use the same series and policy version** (so Friday close ≠ Monday open). Copies `close` → `open` and `check_close` → `check_open` |
| `user_place_order(kind, price_ticks, lots, expire_ts, order_type, self_match, max_fills ≤ 32, max_evictions ≤ 16, seat_hint, use_credit, withdraw_proceeds, client_id)` | authority S (wallet, or seat PDA via CPI); r config, series, mint, token_program, event_authority; w market, book, ledger, mvault, authority_token | Mode; time window; grid; `min_lots`; expiry ≤ `lock_at`; open-order cap. Escrow = credit first (if `use_credit`) then `transfer_checked`. Four-path match with eager expiry eviction (up to `max_evictions`, crediting owners). Rest/cancel/revert; refunds; counters → `PlaceResult{filled_lots, cash_spent, cash_received, credit_used, transferred_in, refunded, rested_handle, evictions}` return data + `OrderExecuted` |
| `user_cancel_orders(handles ≤ 16)`, `user_reduce_order`, `user_cancel_all(max_scan)` | authority S | Trading or Locked; stale handles skipped |
| `public_sweep_expired(max)` | anyone (ops crank) | Evicts expired orders; after `lock_at`, evicts all |
| `user_mint_complete_set(lots)`, `user_merge_complete_set(lots)` | authority S | Trading only; `backing ±= lots` |
| `user_withdraw_credit(amount)` | authority S | Pays to a token account **owned by the authority** |
| `public_settle_window` | anyone | Both primary prints present. If the version has a check source: both check prints present, **or** `now > close_T + check_admission_sec` (settle single-source, flagged), else `CrossCheckPending`. Divergence > `max_divergence_bps` at either boundary → void 0.5/0.5 with `CrossCheckDivergence`. Otherwise payout by close ≥ open (PD-3); no deadline once prints exist. **Writes `MarketResult`** |
| `public_void_expired` | anyone | A required primary print is missing **and `now > T + admission_sec`** (strictly after the last admissible second; mutually exclusive with print admission by clock) → 0.5/0.5, `MissingPrint`; **writes `MarketResult`** |
| `public_release_book` | anyone; w series, book | Status ≥ Locked **and** `order_count == 0` → zero ladders and bitmaps, back to `free_books` (so ~2 books per series suffice) |
| `user_redeem(outcome?, lots?)` | authority S | Terminal market; `open_orders == 0`. Payout = `credit + floor((yes·yN + no·nN)/10⁷)`. Partial redeem supported for PROGRAM seats |
| `public_redeem_for(seat_idx)` | anyone; w owner ATA (created idempotently by the cranker) | Non-PROGRAM seats; pays `seat.owner`'s ATA only (AD-5) |
| `public_close_ledger` | anyone | `open_seats == 0`; sweep any donated residue to treasury; close ledger + mvault → `rent_payer` |
| `public_grow_ledger(extra_seats ≤ 150)` | payer S | Realloc ≤ 10,240 B per call, capacity ≤ 1,024 (PD-8) |
| `user_release_seat` | authority S | All balances 0 and `open_orders == 0` → bond refunded, seat reusable |
| `product_add_dependent` / `product_release_dependent` | program seat PDA S (∈ `config.program_authorities`) | `dependents ±= 1`; release only after the product has captured `MarketResult` (PD-7) |
| `public_close_market` | anyone | `MarketResult` exists, Ledger closed, `dependents == 0`, `now ≥ resolved_ts + result_retention_sec` → close `Market` **and** `MarketResult` → `rent_payer` (PD-7) |

**Seat admission (PD-8):**
- The caller passes `seat_hint` (verified). A new owner takes the first empty seat and posts the refundable `seat_bond`, returned on `user_release_seat` or at redeem.
- Empty seats are reusable. The 16-order cap and `min_lots` bound per-seat book load; the bond makes multi-wallet squatting costly.
- Capacity grows on demand (`public_grow_ledger`). PROGRAM seats (vault, maker, leverage, arena, desk) are pre-allocated, so squatting can't lock products out, and the vault seat aggregates any number of Trading-Balance users.
- `LedgerFull` is an honest refusal that offers the Trading Balance route.

**Pair invariant:**
- Before settlement: `mvault ≥ backing + Σcredit + Σlocked_cash`.
- After settlement: `mvault ≥ Σ unredeemed payouts`.
- Accounting never reads raw `.amount` (donation-safe).

**Errors (one enum):** `InvalidMode`, `NotAdmin`, `NotRoller`, `BadGrid`, `BadWindowIndex`, `WindowOverlap`, `BadAlignment`, `BadHorizon`, `NoFreeBook`, `BookMarketMismatch`, `LedgerMarketMismatch`, `MarketNotTrading`, `MarketNotLocked`, `MarketNotTerminal`, `MarketAlreadyTerminal`, `InvalidPrice`, `InvalidQuantity`, `BelowMinLots`, `OrderAlreadyExpired`, `ExpiryAfterLock`, `PostOnlyWouldCross`, `ImmediateOrCancelNoFill`, `FillOrKillNotFillable`, `BookFull`, `LedgerFull`, `TooManyOpenOrders`, `SeatMismatch`, `UnknownOrder`, `NotOrderOwner`, `ReduceNotSmaller`, `InsufficientCredit`, `InsufficientOutcome`, `WrongMint`, `WrongTokenProgram`, `WrongPrintSource`, `PrintAlreadyRecorded`, `FeedIdMismatch`, `InsufficientVerification`, `PrintTooEarly`, `PrintNotUnique`, `PrintTooLate`, `ConfidenceTooWide`, `BadAttestation`, `UnknownAttestor`, `BadRedStonePackage`, `RedStoneTimestampMismatch`, `UnknownRedStoneSigner`, `InsufficientRedStoneSigners`, `SwitchboardFeedMismatch`, `SwitchboardQueueMismatch`, `DuplicateOracle`, `TooFewOracles`, `QuoteSlotStale`, `CrossCheckPending`, `UnknownPolicyVersion`, `PolicyVersionImmutable`, `SourceNotCovered`, `RetentionNotElapsed`, `CpiNotAllowed`, `PrintsMissing`, `SettlementWindowOpen`, `OpenOrdersRemain`, `ProgramSeatNotPublic`, `LedgerNotEmpty`, `MathOverflow`.

Code ranges: 6000 admin/roller, 6100 orders, 6200 prints/settle, 6300 sets/cash. `CrossCheckDivergence` and `MissingPrint` are **void reasons** stored in `MarketResult`, not errors.

**`agari-common` crate** (shared by all programs, plus TS mirrors in `packages/core` with shared vectors):
- `grid` / fixed-point.
- `PlaceResult`.
- Seeds.
- `view::load_checked`: `UncheckedAccount`, owner == `AGARI_EVENTS_ID`, discriminator, bytemuck cast, market↔book↔ledger binding.
- Book walks: `top_of_book`, `levels(side, n ≥ 32)`, `vwap_over_depth` (cost rounded up), `exit_walk`, `quote_stake` (port of `quoteBinaryStakeOverBook`: 300 bps / 10-tick slippage, refit to lot). Walks **traverse FIFO nodes, skip expired orders, and (for reserve pricing and knock-outs) count only orders rested ≥ `min_rest_slots`** by `placed_slot` (PD-2).
- `print`: per-source verifiers (`pyth`, `redstone`, `switchboard`, `attested`) as pure functions over bytes + policy + T, so they can be unit-tested with real fixtures.

### 3.2 Product programs (Masayume families → Anchor)

**Common rules:**
- Engine reads go through `view::load_checked`; engine writes go through typed CPI `Program<AgariEvents>`.
- Each product's seat authority is its `["seat"]` PDA and always uses `withdraw_proceeds = true`, so the program's token account equals its `liquid` (Masayume `_collect` invariant).
- Products book results from `PlaceResult` return data (drop `AccountLoader` borrows before CPI).
- Masayume iterables become fixed inline arrays (no `init_if_needed`, no unbounded remaining accounts).
- Every product position that references a Window (vault position, Range round, Parlay leg, Boost position, maker window, desk slot, arena card) calls `product_add_dependent` on open and `product_release_dependent` once it has captured `MarketResult` (PD-7).
- Reserve pricing (Parlay, Range) and Boost knock-out decisions use book walks over **rested** orders only and the oracle-model bound (PD-2).
- No product program CPIs another product program.

| Program | Owns | Engine CPIs | Keep from Masayume / Solana deltas |
|---|---|---|---|
| `agari-vault` (EventVault + VaultTally + VenueGateway) | `VaultConfig`; `Account ["acct", owner]{available, private_available, totals}`; `Grant ["grant", owner, kind]{actor, caps, budget, expires, spent_day, spent_today, open_positions, nonce, revoked}`; `VaultPosition ["pos", owner, market]{yes, no, kind, nonce, tally}`; `VaultWindow ["vwin", market]{yN, nN}`; USDC shards `["usdc", owner[0] % 8]` | `place`/`place_for` → IOC, CancelTaker, `use_credit = false`; `vault_settle_window` → `user_redeem` once | Check order exactly: live → price cap → worst-case escrow ≤ budget → place → per-trade cap on actual spend → daily cap (UTC day) → budget → open-position cap. Sale proceeds go to owner `available`. `crank_settle` credits `floor(pos × num / 1e7)`. Grant nonce so re-grants don't corrupt counts. Kinds: SESSION, EXECUTOR, STRATEGY, GAME_SESSION, CLAIM_ONLY. Owner-only withdraw to the owner ATA |
| `agari-strategy` (StrategyRegistry) | `Strategy ["strategy", id]` (metadata ≤ 256 B), `Subscription ["sub", strategy, subscriber]` | — | Reads `Grant` (owner, seeds, kind, actor == runner, within envelope). Fee → creator ATA. Envelope fixed for life; revision bumps |
| `agari-parlay` (ParlayReserve + ParlayPricing/Math) | `Reserve{liquid, locked, shares, params, expiry_locks[32]}`, `Share`, `Parlay ["parlay", owner, nonce]` (≤ 4 legs devnet) | — | Leg price = house-conservative bound of VWAP over **rested** depth vs oracle model ± band; refuse `PriceDisagreement` (PD-2). `ParlayPricing/Math` + vectors; correlation floor (λ); margin/exposure/expiry caps; permissionless `resolve_leg`/`claim` → owner. Legs = (Market, Book) remaining accounts, dedup + binding checked |
| `agari-range` (RangeReserve + RangePricing/Math; WindowQuestion replaced by Window prints) | Reserve (same shape), `Vol ["vol", series]`, `Round` | — | Φ table + probit + σ per ticker; centre = two-sided VWAP over **rested** depth, bounded by the oracle-model centre ± band, refuse on disagreement (PD-2); band inclusive; refuses until the opening print is recorded; settles from `MarketResult` or void (PD-7); `void_stale`; Moonshot = saturated bands |
| `agari-leverage` (LeverageReserve + LeverageGateway/Math) | Reserve + `open[256]`, `LWindow ["lwin", market]{fronted}`, `Position` | IOC buy/sell; partial redeem | `LeverageMath` + vectors; mark = `exit_walk − 1` (knock-out decisions over **rested** depth, PD-2); knock-out; exit split; withdraw blocked while expired positions are unsettled; refuses once Locked or halted (UI says why) |
| `agari-maker` (MarketMakerVault + MakerGateway) | `MakerVault{params incl. max_open_windows, liquid, shares, maker, paused, open[64]{market, lock_at, WindowBook}}` (64 = Masayume's hard max; launch set of 24 regular + token Windows fits), `Share` | `quote` → 2× PostOnly (BUY_YES@bid, BUY_NO@ask); `pull` → `user_cancel_all`; `merge` (before `lock_at`); `settle` → sweep + redeem | Escrow `lots·p` + `lots·(1000−p)`; `credit_used` = Masayume `escrowBack`; `minSpread`; per-window caps; shares at a conservative price; withdraw waits for expired Windows |
| `agari-private` (PrivateDesk + PrivateGateway) | `Desk{pool, owed, in_slots, desk, params}`, `Budget ["budget", owner]`, markers `["charge"/"credit", owner, key]` (init fails on reuse), `Slot ["slot", id]` (no owner) | `mint_in_slot` → IOC through **one desk seat**; `settle_slot` → partial redeem | Owner **or** slot, never both; stake-first walk with escrow ≤ stake; ed25519 claim verified off-chain against the desk key (PD-4) |
| `agari-arena` (GameArena + ArenaMatches/Agents/Commitment/Gateway + SeasonPrizePool) | `Match ["match", id]{cards[8], picks[16], masks, pnl, agents[2]}`, `Tier`, `Credit ["credit", player]`, `Season ["season", id]` | `place_pick` → IOC; `settle_card` → partial redeem | Full lifecycle and refund branches; keccak256 commitment (`sol_keccak256`, same packing; `chainId` → cluster id, `arena` → program id; regenerate the golden vector); per-card-budget escrow (PD-5); season deposit/distribute (winner ATAs checked) |

**Fees and gas:**
- Privy native sponsorship covers embedded wallets.
- The `api/sponsor` co-sign route (external wallets, session keys) enforces a **spending policy**, not just an allowlist:
  - **Instructions:** exact allowlisted discriminators per Agari program (place/cancel/redeem/grant-scoped ops); max 2 signatures.
  - **Sponsor role:** fee payer only. Never another writable or signer account, never the `payer` of an `init`, never a transfer source.
  - **Fees:** `SetComputeUnitLimit ≤ 400k`, `SetComputeUnitPrice ≤ cap` (0 on devnet by default); total fee from `getFeeForMessage` ≤ `max_fee_lamports`.
  - **Simulation:** run before signing; reject if the sponsor's balance delta exceeds the fee cap.
  - **Rent:** only through explicit sponsor-rent routes (e.g. a claim ATA) with a per-tx rent cap.
  - **Budgets:** per address/day, per device/day, and a global daily lamport budget with circuit breaker, tracked in the DB; `/status` shows remaining budget.
  - Deposits are never sponsored.
- Randomness stays Masayume's server-seed commit–reveal.

### 3.3 CPI depth, locking, compute, devnet SOL

**CPI depth (max 4):**

| Path | Depth |
|---|---|
| wallet → events → token/emit | 2 |
| session key/runner/executor → vault → events → token | 3 |
| maker → maker → events | 3 |
| user → leverage → events | 3 |
| desk → private → events | 3 |
| player/agent → arena → events | 3 |
| parlay/range → token | 2 |

**Locking.**
- A trade write-locks only `{market, book, ledger, mvault}` of one Window. Config and Series stay read-only, so lanes run in parallel.
- Serialized by design: the maker key; reserve state on open; vault token shards (8).

**Compute** (estimates; profile with Surfpool `profileTransaction` in S2):

| Operation | CU |
|---|---|
| IOC, 10 fills | 60–90k |
| Vault-wrapped IOC | 110–150k |
| Maker quote | 80–120k |
| 4-leg parlay | 100–250k |
| Leverage open | 150–200k |
| Pyth print | 20–40k |
| RedStone print, 5 packages (3 packages after `strict_sec`) | 140–170k (90–110k) |
| Switchboard print | 30–60k |
| Attested print | 15–30k |
| Settle (with cross-check) | 15–30k |

Defaults: `max_fills` 16 (cap 32); `max_evictions` 16; compute limit = simulation + 10%.

**Devnet SOL** (5,080 lamports/B; 48 series, ≈ 2,600 Windows/day at full cadence, P§2.2):

| Item | SOL |
|---|---|
| Programs | ≈ 3.5–5 MB `.so` ≈ **18–25**, plus ≈ 5 refundable deploy buffer at peak |
| Series | 48 × ≈ 0.0078 ≈ **0.4** |
| Books | ≈ 87 (2 per Regular/token series, 1 per Gap series): 512-node for Regular 5m/15m (36 × 0.29), 256-node elsewhere (51 × 0.23) ≈ **22** |
| Live Ledger + mvault float | ≈ 0.05 each × 2–3 concurrent per series ≈ **6–7**, returned at close (a grown Ledger holds up to ≈ 0.39) |
| `Market` + `MarketResult` | ≈ 0.0044 per Window, reclaimed after `result_retention_sec` (6 h) → ≈ **3** steady float |
| Pyth `PriceUpdateV2` | ≈ 0.0013 each; **the relay closes each after recording** (otherwise ≈ 0.3 SOL/day) |
| Fees | Prints ≈ 5,000–20,000 lamports each; Switchboard batches ≤ 8 feeds per quote → ≪ 0.1 SOL/day |

**Budget ≈ 55–65 devnet SOL, spread across stages.** Development drives run on Surfpool to save devnet SOL. Fallback if SOL-bound: fold `agari-strategy` into `agari-vault`, and parlay with range; 256-node books everywhere; shorter `result_retention_sec`. Program packaging is not user-visible; cadences are never cut.

### 3.4 Security checklist (solana-dev `security.md`)

| Area | Rule |
|---|---|
| Owner, type and binding checks | `load_checked`; market↔book↔ledger↔mvault↔series bindings |
| Signers, programs, init | `Signer` / PDA `invoke_signed`; pinned token program; typed `Program<>`; no `init_if_needed`; `#[account(zero)]`; marker PDAs |
| Duplicate accounts | Anchor 1.x deny default; manual dedup for parlay legs, arena cards, season winners, batched `redeem_for` (count + owner + discriminator + seeds) |
| Math | Exact grid; floor on void; Masayume reserve rounding; checked math; `try_from` casts; i128 print normalization |
| Donation-safe close | Sweep residue then close; never read `.amount` for accounting |
| CPI hygiene | Drop loaders before CPI; return data, not stale re-reads; engine never CPIs products (self `emit_cpi` only) |
| Front-running | `max_stake`, `min_qty`, `min_proceeds` pinned; rested-age filter + oracle-model bound (PD-2) |
| Ed25519 (attested) | Offsets + stack-height checks; domain-separated message with program id, cluster and market |
| Oracle prints (PD-1/PD-6) | Exact-T rule per source; first valid print wins; policy versions immutable and referenced by Window.<br>- **Pyth:** receiver owner pinned by the SDK feature; Full verification; feed id; uniqueness.<br>- **RedStone:** signer allowlist in config; dedupe by recovered address; all 5 signers inside `strict_sec` (anti-selection); timestamp == T·1000; feed id; value byte-size bounds.<br>- **Switchboard:** ed25519 program id + index check; pinned queue pubkey; distinct oracle indices ≥ min; SlotHashes age (blocks cross-cluster replay, since devnet and mainnet share oracle keys); feed hash pinned; clock-bounded admission.<br>- **Cross-check:** settle can't skip a pending check. Roller never lists outside version validity |
| Trust assumptions (README) | Upgrade authority (devnet); roller, attestor and relay keys; operator actors; oracle trust (Pyth guardian/router set, RedStone 5 signers, Switchboard TEE queue and its authority); Switchboard relay may choose among quotes inside the 10–60 s window (low caps) |

## 4. Off-chain services (`services/ops`, one Fly machine, single writer per key)

Masayume conventions: `{tsMs, actor, why}` logs, `/health`, DRY_RUN inversion documented, reconcile before send, never resend.

| Actor | Origin | Responsibility | Key |
|---|---|---|---|
| `window-roller` | NEW | Session calendar (Alpaca calendar ∩ Pyth schedule; lists nothing on disagreement). Opens Regular/Gap/Token Windows at boundaries with the highest policy version covering both boundaries; **skips (and reports "paused: no signed source") when none covers them**. Idempotent (skip existing PDA). Sweep-expired + release-book cranks; closes Ledgers when empty, and Markets + results only when `dependents == 0` and retention has elapsed (PD-7). Grows Ledgers near capacity (PD-8). Split-day skip list (`config/corporate-actions.json`) | `ROLLER_PRIVATE_KEY` |
| `price-relay` | NEW | Per boundary, per the Window's policy version (PD-1). It fetches, schedules and archives; transactions are built by `packages/markets/src/prices/*` (P§6):<br>- **Pyth trial:** `GET …/hermes/v2/updates/price/{T}` at T + 2 s → post `PriceUpdateV2` to the matching devnet receiver → `public_record_print_pyth` → **close the update account** (reclaim rent). **Archive every signed blob** for the proof replay.<br>- **RedStone:** fetch all 5 signer packages for timestamp T at T + 10–15 s (retry; history ≈ 24 h) and **archive them in Postgres** → `public_record_print_redstone`. Also posts TSLA check prints during the trial.<br>- **Switchboard Surge** (S6): request a quote at T + 10 s (≤ 8 feeds per quote), post at once.<br>- **Attested** (opt-in only): Jupiter median-of-3 token fallback, or ETF "demo data" if the user opts in; signed by a separate `PRICE_ATTESTOR` ed25519 key.<br>Also: spot SSE for web and maker | `PRICE_RELAY_PRIVATE_KEY`, `PRICE_ATTESTOR_PRIVATE_KEY`, `PYTH_API_KEY` (server-only) |
| `settler` | NEW | `public_settle_window` (retries on `CrossCheckPending` until the check bound), `public_void_expired`, `public_redeem_for` over non-PROGRAM seats, `vault_settle_window`, `public_close_ledger`, `public_close_market` | `SETTLER_PRIVATE_KEY` |
| `indexer` | NEW (replaces the DreamDEX GraphQL indexer) | **Ingestion contract:**<br>(1) discover signatures via Helius `logsSubscribe({mentions:[program]})` plus paged `getSignaturesForAddress` backfill;<br>(2) fetch `getTransaction(sig, {maxSupportedTransactionVersion: 0, commitment: "confirmed"})`;<br>(3) **skip failed txs** (`meta.err != null`);<br>(4) decode `emit_cpi!` events from the **inner instructions** of Agari programs: data starts with Anchor `EVENT_IX_TAG` (`0x1d9acb512ea545e4` LE), then the event discriminator (IDL/Codama decoders); logs are not used for events;<br>(5) idempotent upserts keyed `(signature, inner_ix_index)`, plus `(market, seq)` gap detection that triggers backfill;<br>(6) rows land `confirmed`; a finality sweep promotes them to `finalized` and removes dropped txs;<br>(7) the per-program cursor (last finalized slot + signature) advances **in the same DB transaction** as projection writes;<br>(8) reconnect = backfill from the cursor, then resume;<br>(9) full rebuild = truncate projections and replay from the deploy slot.<br>Served at `/api/index/*` with Masayume row shapes | Helius key (server-only) |
| `market-maker` | port | S3 `seat` mode then S8 `vault` mode. Fair value = ec-oracle-follow z-score (spot vs open, σ, time left, tie adjustment). Post-only two-sided quotes; requote on move or TTL; merge before `lock_at`; quote only in session; pull on halt; flatten before the close | `MAKER_PRIVATE_KEY` |
| `leverage-keeper`, `strategy-runner`, `x-relay`, `game-room`, `matchmaker`, `duel-projector`, `duel-settler`, `private-desk` | port | Masayume loops on kit sessions. Cursors come from indexer events instead of EVM logs | Per role |

**Web routes kept and re-pointed:**
- `sponsor`, `faucet` (tUSDC mint authority + devnet SOL top-up; challenge and quota policy)
- `private/*`, `room/*`, `takes`, `x/*`, `sensei`, `strategies/*`, `games/*`
- `leaderboard`, `traction`, `status`, `news` (Finnhub)
- `index/*`, `actions/*` (Blinks)

## 5. Web app (fidelity port)

**Strategy: source-led fork.** Copy Masayume `web/`, `packages/{core,brain,db}`, `services/ops`, `scripts/invariants` and workspace config. Replace only the chain seam. Attribution stays in `THIRD_PARTY_NOTICES.md`.

**Exact (unchanged):**
- **Stack:** Next 16 App Router, React 19, Tailwind 4, shadcn `base-nova` over `@base-ui/react`, TanStack Query 5, zod 4, `motion`, `lightweight-charts`, canvas share cards, lucide, `ai` v7 + `packages/brain`, postgres.js + `ensureSchema()`, idb-keyval.
- **Design system:** `web/src/styles/**`:
  - Yosuku `part-01…18.css`, `bridge.css`, `tokens.css`, 36 surface files, `base.css`.
  - Palette `#050505` / vermilion `#E04D26` / profit `#34D399` / loss `#FB7185`.
  - Fonts Sora, Inter, JetBrains Mono, Noto Serif JP.
  - `data-theme` dark/light plus `THEME_INIT_SCRIPT`; reduced-motion kill switch; games audio and haptics.
- **Shell and states:** ShellChrome, header, MobileBottomNav, `nav-items.ts`, AppStrip, states components, receipts, data atoms.
- **Data contracts:** `Reading<T>` + `Diagnosis`, `useReadingQuery`, query-key families, polling constants, IntentJournal recovery.
- **Code conventions:** feature folder convention; `pnpm invariants`.

**Adapted (behind existing seams):**

| Seam | Masayume | Agari |
|---|---|---|
| `packages/markets` (10.6k L) | DreamDEX SDK + viem implementing `core/ports` and `@masayume/markets/react` | Solana implementation of the **same port interfaces and hook names**: `@solana/kit` + Codama clients + indexer API; same file map (`runtime/`, `provider/`, `submitter/`, `sessions/`, `react/`, products) |
| Primitives | `Hex`/`Address`/`Bytes32` (0x) | Base58 `Address`, `Signature`, `Hash32`; `MarketId` = Market PDA; one `ids.ts` |
| Asset identity | `BTC`/`ETH`, `ORACLE_PRICE_SCALE` | `Ticker` registry (P§2.2); ticker picker with filter and paging |
| Market hours | 24/7 cadences | `core/market/session.ts`: `pre`, `regular`, `post`, `closed`, `holiday`, `early-close`, `halted`; honest "Opens Mon 09:30 ET" states; lanes Regular/Gap/Token |
| Wallet shell (7 files) | wagmi + RainbowKit | **Privy** (`@privy-io/react-auth` Solana embedded wallets + `toSolanaWalletConnectors()`) adapted to a kit `TransactionSigner`, plus the kit client (`solanaRpc`) and `@solana/react` `ClientProvider`; HeaderAccount styling kept |
| Message signing (11 files) | viem sign/verify | ed25519 `signMessage` + server verify via `core/auth/signed-message.ts` |
| Tap trading | Session key + EventVault grant + gas top-up | kit `KeyPairSigner` in IndexedDB + `agari-vault` SESSION grant + sponsor co-sign |
| Sponsor / faucet | Forwarder / STT | Fee-payer co-sign allowlist / tUSDC mint + devnet SOL top-up |
| Proof links | Somnia explorer + OracleHub | Solana Explorer devnet links + per-source print proof: Pyth publish time and price; RedStone timestamp and signer count; Switchboard slot and oracle count; attested bar labelled "demo data"; cross-check agreement in bps or "single source" |
| Sensei / agents / news | Crypto wording | Stock wording, session awareness, earnings context (Finnhub), advice Brake; Finnhub news |
| Brand | `BRAND` = Masayume | `BRAND` = **Agari**; manifest, marks, storage prefixes; tokens unchanged |

**Removed noise:**
- The `@coinbase/cdp-sdk` stub.
- DreamDEX-specific invariants (`sdk-import-boundary`, `sdk-version-pin`, `address-drift`, `generated-abi`, `vault-abi-shape`), replaced by `no-evm`, `kit-import-boundary`, `idl-no-destination` (AD-5) and `program-id-drift`.

## 6. Repository structure and conventions

```text
stocklana/  (repo "agari")
├─ anchor/                      Anchor workspace (Anchor.toml, Cargo.toml, rust-toolchain.toml)
│  ├─ programs/agari-{events,vault,strategy,parlay,range,leverage,maker,private,arena}/src/
│  │     lib.rs (dispatch only) · instructions/*.rs · state/*.rs · math/*.rs · matching/*.rs (events) · events.rs · errors.rs · constants.rs
│  ├─ crates/agari-common/      grid, seeds, PlaceResult, view::load_checked, book walks
│  └─ tests/                    targeted LiteSVM tests + vectors/ (shared JSON)
├─ packages/{core,markets,clients,brain,db}
├─ services/ops/                actors (P§4), calendar/, http/{health,spot-sse}
├─ web/                         Masayume fork (P§5)
├─ scripts/{invariants,deploy,drive,env-check.mjs,probe-keys.mjs}
├─ docs/plan/                   00-plan.md · STATUS.md · decisions.md · acceptance.md · parity.md · references.md · specs/ · stage-NN-*.md
├─ CLAUDE.md                    30-line read order + gates
├─ context/                     research (history)
└─ reference/                   clones + symlinks (gitignored)
```

**Conventions:**
- **Files:** hard cap 400 lines (TS/TSX/CSS/RS/MJS), target ≤ 300.
- **Boundaries:**
  - Only `packages/markets` imports `@solana/*`, `@solana-program/*`, `@agari/clients`, `@pythnetwork/*` or `@switchboard-xyz/*` (Privy provider island exempt).
  - web3.js-1 oracle SDKs are confined to `packages/markets/src/prices/legacy/**` (the `kit-import-boundary` invariant enforces it).
  - Only `packages/markets` sends transactions. ops actors, including `price-relay`, use its sessions and `prices/*` builders.
  - `packages/core` stays pure.
- **Money:** integer base units; YES ticks `u16`; lots `u64`; no floats on money paths; time fields suffixed `Ms`/`Sec`/`Ns`.
- **Programs:**
  - Anchor pinned `=1.1.2`. S0 spikes 1.2.0 with pyth-receiver 2.0.0 and switches only if everything resolves (D-002).
  - `InitSpace`, `_reserved`, enum state machines, batched `emit_cpi!` with `seq`, checked math, `transfer_checked`, canonical bumps, `OperatingMode`.
- **Clients:** Codama per program (checked in, `pnpm codegen`, deterministic); no hand Borsh.
- **Package manager: pnpm only** (user preference). All JavaScript and TypeScript tooling runs through pnpm:
  - pnpm 11.24 workspace with Masayume's catalog; root `packageManager: "pnpm@11.24.0"`.
  - `pnpm add` / `pnpm dlx` instead of npm / npx / yarn / bun.
  - `Anchor.toml` `[toolchain] package_manager = "pnpm"`; templates that assume yarn are converted.
  - Only `pnpm-lock.yaml` is committed. The `pnpm-only` invariant rejects `package-lock.json`, `yarn.lock` and `bun.lock*`.
- **CLI:** `NO_DNA=1 anchor …` / `NO_DNA=1 surfpool …`. Localnet is Surfpool (mainnet-fork, time travel, Pyth scenario templates); target cluster devnet.
- **Tests:** targeted only (P§8). Masayume golden vectors reused: `M:packages/core/src/{vault/caps,parlay/pricing,range/pricing,range/moonshot,leverage/sizing}.vectors.json`.
- **Secrets:**
  - `.env.local` per package (gitignored), `.env.example` names only.
  - Role keypairs in `~/.config/agari/devnet/<role>.json`; program keypairs backed up to `~/.config/agari/programs/`.
  - **Data-provider keys (Pyth, Alpaca, Finnhub, Jupiter) are server-only:** ops and route handlers; the browser gets data via SSE and `/api/*`.
  - **The browser RPC must not leak the Helius key:** either Helius RPC access control (domain allowlist) or a thin `/api/rpc` proxy with method allowlist and rate limit; decided in S4.

## 7. Stages (resumable)

### 7.1 Resume protocol

**Files created in S0.** Each ≤ 400 lines; split as needed.

| File | Contents |
|---|---|
| `CLAUDE.md` | Read order below, P§6 conventions, gate commands, "never trust memory over STATUS.md" |
| `docs/plan/00-plan.md` | This plan, verbatim; changed only via `decisions.md` |
| `docs/plan/STATUS.md` | The single resume pointer (template below) |
| `docs/plan/decisions.md` | `D-###` (date, owner, evidence, rule, user-visible consequence, approval) + `Q-###` open user questions naming the rows they block |
| `docs/plan/acceptance.md` | Evidence ledger: UTC, stage, scenario, parity rows, commit, devnet tx link, result, artifact. **Failed transactions stay in** |
| `docs/plan/parity.md` | Every row of `C:05` (L-01…L-74, Y-01…Y-18, A-1a…A-3d): class, status (`Pending/Shell/Partial/Done/Blocked`), owning stage, evidence. Rows only added or advanced |
| `docs/plan/stage-NN-<slug>.md` | Stage block below with checkboxes + `## Findings` + `## Handoff` |
| `docs/plan/specs/<program>.md` | Per-program spec derived from Solidity + tests + P§3 (one truth for parallel agents) |
| `docs/plan/references.md` | Each clone: URL, pinned SHA, licence, allowed use (code or ideas only) |

**`STATUS.md` template:**
```md
# STATUS — updated <UTC> by <agent/session>
Current stage: S4 (in-progress)   Sub-slices: 4a done · 4b in-progress (wt ../agari-wt/s4b) · 4c todo · 4d todo
Last green commit (gate passed): <sha> "<msg>"      Last commit: <sha> "<msg>"
In-flight step: S4b.5 journal reconcile — touches packages/markets/src/submitter/**; chain side-effects: none
Done: S0 ✅ S1 ✅ S2 ✅ S3 ✅ | Milestones: M0 ✅ M1 ☐
Blockers: B-3 X_API_KEY missing (user) since 09-13 — blocks S11 live test only
Env readiness (presence only): PYTH ✅(trial → 09-27) ALPACA ✅ FINNHUB ✅ HELIUS ✅ PRIVY ✅ DATABASE_URL ✅(local) X_API ☐ …
Price sources: TSLA pyth+redstone(check) · QQQ/VOO pyth (until 09-25 close) · single names redstone · token switchboard
Devnet addresses: scripts/deploy/addresses.devnet.json @ <sha>
Next action: <one imperative sentence a fresh agent can start immediately>
```

**Fresh-agent read order:**
1. `CLAUDE.md`
2. `STATUS.md`
3. The current stage file: first unchecked box + `## Handoff`
4. The last 10 `D-` entries and all open `Q-`
5. Only the plan sections the stage names
6. The stage's "Open first" sources

Then run `git status && git log --oneline -5`, confirm HEAD matches STATUS, and run the fast gate before editing.

**Progress rules:**
- Tick a checkbox in the **same commit** as its artifact.
- Update the STATUS `In-flight` line at step start.
- Append an `acceptance.md` row for every devnet transaction.
- Advance `parity.md` only at stage gates.

**Commits:**
- One per step or smaller. Never end a session dirty: use `wip(S4b.5): …`.
- Format: `<feat|fix|chore|docs>(S<n><slice>.<step>/<area>): <summary>`, with trailers `Stage:`, `Parity:` and the required attribution trailers.
- Gate commit `docs(plan): S<n> gate passed` moves "last green".

**Branches:**
- `main` is always gate-green.
- `stage/S<n>-<slug>`; parallel slices `slice/S<n><x>-<slug>` in worktrees `../agari-wt/<slice>`.
- Shared append-only files are merged by the stage owner: `lib.rs` dispatch, error code ranges, `Anchor.toml`, `addresses.devnet.json`, `services/ops/src/main.ts`, sponsor allowlist.

**Idempotent resume:**
- A dirty worktree is finished or reverted, never blind-reset.
- Every chain step has a read-only verify command; skip it if the state exists.
- Deploy and init scripts are ensure-style: read the addresses JSON, create only what's missing, **fail loudly on parameter drift**, never regenerate existing keypairs.
- `pnpm codegen && git diff --exit-code packages/clients`.
- `ensureSchema()` is idempotent.
- Drive scripts accept `RESUME_*` ids.

**Env checklist** (`pnpm env:check` prints presence only):
- **Root:** `PYTH_API_KEY`, `ALPACA_{ENDPOINT,KEY_ID,SECRET_KEY}`, `FINNHUB_API_KEY`, `HELIUS_API_KEY`, `JUPITER_API_KEY` (optional).
- **Already in `stocklana/.env.local` (2026-09-13):** Pyth (trial), Alpaca, Finnhub, Helius, `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `OPENAI_API_KEY` + `AI_MODEL=openai/gpt-5.4` (from Masayume's Fly ops), `DATABASE_URL=postgres://abu@localhost:5432/agari` (local Postgres 16), `X_HANDLE` + `X_RETTIWT_API_KEY` (@masayume_app), and freshly generated `ROOM_TOKEN_SECRET` / `X_SESSION_SECRET` / `GAME_DECK_KEY`. Pending and not blocking: `X_API_KEY` / `X_API_KEY_SECRET`. S0 splits these into root, web and ops `.env.local` files. RedStone needs no key.
- **Web:** `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_SOLANA_RPC_URL`/`_WS_URL`, `DATABASE_URL`, `SPONSOR_PRIVATE_KEY`, `FAUCET_MINT_AUTHORITY_PRIVATE_KEY`; LLM keys (S13); X OAuth + `X_SESSION_SECRET` (S11); `ROOM_TOKEN_SECRET` (S12b).
- **Ops:** `ROLLER_`, `PRICE_RELAY_`, `PRICE_ATTESTOR_`, `SETTLER_`, `MAKER_`, `LEVERAGE_KEEPER_`, `RUNNER_`, `X_EXECUTOR_`, `PRIVATE_DESK_`, `GAME_DECK_`, `GAME_SETTLER_`, `SEASON_ADMIN_` `PRIVATE_KEY`; X cookies; optional `REDSTONE_GATEWAY_URLS` (default: public gateways) and `SWITCHBOARD_CROSSBAR_URL` (default public; 429-limited, self-host if needed). Source matrix and dates: `services/ops/config/price-sources.json`.

### 7.2 Stages

#### S0 — Bootstrap and authority (M0 "the fork builds")

**Goal:** a git repo containing Masayume's exact tree renamed to Agari (still EVM) that builds; toolchain pinned; references cloned; keys probed; plan files in place.

**Open first:**
- `C:05` §1, §6
- P§1, P§6
- `M:package.json`, `M:pnpm-workspace.yaml`
- `M:docs/architecture/yosuku-source-led-migration/05-migration-and-agency-handoff.md`
- `R:solana-templates/kit/nextjs-anchor/{anchor,codama.json}`, `R:solana-templates/kit/nextjs` (wallet plugin client)
- `C:06`–`C:12` (session research written right after plan approval; confirm present before S0)

**Steps:**
- [ ] `git init` in `/Users/abu/dev/hackathon/stocklana`; `context/` tracked, `reference/` and `data/archive/` ignored.
- [ ] Import the pinned tree: `git -C …/sommina-events archive 68f7a09 web packages services scripts package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts THIRD_PARTY_NOTICES.md | tar -x`. Record D-001 (provenance + SHA).
- [ ] Rename `@masayume/*` → `@agari/*`, `BRAND`, manifest, marks, storage prefixes `masayume.` → `agari.`. Record the remaining `grep -ri masayume` hits for S15.
- [ ] `pnpm install && pnpm typecheck && pnpm build` green on the renamed EVM tree (baseline proof).
- [ ] D-002 toolchain: spike a throwaway program with `anchor-lang =1.2.0` + `pyth-solana-receiver-sdk 2.0.0` + `redstone` rust-sdk v4.0.0 (git rev pinned, `solana` feature) + `switchboard-on-demand 0.13.0` (`solana-v3`, `solana-program` 3.0.0 pinned). **SBF build (`cargo build-sbf`), not just `cargo check`.** Pin 1.2.0 if everything builds, else `=1.1.2` (CLI + crates, `rust-toolchain.toml`). Record which oracle crates failed; S2 uses in-crate verifiers for those. Also decide the Pyth receiver feature (default vs `pro-compatible`) by checking which receiver the trial's Hermes updates verify against on devnet.
- [ ] **Time-sensitive: start the Pyth trial archiver** (the trial ends ≈ 09-27). `scripts/archive/pyth-trial.mjs` saves signed Hermes updates (`encoding=base64`) for TSLA/QQQ/VOO at every 1-minute session boundary, backfilling from the first trial session (historical works with the key). Output goes to gitignored `data/archive/pyth/`, and it runs in the background until the trial ends. Also save RedStone TSLA/NVDA packages at every 5-minute boundary (`data/archive/redstone/`; ≈ 24 h retention, so it must run continuously) until the S3 relay takes over. One archived 16:00:00 blob and package become S2 test fixtures.
- [ ] Scaffold `anchor/` (Anchor.toml with `package_manager = "pnpm"`, workspace Cargo.toml, `crates/agari-common` stub) + `codama.json` + `pnpm codegen` / `pnpm anchor:build` scripts.
- [ ] pnpm-only: root `packageManager: "pnpm@11.24.0"`, `pnpm-only` invariant rule, remove any non-pnpm lockfiles.
- [ ] Clone and pin in `references.md`:
  - `Ellipsis-Labs/phoenix-v1` (MIT)
  - `Ellipsis-Labs/sokoban` (MIT/Apache)
  - `Polymarket/ctf-exchange` (MIT)
  - `BetDexLabs/protocol` (Apache)
  - `Bonasa-Tech/manifest` (GPL, ideas only)
- [ ] Add the Solana Developer MCP (`https://mcp.solana.com/mcp`) to the project `.mcp.json`; confirm Context7 ids `/websites/anchor-lang`, `/anza-xyz/kit`, `/llmstxt/privy_io_llms_txt`, `/tanstack/query`.
- [ ] Role keypairs (outside repo); `scripts/deploy/roles.mjs` prints pubkeys. Fund the deployer (target 55–65 devnet SOL over time; record balance).
- [ ] `.env.local` / `.env.example` for root, web and ops; `scripts/env-check.mjs`.
- [ ] Rerun `scripts/probe-keys.mjs`: Pyth trial feeds (TSLA/QQQ/VOO) with the exact trial end timestamp; RedStone gateway latest + historical packages for TSLA (confirm 5 signers per timestamp and the signer addresses against the adapter `config.rs`); Jupiter Price v3. D-003 records the per-ticker source matrix and policy-version dates (PD-1) in `services/ops/config/price-sources.json`. Optional user email: Stork hackathon key.
- [ ] Create all `docs/plan/*`:
  - Seed `parity.md` from `C:05`.
  - Decisions D-004+ (Agari, Privy, own engine, Masayume authority, nine programs, tests policy, PD-1…PD-8, PD-7 r2 amendment).
  - Q list: Q-001…Q-008 from P§0, with their defaults; nothing Excluded without an answer.

**Parallel:** clones · keypairs/env · Anchor scaffold.

**Gate:**
- `pnpm typecheck && pnpm build`
- `NO_DNA=1 anchor build` (empty workspace)
- `surfpool --version`
- `pnpm env:check`
- Probe recorded; first commit on `main`

**Risks:**
- Yosuku CSS licence (gates public visibility only).
- Devnet faucet limits (request SOL over days).

#### S1 — Solana primitives, stub adapter, Privy wallet shell (no EVM left)

**Goal:** core types Solana-shaped; every route renders against a stub adapter returning honest `unavailable` Readings; Privy + Wallet Standard connect; ed25519 message signing; zero viem/wagmi/RainbowKit/Somnia imports.

**Open first:**
- `M:packages/core/src/{types/primitives.ts,ports/*,urls,projection/settle.ts,private/types.ts,market}`
- `M:packages/markets/src/{index.ts,react/*}` + `package.json` exports
- `M:web/src/providers/*`, `M:web/src/lib/wallet-session.ts`
- The 32 EVM-importing web files (`C:05` §4.1)
- Context7: Privy Solana, `@solana/kit` 8, `@solana/react`
- `solana-dev` skill `references/frontend.md`, `kit/react.md`

**Deliverables:**
- **Core types:** `packages/core/src/types/{primitives,ids}.ts` (base58 `Address`, `Signature`, `Hash32`; `MarketId`).
- **Core market:** `core/market/{tickers,session,lanes}.ts` (Pyth `schedule` parser, Alpaca calendar shape, cadence alignment, `lock_at`, no-entry buffer).
- **Core other:** `core/auth/signed-message.ts`, `core/urls/explorer.ts`, `core/projection/settle.ts` (1e7 denominator), `asset` → `Ticker`.
- **Markets stub:** `packages/markets/src/stub/*` implementing both ports; export map and hook names unchanged.
- **Web providers:** `web/src/providers/{AppProviders,UserSessionProvider,privy.tsx,solana-client.ts}`; `wagmi.ts` and `rainbowkit-theme.ts` deleted; `HeaderAccount`/`ConnectButton` on Privy.
- **Web verifiers and write hooks:** `*.server.ts` verifiers use ed25519; product write hooks return `CapabilityPending` refusals.
- **Routes kept exactly as in Masayume:**
  - Legacy redirects `/bell`, `/beta`, `/markets-live`, `/markets/[id]`, `/pool`.
  - `/download` and `/native-auth` (L-18/L-19; native stays Blocked).
  - `/games/{practice,duel,duel/[matchId],lucky,line-rider,candle-hop,moonshot,range,rank,history}` under the games shell.
  - `/dev/*` fixtures (scaffolding, never linked).
- **Invariants:** remove DreamDEX rules; add `no-evm`, `kit-import-boundary`, `idl-no-destination`, `program-id-drift`; extend `file-length` to `.rs`.
- **Tests:** delete EVM-coupled tests (D-entry); keep golden vectors.

**Steps:**
- [ ] 1a core primitives, tickers, session, lanes (first; the other slices compile against it)
- [ ] 1b markets stub + invariants
- [ ] 1c providers, Privy, header
- [ ] 1d port the 32 files onto the stub and identity seams
- [ ] `/dev/wallet` fixture: Privy sign-in → signMessage → server verify
- [ ] Browser pass: 37 product routes at 390 and 1440, both themes

**Parallel (after 1a):**
- 1b `packages/markets`, `scripts/invariants`
- 1c `web/src/providers`, `components/shell`, `lib`
- 1d `web/src/features/**`, `app/api/**`

**Gate:**
- `pnpm typecheck && pnpm invariants && pnpm build`
- No EVM imports
- Privy embedded wallet shows a base58 address
- Phantom connects
- Signed-message verify works

**Rows:** Shell L-01, 02, 03, 05, 06, 07, 21; Partial L-10, L-24, L-72.

**Risks:** Privy Solana config shape (do Context7 first); lazy-load the Privy island for bundle weight.

#### S2 — `agari-events` engine (parallel with S1)

**Goal:** P§3.1 implemented exactly, deployed to devnet, Codama client, targeted money tests.

**Open first:**
- P§3.0–3.4, P§8
- `R:dreamdex-markets-sdk/package/src/{tradeAbi,moduleAbi,readsAbi,eventsAbi,writer,orders,store,derivedReads}.ts`, `binary/{sets,settlement}.ts`
- `R:dreamdex-docs` EC pages; `M:context/{41,43,44,48}`
- `R:phoenix-v1` (matching loop, `match_limit`), `R:sokoban`, `R:ctf-exchange` (`MatchType`)
- `C:02` §1.5, §6.3; `R:pyth-examples`; `R:program-examples/oracles/pyth/anchor`
- `C:13` §1(a), §1(c), §3 (RedStone details), §6.2 (shared settlement rules); `github.com/redstone-finance/rust-sdk` (`crates/redstone`, Solana adapter `config.rs` signers)
- `C:06` (DreamDEX engine spec), `C:07` (order-book options), `C:08` (engine review + account/instruction spec), `C:11` (Solana reference patterns)
- `R:anchor/tests/{events,escrow,duplicate-mutable-accounts,lazy-account}`
- Context7: Anchor zero-copy, `#[event_cpi]`, `token_interface`

**Deliverables:**
- **Spec:** `docs/plan/specs/events-engine.md` (truth table with worked numbers, escrow/refund, revert semantics, byte layouts + rent, per-instruction account lists, errors, event schema). Plus `docs/plan/specs/prints.md`: `PrintPolicy` and version layout; per-source verification rules, including the RedStone package layout and anti-selection rule and the Switchboard quote layout and index workaround; admission defaults; cross-check settle rules; void reasons; the version-selection rule the roller uses.
- **Common crate:** `anchor/crates/agari-common/src/{grid,seeds,place_result,view,book_walk}.rs` + `print/{pyth,redstone,attested,median}.rs` (Switchboard added in S6).
- **Engine program:** `anchor/programs/agari-events/src/{lib,constants,errors,events}.rs` + `state/{config,series,policy,market,result,book,ledger}.rs` + `book/{ladder,slab}.rs` + `matching/{engine,paths,evict}.rs` + `instructions/*.rs`.
- **Tests:** `anchor/tests/events_{paths,orders,settle,prints,crosscheck}.rs`; `anchor/tests/vectors/book.vectors.json` shared with `packages/core/src/market/book-math.ts`; `anchor/tests/vectors/prints/{pyth-tsla-<T>.b64,redstone-tsla-<T>.json}` (real archived fixtures from S0).
- **Client:** `packages/clients/agari-events/**`.
- **Scripts:** `scripts/deploy/{deploy.mjs,init-events.mjs,addresses.devnet.json}`, `scripts/drive/events-cycle.ts`.

**Steps:**
- [ ] Spec (frozen at end of step)
- [ ] Workspace, common grid, seeds
- [ ] State accounts; `Book` as keypair + `#[account(zero)]`; `Ledger` PDA
- [ ] Admin instructions incl. `admin_add_policy_version` + `roller_open_window` (PROGRAM seats, version coverage check)
- [ ] Prints:
  - **Pyth:** uniqueness with `grace_sec`, Full verification, feed id, confidence cap, receiver owner per D-002.
  - **RedStone:** dedupe by recovered address, all 5 inside `strict_sec` then ≥ 3, median, timestamp == T·1000, feed id. Use the rust-sdk if D-002 built it, else the in-crate verifier (`secp256k1_recover` + package layout from `C:13` §3). Verify the archived real TSLA packages at T and **measure transaction size and CU for 5 packages** on Surfpool.
  - **Attested:** ed25519 introspection, domain-separated.
  - Also: `public_copy_open_from_prev`; cross-check prints + settle rules + void reasons.
- [ ] Matching: four paths, Normal/IOC/FOK/PostOnly, self-match, `max_fills`, eager eviction with `max_evictions`, credit-first funding, PostOnly-after-expiry-skip, remainder cancel at fill cap, `placed_slot` for the rested-age filter
- [ ] Cancel, reduce, cancel-all, sweep-expired
- [ ] Complete sets; withdraw credit
- [ ] Settle (cross-check), void, redeem/redeem_for, release book, close ledger + mvault (donation-safe), close market + result after retention
- [ ] `book_walk` + TS mirror + vectors
- [ ] Targeted tests (P§8 engine list), plus a **randomized operation-sequence harness** over the pure-Rust matching + ledger core (invariants checked after every op), plus **deadline race tests** (print vs void at `T + admission_sec`, per source)
- [ ] CU profile (Surfpool `profileTransaction`; 10-fill IOC within budget; record)
- [ ] Codegen
- [ ] Devnet deploy + `init-events`: config with RedStone signers and a placeholder Switchboard queue; tUSDC mint with faucet authority; 2 books each for **TSLA** (Pyth primary + RedStone check, trial-dated version) and **NVDA** (RedStone) × Regular 5m. Publish the IDL via Program Metadata (`anchor idl init`) so explorers decode instructions. Close deploy buffers
- [ ] Surfpool drive (time travel): open → mint-pair → print (Pyth + RedStone check) → settle → redeem; plus a divergence void and a missing-print void
- [ ] The same drive on devnet in market hours with real Pyth trial (TSLA) and RedStone (NVDA) prints, plus one attested print on a test series

**Parallel (after state + spec freeze):**
- 2a orders + matching
- 2b prints + settle + redeem
- 2c sets + admin + roller + deploy scripts
- 2d `book_walk`, TS mirror, vectors, codegen

Error ranges as P§3.1.

**Gate:**
- `NO_DNA=1 anchor build`
- `cargo test -p agari-events`
- Codegen diff clean
- Surfpool drive passes
- `acceptance.md` devnet signatures: window opened, direct fill, mint-pair fill, burn-pair fill, **Pyth trial print**, **RedStone 5-signer print**, **cross-check settle**, attested print, settle, redeem, void
- Account sizes, rent and CU recorded (including RedStone print CU and transaction bytes)

**Rows:** resolves `C:05` §6 Q1 (market primitive); enables L-29…L-34.

**Risks:** reconstructed DreamDEX internals (spec cites evidence); CU and account limits; RedStone SDK SBF build (in-crate fallback) and 5-package transaction size (ALT fallback); Anchor 1.x skew in LLM output (Solana MCP / anchor docs); CPI PDA-signer surface frozen now for S7+.

#### S3 — Venue operations: calendar, roller, prices, settler, indexer, seed maker

**Goal:** devnet runs unattended through a full NYSE session. Windows roll per calendar, prints post, Windows settle or void, projections fill, books have quotes.

**Preconditions:** S1 (session types), S2 (IDL, clients, addresses).

**Open first:**
- `M:services/ops/src/{main.ts,actors/market-maker/*,actors/duel-projector/*}`
- `M:packages/db/src/{client,migrate,schema}.ts`
- `C:02` §1.4–1.5, §4.1–4.3, §6.2–6.3; `C:13` §1(c), §3 (RedStone), §6.3–6.4; P§2.2, P§4
- `M:reference/dreamdex-bot-kit/strategies/{ec-maker,ec-oracle-follow}`
- Context7: `@pythnetwork/hermes-client`, `@pythnetwork/pyth-solana-receiver` (post + close update accounts), Helius `logsSubscribe`, Alpaca market data

**Deliverables:**
- `services/ops/src/calendar/{alpaca,pyth-schedule,session-service}.ts`
- `actors/window-roller/{plan,versions,execute,index}.ts` (version coverage + paused-lane reporting)
- `actors/price-relay/{hermes-fetch,pyth-archive,redstone-fetch,redstone-archive,attest-sign,jupiter,index}.ts` (fetch/schedule/archive only)
- `packages/markets/src/prices/{pyth-post,redstone-print,attested-print,index}.ts` + `prices/legacy/*` (web3.js-1 Pyth receiver SDK, contained)
- `services/ops/config/price-sources.json` (D-003 matrix) + `scripts/deploy/set-policies.mjs` (ensure-style `admin_add_policy_version`)
- `actors/settler/{decide,index}.ts`
- `actors/indexer/{subscribe,backfill,decode,apply,index}.ts`
- `actors/market-maker` `MAKER_MODE=seat`
- `services/ops/src/http/{health,spot-sse}.ts`
- `packages/db/src/schema-index.ts` (markets, fills, orders, candles, positions, prints, **print_archive** (raw signed blobs and packages), cursors)
- `packages/markets/src/{runtime/solana-rpc.ts,sessions/keypair-session.ts}`
- `scripts/deploy/init-series.mjs` (9 tickers × Regular 5/15/60)
- `scripts/drive/verify-index.ts`

**Steps:**
- [ ] Calendar service
- [ ] Policy versions registered from `price-sources.json` (trial-dated Pyth versions; RedStone versions from Fri 09-25 for TSLA)
- [ ] Roller (highest covering version; "paused: no signed source" when none)
- [ ] Pyth trial relay (TSLA/QQQ/VOO) + close update accounts; take over the S0 blob archive
- [ ] RedStone relay: all 5 signer packages at T + 10–15 s with retries; archive to `print_archive`; single names + TSLA check prints
- [ ] Attested relay (opt-in only; off by default)
- [ ] Settler (retries `CrossCheckPending` until the check bound)
- [ ] Indexer + backfill
- [ ] Seed maker
- [ ] Register actors in `main.ts` (DRY_RUN default) + heartbeats
- [ ] Register series + rent accounting
- [ ] One-session soak

**Parallel:**
- 3a calendar + roller
- 3b price-relay + SSE
- 3c settler + seed maker
- 3d indexer + db

The stage owner edits `main.ts`.

**Gate:**
- `pnpm typecheck && pnpm invariants`
- Soak: N Windows, no overlaps; all resolved or voided within their windows; indexer lag < 10 s; `verify-index.ts` Fill counts match chain
- Prints: every Window's source matches `price-sources.json`; 100% of RedStone boundaries fetched and archived within 60 s; TSLA cross-check agreement (bps) recorded; zero leftover `PriceUpdateV2` accounts owned by the relay
- A dry-run of the post-trial switch (roller with a clock after 09-25 close) shows TSLA on RedStone and QQQ/VOO paused
- Off-hours: no Regular Windows listed

**Rows:** Partial L-73, L-15, L-16; implements HRS/BASIS.

**Risks:** Pyth trial end (dated versions; QQQ/VOO paused); RedStone gateway outage (retry, multiple gateway URLs, archive; void after admission is the honest outcome); Helius 10 RPS (batch, cursor backfill); relay/attestor trust (README).

#### S4 — First end-to-end call on devnet (M1)

**Goal:**
1. `/markets` signed out → Tutorial
2. Privy sign-in → Get test funds (SOL top-up + tUSDC)
3. Ticket quotes off the book → sponsored IOC fill → The Call share card
4. Verdict at expiry → Claim → Portfolio rows update

Also: journal recovery, Reels on the same stream, honest closed states.

**Preconditions:** S3.

**Open first:**
- `M:packages/markets/src/runtime/{read-runtime,coordinator}.ts`, `provider/*`, `submitter/**`, `sessions/*`, `react/*`
- `M:web/src/features/markets/{hero,lanes,word-board,ticket,verdict,claims,reels,faucet,wallet}`, `features/{funding,onboarding,recovery}`
- `M:web/src/app/api/{faucet,faucet/challenge,sponsor}`
- `M:docs/implementation/testnet-faucet-2026-09-07.md`
- `C:04` §3, §5; `solana-dev` frontend references

**Deliverables:**
- `packages/markets/src/runtime/coordinator.ts` (account notifications, deduped)
- `provider/*` over Codama decoders + `/api/index/*`
- `submitter/steps/{status-gate,expiry,quote,build,sign,send,confirm}.ts`
- Journal reconcile by signature + `lastValidBlockHeight`
- `sessions/{privy-signer,wallet-standard-signer}.ts`
- `faucet/solana.ts`, `sponsor/policy.ts`
- `web/src/app/api/{faucet,faucet/challenge,sponsor,index/[...path]}/route.ts`
- Markets surfaces rewired (ticker picker, session chips, closed copy)
- Invariants `status-gate-enum`, `expiry-from-headroom`, `order-lane-ioc` re-pointed
- `scripts/drive/first-call.ts`

**Steps:**
- [ ] Context7 (kit confirmation factories, Privy `useSignTransaction`)
- [ ] Runtime + boot facts
- [ ] Provider reads
- [ ] Hooks (names unchanged)
- [ ] Submitter + journal recovery
- [ ] Signer seams
- [ ] Faucet
- [ ] Sponsor
- [ ] Web rewiring
- [ ] Drive script
- [ ] Browser pass at 390/768/1440, both themes: signed-out, first-run, unfunded, quote moved, fill, unknown send (kill tab mid-send), win/loss/void, claim, closed
- [ ] Tag `m1-first-call`

**Parallel** (port signatures frozen from S1; changes need a D- entry):
- 4a `runtime/`, `provider/`, `react/`
- 4b `submitter/`, `sessions/`
- 4c faucet + sponsor + `features/funding`
- 4d `web/src/features/markets/**`

**Gate:**
- Full gate; drive passes
- Manual fresh-Privy end-to-end during market hours
- Acceptance rows: faucet SOL, mint, sponsored fill (fee payer = sponsor), ops settle, claim
- Journal recovery shown
- Then run S16 once

**Rows:** L-04, L-08, L-09, L-10, L-22, L-24, L-25, L-26, L-29…L-34; Partial L-44, L-46.

**Risks:** blockhash expiry during co-sign (sign immediately); sponsor drain (quotas, rent payer); Privy dashboard config (Wallet Standard works through the same seam).

#### S5 — Proof and analytics on the indexer

**Preconditions:** S4.

**Open first:**
- `M:packages/core/src/projection/*`
- `M:packages/markets/src/provider/{history,board,traction,scan,fills}.ts`
- `M:web/src/features/{stats,status,edge,leaderboard,surface,share}`, `features/markets/{portfolio,balance,history}`
- `M:web/src/app/api/{leaderboard,traction,status}`

**Deliverables:**
- Portfolio: history, receipt, equity, badges, CSV, Restore
- Trader Edge with ET session buckets
- Leaderboard: this session, per ticker
- `/stats`, `/traction`
- `/status` probes: slot lag, indexer lag, relay freshness (session-aware), print-source mix per lane, Pyth trial days left, RedStone gateway latency and signer count, Switchboard quote success (after S6), cross-check agreement, paused lanes, sponsor budget, DB, ops heartbeats
- **Pyth trial proof replay** (additive): post an archived signed blob to the devnet receiver, then show the verified `PriceUpdateV2` beside the print that settled that historical Window. No new markets on past T
- `/surface` on the Book decode; Earned Heat card
- `scripts/drive/recount.ts`

**Parallel:**
- 5a portfolio/edge/CSV/badges
- 5b leaderboard/stats/traction
- 5c status
- 5d surface/share

**Gate:** `recount.ts` matches `/stats` + leaderboard for 24 h; `/status` green in session and "closed (expected)" off-hours; browser pass.

**Rows:** L-15, L-16, L-22, L-40, L-46, L-47, L-48, L-49.

#### S6 — Stock-session lanes and states (parallel with S5)

**Goal:** Gap lane, 24/7 token lane, halts/voids, earnings flags, split-day skips, closed/early-close/halted states on every always-on surface.

**Preconditions:** S4.

**Open first:** `C:02` §4, §6; `C:13` §2.3–2.5, §3 (Surge row), §5; `R:switchboard-examples`; `C:01` (xStock mints, ScaledUiAmount); `C:05` §2.3, §3.1; P§2.2.

**Deliverables:**
- Roller `gap` + `token24x7` series; Gap listed only when one policy version covers Friday and Monday
- **Spikes first (record D-entries):**
  - (a) Request Surge quotes for the four symbols on devnet and record the maximum distinct oracle signatures. If < 3, the D-entry sets `switchboard_min_oracles` to the observed value with lower token-lane caps, and it is user-visible.
  - (b) On a real Monday, record RedStone `TSLA` and `TSLA---EXTENDED` at 09:29:50–09:30:30 ET. The D-entry picks the Gap closing feed variant (and T offset, if any) before any RedStone Gap Window is listed.
- Token-lane prints:
  - **Switchboard Surge** quotes (`TSLAX/USD`, `NVDAX/USD`, `SPYX/USD`, `QQQX/USD`, batched in one quote) via `public_record_print_switchboard`. `agari-common/print/switchboard.rs` + `packages/markets/src/prices/switchboard-print.ts` (`@switchboard-xyz/on-demand` in `prices/legacy/`). Crate `solana-v3` feature + index workaround; queue pinned; distinct oracles; clock-bounded admission.
  - Relay `jupiter.ts` attested fallback: verified xStock mints only (`isVerified` + `xstocks` tag), multiplier normalization, median of 3 samples around T.
- Void-reason enum on verdict, receipts and share cards
- `core/market/events-calendar.ts` (Finnhub earnings) + cap-tightening flags for S10
- `services/ops/config/corporate-actions.json`
- Header session indicator; "TSLAx token price" labels; Monday Gap card; halted refusals
- **Holdings-aware hedge (A-1a core, moved forward for the holder story):**
  - Read the connected wallet's **mainnet** xStock/Ondo/Backpack holdings read-only (Helius mainnet RPC, verified mints, ScaledUiAmount normalized).
  - Show "your TSLAx exposure this session / this weekend".
  - One-tap Down or Monday-Gap hedge sized to the holding, placed on devnet. The copy says the hedge uses devnet test collateral.
- **M2 demo** = holder journey: connect → holdings detected → weekend Gap hedge → Monday settlement, plus session Windows and the token lane
- `/dev/states` fixtures

**Parallel:**
- 6a Gap
- 6b Token
- 6c halts/voids/earnings/corp
- 6d copy/states/fixtures

**Gate:**
- Surfpool time travel proves a Gap Window (Friday close print → Sunday 20:00 lock → Monday open print → settle)
- A halt (confidence cap / missing print) voids
- Switchboard print rejected before `T + min_delay_sec`, with a stale slot, a duplicate oracle or the wrong queue (Surfpool)
- Real-weekend devnet token-lane settlement + RedStone Gap Window recorded

**Rows:** HRS/BASIS/HALT/CORP/EVT across L-04, L-09, L-29, L-32, L-33, L-44, L-61, L-62, L-72; resolves `C:05` §6 Q2.

**Risks:** thin-token Jupiter manipulation (low caps, limited tickers); Switchboard quote selection inside the admission window (first valid print wins; caps; disclosed); Surge oracle count; RedStone open-print semantics (spike b); holiday Monday.

#### S7 — Trading Balance vault, tap trading, plain cash-out

**Preconditions:** S4.

**Open first:**
- `M:contracts/src/vault/*`
- `M:contracts/test/{EventVault.funding,EventVault.trading,CapsVectors}.t.sol`
- `M:packages/core/src/vault/caps.vectors.json`
- `M:packages/markets/src/{vault,sessions/session-key.ts}`
- `M:web/src/features/{vault,session}`
- `M:context/41`; P§3.2 vault row

**Deliverables:**
- `anchor/programs/agari-vault/**` (P§3.2) + caps-vector Rust replay + `specs/vault.md`
- `packages/markets/src/vault/*`
- Session key (kit `KeyPairSigner`, IndexedDB) + sponsor policy entry
- Web: vault/session surfaces, Trading Balance plate row, ticket route selector, **L-35 plain cash-out** (IOC sell; "no exit liquidity" when closed)

**Parallel:** 7a program · 7b adapter (after IDL freeze) · 7c web.

**Gate:**
- Caps vectors pass; `idl-no-destination` passes
- Devnet: `deposit_and_grant` (one signature); 3 session taps with zero popups; cap refusal sends no transaction; revoke returns budget; owner withdraw; `crank_settle` → owner; plain cash-out fill

**Rows:** L-27, L-28, L-35, L-46, Y-16.

#### S8 — Earn: maker vault + maker actor (parallel with S7)

**Preconditions:** S4.

**Open first:**
- `M:contracts/src/maker/*`
- `M:contracts/test/{MarketMakerVault.*,MakerTestBase}.sol`
- `M:services/ops/src/actors/market-maker/*`
- `M:packages/core/src/maker`, `M:packages/markets/src/maker`, `M:web/src/features/earn`
- `M:context/44`

**Deliverables:**
- `agari-maker` (P§3.2)
- Actor `MAKER_MODE=vault` (session-only quoting, pull on halt, flatten before close, merge before `lock_at`)
- `/earn`; LP Provider badge

**Gate:**
- Devnet: supply → quotes rest a full session → user taps fill them → merge → settle → withdraw after cranks
- Share-price monotonicity script

**Rows:** L-50, A-2b (maker tab).

**Risks:** weekend inventory gap risk.

#### S9 — Agents: registry, runner, builder, copy

**Preconditions:** S7.

**Open first:**
- `M:contracts/src/strategy/*` + test
- `M:services/ops/src/{runner-main.ts,actors/strategy-runner/**}`
- `M:packages/brain`, `M:packages/core/src/strategies/{spec,agent}.ts`, `M:packages/db/src/strategy*.ts`
- `M:web/src/features/strategies`, `M:web/src/app/{agents,api/strategies}`
- `M:docs/implementation/acceptance-2026-09-06.md` (unit-normalization defect)

**Deliverables:**
- `agari-strategy`
- Runner on kit sessions ("sleeping until open")
- 4-step builder, copy drawer, agents board
- **L-56** paid Memory Market (fee-gated)
- **L-57** Reversion preset selectable

**Parallel:** 9a program + adapter · 9b runner · 9c web · 9d L-56/57.

**Gate:**
- Devnet: publish → subscribe with grant → persisted AI decision → fill → auto-settle to owner → pause/revoke
- Restart creates no duplicate attempts; equity normalization check

**Rows:** L-51…L-57.

#### S10 — Specialist tickets (sub-stages in separate worktrees)

Append-only shared files (ticket mode registry, `Anchor.toml`, addresses JSON, sponsor allowlist) merge in order a → b → c → d.

| Sub | Pre | Open first | Deliverables | Gate | Rows |
|---|---|---|---|---|---|
| **10a Parlay** | S4 (+S7 vault route) | `M:contracts/src/parlay/*`, `M:contracts/test/Parlay*.t.sol`, `M:packages/core/src/parlay/pricing.vectors.json`, `M:web/src/features/parlay`, `M:context/42` | `agari-parlay`; `core/parlay/correlation.ts` (ticker-correlation haircut, CORR, D-entry) | Vectors pass; open → resolve_leg → claim; voided leg | L-38 |
| **10b Range + Moonshot** | S4, S6 | `M:contracts/src/range/*`, `M:contracts/test/{Range*,MoonshotVectors}.t.sol`, `M:packages/core/src/range/{pricing,moonshot}.vectors.json`, `M:web/src/features/{range,games/moonshot}`, `M:context/43`, `06-game-architecture.md` §Moonshot | `agari-range` (σ/ticker, closing-print settle, `void_stale`, saturated bands, earnings caps); Range takes | Vectors pass; inside + outside settle; Moonshot win paid | L-36, L-67 |
| **10c Boost + keeper (+Inverse)** | S4, S6 | `M:contracts/src/leverage/*`, `M:contracts/test/Leverage*.t.sol`, `M:packages/core/src/leverage/sizing.vectors.json`, `M:services/ops/src/actors/leverage-keeper/*`, `M:web/src/features/leverage`, `M:context/45` | `agari-leverage` (session caps `C:02` §6.3; no knock-out when halted/closed). **A-1b Inverse only after Q approval** | Vectors pass; 2× open, cash-out, keeper knock-out, settle | L-37, A-1b |
| **10d Private desk** | S7 | `M:contracts/src/private/*`, `M:contracts/test/Private*.t.sol`, `M:web/src/app/api/private/*`, `M:web/src/features/private`, `M:context/46` | `agari-private` (PD-4); backup/restore | Resumable open; restore from empty browser; cash-out; lost reply never double-charges | L-39 |

**Risks:** many-leg tx size (ALTs); normal-σ mispricing across gaps (earnings caps); desk key trust (disclosed).

#### S11 — Trade from X + Blinks

**Preconditions:** S7, S6. The user supplies the Agari X account, cookies and OAuth keys (Q).

**Open first:**
- `M:web/src/features/x`, `M:web/src/app/{api/x/*,claim}`
- `M:packages/core/src/x/*`, `M:services/ops/src/actors/x-relay/**`, `M:packages/db/src/x*.ts`
- `C:04` §7, `R:solana-actions/examples/next-js`

**Deliverables:**
- Cashtag grammar (`$TSLA up 5 15m`, synonyms, ambiguity + closed/halted refusals)
- EXECUTOR grant; relay through kit session; rebranded reply card
- `/claim` ed25519 relink
- `web/public/actions.json` + `/api/actions/w/[marketId]` (GET/POST, kit-serialized tx) + OG fallback
- Dialect registry submission (live action; needs the user's go)

**Gate:** one mention executes exactly once with image receipt; invalid command → one refusal, no tx; recursion fence; a Blink tx confirms via Phantom/dial.to.

**Rows:** L-58, L-59, L-60, A-3d.

#### S12 — Games

**12a Off-chain and ticket-lane games** (pre S4; S6 for off-hours).
- **Open first:** `M:web/src/features/games/{GamesHub.tsx,catalog.ts,practice,lucky,arcade,art,stage}`, `M:packages/core/src/games`, `M:web/src/app/api/games/{arcade,lucky,occupancy,history}`, `M:packages/db/src/{arcade,lucky,games}.ts`, `06-game-architecture.md`.
- **Deliverables:** Hub; Practice on live spot (paused off-hours or token lane); Lucky commit-reveal over eligible Windows; Line Rider, Candle Hop; history/audio/motion/settings; **L-71** profile, achievements, friends.
- **Gate:** Lucky spin placed + settled on devnet; arcade score server-replayed; Practice checked in and off session.

**12b Arena, Duel, Rank, Season** (pre S4; S7 optional).
- **Open first:** `M:contracts/src/games/*`, `M:contracts/test/{GameArena.*,ArenaVectors,SeasonPrizePool}.t.sol`, `M:services/ops/src/actors/{matchmaker,game-room,duel-projector,duel-settler}/*`, `M:services/ops/src/tools/season-*`, `M:web/src/app/api/games/{room-token,rank,season,sponsor}`, `M:web/src/features/games/duel`, `M:context/{54,55}`.
- **Deliverables:** `agari-arena` (PD-5); projector on indexer events; room token signed by the game key and checked against `agentOf`; sponsor funds the match key.
- **Gate:** two browsers finish a full duel (create/join one signature each → reveal → all picks → settle → finalize → claim); refund branches on Surfpool; season fund + distribute on devnet.

12a and 12b run in parallel. **Rows:** L-61…L-71. **Risks:** deck supply depends on in-session Windows (measure dealability, Masayume `spike:deck-supply`).

#### S13 — Social and assistant (parallel with S5/S6)

**Preconditions:** S4.

**Open first:** `M:web/src/features/{sensei,room,takes,alerts,news}`, `M:web/src/features/markets/reels`, `M:web/src/app/api/{sensei,room/*,takes,news}`, `M:packages/brain`, `M:packages/db/src/{comments,bettors,takes}.ts`.

**Deliverables:**
- Sensei (stock + session + earnings aware; advice Brake)
- Finnhub news
- Room (ed25519 join; bettors from indexer); Takes with cashtags
- Basis-aware alerts; Reels with woven takes
- Marquee sentiment (Y-08 decision)
- **A-3a** profiles, follows, social boards
- **A-3c** ticker rooms, activity feed, lifecycle notifications

**Parallel:** 13a Sensei · 13b Room/Takes/Reels · 13c news/alerts/marquee · 13d A-3a/A-3c.

**Gate:** signed take verifies server-side; Room gated by on-chain position; Sensei trade card → ticket; advice framing refused; notifications fire.

**Rows:** L-04, L-17, L-41…L-45, A-3a, A-3c.

#### S14 — Add-ons completion

**Preconditions:** S9, S10, S13.

**Deliverables:**
- **A-1a:** Bet-against toggle + Down-first presets + hedge polish. The core holdings hedge ships in S6; devnet mock Token-2022 xStocks exist only for users without mainnet holdings, labelled mocks.
- **A-1c:** fade a strategy (inverse subscription in the runner)
- **A-3b:** copy human traders
- **A-2a:** idle-balance yield per Q answer (honest "mainnet only" state + design, or devnet reserve-fee accrual). **Never a fake APY**
- **A-2b:** Earn tabs Maker / Range-Moonshot / Parlay / Boost / Inverse
- **A-2c:** realized-only yield reporting

**Parallel:** 14a A-1a · 14b A-1c + A-3b · 14c A-2a/b/c.

**Gate:** each add-on has devnet evidence, or is Blocked with a recorded user decision.

**Rows:** A-1a, A-1c, A-2a…c, A-3b.

#### S15 — Public story, docs, submission

**Preconditions:** S5–S14 surfaces (copy drafts from S6).

**Open first:**
- `M:web/src/features/{how-it-works,demo,pitch,install}`, `M:web/src/styles/**` (design system)
- `M:README.md`, `M:docs/submission/*`
- `/Users/abu/dev/hackathon/masayume-docs` (separate Fumadocs repo)
- `C:00` §1, §3, §7
- `direct-demo-video` skill

`R:yosuku/app/page.tsx` is **lineage only**: open it only if the user approves Q-001's landing page and wants that layout. Masayume's tokens and components are the authority.

**Deliverables:**
- **Site pages:**
  - L-11 landing (per Q-001) in Masayume's design system, with live stock dial or closed state
  - L-12 How it works (sessions, basis, halts, voids)
  - L-13 demo (**recorded Mon–Thu during market hours**)
  - L-14 pitch
  - L-18 download
  - L-19 honest native page (Blocked)
  - L-20 docs content rewrite
  - L-23 site and per-ticker OG images (Y-14)
- **README:** Proven on-chain table, program ids, trust assumptions, honest limitations, why Solana.
- **Compliance and brand:**
  - `THIRD_PARTY_NOTICES.md` (+ Phoenix, sokoban).
  - **Geofence:** `web/src/proxy.ts` (Next 16) reads Vercel `x-vercel-ip-country`. US visitors get a read-only "not available in your region" state for funded actions, and server routes (`sponsor`, `faucet`, `private/*`, `x/*`) enforce the same check.
  - "Not investment advice" copy (Sensei, agents, share cards); submission checklist; brand sweep.
- **Docs site:** fork `masayume-docs` as a separate `agari-docs` Fumadocs repo (every fact rewritten, real captures).
- **Program credibility:** verifiable builds (`anchor build --verifiable` / `verifiedBuild`) and IDLs published for all programs; program ids + explorer links in README.

**Gate:** public routes at 320/390/768/1440 both themes; README links resolve; zero "masayume" identity hits outside notices; demo exists.

**Rows:** L-11…L-14, L-18…L-20, L-23, Y-rows as decided.

#### S16 — Deploy train (Vercel web, Fly ops, Neon DB)

Runs first after S4, after each milestone, and a final run before S17. **Every live action needs the user's go.**

**Open first:** Masayume `RESUME.md` hosting notes (Fly `masayume-ops`, Vercel), `vercel:deploy` skill.

**Deliverables:**
- Neon Postgres provisioned through the Vercel Marketplace (load the `vercel:marketplace` skill first; Masayume already used Neon) → `DATABASE_URL` + `ensureSchema`
- Vercel project `agari` (root `web`), env, CSP for Privy/Helius
- `services/ops/{Dockerfile,fly.toml}` (one machine, never auto-stopped, per-role secrets)
- `scripts/deploy/verify-live.mjs` (read-only)

**Steps:**
- [ ] Provision
- [ ] Migrate
- [ ] **Stop local ops** (one writer per key)
- [ ] Deploy ops
- [ ] Deploy web
- [ ] Verify
- [ ] One end-to-end call from the deployed URL

**Gate:** public URL works; status green; deploy ids in `acceptance.md`. **Rows:** L-73, L-74.

#### S17 — Fidelity completion gate and coherence pass

**Steps:**
- [ ] Performance: one stream per key, hidden-tab throttling, bundle/font audit, lazy game bundles
- [ ] Accessibility: keyboard paths through ticket, modals and games; focus traps in portals and drawers; contrast in both themes (Masayume fixed profit/loss light-mode contrast); reduced-motion honored
- [ ] Route-by-route comparison vs Masayume source at 390/768/1440, both themes
- [ ] Drive all eight `C:05` §2.2 flows on the deployed app
- [ ] Reconcile `parity.md`; close or record every Q
- [ ] Final README evidence; `/status` green

**Gate:** P§7.4.

### 7.3 Dependency graph

```text
S0 ─┬─> S1 ─┐
    └─> S2 ─┴─> S3 ──> S4 (M1 first call) ──┬─> S5  ┐
                                            ├─> S6  │  (M2 stock-native demo = S5+S6)
                                            ├─> S13 │
                                            ├─> S8  │
                                            ├─> S10a, S10b(+S6), S10c(+S6)
                                            ├─> S12a, S12b
                                            ├─> S16 (first run)
                                            └─> S7 ──┬─> S9 ─┐
                                                     ├─> S10d │
                                                     └─> S11(+S6)
                        S9 + S10* + S13 ──> S14 ──> S15 ──> S16 (final) ──> S17
```

**Concurrency:**
- S1 ∥ S2.
- **S2's gate is hard for money.** No financial program stage (S7 vault, S8 maker, S10 reserves, S12b arena) starts until the engine's randomized sequences, deadline races and failure scenarios pass and the devnet evidence rows exist.
- After M1, up to four agents per wave:
  - W1: S5, S6, S13, S7
  - W2: S8, S10a, S10b, S12a
  - W3: S9, S10c, S12b, S11
  - W4: S10d, S14
- Program stages own separate `anchor/programs/*` directories; only `Anchor.toml` and the addresses JSON are shared (append-only).
- Budget devnet SOL per deploy; close buffers after each.

### 7.4 Definition of done (fidelity completion gate)

1. **Classification.** Every `parity.md` row (L-01…L-74, Y-01…Y-18, A-1a…A-3d) is **Exact / Adapted / Additive / Blocked**. **No Excluded row** without a dated user decision; every Q answered and reclassified.
2. **Status.** Every row is Done, or Blocked with a named blocker and the exact resolution needed (e.g. L-19 native: no source).
3. **Done evidence:** commit, route check vs Masayume source at mobile + desktop in both themes, devnet tx in `acceptance.md` for economic rows. Masayume's doc-05 route DoD applies: real data, real write boundary, shared truth, all identity/failure/recovery/responsive states.
4. **States.** All `C:05` §2.3 state families implemented, including stock states: pre, regular, post, closed, holiday, early-close, halted, corporate-action pending, gap, token basis, **source-paused lane**, **cross-check pending**, and void reasons (missing print / sources disagree).
5. **Flows.** All eight `C:05` §2.2 flows driven on the deployed devnet app with receipts: first call, tap trading, agent lifecycle, X, duel, Lucky, Earn, Private.
6. **Programs.** P§8 engine checks + golden vectors pass in Rust; `idl-no-destination` passes; permissionless void/redeem/settle work after deadlines.
7. **Repo gate.** `pnpm typecheck && pnpm invariants && pnpm build && NO_DNA=1 anchor build` green; no file > 400 lines; no EVM imports.
8. **Honest data.** No invented odds, balances, fills, users or APYs; Practice/arcade say "no stake". Every verdict, receipt and share card names its print source; "oracle price at 16:00:00 ET", never "official close"; attested prints say "demo data"; the README discloses the RedStone licence status and oracle trust.
9. **Shipped.** Deployed (Vercel/Fly/Neon); `/status` green; README trust assumptions + limitations; demo recorded in market hours; user's full end-to-end review.

## 8. Verification (proportionate; tests are not a deliverable)

**Per stage:** `pnpm typecheck && pnpm invariants && NO_DNA=1 anchor build`, plus `pnpm build` for web.

**Engine (Rust LiteSVM, targeted):**
- Four fill paths with exact cash/outcome and `ΣYES == ΣNO == backing`.
- Eviction credit.
- IOC zero-fill revert; PostOnly with an expired top-of-book.
- Normal remainder cancelled at the fill cap.
- **Prints (pure `agari-common::print` tests on real archived fixtures, plus LiteSVM for account rules):**
  - **All sources:** wrong source for the policy; slot already recorded (first valid wins); an unknown policy version; the roller refuses a Window its version doesn't cover; `admin_add_policy_version` can't overwrite.
  - **Pyth:** `publish_time` outside `(prev < T ≤ publish ≤ T + grace)`; wrong feed; Partial verification; wrong receiver owner; confidence breach; an archived trial blob accepted only for its own T.
  - **RedStone:** a real TSLA 5-signer package at T verifies (golden) and the median matches; timestamp ≠ T·1000; unknown signer; the same signer twice or a malleated duplicate counts once; 3 or 4 signers refused inside `strict_sec` and accepted after; tampered value fails recovery; wrong feed id.
  - **Switchboard (S6):** wrong queue; duplicate oracle index; below min oracles; slot age exceeded; wrong feed hash; index 0xFFFF accepted; posted before `T + min_delay_sec` or after `T + admission_sec` refused.
  - **Attested:** forged ed25519 offsets; before the correction cutoff; CPI invocation refused.
  - **Cross-check:** settle refused (`CrossCheckPending`) while check prints are missing and the bound is open; settles single-source after it; divergence beyond the band voids with `CrossCheckDivergence`; `public_copy_open_from_prev` copies check prints and refuses a different version.
- Redeem 1/0 and void 0.5.
- A stale handle can't cancel on a recycled book.
- Donation doesn't block close.
- **Randomized operation sequences** (proptest over the pure-Rust matching + ledger core: random place/cancel/reduce/mint/merge/expire/settle/redeem/release-seat sequences). After every op, check: `ΣYES == ΣNO == backing`; conservation `mvault == backing + Σcredit + Σlocked_cash + Σbond`; no negative balances; exact refunds; book/ledger/order-count consistency. Ported golden vectors validate inherited formulas only; this validates the new matcher and account lifecycle.
- **Deadline races (PD-6):** print vs `public_void_expired` in both orders at `T + admission_sec` and at `+1 s`, for each source's default window (15 min intraday, Gap open at `lock_at`, 60 s Switchboard).
- **Cross-slot manipulation (PD-2):**
  - Spoof depth, price a parlay/range N slots later, then cancel.
  - Cancel to thin the book before a knock-out.
  - Book vs model disagreement → refusal.
- **Lifecycle (PD-7/PD-8):** late product claim after Ledger close; `public_close_market` refused with live dependents or before retention; Range and Parlay claim from their captured result after Market + `MarketResult` close; ledger growth; seat bond refund; squatting a full ledger → honest refusal.
- **Indexer:** failed tx ignored; reconnect gap backfill; duplicate delivery idempotent; confirmed → finalized promotion; full rebuild equals live projections.
- **Sponsor:** oversized compute price, sponsor as writable/init payer, and budget exhaustion are all refused.

**Products:**
- Masayume golden vectors replayed in pure Rust: `vault/caps`, `parlay/pricing`, `range/pricing`, `range/moonshot`, `leverage/sizing`.
- One `place_for` CPI booking + grant nonce.
- Maker `credit_used` = escrowBack; withdraw blocked while a Window is unsettled.
- Parlay void refund; private key-reuse rejection; arena commitment vector + forfeit path.

**Drives:** Surfpool mainnet-fork with `surfnet_timeTravel` across boundaries and Pyth `registerScenario`. Archived RedStone packages and Pyth blobs replay on Surfpool because the checks use the Window's T, not the clock. One `scripts/drive/*.ts` per stage (successor of Masayume `spike:*`); devnet receipts into `acceptance.md`.

**UI:** manual browser pass at 390/768/1440, both themes (Chrome MCP), against the Masayume source route. States covered: signed-out, first-run, funded, closed market, stale, error, unknown send, settled. Source against source, no screenshot loops.

**Pre-submission:** `/status` green; `/stats` shows only on-chain numbers; README "Proven on-chain"; demo recorded in NYSE hours.

## 9. Risks and honest limitations

| Risk | Mitigation / disclosure |
|---|---|
| Own CLOB complexity (CU, account limits, unaudited matcher) | Zero-copy ladder book; `max_fills`/`max_evictions`; one Window's accounts per trade; Surfpool CU profiling; Certora-style invariant list from Manifest as checklist; "book full" honest refusal |
| Pyth trial ends ≈ 09-27, before judging ends 10-02; Pyth paid plans unaffordable | PD-1 dated policy versions: TSLA moves to RedStone from Fri 09-25; QQQ/VOO paused by default after the trial; S0 archiver + S5 proof replay; optional Stork key for ETFs; source shown on every verdict and receipt; no redeploy |
| RedStone public-gateway licence unverified; `rust-sdk` SBF build untested; ~24 h history | Disclosed in README; S0 SBF spike with an in-crate verifier fallback; relay fetches at T + 10–15 s and archives |
| RedStone signer-subset selection (a poster picks the 3 of 5 values giving a favourable median) | All 5 signers required inside `strict_sec`; dedupe by recovered address; tested |
| RedStone feed semantics at the 09:30 open (`TSLA` vs `---EXTENDED`) | S6 spike on a real Monday before RedStone Gap Windows list |
| Switchboard token-lane quotes (no timestamp; relay could choose among quotes; Surge oracle count unverified) | Clock-bounded 10–60 s admission + slot age; first valid print wins; low token-lane caps; label "observed ≤ 60 s after T"; S6 oracle-count spike |
| Operator trust (roller, attestor, maker, keepers) | Permissionless settle/void/redeem after deadlines; separate keys per role; `/status` heartbeats; README trust section |
| Thin books at quiet times | Earn maker quotes each live Window within caps; mint-a-pair lets opposite buyers trade without a maker; honest depth, never invented odds |
| Stock semantics (halts, gaps, splits, holidays, frequent ties) | Session calendar; confidence cap + missing-print voids; earnings-day caps; split-day skips; tie rule explained (PD-3) |
| Regulatory framing | Devnet test collateral only; geofence + "not investment advice"; no real-money claims |
| Market-data licensing | Every free or cheap market-data tier forbids public redistribution (`C:13` §4). Real-time IEX TOPS now costs $500/mo, rising to $1,000 from 10-01. Attested prints are labelled "demo data" and used only as a last resort. Devnet, non-commercial use is disclosed. Production uses licensed signed sources: Chainlink Data Streams ($150/stream/mo) and/or Pyth/RedStone agreements, or Databento EQUS.MINI ($199/mo), which allows redistribution |
| Devnet SOL (≈ 55–65 SOL; ≈ 2,600 Windows/day churn) | Stage deploys; close buffers; mixed 256/512-node books; PD-7 retention reclaim; relay closes Pyth update accounts; Surfpool for drives; optional program folding; request SOL early |
| Privy dashboard config (allowed origins, Solana devnet) | Configure in S1; Wallet Standard path through the same seam as fallback |
| Keys pasted in chat | Rotate Alpaca, Finnhub, Helius, Pyth and the Privy app secret after the hackathon |
| Reserve pricing manipulation (spoof depth across slots, cancel-to-thin) | PD-2 defence in depth: rested-age filter, oracle-model bound with refusal on disagreement, Masayume caps; adversarial cross-slot tests |
| Print/void ordering races | PD-6 admission deadline; both transaction orders tested |
| Claims lost to account cleanup | PD-7 `MarketResult` + dependents counter; Market and result close only after capture + retention; late-claim test |
| Seat exhaustion / sybil squatting | PD-8 growable Ledger, refundable bond, eviction, pre-allocated PROGRAM seats, vault aggregation |
| Indexer correctness (CPI events in inner instructions, failed txs, finality) | P§4 ingestion contract, atomic cursor, rebuild-from-deploy check |
| Sponsor drain | Spending policy (instruction allowlist, fee/CU caps, simulation delta, rent routes, global budget + circuit breaker) |
| Oracle price at 16:00:00 ≠ official close (e.g. TSLA 09-11: official 365.44, RedStone 365.48, Pyth last on-chain 365.275) | Every verdict and receipt says "oracle price at 16:00:00 ET" with its source; the official close is shown alongside when known; production settles closes on session-aware licensed sources (Chainlink/Pyth) |

## Appendix — research index

| Doc | Topic |
|---|---|
| `C:00-research-briefing.md` | Summary + key table |
| `C:01` | Tokenized-stock issuers, mints, Token-2022, regulation |
| `C:02` | Oracles, market hours, settlement design |
| `C:03` | Prediction-market landscape |
| `C:04` | Solana dev stack + port map |
| `C:05` | Masayume parity inventory: 74 rows, add-ons, open questions |
| `C:06-dreamdex-engine-spec.md` | DreamDEX Event Contracts engine spec |
| `C:07-solana-orderbook-options.md` | Manifest / Phoenix / OpenBook / Monaco / build-own comparison |
| `C:08-engine-and-programs-review.md` | 26 corrections, account/instruction spec, CPI map, security |
| `C:09-masayume-web-explorer.md` | Masayume web stack, tokens, shell, data layer, routes, env |
| `C:10-masayume-contracts-services-explorer.md` | Contract semantics + formulas, ports, ops actors |
| `C:11-solana-reference-patterns.md` | Solana reference repos, adopt/adapt/avoid |
| `C:12-stage-roadmap-source.md` | Full roadmap agent output behind P§7 |
| `C:13-affordable-equity-price-sources.md` | Affordable price sources: Pyth trial facts, RedStone, Switchboard (Anchor 1.x path), Chainlink pricing, data licensing, xStock token prices, phased settlement design (researched 2026-09-13) |

S2+ writes `docs/plan/specs/<program>.md` from `C:06`, `C:08`, `C:10` and the Masayume Solidity + tests; `specs/prints.md` comes from `C:13` + P§3.1.
