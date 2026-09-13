---
title: Masayume baseline parity inventory for Stocklana
status: research inventory — no implementation, no Solana-tooling or stock-oracle research (other agents own those)
date: 2026-09-13
method: reference-product-fidelity (SKILL.md + references/fidelity-contract.md §1–§3, §6)
reference_pin: Blockchain-Oracle/masayume main 68f7a09 (local == remote)
upstream_pin: reference/yosuku 3c56ef5 (local); Blockchain-Oracle/yosuku 9f0af31 (secondary, diverged)
deadline_context: Stocklana submissions close 2026-09-18
---

# Masayume baseline parity inventory for Stocklana

## 0. How to read this file

**Path prefixes** (all evidence is repo-relative under these roots):

| Prefix | Absolute root | Pin |
|---|---|---|
| `M:` | `/Users/abu/dev/hackathon/sommina-events` | `main` @ `68f7a09` (untracked only: `docs/marketing/creative-research-2026-09-11.md`, `videos/`) |
| `Y:` | `/Users/abu/dev/hackathon/sommina-events/reference/yosuku` | `3c56ef5` (2026-08-28), cloned from `Cybire1/yosuku` (now 404) |
| `BO:` | `github.com/Blockchain-Oracle/yosuku` | `9f0af31` (2026-06-29), inspected via `gh api` tree + contents |
| `D:` | `/Users/abu/dev/hackathon/masayume-docs` | `384d2a5` (source of docs.masayume.app) |

**Evidence markers.** **[C]** means I confirmed it from source, docs, `wc`, `grep` or `gh api` in this pass. **[I]** means inference, not yet verified. Live sites (masayume.app, docs.masayume.app) were **not** exercised at runtime in this pass. Runtime, responsive and theme behaviour are taken from Masayume's dated acceptance and parity records.

**Classification vocabulary** (per the skill; **Excluded is never used**, because the user has approved no exclusions for Stocklana):

- **Exact.** Same user-visible behaviour and presentation. Brand text may change.
- **Adapted.** Same product promise on Solana and US stocks/ETFs, backed by a different real implementation. "(Masayume gap)" means Masayume's own manifest required the capability but Masayume never finished it. Stocklana inherits the obligation.
- **Additive.** A user-requested add-on that must coexist with the baseline.
- **Blocked.** Source or platform evidence is genuinely missing. The blocker is named.
- **Open question.** The capability exists in the Yosuku lineage but not in shipped Masayume, often because the owner removed it for Masayume. The user must say whether Stocklana carries it. It is never silently dropped.

**Chain-coupling codes.**

| Code | Meaning |
|---|---|
| `UI` | Pure UI, no chain I/O. |
| `SDK-R` | Somnia `@somnia-chain/markets-sdk` read or indexer, through `packages/markets`. |
| `SDK-W` | SDK order or tx write, through `packages/markets`. |
| `SOL` | Masayume Solidity contract. |
| `WAL` | EVM wallet or signing primitive: wagmi, RainbowKit, `personal_sign`, EIP-712, ERC-2771. |
| `OPS` | Long-running `services/ops` actor or server signer. |
| `DB` | Postgres (`packages/db`). |
| `EXT` | External API: X, LLM, RSS, explorer. |

**Stock-semantics codes** (used in the ledger's stock column; §3.1 defines them):

| Code | Topic |
|---|---|
| `HRS` | Market hours, weekends, holidays |
| `BASIS` | 24/7 tokenized price vs exchange print |
| `HALT` | Trading halts |
| `CORP` | Splits, dividends, delistings |
| `EVT` | Earnings and macro events |
| `UNIV` | Ticker universe |
| `CORR` | Cross-ticker correlation |
| `REG` | Securities framing |

---

## 1. Authority record (fidelity-contract §1)

| Field | Content |
|---|---|
| **Target product** | Stocklana hackathon entry (brand TBD): a **prediction market on US stock and ETF prices on Solana**. It must carry *everything Masayume has*, plus user-requested add-ons. Submissions close **2026-09-18**. |
| **Reference artifacts** | **(1) Masayume app.** `M:` @ `68f7a09`. Local HEAD equals `Blockchain-Oracle/masayume` remote `main`, 2026-09-10 **[C per coordinator + `git log`]**. **(2) Masayume authoritative architecture package.** `M:docs/architecture/yosuku-source-led-migration/00–06` + `README.md`. **(3) Masayume acceptance ledger.** `M:docs/implementation/acceptance-2026-09-06.md` is the latest dated live truth. **(4) Masayume working parity ledger.** `M:docs/implementation/parity-ledger.md` (1,388 lines; decision log + per-surface tables). **(5) Masayume docs.** `D:content/docs` (52 guides; `help/availability.mdx` lists incomplete areas). **(6) Submission package.** `M:docs/submission/{buidl-description-2026-09-07,demo-script-2026-09-06}.md`, `M:web/public/video/masayume-demo-2026-09-07.mp4`. **(7) Upstream baseline.** `Y:` @ `3c56ef5`. **(8) Secondary upstream.** `BO:` @ `9f0af31`. **(9) Game mechanics references.** PIPS `fe8f696` and Flicky `56054ba` (`M:reference/{pips,flicky}`), mechanics only. **(10) Research index.** `M:context/11–15, 52`. |
| **Authority order** | 1. The user's latest explicit direction (this Stocklana brief). 2. **Masayume `68f7a09` source** for what the product currently is, read with its decision log and the 2026-09-06 acceptance ledger. 3. Masayume architecture package 00–06 for the *intended* minimum surface, including rows Masayume left Pending. 4. `D:` docs (user-facing promise and incomplete areas). 5. **Local Yosuku `3c56ef5`** as the newer upstream baseline. 6. **`BO:` Yosuku `9f0af31`** as secondary evidence. 7. PIPS/Flicky (mechanics). 8. `M:context/` research. 9. BMAD artifacts (historical). **Conflict noted [C]:** the parity ledger's *Route baseline* table (`parity-ledger.md` L1240–1293) is stale against code and the later decision log. For example, it lists `/waitlist` and `/creators` as "Shell" although they were deleted 2026-09-04. It also lists `/` as "Shell" while `M:web/src/app/page.tsx` redirects to `/markets`. **Code and the decision log win.** |
| **Baseline strength** | **Minimum product baseline.** The user said "every feature on those listings is gonna be there". |
| **Allowed deviations** | (1) **Chain:** Somnia/DreamDEX to Solana. (2) **Asset class:** BTC/ETH to US stocks/ETFs (tokenized). (3) **Brand:** TBD. Per the skill, a rename changes identity fields only, not palette, type, layout, IA or voice. (4) **Additive features.** *Carried by inference, recommend confirming:* Masayume doc 00's "truth corrections" class (rewording a claim that would be false on the new stack) [I]. |
| **Additions (Additive)** | (a) **Betting against stocks:** short or inverse exposure beyond binary Down. (b) **Yield:** Earn on idle balances and LP/reserve capital. (c) **Deeper social trading:** leaderboards, copy trading, trade-from-X. See §5 and ledger rows `A-*`. |
| **Missing evidence** | **1. The market primitive.** Masayume never built an Up/Down market. DreamDEX supplied Windows, the CLOB, OracleHub prints, ERC-6909 outcome tokens, redemption and the collateral faucet. The Solana and stock equivalent is owned by other agents and blocks most `SDK-*` / `SOL` rows. **2. Native app.** Yosuku's README claims Expo iOS/Android, but neither `Y:` nor `BO:` contains native source **[C tree]**. **3. Yosuku divergence.** Local and BO histories diverge (§1.1). **4. Runtime verification.** No runtime browser pass this session. **5. Masayume's own gaps:** landing page, plain cash-out, OG images, achievements/profile/friends, paid Memory Market, Reversion preset, Range takes, Fear/Greed provider, lifecycle notifications. **6. Stock inputs absent from all references:** no session calendar, corporate-action handling or equities news source. **7. Prior removals.** The 2026-09-04 Masayume route removals were owner-approved *for Masayume*. Whether they stand for Stocklana is unrecorded. |
| **Provenance** | Per `M:THIRD_PARTY_NOTICES.md` and `M:docs/submission/public-release-audit-2026-09-06.md` **[C]**: **Yosuku.** Reuse is owner-approved (2026-09-01), but the pinned tree has **no LICENSE**. The MIT badge links to an absent file, and redistribution terms and copyright notice are **unrecorded**. **PIPS/Flicky.** No root licence (Flicky "TBD"), so behaviour references only, with UI/engine/server independently implemented. **Assets.** Ten sounds (Kenney CC0); m6x11plus (attribution-only, Daniel Linssen); Sora/Inter/JetBrains Mono/Noto Serif JP (OFL 1.1); DiceBear Notionists (design CC0, code MIT). **Masayume itself.** Private repos, no project licence; Solidity files carry MIT SPDX headers only. **Stocklana implication [I]:** reusing Masayume code is the owner's own work, but its Yosuku-derived CSS and source still carry the unresolved redistribution question. A public hackathon repo forces that decision. |
| **Task boundary** | Research and inventory only. No implementation, deployment or live action. No Solana tooling or stock-oracle research. |

### 1.1 Yosuku lineage divergence (coordinator-supplied pins; spot-checked this pass)

| Fact | Evidence |
|---|---|
| `BO:` main `9f0af31` vs local `3c56ef5`: `status: diverged`, **ahead_by 121, behind_by 591**, merge base `0f2928a` (2026-05-12). | `gh api repos/Blockchain-Oracle/yosuku/compare/3c56ef5...9f0af31` **[C]** |
| `BO:` tree has 261 blobs. Its app routes are a **subset** of local's; the only `BO:`-only route is `/feed`, which local renamed to `/reels` (same TikTok-style feed; `BO:app/feed/page.tsx` header). | Tree diff **[C]** |
| All 16 `BO:` API routes exist locally. Local adds 19 more (sensei, spot, traction, claim/x/*, bet/build, studio, creator-card, alerts, desk/health, agent-spec, deposit/cctp, fund-preview, room/ensure). | Tree diff **[C]** |
| `BO:`-only files. `components/TheBell.tsx` is a draggable floating round-countdown widget. `components/TradingBalanceModal.tsx` is a wallet-to-Trading-Balance deposit/withdraw sheet. `app/opengraph-image.tsx` is a site-wide OG card. There are also planning docs only: `ROADMAP.md`, `DESIGN.md`, `PITCH_DECK.md`, `YOSUKU_DECK.md`, `DEPLOY_V13.md`, `TRADING_BALANCE_PLAN.md`, `TRADING_BALANCE_AGENT_HANDOFF.md`, `architecture.md`. `infra/onara/policies/*` exists in both trees. | `gh api …/contents/<path>?ref=9f0af31` **[C]** |
| The coordinator's 121 commit subjects (zkLogin, news, docs, strategy grid + MemWal, underwriting/earn, margin desk, stats + waitlist, parlay, surface, pitch/demo, trade-from-x, claim) all have **route or file counterparts in local `3c56ef5`**. They are likely re-landed under different commits [I; not reconciled commit-by-commit]. The `/agent` attested showcase was added then removed and is absent at both tips. | Route/file presence **[C]**; reconciliation **[I]** |
| **Yosuku-only capabilities absent from both local Yosuku and Masayume:** TheBell widget, root OG image, `/agent` showcase. These appear as `Y-*` open-question rows in §3.3. | — |

---

## 2. Reconstruction inventory

**Count [C]:**
- **59** `page.tsx` routes: 37 product/public (including 5 redirects and 1 honest "blocked" page) and 22 `/dev/*` fixtures.
- **39** API route handlers.
- **8** ops actors.
- **8** Solidity contract families (34 files).
- **74** ledger surfaces (`L-01…L-74`), **18** Yosuku-lineage open rows (`Y-01…Y-18`), **10** additive rows (`A-*`).

### 2.1 Surfaces by fidelity-contract category

| Cat. | Surface (ledger id) | Route / entry | Evidence |
|---|---|---|---|
| **Shell & chrome** | Root layout, theme pre-paint, fonts, PWA manifest (L-01) | all | `M:web/src/app/layout.tsx`, `web/src/lib/theme.ts`, `web/public/manifest.webmanifest` |
| | Desktop header, grouped nav, balance pill, account menu (L-02) | all | `M:web/src/components/shell/header/{Header.tsx,nav-items.ts,nav-items.test.ts}` |
| | Mobile floating pill nav + "Everything" drawer (L-03) | all | `MobileBottomNav.tsx`; `parity-ledger.md` L1327–1329 |
| | AppStrip, Marquee ticker, Footer, grain, cursor, theme toggle (L-04) | all | `M:web/src/components/shell/*`, `components/chrome/{LiveTicker,Ticker}.tsx` |
| | Yosuku design system port (L-05) | all | `M:web/src/styles/yosuku/` (5,871 L), 40 feature CSS files |
| | Toast (L-06); error boundaries (L-07); write-journal recovery (L-08); wrong-network banner (L-10) | all | `components/ui/toast.tsx`; `app/{error,global-error,not-found}.tsx`; `features/recovery/`, `packages/markets/src/submitter/recovery.ts`; `components/chrome/WrongNetworkBanner.tsx` |
| **Landing / public** | Editorial landing (L-11). **Masayume redirects `/`→`/markets`**; Yosuku has the full page. | `/` | `M:web/src/app/page.tsx` ("landing page lands in Epic 4"); `Y:app/page.tsx` (1,032 L); `M:context/11` §`/` |
| | How it works (L-12), Demo (L-13), Pitch (L-14), Stats (L-15), Status (L-16), News (L-17), Download/PWA (L-18), Native auth (L-19), Docs site (L-20), legacy redirects (L-21), share cards (L-22), OG images (L-23) | `/how-it-works` `/demo` `/pitch` `/stats` `/status` `/news` `/download` `/native-auth` external docs; `/bell` `/beta` `/markets-live` `/markets/[id]` `/pool` | `M:web/src/features/{how-it-works,demo,pitch,stats,status,news,install,share}`; `D:content/docs/**` |
| **Auth / first run / funding** | First-run Tutorial (L-09) | `/markets` overlay | `features/onboarding/*` |
| | Wallet connect/disconnect/switch (L-24) | header, `/portfolio` connect card | `M:web/src/providers/*` (RainbowKit + wagmi) |
| | Get test funds: gas top-up + collateral mint (L-25) | header / portfolio / ticket gate | `app/api/faucet/{route,challenge/route}.ts`; `features/funding/`; `docs/implementation/testnet-faucet-2026-09-07.md` |
| | Add-money modal + first-credit welcome (L-26) | header pill `+` | `features/funding/AddFunds.tsx`; ledger 2026-09-04 "One money rail" |
| | Tap-trading session key + grant + sponsor (L-27) | ticket, portfolio | `features/session/` (20 files), `packages/markets/src/sessions/session-key.ts`, `app/api/sponsor/route.ts` |
| | Trading Balance vault (L-28) | `/portfolio` plate rows | `features/vault/`; `contracts/src/vault/EventVault.sol` |
| **Primary loop** | Markets hero-as-ticket (L-29), live rail (L-30), "Just ask" board (L-31) | `/markets` | `features/markets/{hero,lanes,word-board}`; ledger §hero L845–873 |
| | Call ticket, one-tap (L-32) | `/markets` rail / mobile drawer | `features/markets/ticket/` (1,531 L); ledger 2026-09-04 "nine blocks" |
| | Verdict + inline claim (L-33); claim-all (L-34); plain cash-out (L-35, **not built**) | `/markets`, `/portfolio` | `features/markets/{verdict,claims}`; `grep cash-out features/markets` = 0 **[C]** |
| **Specialist tickets** | Range (L-36), Boost/leverage (L-37), Parlay (L-38), Private (L-39), Market Surface (L-40) | ticket modes; `/games/range`; `/parlay`; `/surface` | `features/{range,leverage,parlay,private,surface}`; `contracts/src/{range,leverage,parlay,private}` |
| **Assistant & social-in-market** | Sensei (L-41), The Room (L-42), price alerts (L-43), Reels (L-44), Takes (L-45) | dock on `/markets` (`?sensei=1`); hero foot; `/reels` | `features/{sensei,room,alerts,takes}`, `features/markets/reels`; `app/api/{sensei,room/*,takes}` |
| **Portfolio & analytics** | Portfolio (L-46), Trader Edge (L-47), Leaderboard (L-48), reputation/badges/CSV (L-49) | `/portfolio` `/portfolio/edge` `/leaderboard` | `features/markets/{portfolio,balance,history}`, `features/{edge,leaderboard}`; `packages/core/src/projection/*` |
| **Earn / yield** | Maker vault (L-50) | `/earn` | `features/earn/`; `contracts/src/maker/`; `services/ops/src/actors/market-maker/` |
| **Agents** | Strategies desk (L-51), launch builder (L-52), copy (L-53), agents board (L-54), runner + self-host (L-55), paid Memory Market (L-56, incomplete), Reversion preset (L-57, not selectable) | `/strategies` `/agents` | `features/strategies/` (40 files); `contracts/src/strategy/StrategyRegistry.sol`; `services/ops/src/actors/strategy-runner/`; `D:content/docs/{agents/*,builders/self-host-agent.mdx,help/availability.mdx}` |
| **X social trading** | Trade-from-X (L-58), X recovery/claim (L-59), X relay (L-60) | `/trade-from-x` `/claim` | `features/x/` (26 files); `app/api/x/*`; `packages/core/src/x/parse.ts`; `services/ops/src/actors/x-relay/` |
| **Games** | Hub (L-61), Practice (L-62), Duel + match link (L-63), History (L-64), Rank + seasons (L-65), Lucky Draw (L-66), Moonshot (L-67), Line Rider (L-68), Candle Hop (L-69), audio/motion/art (L-70), profile/achievements/friends (L-71, pending) | `/games` `/games/{practice,duel,duel/[matchId],history,rank,lucky,moonshot,range,line-rider,candle-hop}` | `features/games/{duel,lucky,moonshot,practice,arcade,art,stage}`; `contracts/src/games/*`; `services/ops/src/actors/{matchmaker,game-room,duel-projector,duel-settler}`; `app/api/games/*` (15 handlers) |
| **Developer / operator** | `/dev/*` fixtures (L-72), ops host and health (L-73), API surface (L-74) | `/dev` + 21 pages | `M:web/src/app/dev/page.tsx` (fixture index); `services/ops/src/{main,runner-main}.ts` |

### 2.2 End-to-end flows (transitions, blockers, recovery)

1. **First call.**
   - The user browses `/markets` signed out; reads need no wallet.
   - Tutorial shows once and ends on Connect.
   - Header or ticket gate offers **Get test funds**: a signed challenge, then the STT top-up (<1 → 2 STT, quota-bounded), then the wallet-signed tUSDC mint. CreditWelcome fires on the first credit.
   - The ticket quotes off the book, handles approval, and places the IOC. A book move gives a requote, never a worse fill.
   - A confirmed fill turns the ticket into **The Call** (share PNG). The toast carries the tx.
   - At expiry the hero shows the **Verdict**. Won positions show **ClaimWinnings** inline, then land in portfolio history with receipt, equity and badges.
   - Recovery: an unknown or timed-out send is reconciled at next session start as confirmed, reverted, absent or unknown, and is never resent.
   - Evidence: `parity-ledger.md` §Toast, §Error recovery, 2026-09-04 rows; `testnet-faucet-2026-09-07.md`.
2. **Tap-trading.**
   - The enable modal (one sentence, one button, caps behind "adjust") triggers `depositAndGrant`, one signature, which arms the browser session key.
   - Taps route to `placeFor` when `simulateCaps` passes. Otherwise the wallet signs and the reason is stated.
   - The manager shows grants; **Revoke** ends the grant. Sponsor gates are per address and per device.
   - Evidence: ledger §Session-key tap trading; 2026-09-04 modal row.
3. **Agent lifecycle.**
   - The 4-step builder runs identity/approach → behaviour/limits → real test read → publish (StrategyRegistry). A failed publish receipt is preserved and retried.
   - A follower opens the CopyDrawer: STRATEGY grant, then `subscribe` (2 signatures).
   - The runner reserves a decision, makes the model or deterministic read, records the attempt before sending, fills, auto-settles to the owner's available balance, and never refills the grant.
   - Pause and revoke are available.
   - Evidence: `acceptance-2026-09-06.md` (live AI loss, Momentum win, restart comparison).
4. **Trade from X.**
   - The user signs in with X (OAuth 1.0a), links the wallet with a signed message (5-min TTL), and funds an EXECUTOR grant.
   - The user mentions `@masayume_app <btc|eth> <up|down> <stake> <cadence>`. The relay parses and either executes once or refuses.
   - The reply is an image card with sender, market, spend and full hash; its own replies are fenced from recursion.
   - "Cash out" means revoke, which returns the budget to the Trading Balance.
   - Evidence: `acceptance-2026-09-06.md` X rows; `core/x/parse.ts`.
5. **Duel.**
   - Hub → queue with widening Elo band → match found.
   - The entry transaction (`createMatchWithAgent` / `joinMatchWithAgent`) escrows the pot and names a browser match key. The sponsor funds the key's gas once the arena names it.
   - Deck commit, then permissionless reveal, then swipe picks signed by the key. At 15 s left a card is auto-swiped on the favoured side.
   - Lock → per-card settlement → finalize → result modal and share.
   - `/games/duel/[matchId]` is reload-safe, and outsiders see a read-only view.
   - Refund branches: creator cancel, join timeout, reveal unavailable, one or both players incomplete, void.
   - Evidence: `06-game-architecture.md`; ledger 2026-09-04 duel rows.
6. **Lucky.** Server seed commit → client seed → HMAC draw over the eligible-Window candidate hash → deal card with proof → place through the normal ticket lane → verdict, history and streak. **No deal** and **unconfirmed** are distinct outcomes.
7. **Earn.**
   - Supply mints shares at the conservative share price.
   - The maker actor rests bounded post-only quotes.
   - Withdrawal takes idle capital only. Every closed, unsettled Window is cranked first (one signature each).
8. **Private.**
   - `depositAndAllow` → sign the human-readable authorisation → the desk opens in 3 txs (charge/fund/mint) → an EIP-712 claim is stored in localStorage.
   - Back up and Restore work from an empty browser. Cash-out runs settle → sweep → credit to the private balance, then withdraw.
   - A lost reply resumes without double charging.

### 2.3 State inventory (Masayume state contract + stock additions)

Masayume's contract (`01-reference-parity-manifest.md` §State contract; `parity-ledger.md` L1379–1388) **[C]**:

| Family | Masayume states (must carry) | Stock-specific states Stocklana must add [I] |
|---|---|---|
| Identity | signed out → connecting → first run → linked → returning → recovery → revoked | jurisdiction / eligibility gate if tokenized-stock access is restricted (`REG`) |
| Money | unfunded → insufficient → grant required → funded → pending withdrawal | none structural |
| Reads | loading → live → stale last-good → empty → disconnected → unavailable (`Reading<T>`) | **feed paused by session** (not an outage); last official close vs live token price (`BASIS`) |
| Market (Window) | upcoming → live → between rounds → near expiry (no-entry buffer `max(30, min(300, 0.4×interval))`) → suspended → expired → settled → voided | **pre-market / regular / after-hours / closed (weekend/holiday) / early close / halted (LULD, news, MWCB) / corporate action pending / delisted**; earnings-window warning (`HRS HALT CORP EVT`) |
| Trade | quote loading → quote moved (requote) → confirmation → submitted → fill/partial → rejected (named blockers) → unknown → claimable → redeemed | refused: *market closed*, *ticker halted*, *auction window*; void reason: *halt / corporate action* |
| Social/agent | unlinked → authorizing → authorized → capped → expired → runner unavailable → execution receipt | runner "sleeping until open"; X refusal "market closed" |
| Game | idle, tutorial, queued, matched, reveal, picking, locked, per-card settlement, final, refund, forfeit, reconnect | "no dealable deck until open"; Practice paused off-hours unless a 24/7 basis is chosen |
| Responsive | inspected at 390/768/1024/1440 (and 320); mobile pill nav; Reels phone-proportioned on desktop; ticket drawer ↔ rail | ticker search/picker at 320 px |

---

## 3. Parity ledger

### 3.1 Stock-semantics reference (defined once; ledger cells cite codes)

These are **impact statements**, not oracle or tooling research. They are **[I]** unless noted.

- **`HRS`: market hours.** US equities trade regular hours 09:30–16:00 ET, with extended sessions of roughly 04:00–09:30 and 16:00–20:00. They are closed weekends and exchange holidays, with 13:00 early closes. Masayume's Windows (5m/15m/1h/4h/1d lanes **[C]**) assume a 24/7 underlying. Every always-on surface (lanes, Reels, Duel decks, Lucky, Practice, agents, X) needs a session calendar and an honest closed state.
  - A Window that spans the close or a weekend needs a stated settlement rule: refuse, settle on next open, or settle on the 24/7 token price.
- **`BASIS`: settlement print.** Tokenized stocks trade 24/7 on-chain, while exchange prints (consolidated last, official closing auction) exist only in session. The "opening print" concept (the Window's line, **[C]** OracleHub in Masayume) must name which price it uses. Off-hours token premium or discount and stale feeds must be detectable, and `/status` lag thresholds become session-aware.
- **`HALT`: trading halts.** LULD pauses, news/regulatory halts and market-wide circuit breakers freeze the reference price. The product needs rules for placing (refuse), knock-outs (impossible while halted), and settlement (void, extend, or last print).
- **`CORP`: corporate actions.**
  - Splits and reverse splits make the opening print non-comparable.
  - Cash dividends drop price on the ex-date, biasing Down.
  - Spin-offs, mergers, symbol changes and delistings need handling.
  - Tokenized wrappers may rebase or use multipliers, so prices must be normalized.
- **`EVT`: scheduled events.** Earnings (usually pre-market or after-hours), FOMC and CPI create gap opens. House-priced products that assume a normal return with measured σ (Range, Moonshot) are mispriced across gaps. Knock-out reserves (Boost) take gap losses beyond the line, and maker inventory carries gap risk.
- **`UNIV`: ticker universe.** BTC/ETH become a curated ticker set that depends on which tokenized stocks and ETFs exist on Solana (other agents). Consequences:
  - Asset marks and logos (trademark), per-ticker σ and price-scaled presets (Masayume already scales presets by price **[C]** ledger 2026-09-03).
  - Lane count grows as tickers × cadences, so discovery, paging and filters are needed.
- **`CORR`: correlation.** Parlay's same-print correlation floor **[C]** covers Windows closing on the same instant. Equities also correlate across tickers (SPY/QQQ, sector names), which affects parlay pricing and reserve exposure caps.
- **`REG`: securities framing.** Binary or leveraged bets on securities, tokenized-stock eligibility and geofencing, "not investment advice" copy (Sensei, copy trading) [I; flagged, not researched].

### 3.2 Baseline ledger (one row per capability)

| # | Surface | Reference evidence | Reference behaviour | Coupling | Stock-semantics impact | Class | Porting notes |
|---|---|---|---|---|---|---|---|
| L-01 | Root layout, providers, pre-paint theme, fonts, PWA manifest | `M:web/src/app/layout.tsx`; `web/src/lib/theme.ts`; `web/public/manifest.webmanifest`; `Y:app/layout.tsx` | Sora/Inter/JetBrains Mono/Noto Serif JP; no theme flash; installable PWA | UI + WAL (providers) | none | Exact | Copy; 4 of 8 files in `web/src/providers` import wagmi/viem/RainbowKit **[C]**. Swap for a Solana wallet provider behind the same context. |
| L-02 | Desktop header, grouped nav, balance pill, account menu | `M:web/src/components/shell/header/{Header.tsx,nav-items.ts,nav-items.test.ts}`; ledger L1327 | Markets · Reels · Games▾ · Build▾ · Explore▾ · Portfolio; pill = spendable sum + `+` opens AddFunds; menu Trading account/Wallet/Portfolio/Disconnect | UI + SDK-R | A session indicator (open/closed) fits the header [I] (`HRS`) | Exact | The route-coverage test fails when a public route loses its nav home. Keep it. |
| L-03 | Mobile pill nav + "Everything" drawer | `MobileBottomNav.tsx`; ledger L1327–1329 | Markets·Reels·Games·Portfolio·More; focus trap; no overflow at 320 | UI | none | Exact | Copy. |
| L-04 | AppStrip, Marquee ticker, footer, grain, cursor, theme toggle | `M:web/src/components/shell/*`; `components/chrome/{LiveTicker,Ticker,useTickerPrices}.tsx`; ledger L1226–1231 | Real venue prices + next close in marquee; Fear/Greed cell pending | UI + SDK-R | Ticker shows equities with closed/last-close labelling (`HRS BASIS UNIV`); VIX-like sentiment cell [I] | Adapted | The price source moves behind the Solana adapter. |
| L-05 | Design system (Yosuku port) | `M:web/src/styles/yosuku/` (5,871 L; ~99.6% line match to `Y:app/globals.css` per release audit); parity manifest §Visual contract | Cream `#F4EEE3` / dark `#050505` / vermilion `#E04D26` / profit `#34D399` / loss `#FB7185`; grain, torii headers, banzuke; reduced motion | UI | Ticker logos replace BTC/ETH drawings (`UNIV`) | Exact | Brand TBD must not change tokens without a user decision. Carries Yosuku provenance question. |
| L-06 | Toast / transaction feedback | `components/ui/toast.tsx`, `styles/toast.css`; ledger §Toast | Typed stack, tinted border, bounce entry | UI | none | Exact | Copy. |
| L-07 | Error boundaries | `app/{error,global-error,not-found}.tsx`; `components/states/BoundaryScreen.tsx` | "A quiet moment on the floor." | UI | none | Exact | Copy. |
| L-08 | Write-journal recovery on session start | `packages/markets/src/submitter/{journal,recovery,reconcile}.ts`; `features/recovery/WriteRecovery.tsx` | Verdicts confirmed/reverted/absent/unknown; never resend | SDK-W | none | Adapted | Journal and verdict UI port. Receipt reading becomes signature-status and blockhash expiry [I]. |
| L-09 | First-run Tutorial | `features/onboarding/*`; `Y:components/Tutorial.tsx` | 5 steps once per browser; ends on Connect | UI | Copy must explain session-bound Windows (`HRS`) | Adapted | Copy change only. |
| L-10 | Wrong-network banner | `components/chrome/WrongNetworkBanner.tsx` | Chain 50312 guard | WAL | none | Adapted | Becomes a cluster guard (devnet/mainnet). |
| L-11 | **`/` editorial landing** | `Y:app/page.tsx` (1,032 L; `M:context/11` §`/`); **Masayume `M:web/src/app/page.tsx` = redirect** **[C]** | Yosuku: live dial hero, 5 sticky acts, manifesto, spec table, FAQ, giant-mark footer. Masayume: not ported. | UI + SDK-R | Dial needs a live stock Window or a closed-market state (`HRS`) | Adapted (Masayume gap) | Port from Yosuku source, since Masayume has no implementation. The parity manifest listed it as "Exact shell". |
| L-12 | How it works | `features/how-it-works/` (598 L); ledger §Public proof | Steps, 64/36 worked example (labelled), mechanics, fees, settlement, 7 FAQs | UI | Must explain session rules, halts, corporate actions, settlement price (`HRS HALT CORP BASIS`) | Adapted | 0 chain imports **[C]**. Facts rewrite. |
| L-13 | Demo | `features/demo/` (652 L); `web/public/video/masayume-demo-2026-09-07.mp4`; `docs/submission/demo-script-2026-09-06.md` | Native player, captions, transcript, feature walkthrough, tx evidence links | UI + EXT | Recording must happen in session or on a declared 24/7 basis (`HRS`) | Adapted | New footage and evidence required before 2026-09-18. |
| L-14 | Pitch folio | `features/pitch/` (1,343 L) | 15 slides, keyboard/dots, CONCEPT/NOT LIVE labels, live usage from `/api/leaderboard` | UI + SDK-R | Thesis rewrite (`REG` framing) | Adapted | Copy. |
| L-15 | Stats / traction | `features/stats/`; `packages/markets/src/provider/{traction,scan}.ts`; `app/api/traction` | 24h wallets, calls, staked, settled; hourly growth curve; activity rows → explorer; `complete:false` floors | SDK-R (indexer fill tape) | Rolling 24h spans closed sessions, so weekends read near-zero (`HRS`) | Adapted | Needs a Solana indexer for program events [I]. |
| L-16 | Status | `features/status/`; `app/api/status/route.ts` | Parallel probes: RPC, indexer, price-feed lag, store, Sensei; 120 s rule | SDK-R + DB + EXT | Feed lag off-hours is expected, not degraded (`HRS BASIS`) | Adapted | Probe set changes; the page structure copies. |
| L-17 | News wire | `features/news/`; `app/api/news/route.ts` (Cointelegraph + Decrypt RSS) | Lead story, numbered wire, keyword sentiment | EXT | Equities/earnings news; per-ticker filter [I] (`EVT UNIV`) | Adapted | Provider swap. |
| L-18 | Download / PWA install | `features/install/` (277 L); ledger §Download | Install state machine (prompt/iOS/manual/installed), real phone capture | UI | none | Adapted | Copy. |
| L-19 | Native app + `/native-auth` | `M:web/src/app/native-auth/page.tsx` (CapabilityPending); `Y:README.md` L7, L53 (Expo claim) | Honest "no native build" | — | — | **Blocked** (no native source in `Y:` or `BO:` **[C]**) | Keep the honest page. |
| L-20 | Documentation site | `D:content/docs/**` (52 guides); `nav-items.ts` `DOCS_URL` | Quickstart, trading, games, agents, builders, architecture maps, llms.txt | UI (separate repo) | Every guide's facts change | Adapted | The docs framework copies; content is rewritten. |
| L-21 | Legacy redirects | `app/{bell,beta,markets-live,markets/[id],pool}/page.tsx` | Old links resolve, never 404 | UI | none | Exact | Copy. |
| L-22 | Share cards (The Call, Earned Heat) | `features/share/` (1,027 L); ledger §Sharing | 1600×900 PNG, QR stub, native share/X intent, leverage caveat, oracle-settled record | UI | Settlement line names the price basis; void reason halt/corp action (`BASIS HALT CORP`) | Adapted | 0 chain imports **[C]**. |
| L-23 | Social OG images | `Y:app/markets/[id]/opengraph-image.tsx`; `BO:app/opengraph-image.tsx`; Masayume none (`grep ImageResponse` = 0 **[C]**) | Per-market OG with live probability; site OG card | UI + SDK-R | Per-ticker OG | Adapted (Masayume gap) | See also Y-14. |
| L-24 | Wallet connect / disconnect / account switch | `M:web/src/providers/*`; `features/markets/wallet/`; `packages/markets/src/react/session.tsx` | RainbowKit; sessions disposed on account/chain switch | WAL | none | Adapted | Solana wallet-adapter with the same dispose semantics. |
| L-25 | Get test funds | `app/api/faucet{,/challenge}/route.ts`; `features/funding/`; `features/markets/faucet/`; `packages/{core,db,markets}/src/faucet` | Signed challenge → STT top-up (quotas, Postgres reservations, exact-bytes retry) → SDK tUSDC mint | OPS (server signer) + SDK-W + DB | Test collateral is stablecoin; mainnet tokenized stocks are not faucet-able [I] | Adapted | Policy, DB and UI copy port. The signer becomes SOL airdrop/transfer plus a test-USDC mint. |
| L-26 | Add-money modal + CreditWelcome | `features/funding/AddFunds.tsx`, `CreditWelcome.tsx`; ledger 2026-09-04 | One mint rail; welcome on first credit | UI + SDK-W | Mainnet may want an on-ramp (see Y-05) | Adapted | Copy. |
| L-27 | Tap-trading (session key + SESSION grant + sponsor) | `features/session/` (1,620 L); `packages/markets/src/sessions/session-key.ts`; `packages/markets/src/vault/sponsor.ts`; `app/api/sponsor/route.ts` | Enable modal (1 sig `depositAndGrant`), caps editor, capability receipt, manager, revoke; forwarder-sponsored `placeFor` with allowlist | SOL + WAL + OPS | Grants must refuse when the ticker is closed or halted (`HRS HALT`) | Adapted | Grant program on Solana is new. Session keys and fee-payer sponsorship are native patterns [I]. 0 direct chain imports in feature; 9 port imports **[C]**. |
| L-28 | Trading Balance vault | `features/vault/` (906 L); `contracts/src/vault/{EventVault,VenueGateway,VaultTally}.sol` (590 L); ledger §EventVault | Deposit once, owner-only withdraw, private bucket, typed grants SESSION/EXECUTOR/STRATEGY (+ game key), `crankSettle`, per-owner tally | SOL | none | Adapted | Foundation for every add-on. Invariant "no function takes a destination" must survive. |
| L-29 | `/markets` hero-as-ticket | `features/markets/hero/` (1,003 L); `features/markets/MarketsScreen.tsx`; ledger L845–873 | Asset badge, cadence tabs from live lanes (5m/15m/1h/4h/1d), "BTC holds above $open?", distance line, settles-in, chart, foot (Room · Alerts · ramp), mobile UP/DOWN, `?m=&dir=` deep links, auto-roll in no-entry buffer, skeleton / diagnosis / "no live Windows" | SDK-R | "Between rounds" must become "Market closed · opens …" (`HRS`); ticker picker (`UNIV`); line = which open price (`BASIS`) | Adapted | Presentation copies; lane discovery moves behind the adapter. |
| L-30 | §01 live-now rail cards | `features/markets/lanes/` (505 L); ledger §§01 rail card | Chart card per lane, live odds ramp, UP/DOWN, closing state, between-rounds placeholder | SDK-R | Tickers × cadences explode the rail; needs filters/paging (`UNIV`) | Adapted | Copy with a grouping change. |
| L-31 | §02 "Just ask" word board | `features/markets/word-board/`; `packages/core/src/market/horizons.ts` | Plain yes/no questions by horizon; `N% implied` | SDK-R | Templates like "Will AAPL close above $X today?" (`HRS BASIS`) | Adapted | Copy. |
| L-32 | Call ticket (one-tap) | `features/markets/ticket/` (1,531 L); ledger 2026-09-04 "nine blocks", "over-book" rows | Stake + `+1 +5 +20`; Current cost · Return · Max loss; route Wallet / Trading Balance / Private; inline gates; named blockers (over-book, thin-book, reserve-cap); requote; The Call on fill; drawer ↔ rail | SDK-W + SOL | New blockers: closed, halted, auction window; earnings-day warning (`HRS HALT EVT`) | Adapted | Blocker vocabulary extends. The ticket shape stays. |
| L-33 | Verdict + inline claim | `features/markets/verdict/` (454 L) | Win/loss/void/both-sides-net; collect on the Window | SDK-R/W | Void reasons from halts, delistings, corporate actions (`HALT CORP`) | Adapted | — |
| L-34 | Claim-all plate | `features/markets/claims/` (563 L) | Idle → progress → success receipt | SDK-W | none | Adapted | — |
| L-35 | **Plain-position cash-out** | Yosuku "Cash out anytime" act (`M:context/11` §`/` sticky features); Masayume ledger "cash-out pending"; no control in `features/markets` **[C]** | Masayume: not built (how-it-works FAQ says the app control is pending) | SDK-W | No exit liquidity when closed; wide after-hours spreads (`HRS`) | Adapted (Masayume gap) | Leverage and Private already have cash-out. |
| L-36 | Range (ticket mode + `/games/range`) | `features/range/` (1,595 L); `contracts/src/range/` (793 L); `packages/core/src/range/` (+ `pricing.vectors.json`) | Inside band (Tight/Balanced/Wide, centre steps); Outside on the game page; priced from book centre + σ from venue prints; permissionless settle / void-stale / claim | SOL + SDK-R | σ per ticker and per session; overnight/earnings gaps break the normal model (`EVT HRS UNIV`) | Adapted | Math, vectors and UI port. Settlement basis is new. |
| L-37 | Boost 2×/3× (LeverageReserve) | `features/leverage/` (435 L); `contracts/src/leverage/` (800 L); `services/ops/src/actors/leverage-keeper/` (114 L); `core/leverage` (+ `sizing.vectors.json`) | Knock-out certificate: front `(L−1)·stake`, 8% premium, 120% line, no opens in the last 90 s, owner cash-out, permissionless knock-out | SOL + OPS + SDK-R | Gap through the line at open or after a halt; no knock-out while halted (`HALT EVT`) | Adapted | Needs book or mark source on Solana. |
| L-38 | Parlay | `features/parlay/` (1,362 L); `contracts/src/parlay/` (610 L); `core/parlay` (+ vectors) | Legs = Window + side priced off books in-tx; correlation floor; a void leg voids the ticket; Settle/Paid/Voided; reserve liquid line | SOL + SDK-R | Cross-ticker correlation; legs spanning a close (`CORR HRS`) | Adapted | — |
| L-39 | Private mode | `features/private/` (1,352 L); `contracts/src/private/` (531 L); `app/api/private/{status,open,cashout}`; `features/private/desk.server.ts` | Link-private desk (charge/fund slot/mint), EIP-712 claims in browser, back up/restore, cash-out, "not anonymous" copy | SOL + WAL (EIP-712) + server desk key | none specific | Adapted | Claims re-signed with ed25519 [I]. Honesty copy copies. |
| L-40 | Market Surface | `features/surface/` (855 L); `core/surface/` | Book tiles, cumulative depth, slippage ladder, term structure; crossed-book honesty | SDK-R (books) | Term structure across sessions; listed-options implied vol is an optional add [I] | Adapted | — |
| L-41 | Sensei AI dock | `features/sensei/` (918 L); `app/api/sensei`; `packages/brain` (252 L) | Ring, teaser, drawer, meter, tape, typewriter, chips; trade cards hand off to ticket; **the Brake**; provider-agnostic AI SDK | EXT (LLM) + SDK-R | Prompt must know hours, earnings, halts; securities-advice framing (`HRS EVT REG`) | Adapted | Brain package copies. Prompt rewrite. |
| L-42 | The Room | `features/room/` (865 L); `app/api/room/{route,join,bet,status}`; `packages/db/src/{comments,bettors}.ts` | Bettors-only per-Window chat; signed join; bettors registry; 9 s poll | DB + WAL + SDK-R | Per-ticker rooms may suit short Windows better [I] | Adapted | Signature verify changes to ed25519. |
| L-43 | Price alerts | `features/alerts/` (389 L) | Above/Below rules, in-tab evaluator, toast + system notification | SDK-R | Which price triggers off-hours (`BASIS HRS`) | Adapted | — |
| L-44 | Reels | `features/markets/reels/` (579 L); ledger §`/reels` | Snap feed of Windows + woven takes; IO-gated charts; UP/DOWN deep links; take pill; ↑/↓; `?m=` restore | SDK-R + DB | Closed session feed ("next open" cards or 24/7 basis) (`HRS`) | Adapted | — |
| L-45 | Takes | `features/takes/` (625 L); `app/api/takes`; `packages/db/src/takes.ts` | Signed post, ✓ position, "take the other side"; Range takes disabled | DB + WAL + SDK-R | Cashtags; ticker snapshot at post (`UNIV`) | Adapted | Range takes are still disabled in Masayume (`D:help/availability.mdx`). |
| L-46 | Portfolio | `features/markets/{portfolio,balance,history}` (1,618 L); `features/x/XWalletCard.tsx`; `features/private/PrivateClaims.tsx`; ledger 2026-09-02 plate row | Cream ledger plate (one spendable number, proportion bar, pool rows: Trading Balance / Private / X), open bets + boost rows, claimables, §03 record (history, receipt, equity, reputation, badges, CSV), Restore, Add money | SDK-R + SOL + DB | Marks when closed = last close; corporate-action adjusted history (`HRS CORP`) | Adapted | Creator-earnings row pending/removed (Y-18). |
| L-47 | Trader Edge | `features/edge/` (502 L); `core/projection/edge.ts` | Equity curve, win rate, profit factor, expectancy, drawdown, time-of-day, payoff shape, provenance | UI over projection | Time-of-day buckets become ET session buckets (`HRS`) | Adapted | 0 chain imports **[C]**. |
| L-48 | Leaderboard | `features/leaderboard/` (647 L); `app/api/leaderboard`; `packages/markets/src/provider/board.ts` | Podium, banzuke, You bar; 24h venue-wide replay; partial-day honesty | SDK-R (indexer) | Per-ticker/sector boards; "this session" window (`UNIV HRS`) | Adapted | Extended by A-3a. |
| L-49 | Reputation, badges, CSV | `core/projection/{reputation,badges,csv}.ts` | Tiers, LP Provider badge reads maker shares | UI + SOL read | none | Adapted | — |
| L-50 | Earn (maker vault) | `features/earn/` (651 L); `contracts/src/maker/` (544 L); `services/ops/src/actors/market-maker/` (273 L); `core/maker` | Share price, utilization, supply, withdraw idle, Windows table (Merge/Settle); bounded post-only maker | SOL + OPS + SDK-R/W (CLOB) | Inventory carries overnight/weekend gaps; quote only in session; pull on halt (`HRS HALT EVT`) | Adapted | Needs a CLOB-like venue. If Stocklana owns the market, Earn reverts to Yosuku's house-LP model [I]. Extended by A-2. |
| L-51 | Strategies desk | `features/strategies/` (3,060 L); `app/api/strategies/{route,health,playbook,preview}` | Live desk, cards with runner health, recent copy-trades, memory panel, public playbooks | SOL (registry) + DB + OPS | Strategies must not trade into the close or while closed (`HRS`) | Adapted | — |
| L-52 | Launch an agent (4-step builder) | `features/strategies/{CreatorStudio,StudioForm}.tsx`; `core/strategies/{spec,agent}.ts`; `D:agents/launch.mdx` | Identity & approach → behaviour & limits → real test read → publish; Momentum + AI Agent (persona, posture, cadences 300…86,400 s); house runner or own bot | SOL + EXT + DB | Ticker selection, session calendar in spec (`UNIV HRS`) | Adapted | Spec hash format must stay stable across ports. |
| L-53 | Copy a strategy | `features/strategies/CopyDrawer.tsx`; EventVault STRATEGY grant + `StrategyRegistry.subscribe` | 2 signatures; caps total/per-trade/daily/open/price/expiry; pause/revoke/resume; settlement to available | SOL | none | Adapted | Extended by A-3b. |
| L-54 | Agents board | `M:web/src/app/agents/page.tsx`; `features/strategies` | Agent leaderboard by entrusted capital / copy-trades | SOL + DB | none | Adapted | — |
| L-55 | Strategy runner + self-host | `services/ops/src/actors/strategy-runner/` (741 L); `runner-main.ts`; `D:builders/self-host-agent.mdx`; `acceptance-2026-09-06.md` | Durable decisions/attempts, reconcile uncertain sends, auto-settle, DRY_RUN, own runner key | OPS + SDK-W + DB + EXT | Price-basis normalization: Masayume's live defect compared 2-dp oracle vs 18-dp EMA **[C]**; equities feed scales (`BASIS HRS`) | Adapted | Loop copies; execution via adapter. |
| L-56 | Paid Memory Market | `Y:app/strategies` (Seal passes; `M:context/11` feature 17); `M:web/src/features/strategies/MemoryMarket.tsx`; `D:help/availability.mdx` | Masayume: headline + public playbooks; paid passes incomplete | — | none | Adapted (Masayume gap) | — |
| L-57 | Reversion preset | `core/strategies/spec.ts` (supports `reversion`); `D:help/availability.mdx` ("not selectable") | Not selectable in builder | — | Mean reversion is common on equities [I] | Adapted (Masayume gap) | — |
| L-58 | Trade from X | `features/x/` (2,094 L); `app/api/x/{start,callback,bind,status,unlink,receipts}`; `core/x/{parse,grant-policy,receipt,refusal}.ts` | OAuth 1.0a sign-in, signed wallet link, EXECUTOR grant, grammar `@handle <btc\|eth> <up\|down> <stake> <1m\|5m\|15m\|1h\|4h\|1d>` (synonyms incl. `short`→down **[C]**), receipts, dark island | EXT (X) + SOL + WAL + DB | Cashtag grammar, symbol ambiguity, "market closed" refusal (`UNIV HRS`) | Adapted | Parser is pure TS and copies with a new asset table. Extended by A-3d. |
| L-59 | X recovery / claim | `features/x/ClaimScreen`; `app/claim/page.tsx`; ledger rows 21–24 of needs-user-review | Finds linked wallet; signed re-link | DB + WAL | none | Adapted | — |
| L-60 | X relay | `services/ops/src/actors/x-relay/` (905 L; `rettiwt-api`, `sharp`, OFL fonts) | Poll mentions, parse, execute once, image receipt card, recursion fence, health, paginated drain | OPS + EXT + SDK-W + DB | Closed/halted refusals (`HRS HALT`) | Adapted | New brand X account and session cookies needed. |
| L-61 | Games hub | `features/games/{GamesHub,catalog,SeasonBanner}.tsx`; `app/games/layout.tsx`; `app/api/games/occupancy` | Prediction / Duel / Arcade groups, resume active match, remembered last game, HOW TO, settings sheet, season banner | UI + DB + OPS | Prediction modes show closed off-hours; arcade always on (`HRS`) | Adapted | — |
| L-62 | Practice | `features/games/practice/` (652 L); `core/games/practice.ts` | No-stake swipe vs bot on live feed | SDK-R (spot) | Needs live price: off-hours needs a replay or 24/7 basis (`HRS BASIS`) | Adapted | — |
| L-63 | Duel (Free/Ranked) + match link | `features/games/duel/` (3,865 L); `contracts/src/games/` (1,102 L); `services/ops/src/actors/{matchmaker,game-room,duel-projector,duel-settler}` (2,412 L); ledger 2026-09-04 duel rows | Queue/Elo, commit-reveal deck of live Windows, entry signs once + match key swipes, sponsor gas, auto-swipe, per-card settle, result modal/share, reload-safe `/games/duel/[matchId]` | SOL + OPS + SDK + DB | Deck supply needs live Windows: none off-hours. Masayume measured 40%→89% dealability on 2 assets **[C]**. More tickers help in session (`HRS UNIV`) | Adapted | Core lifecycle/Elo/deck/commitment is pure TS. Projector (log cursor) is rewritten. |
| L-64 | Games history | `features/games/duel/DuelHistory.tsx`, `lucky/LuckyHistory.tsx`; `app/api/games/history` | Every duel/draw, verdict, PnL, 8 s poll | DB | none | Adapted | — |
| L-65 | Rank + seasons | `features/games/duel/DuelRank.tsx`, `SeasonBanner.tsx`; `app/api/games/{rank,season}`; `contracts/src/games/SeasonPrizePool.sol` (deployed per `M:README.md`) | Rating ladder; prize overlay only when an operator configures a season, with on-chain escrow evidence | DB + SOL | Seasons may align to trading weeks [I] | Adapted | Prize UI is operator-gated. |
| L-66 | Lucky Draw | `features/games/lucky/` (2,226 L); `app/api/games/lucky/{commit,reveal,placed,history,board}`; `packages/db/src/lucky.ts`; `core/games/lucky.ts` | Committed server seed + client seed HMAC draw; candidate-set hash; one order via ticket lane; streak, board | SDK-W + DB | Empty eligible set off-hours; bigger universe (`HRS UNIV`) | Adapted | — |
| L-67 | Moonshot | `features/games/moonshot/` (771 L); `core/range/moonshot.ts` (+ `moonshot.vectors.json`); RangeReserve saturated band | Choose direction (LONG/SHORT mirror) + 2–25× target; In play → Won → Paid **[C live round 3]** | SOL + SDK-R | Earnings gaps misprice far targets under normal σ (`EVT`) | Adapted | — |
| L-68 | Line Rider | `features/games/arcade/` (1,774 L shared); `core/games/arcade`; `app/api/games/arcade/{score,board}`; `packages/db/src/arcade.ts` | Seeded fixed-step engine, canvas, server-replayed score, Top runs | UI + DB | Optional real-candle skin [I] | Exact | Engine copies. Score API copies (wallet identity changes). |
| L-69 | Candle Hop | same as L-68 | One-button flight; server-checked score | UI + DB | same | Exact | Copy. |
| L-70 | Game audio, motion, art, settings | `features/games/{art,stage}`; `web/public/sounds/SOURCES.md` (Kenney CC0); `web/public/fonts/m6x11plus.ttf` | Flicky/PIPS sound, press physics, CRT/pixel art in Yosuku tokens; sliders | UI | none | Exact | Keep attributions. |
| L-71 | Game profile, achievements, friends | `features/games/GamesHub.tsx` (dashes); ledger 2026-09-04 "wait on their stores"; `06-game-architecture.md` §Data | Pending in Masayume | DB | none | Adapted (Masayume gap) | Overlaps A-3a. |
| L-72 | `/dev/*` fixtures | `M:web/src/app/dev/page.tsx` + 21 pages | Canned-state review harnesses | UI | Add stock-state fixtures (closed, halted, split) [I] | Adapted | Internal, not a public deliverable (manifest §Route baseline). |
| L-73 | Ops host and health | `services/ops/src/{main,runner-main}.ts`; `app/api/strategies/health`; `app/api/x/status` | Separate signers per actor, DRY_RUN default, derived liveness | OPS | A shared session-calendar service for all actors [I] (`HRS`) | Adapted | — |
| L-74 | API surface | `M:web/src/app/api/**` (39 handlers, 1,502 L) | Thin, schema-validated handlers; honest 503 when unconfigured | mixed | per row | Adapted | — |

### 3.3 Yosuku-lineage capabilities absent from shipped Masayume (open questions, never Excluded)

| # | Capability | Evidence | Why absent in Masayume | Coupling | Stock impact | Class |
|---|---|---|---|---|---|---|
| Y-01 | Founder waitlist + referral rank (`/waitlist`) | `Y:app/waitlist`, `BO:app/waitlist`, `Y:infra/onara/policies/yosuku-waitlist.json` | Removed 2026-09-04 by owner (`parity-ledger.md` L43) | SOL/DB | none | Open question |
| Y-02 | Creators guide, creator card studio, creator recovery (`/creators`, `/creator/studio`, `/creator/recover`) | `Y:app/{creators,creator/studio,creator/recover}` | Removed 2026-09-04 (builder fees not available on DreamDEX) | DB + EXT | Creator "calls" on tickers | Open question |
| Y-03 | Founder Line Studio (`/studio`) | `Y:app/studio`; `M:context/15` §3d | Removed 2026-09-04 | EXT (X) | — | Open question |
| Y-04 | Internal social content board (`/social`) | `Y:app/social` | Removed 2026-09-04 | UI | — | Open question |
| Y-05 | `/fund` card on-ramp + cross-chain deposit (CCTP) | `Y:app/fund`, `Y:app/api/{fund-preview,deposit/cctp}` | Removed 2026-09-04 ("nothing like buy from card"); Yosuku's Paystack drip was farmed and closed | EXT | Mainnet stock product may need a fiat on-ramp [I] | Open question |
| Y-06 | In-app editorial `/docs` page | `Y:app/docs` | Moved to external docs site (`M:README.md` L153) | UI | — | Adapted already (L-20); confirm |
| Y-07 | Agent/MCP tx-builder (`/api/bet/build`), npm SDK, MCP server | `Y:app/api/bet/build`; `M:context/15` §3i; `M:context/11` §/docs | Not ported (`grep bet/build` = 0 **[C]**) | SDK-W | — | Open question |
| Y-08 | Polymarket discovery rail; multi-coin ticker + Fear & Greed | `Y:app/api/{polymarket,ticker}` | Ticker uses venue prices; Fear/Greed pending a provider | EXT | Equity sentiment index [I] | Open question |
| Y-09 | Sensei persistent memory (MemWal) | `Y:lib/memwal.ts`; ledger §Sensei (dropped) | No store; wallet would leak to a nonexistent feature | EXT + DB | — | Open question |
| Y-10 | TEE-attested agent / attested X bind | `Y:app/api/claim/bind-attested`, `api/agent-spec`; `M:context/11` §/claim | Keys, not TEE (approved trust model) | EXT | — | Open question |
| Y-11 | Name-service handle claim (`.yosuku.sui`) | `Y:app/api/suins/claim` | Removed with waitlist | EXT | Solana name-service analogue [I] | Open question |
| Y-12 | Encrypted rooms (Seal) | ledger §The Room ("Not carried") | Comments stored in clear; badge says "bettors only" | DB | — | Open question |
| Y-13 | TheBell floating draggable countdown widget | `BO:components/TheBell.tsx` (absent in `Y:` and `M:`; Sensei dock ring is the nearest analogue) | Folded into `/markets` (`M:web/src/app/bell/page.tsx` comment) | UI | Countdown to *market open/close* is natural for stocks [I] | Open question |
| Y-14 | Site-wide + per-market OG images | `BO:app/opengraph-image.tsx`; `Y:app/markets/[id]/opengraph-image.tsx` | Not ported | UI | per ticker | Open question (L-23) |
| Y-15 | `/agent` attested showcase | BO commit subjects (coordinator); absent at both tips | Removed upstream | — | — | Open question (low) |
| Y-16 | Standalone Trading Balance deposit/withdraw modal | `BO:components/TradingBalanceModal.tsx` | Covered by `VaultControls` + AddFunds [I] | SOL | — | Open question (likely covered) |
| Y-17 | Native iOS/Android app | `Y:README.md` L53 | No source | — | — | Blocked (L-19) |
| Y-18 | Creator earnings pool row (builder codes) | `Y:app/portfolio` L318–329; ledger L930 "Pending" | Builder fees absent on venue | SOL | — | Open question |

---

## 4. Porting leverage analysis

All figures are **[C]** measurements (`wc -l`, file counts, import greps) of non-test source unless noted. Effort sizing is **[I]**.

### 4.1 Size and coupling by area

| Area | Size (non-test) | Tests | Chain imports | Verdict |
|---|---|---|---|---|
| `packages/core` | **8,989 LOC / 133 files** | 3,561 LOC / 42 files | **None.** Externals are `zod` only. EVM-*shaped* types remain: `Hex/Address/Bytes32 = 0x${string}` (`types/primitives.ts`), EIP-712 claim struct (`private/types.ts`), tx-hash unions (`ports/submitter.ts`), Shannon explorer URLs (`urls/explorer.ts`), DreamDEX payout rules in `projection/settle.ts`. | **Near-verbatim.** Swap primitives to base58 key/signature types, explorer URLs and settle rules. Largest pure assets: `games` 3,483 (lifecycle, deck, scoring, Elo rating, matchmaking, practice, Lucky HMAC draw, protocol/wire, arcade engines), `projection` 741, `strategies` 642, `range` 457, `copy` 375, `x` 350, `parlay` 286, `private` 278, `surface` 251, `leverage` 241. |
| Golden vectors | 6 files: `core/src/{leverage/sizing,range/pricing,range/moonshot,parlay/pricing,vault/caps}.vectors.json` + `moonshot.vectors.py` | shared by forge + vitest | — | **Copy as fixtures** for Solana program tests [I]. They pin Range, Moonshot, Parlay, Leverage and caps math across implementations. |
| `packages/brain` | 252 LOC | 1 test | AI SDK only (anthropic/openai/google); imports core | **Verbatim.** Prompt copy changes. |
| `packages/db` | 2,561 LOC / 23 files | Postgres scripts | `postgres`, `zod` | **Near-verbatim.** Widen and validate address/hash columns for base58; faucet schema retargets. |
| `packages/markets` (**the Somnia seam**) | **10,713 LOC / 165 files** | 1,135 LOC | **38 files import `viem`, 30 import `@somnia-chain/markets-sdk`** | **Rewrite as a Solana adapter behind the same exports and `Reading<T>` contracts.** Subdirs: `provider` 1,230, `vault` 1,103, `games` 885, `react` 828 (hook API reusable), `submitter` 813 (journal pattern reusable, nonce lane not), `private` 751, `range` 731, `contracts` (ABIs) 641, `runtime` 564 (coordinator dedupe pattern reusable), `leverage` 509, `parlay` 507, `strategies` 434, `maker` 423, `sessions` 326, `mappers` 312. The port interfaces (`core/src/ports/{markets-provider,submitter}.ts`) are the seam. |
| `contracts/src` (Solidity) | **5,480 LOC / 34 files**; 9 deploy scripts | **6,768 LOC / 44 files** | **20 of 34 files import `IDreamDex`/`IOracleHub`/`VenueGateway`** | **Nothing copies as code.** Each family becomes a Solana program or instruction set. Invariants, caps, events, fork-test scenarios and vectors transfer as the spec. Families: vault 683, games 1,102, leverage 800, range 793, parlay 610, maker 544, private 531, strategy 235. The gateway pattern (contract as IOC taker, measuring deltas) presumes a composable venue. If none exists for stocks on Solana, Stocklana must own the binary market (other agents). |
| `services/ops` | **6,229 LOC** (8 actors) | 1,284 LOC | Only `matchmaker` imports `viem` directly (1 file); others use the `@masayume/markets` port | **Mostly portable.** Loops copy: `x-relay` 905, `game-room` 944, `matchmaker` 839, `strategy-runner` 741. Rewrite chain-cursor or venue-specific pieces: `duel-projector` 359 (log cursor), `duel-settler` 270, `market-maker` 273, `leverage-keeper` 114. Room-token and link signature verification changes to ed25519. |
| `web` TS/TSX | **52,417 LOC / 783 files** | 1,146 LOC | **32 files import viem/wagmi/Somnia SDK/RainbowKit directly** (features 22, app 4, components 1, lib 1, providers 4); **163 files use the `@masayume/markets` port**; ~588 files (75%) import neither | **UI near-verbatim** if the Solana adapter keeps port signatures. Only the 32 direct files need rework. Zero-import features: `edge` 502, `how-it-works` 598, `install` 277, `onboarding` 243, `share` 1,027. |
| Web CSS | **17,488 LOC** (Yosuku port 5,871 + ~40 feature sheets) | — | none | **Verbatim** (subject to provenance). |
| Web features by size | `games` 12,132 (100 files; 7 direct / 27 port); `markets` 7,055 (144; 2 / 39); `strategies` 3,060 (40; 1 / 5); `x` 2,094 (26; 3 / 4); `session` 1,620 (20; 0 / 9); `range` 1,595; `parlay` 1,362; `private` 1,352 (15; 1 / 9); `pitch` 1,343; `share` 1,027; `sensei` 918; `vault` 906; `room` 865 (2 direct); `surface` 855; `demo` 652; `earn` 651; `leaderboard` 647; `takes` 625 (2 direct); `how-it-works` 598 | — | — | — |
| Docs repo | 52 MDX guides + evidence audits | docs checks (215 links, 241 source refs) | — | Framework copies; every fact is rewritten. |

### 4.2 Summary of copy vs rewrite

| Bucket | Approx. size | Examples |
|---|---|---|
| **Copy nearly verbatim** (retarget types/copy) | ~9.2k core+brain, 2.6k db, ~40k web TS (non-chain files), 17.5k CSS, ~3.4k ops loops | Game engines/lifecycle/Elo/deck, projection (edge/equity/badges/leaderboard/CSV), X parser, strategy spec/model, Range/Parlay/Leverage/Moonshot TS math mirrors, surface math, share cards, all editorial pages, nav/shell, arcade games, Sensei UI + brain |
| **New adapter behind existing seam** | 10.7k `packages/markets` + 32 direct web files + providers + ~1k ops chain pieces | Market discovery/books/prices, order submit + journal, balances/positions/claims, session keys + sponsor, faucet signer, indexer-derived history/board/traction, duel projector |
| **Re-implement as Solana programs from spec** | 5.5k Solidity (+6.8k tests as behaviour spec) | EventVault + grants, StrategyRegistry, Range/Moonshot, Leverage, Parlay, Maker vault, PrivateDesk, GameArena + SeasonPrizePool |
| **Blocked on other agents** | — | The binary stock market primitive, settlement oracle/basis, session calendar, tokenized-stock availability |

**Schedule risk [I].** Five calendar days remain to 2026-09-18. Full-parity programs plus an adapter are a multi-week effort by Masayume's own history (Stage 2–6 ran 2026-09-01 to 09-07 with a prebuilt venue). This is recorded as **sequencing risk, not a scope cut**. Any deferral needs an explicit user decision per the skill.

---

## 5. User-requested add-ons (Additive rows)

Each add-on shares identity (wallet + linked X + game profile), the **Trading Balance** vault, **typed grants** (caps, expiry, revoke, owner-only withdraw), the one ticket write pipeline and receipt/journal truth, the Postgres social store and the portfolio plate's "never sum unspendable pools" rule (`PORTFOLIO_UX_SPEC.md` via `M:context/15` §5). All of these are **[I]** designs to be validated.

| # | Add-on | What already exists in the baseline (reuse) | New behaviour | Coupling | Stock-semantics impact | Class | Shares with baseline |
|---|---|---|---|---|---|---|---|
| A-1a | **Bearish exposure via existing primitives** | Binary DOWN (L-32); Boost on the chosen side (L-37); Range OUTSIDE (L-36); Moonshot SHORT mirror band (`06-game-architecture.md` §Moonshot **[C]**); X `short`→down synonym (`core/x/parse.ts` **[C]**); "Take the other side" (L-45) | Surface a first-class "Bet against" entry: ticker page toggle + Down-first presets | UI over existing | Dividend ex-date bias toward Down (`CORP`) | Additive | Same ticket, grants, portfolio rows |
| A-1b | **Inverse position** (linear short, not binary) | LeverageReserve knock-out certificate pattern (front, premium, line, permissionless knock-out, owner cash-out); `core/leverage` math + vectors | Payoff linear in price decline from entry, capped loss at a knock-out line, optional funding/premium; open/close during session; portfolio "Inverse" row; share-card caveat | SOL (new reserve) + OPS (keeper) + price basis | Halts freeze the mark (no knock-out); gap-up through the line → reserve gap loss; dividends owed by synthetic shorts must be defined (`HALT EVT CORP HRS`) | Additive | Trading Balance funding; SESSION grant must list the new action; leaderboard/edge projections gain a row type; Sensei snapshot; X grammar (`$TSLA short 2x 1h`) |
| A-1c | **Fade a trader/agent** | CopyDrawer + STRATEGY grant (L-53); runner (L-55) | Subscribe *inverse* to a strategy or human caller's signals within caps | SOL + OPS | Same session gating as copy (`HRS`) | Additive | Registry + grant + runner reuse |
| A-2a | **Yield on idle Trading Balance** | EventVault `available` bucket; plate pool rows | Opt-in routing of idle collateral to a yield source; instantly withdrawable portion shown separately; tap-trading spends only liquid funds | SOL + EXT (yield protocol) | None directly; yield source risk disclosure | Additive | Plate must label "earning, not instantly spendable" if illiquid; grants cannot spend deployed yield |
| A-2b | **Supplier ("be the house") UI for every reserve** | Reserves already have `supply`/`withdraw` shares (Parlay, Range, Leverage) but only Earn has a supplier UI; the leverage reserve is house-supplied (ledger §LeverageReserve **[C]**) | Earn tabs: Maker · Range/Moonshot · Parlay · Boost · Inverse; share price, utilization, locked vs liquid, withdraw idle, settle cranks | SOL | Reserve PnL concentrated around opens/earnings; withdrawal gating across sessions (`EVT HRS`) | Additive | `/earn` shell and `MarketMakerVault` presentation reuse; LP Provider badge extends |
| A-2c | **Yield reporting** | Earn hero share-price delta; badges; stats | Realized yield per pool, APR from realized history only (no projections presented as fact) | UI + SOL read | Weekend/holiday yield dilution | Additive | Doc-05 no-fake-data rule |
| A-3a | **Trader profiles, follows, social leaderboards** | Leaderboard banzuke (L-48); games follows/friends design (`06-game-architecture.md` §Data, owner-approved directional follows **[C]**); agents board | Public profile (handle, linked X, record, Edge excerpt), follow graph, Friends / per-ticker / sector / session boards | DB + indexer projection | Per-session and per-ticker windows (`HRS UNIV`) | Additive | One leaderboard home; losses never disappear (projection rule) |
| A-3b | **Copy human traders** | StrategyRegistry + STRATEGY grant + runner; caps and worked example copy | A trader publishes a "calls" feed; copiers mirror fills under caps; the leader's receipts are the source; pause/revoke | SOL + OPS + DB | Mirror refused when closed or halted; latency around open (`HRS HALT`) | Additive | Same grant caps, receipts and settlement-to-owner path |
| A-3c | **Ticker rooms, cashtag takes, activity feed, notifications** | Room (L-42), Takes (L-45), Reels (L-44), alerts (L-43) | Per-ticker room and feed; takes tagged by cashtag; lifecycle notifications (fill, settle, copied trade), which Masayume left pending | DB + WAL | Earnings-day threads; pump/spam moderation (`EVT REG`) | Additive | Signed identity and position-gating rules |
| A-3d | **Trade-from-X for stocks** | X rail (L-58, L-60), reply cards | Cashtag grammar (`$AAPL up 5 1h`), public caller leaderboard from X receipts, quote-tweet "fade" | EXT + SOL + OPS | Symbol collisions, market-closed refusals (`UNIV HRS`) | Additive | EXECUTOR grant, receipts, recursion fence |

---

## 6. Open questions and missing evidence

1. **Market primitive (blocker; other agents).** Masayume's Up/Down Window, CLOB, OracleHub opening/closing prints, ERC-6909 outcomes, redemption, void semantics and collateral faucet all came from DreamDEX. The Solana stock equivalent is unknown here.
   - Most `SDK-*` and `SOL` rows depend on it.
   - If Stocklana must own the market, Earn and the gateway-pattern reserves change shape.
2. **Session and settlement policy (product decision + oracle agent).** Which price settles a Window (exchange print vs 24/7 token)? Are Windows listed only in session? What happens across closes, weekends, halts and corporate actions? Is Practice or the arcade allowed on a 24/7 basis?
3. **Masayume-era removals (Y-01…Y-05, Y-18).** They were approved by the owner *for Masayume* on 2026-09-04. The user has not said whether Stocklana's baseline is "Masayume as shipped" or the Masayume manifest including these. **Never Excluded without that answer.**
4. **Masayume's own unfinished baseline rows** (L-11 landing, L-23 OG, L-35 plain cash-out, L-56 paid Memory Market, L-57 Reversion, L-71 profile/achievements/friends, Range takes, Fear/Greed, lifecycle notifications, Range band on hero chart, duel home-tile sparkline). Does Stocklana inherit the obligation or the shipped state?
5. **Native mobile.** Yosuku claims Expo parity, but no native source exists in `Y:` `3c56ef5` or `BO:` `9f0af31` **[C]**. Still Blocked.
6. **Yosuku divergence.** `BO:` 121 commits vs local 591 were compared by tree and route, not commit by commit. The Y-13/Y-14/Y-15/Y-16 rows came from this. A fuller `compare` pass could surface behaviour differences inside shared files.
7. **Provenance and licence.** Yosuku's redistribution terms and rights-holder notice are unrecorded, and no project licence exists. A public Stocklana repo needs these decided. The PIPS/Flicky independent-implementation rule continues. Ticker logos raise trademark use [I].
8. **Runtime evidence.** masayume.app and docs.masayume.app were not exercised this pass. Responsive, theme and state claims rest on `acceptance-2026-09-06.md` and ledger observations dated 2026-09-01…09-08.
9. **Brand TBD.** Confirm the Yosuku visual contract carries unchanged under the new name. Masayume approved theme deviations (e.g. the ledger plate follows the theme, agent DiceBear portraits).
10. **Live-ops identity for a new brand.** A new X account and cookies, LLM credentials, Postgres, and an ops host (Masayume used Fly + Vercel). The Masayume faucet, sponsor, maker, runner, X executor and desk keys are all distinct signer roles to recreate.
11. **Regulatory framing (`REG`).** Stock-price binaries, leverage and copy trading on securities, and tokenized-stock eligibility may impose geofencing or copy constraints. Flagged, not researched.
12. **Stale internal records.** `parity-ledger.md` route table (L1240–1293) and "Feature families" (L1341–1362) predate deployments and removals. `RESUME.md` is historical per the acceptance ledger header. Builders should cite code plus the decision log plus `acceptance-2026-09-06.md`.
