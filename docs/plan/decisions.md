# Decisions and open questions

The plan (`00-plan.md`) changes only through entries here. Format: `D-###`: date · owner · evidence · rule · user-visible consequence · approval.

## Decisions

### D-001 — Source-led fork of Masayume `68f7a09`
- **Date / owner:** 2026-09-13 · planner (S0)
- **Evidence:** `git -C /Users/abu/dev/hackathon/sommina-events archive 68f7a09 web packages services scripts package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json vitest.config.ts THIRD_PARTY_NOTICES.md | tar -x` (commit `1a52aec`).
- **Rule:** Agari starts from Masayume's exact tree. `contracts/` and `docs/` are read from `reference/masayume`, not copied.
- **S0 rename:** `@masayume/*` → `@agari/*`; BRAND; wordmarks; manifest name; `AgariMark`; storage, protocol and device-header prefixes.
- **Deferred (recorded in `stage-00-bootstrap.md` Handoff):** signed-message wording, verdict stamp copy, domains, X handle, Fly app name and demo media.
- **User-visible:** the app shows Agari; behaviour is unchanged (still EVM until S1).
- **Approval:** plan r2 (user, 2026-09-13).

### D-002 — Anchor 1.2.0; all three oracle crates usable on SBF
- **Date / owner:** 2026-09-13 · planner (S0), spike by a sub-agent.
- **Evidence:**
  - Sources: `docs/plan/spikes/d002/` (build matrix + program sources).
  - Real `cargo build-sbf` on anchor-lang/anchor-spl **1.2.0 and 1.1.2** with `pyth-solana-receiver-sdk 2.0.0`, `redstone` rust-sdk (git rev `05e3c9f…`, `solana` feature) and `switchboard-on-demand 0.13.0` (`solana-v3`). Both pass with all three crates; .so ≈ 247 KB.
  - The dependency graphs are identical apart from `anchor-*`. Host IDL build passes.
  - Anchor CLI 1.2.0 installed via avm (prebuilt, 12 s). The Solana release link is unchanged (3.1.10), and `anchor build` passes.
- **Rule:**
  - `anchor/Anchor.toml` sets `anchor_version = "1.2.0"`; `[workspace.dependencies]` pins `anchor-lang`/`anchor-spl` `=1.2.0`.
  - `anchor/rust-toolchain.toml` pins host rustc 1.98.1. SBF uses platform-tools 1.89.0 (`~/.cache/solana/v1.52`).
  - After adding oracle crates, run `cargo update -p solana-program@5.0.0 --precise 3.0.0`; unpinned resolves 5.0.0.
  - **Pyth:** default feature → receiver `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`; `pro-compatible` → `rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp`. S2 picks the one the trial's updates verify against on devnet.
  - **RedStone:** use the SDK, with no in-crate verifier needed.
    - Call `Config::try_new(threshold, signers, [feed], block_timestamp = T_ms, max_delay = Some(0), max_ahead = Some(0))`, then `process_payload`. This forces package timestamp == T without Clock.
    - **Anti-selection (PD-1):** pass `threshold = 5` inside `strict_sec`, and 3 after.
    - The SDK recovers every package (25k CU each) and silently drops a feed below threshold, so `require!(!values.is_empty())`.
    - The median of an even count averages the two middle values.
    - High-s signatures are rejected; dedupe is per (feed, signer).
    - Heap: one payload clone per package, fine for ≤ 5 single-feed packages.
  - **RedStone signers (primary-prod, threshold 3),** from the adapter `config_prod.rs` at `redstone-oracles-monorepo@519cd10`, matching the 5 addresses seen on the gateway (D-003): `8bb8f32d…b774`, `deb22f54…8499`, `51ce04be…d202`, `dd682dae…b5be`, `9c5ae89c…b6de`.
  - **Switchboard:**
    - `switchboard-on-demand` pulls `libsecp256k1` → `rand` → `getrandom 0.2`, which fails on SBF. Enable `getrandom = { features = ["custom"] }` + `register_custom_getrandom!(always_fail)` under `cfg(target_os = "solana")`; verification never needs randomness.
    - Plus the 0xFFFF index workaround, pinned queue, distinct oracle indices (`spikes/d002/.../sb_settle.rs`).
  - **Correction to `C:13` §3:** the "2 days between untrusted updates" limit was RedStone's *old* adapter (tag 2.0.1). The current adapter uses a 40 s interval and 3 min max delay. It doesn't affect Agari, which verifies in-program.
- **User-visible:** none (build toolchain).
- **Approval:** within plan r2 S0 (pin 1.2.0 if it builds).

### D-003 — Price-source matrix and policy-version dates
- **Date / owner:** 2026-09-13 · planner (S0)
- **Evidence:**
  - `scripts/probe-keys.mjs` rerun 2026-09-13 ~19:45 UTC:
    - Pyth trial exact-T at Fri 09-11 16:00 ET: TSLA 365.48, QQQ 714.90, VOO 702.50, all `exactT`. RedStone TSLA at the same T is 365.4827, so primary and check agree within 1 bp.
    - AAPL, `Crypto.TSLAX/USD` and Pro AAPL return 403: not in the trial. The token lane can't use Pyth.
    - RedStone gives 5 signers for all 7 single names, both latest and at an exact past T.
    - Alpaca calendar: 77 sessions to year end; early closes 11-27 and 12-24.
  - `data/archive/pyth/2026-09-11.jsonl`: 391/391 boundaries pass exact-T for all three feeds.
- **Rule:** `services/ops/config/price-sources.json` holds the PD-1 versions (validity inclusive, UTC):
  - **TSLA:** v1 Pyth + RedStone check `2026-09-11 → 2026-09-25T20:00Z`; v2 RedStone from `2026-09-25T20:00Z`. The 09-25 Gap Window (open T = Fri 20:00Z) is covered only by v2; Friday's intraday Windows stay on v1.
  - **QQQ/VOO:** v1 Pyth until `2026-09-25T20:00Z`, then paused.
  - **NVDA/AAPL/MSFT/META/AMZN/GOOGL:** v1 RedStone, open-ended.
  - **Token lane:** Switchboard Surge (S6); feed hashes pinned then.
- **Defaults:**
  - Pyth: grace 5 s, max confidence 50 bps, admission 900 s.
  - RedStone: strict (all signers) 300 s, admission 900 s, threshold 3.
  - Switchboard: min delay 10 s, admission 60 s, max slot age 20, 3 oracles.
  - Cross-check: max divergence 25 bps, check admission 120 s.
- **RedStone signers observed on the gateway:** `0xdEB22f54…8499`, `0xDD682daE…b5bE`, `0x51Ce04Be…d202`, `0x9c5AE89C…B6de`, `0x8BB8F32D…B774`. They must match the adapter's authoritative list (D-002) before S2 `init-events`.
- **S2 spec note:** one admission value per Window can't serve the Gap lane, whose opening print needs until `lock_at` but whose Monday print should void quickly. `specs/prints.md` uses admission per boundary (`open_admission_sec` / `close_admission_sec`), consistent with PD-6.
- **User-visible:** every verdict names its source. QQQ/VOO show "paused: no signed source" after the 09-25 close.
- **Approval:** within plan r2 PD-1 (user, 2026-09-13).

### D-004 — Product decisions carried from plan r2
- **Date / owner:** 2026-09-13 · user
- **Rule:**
  - Brand **Agari (上がり)**.
  - ~~**Privy** sign-in from S1.~~ Replaced by Wallet Standard via the Kit wallet plugin (D-023, user, 2026-09-14).
  - **Own Anchor CLOB** rebuilding DreamDEX Event Contracts.
  - **Masayume** is the design authority; Yosuku is lineage only.
  - **Nine programs:** agari-{events, vault, strategy, parlay, range, leverage, maker, private, arena}.
  - **Tests are not a deliverable:** targeted money/settlement tests only.
  - **pnpm only.**
  - Local Postgres first.
- **Approval:** user, 2026-09-13 (plan r2).

### D-005 — Planner decisions PD-1…PD-8 (plan §0)
- **Date / owner:** 2026-09-13 · planner, approved with plan r2
- **Rule:**
  - **PD-1:** dated price-policy versions per Series, one source per Window, anti-selection rules.
  - **PD-2:** rested-age filter + oracle-model bound.
  - **PD-3:** close ≥ open → Up.
  - **PD-4:** private claim verified off-chain.
  - **PD-5:** arena escrow.
  - **PD-6:** per-source print admission deadlines.
  - **PD-7 (amended r2):** Market + MarketResult close after retention once dependents == 0.
  - **PD-8:** growable Ledger with seat bond.
- **No Pyth trial-extension request** (user, 2026-09-13). A Stork hackathon key was requested (email sent 2026-09-13).

### D-006 — Engine account layouts and sizes (S2 spec)
- **Date / owner:** 2026-09-14 · S2 owner (spec step)
- **Evidence:**
  - `docs/plan/specs/events-accounts.md` §3. Every layout was computed by script: no implicit padding, offsets asserted.
  - Anchor docs (zero-copy: `repr(C)`, `#[account(zero)]` for > 10,240 B).
  - Solana "CPI cost model: realloc limits" (`MAX_PERMITTED_DATA_INCREASE` = 10,240 B beyond the size at the start of the top-level instruction).
  - Anchor `realloc` codegen (`AccountReallocExceedsLimit`).
- **Rule:**
  - All engine accounts are `#[account(zero_copy)]` with explicit padding.
  - **Ledger:** seat 88 B (bond amount moved to the Ledger header, `BONDED` flag). `public_grow_ledger` adds **≤ 116 seats per call** (the plan's +150 would need 13,200 B). 1,024 seats = 90,216 B ≈ **0.459 SOL** (plan ≈ 0.39).
  - **Book:** 1-based node refs (a zeroed Book is empty) with a free-list plus high-water allocator; exact sizes 56,968 B (512) / 44,680 B (256).
  - **Other sizes:** GlobalConfig 856 B, Series 1,368 B, Market 456 B, MarketResult 256 B (adds `rent_payer`; the settler's rent is refunded to the settler).
  - PROGRAM seat index = the `config.program_authorities` index.
  - `admin_init_config` requires the program upgrade authority.
  - New errors (marked ★ in §4): BadPolicy, BadSeriesParams, BadBookSize, TooManyBooks, BadAuthorities, SeriesMarketMismatch, MvaultMarketMismatch, NotProgramAuthority, SelfMatchCancelTaker, InvalidOrderArgs, InvalidPrintValue, PrintNotAdjacent, DependentsRemain, BookNotReleased, LedgerNotClosed, PartialRedeemNotAllowed, BadPrintSlot, WrongTokenOwner, SeatNotEmpty, BadGrowAmount. Codes use explicit discriminants in fixed ranges.
- **User-visible:** a full Ledger grows in 8 steps instead of 7; the per-Window SOL float rises from ≈ 0.0044 to ≈ 0.0049 (Market + result), ≈ 3.7 SOL steady.
- **Approval:** within plan r2 S2 spec step (sizes are derived facts; semantics unchanged).

### D-007 — Print admission per boundary; verification refinements (S2 spec)
- **Date / owner:** 2026-09-14 · S2 owner (spec step)
- **Evidence:**
  - D-003's S2 spec note (the Gap open needs admission until `lock_at`).
  - `R:redstone-rust-sdk@05e3c9f`:
    - `core/aggregator.rs`: unknown signers and zero values are skipped; a repeated signer returns `Err(ReoccurringFeedId)`; a feed below threshold is silently dropped.
    - `protocol/payload_decoder.rs`: big-endian fields; a 142 B single-feed package.
    - `utils/median.rs`: overflow-safe floor average.
    - `types/feed_id.rs`: left-aligned ASCII.
    - SDK errors carry raw codes (509…, 1000+i).
  - `docs/plan/specs/prints.md`.
- **Rule:**
  - **Per-boundary admission.** `PrintPolicy` gains `open_admission_sec` + `close_admission_sec` (replacing one `admission_sec`), with `ADMIT_UNTIL_LOCK = u32::MAX` allowed only for the Gap open. Deadlines are frozen into `Market.open_deadline` / `close_deadline` at listing. A check policy's admissions must equal `check_admission_sec`. `Series.settlement_window_sec` is dropped.
  - **Clock.** Every source requires `now ≥ T + min_delay_sec`; the plan's Pyth `publish_time ≤ now + 2` is removed (the uniqueness window already pins the update).
  - **RedStone.**
    - Pre-parse a strict wire layout (single-feed, 32-byte values, `N ≤ signer_count`), then call the SDK with **threshold = N (the posted package count)**. Every posted package must verify, so `Print.signers = N` exactly.
    - `N ≥ 5` inside `strict_sec`, `N ≥ redstone_threshold` after.
    - A duplicate or malleated signer **refuses the whole print** (the plan's test said "counts once").
    - SDK errors are mapped to our codes; `UnknownRedStoneSigner` is reserved (not raised on the SDK path).
  - **Cross-check.** A present check print that diverges always voids; missing checks only flag `single_source`.
  - **`public_copy_open_from_prev`** is limited to `now ≤ open_deadline` (keeps PD-6 exclusivity).
  - **Attested.** `source_ts` = T is derived, not an argument.
- **User-visible:** none beyond PD-1/PD-6 as planned; a RedStone print shows its exact signer count.
- **Approval:** within plan r2 PD-1/PD-6 (planner, S2 spec step).

### D-008 — Matching and funding semantics (S2 spec)
- **Date / owner:** 2026-09-14 · S2 owner (spec step)
- **Evidence:**
  - `R:dreamdex-docs/trading/common/order-types.md` ("What happens when an order is refused": Cancel Taker → `SelfMatchCancelTaker` revert; "Self-Trade Prevention").
  - `R:phoenix-v1 fifo.rs:1190-1330` (expired and self-trade handling count against the match limit).
  - `C:08` #9–#13.
  - Solana return-data docs (return data is cleared before every CPI).
- **Rule:**
  - **Self-match.** CancelTaker **reverts** `SelfMatchCancelTaker` (DreamDEX fidelity; supersedes `C:08` #10's "cancel remainder"). CancelMaker cancels the maker and consumes a `max_fills` unit.
  - **Match loop.** Expired nodes are evicted up to `max_evictions`, then skipped up to `MAX_SKIPS = 64`. A Normal remainder is cancelled on the fill or skip cap. A PostOnly that hits the skip cap reverts.
  - **Funding.** Exact funding **after** matching (credit first, then one transfer); `PlaceResult.refunded` is a report of never-pulled escrow.
  - **Proceeds.** `withdraw_proceeds` sweeps the whole seat credit; pulls and payouts are never netted. `set_return_data` is the last action.
  - **Order management.** Reduce is in place and keeps priority. The open-order cap is checked when an order would rest (revert). The cancel instructions take a `withdraw` flag; mint takes `use_credit`; merge takes `withdraw`.
  - **Mode.** ReduceOnly blocks buys, mint, listing and growth; Halted blocks all placement, mint, listing and growth; neither blocks cancel, sweep, withdraw, merge, prints, settle, void, redeem or close.
- **User-visible:** placing an order that would trade against your own resting order is refused with a named reason, as on DreamDEX.
- **Approval:** within plan r2 (Masayume/DreamDEX is the design authority); planner, S2 spec step.

### D-009 — Lifecycle and closure details (S2 spec)
- **Date / owner:** 2026-09-14 · S2 owner (spec step)
- **Evidence:** plan PD-6/PD-7/PD-8; `C:08` #11, #14–#16; `docs/plan/specs/events-engine.md` §5–§8.
- **Rule:**
  - **Status.** Cancel, reduce, cancel-all and sweep work in every status (so redeem is never stuck behind orders). A void may land before `lock_at` and stops trading at once; a sweep evicts every order after `lock_at` **or** once terminal.
  - **Redeem.** Redeem zeroes a non-PROGRAM seat and refunds its bond. Partial redeem is PROGRAM-only.
  - **Seats.** One seat per owner (scan on claim).
  - **Closure.** `public_close_ledger` scans seats instead of maintaining an `open_seats` counter. `public_close_market` also requires `BOOK_RELEASED` and `LEDGER_CLOSED`. Rent from `public_grow_ledger` returns to the Ledger's `rent_payer`.
  - **Dependents.** The engine doesn't enforce "result captured before `product_release_dependent`" (the product's obligation).
- **User-visible:** a Window whose opening price never arrives voids early (0.5/0.5) and stops trading; users can always cancel and redeem.
- **Approval:** within plan r2 PD-6/PD-7/PD-8 (planner, S2 spec step).

### D-010 — Solana primitives in `@agari/core`, and what S1 renames
- **Date / owner:** 2026-09-14 · S1 owner (step 1a.1)
- **Evidence:** plan P§5 "Primitives" and "hook names unchanged"; the blast radius in `stage-01-solana-shell.md` Findings; core typecheck + 757 core tests after the change.
- **Rule:**
  - `Address` = branded base58 of 32 bytes; `Signature` = branded base58 of 64 bytes (a transaction's id, or an ed25519 message signature); `MarketId` = branded `Address` of the Market PDA (`types/ids.ts`). Validation decodes exactly (`types/base58.ts`, vector-tested); core still imports no chain SDK.
  - `Hex` stays for bytes that really are hex (keccak commitments, RedStone's 20-byte signer ids). `Bytes32` → `Hash32` (0x + 64 hex) for hashes, feed ids, match ids and desk keys. The venue id is the events `GlobalConfig` `Address`.
  - **Addresses are never lowercased or text-sorted.** Base58 is case-sensitive, so every EVM-era `toLowerCase()` on an address was removed. Hex values keep case-folding. Commitments pack an address as its 32 decoded bytes, and the Lucky candidate set sorts by those bytes.
  - **Names:** fields keep Masayume's names when the concept maps 1:1: `txHash` (now a `Signature`), `poolAddress` (the recycled Book), port and hook names. They're renamed only when the concept changed (`asset` → ticker, token ids, the oracle question id, wei/STT).
  - **Scope:** product-family types (vault, parlay, range, maker, leverage, private, arena, strategies) keep fields like `chainId` until their own stage ports the program. In S1 they only need to compile behind `CapabilityPending`.
  - Golden vectors are unchanged: the test wallet and arena are the old left-padded words as 32-byte keys, so the packed bytes are identical.
- **User-visible:** none yet (the web still runs on EVM until 1d).
- **Approval:** within plan r2 S1.

### D-011 — Ticker registry, the Window read model and lock-aware entry
- **Date / owner:** 2026-09-14 · S1 owner (steps 1a.2–1a.3)
- **Evidence:** Hermes `/v2/price_feeds` fetched 2026-09-14 (TSLA/QQQ/VOO ids match S0's probe); `services/ops/config/price-sources.json` (xStock mints); plan P§2.2, P§3.1 `Series` seeds and `lock_at`; the session slice's tests (DST, early close, Gap).
- **Rule:**
  - **`core/market/tickers.ts` is the universe.** Permanent `seriesId` (the `ticker: u16` Series seed): TSLA 1, NVDA 2, AAPL 3, MSFT 4, META 5, AMZN 6, GOOGL 7, QQQ 8, VOO 9, SPY 10; 11 COIN and 12 MSTR are reserved. SPY is there only for the SPYx token lane. The registry says what a ticker *is*; whether a lane is live comes from policy coverage.
  - **`EventMarket` is Solana-shaped:**
    - Adds `lane` (`regular | gap | token`, the `basis: u8` seed), `lockAtSec`, `seriesAddress`, `policyVersion`, `printSource` and `voidReason`.
    - Removes DreamDEX-only fields: `strikeRaw`, `isUpDown`, `yesTokenId`/`noTokenId`, `oracleQuestionId` (and `OnchainSnapshot.outcomeToken`/`yesId`/`noId`, `LaneSet.excludedFixedStrike`, the `approve` intent).
    - `asset` keeps its name, typed `TickerSymbol`. Prints are normalized to `PRINT_EXPO = -8`.
    - Renamed: `nativeWei` → `nativeLamports`, `blockTimestampSec` → `publishTimeSec`, `ClockSync.blockNumber` → `slot`; venue credit is per `marketId` (the Ledger seat), not per pool.
  - **Gap lane cadence seed = 604,800** (`GAP_CADENCE_SEC`); the Window's real span varies with holidays.
  - **Entry closes 30 s before `lock_at`, not expiry:**
    - `noEntryCutoffSec`, `orderExpirySec` and `insideNoEntryBuffer` take `{ lockAtSec, intervalSec }`, so an expiry can't be passed positionally.
    - `phase()` locks at `lockAtSec`.
    - `countdown` stays on `expirySec` ("settles in").
  - **Calendar (session slice):**
    - Regular Windows align to the ET clock (60m runs 10:00–16:00) and none expires after the close.
    - Gap = last session close before the weekend → first session open after it, locking Sunday 20:00 ET.
    - The roller lists a date only when Alpaca and the Pyth schedule agree; halts are an input.
    - Pyth schedule overrides carry no year, so only a recently fetched schedule is trusted.
  - **X grammar** reads the registry (symbols + company words) with Regular cadences 5m/15m/1h. It matches Regular-lane Windows only; token-lane grammar is S11's call.
  - **Left for their stages (they read the registry then):**
    - Lucky's `LUCKY_ASSETS` (S12): changing it needs a policy-version bump and new golden vectors.
    - Strategy copy defaults (S9).
    - Range/moonshot pricing vectors (S10).
- **User-visible:** stock tickers instead of BTC/ETH; Gap Windows stop taking entries at Sunday 20:00 ET.
- **Approval:** within plan r2 S1.

### D-012 — Signed messages, cluster ids and fees on Solana
- **Date / owner:** 2026-09-14 · S1 owner (step 1a.4)
- **Evidence:** Wallet Standard `solana:signMessage` and Privy `signMessage` sign raw bytes with ed25519 (no EIP-191 prefix); RFC 8032 (deterministic signatures); plan P§3.2 sponsor policy (compute ≤ 400k, simulate first); S0 Handoff (signed-message wording deferred to S1).
- **Rule:**
  - A signed text is its exact UTF-8 bytes; the browser and server build it from the same fields. It names "Agari" and the cluster (`Network: Solana devnet`, or `on Solana devnet`). The signature travels as base58 (64 bytes).
  - `verifySignedMessage(text, signature, signer, verify)` takes the ed25519 verifier as an argument (core stays crypto-free) and returns false, never throws, on malformed input.
  - Numeric cluster ids replace EVM chain ids wherever a number was bound into a signature or commitment: mainnet-beta 101, devnet 103 (the SPL token-list convention), localnet 104. Fields keep the name `chainId` (D-010).
  - No per-lane gas table: compute limit = simulated units × 1.1, capped at 400,000; a self-paying wallet needs `FEE_RESERVE_LAMPORTS` (4 × 5,000).
  - Faucet: devnet SOL top-up to 0.02 when below 0.005 SOL, 1 SOL/day, 2 SOL reserve; a prepared claim is reconciled against `lastValidBlockHeight`.
  - The `insufficient-allowance` diagnosis is gone (there's no token approval on Solana).
- **User-visible:** sign-in and consent prompts say Agari and Solana devnet; "Out of SOL for fees" replaces "Out of STT gas".
- **Approval:** within plan r2 S1.

### D-013 — S2 spec review amendments (core alignment)
- **Date / owner:** 2026-09-14 · S1 owner, reviewing the S2 spec before merge
- **Evidence:**
  - Hand re-derivation of all eight fill rows and the eight worked examples: cash pairs sum to `1000·q`; `mvault` reconciles under Up and void.
  - Every layout offset, size and rent figure recomputed (GlobalConfig 856, Series 1,368, Market 456, MarketResult 256, Seat 88, Book 32,384 + 48·n).
  - The PD-6 inequalities checked for exclusivity.
  - Core D-011 (`GAP_CADENCE_SEC`, clock-aligned Windows) and D-012 (`CLUSTER_ID`).
- **Rule:**
  - **Gap Series seed:** `cadence_sec = 604,800` (not 0), shared with core, so no consumer divides by a zero interval.
  - **Series cadence:** Regular/Token cadences must divide 3,600.
  - **`roller_open_window` alignment:** `trading_start % cadence == 0` and `expiry − trading_start == cadence`, with no partial Windows. The chain is at least as strict as the calendar that generates them.
  - **`cluster_tag`:** values = core `CLUSTER_ID` (101 mainnet-beta, 103 devnet, 104 localnet), one numbering for attested prints and signed texts.
  - **RedStone check policy:** `strict_sec < check_admission_sec` (launch value 60 s inside the 120 s window).
  - D-006…D-009 are accepted as written, including the CancelTaker revert and refusing duplicate RedStone signers.
- **User-visible:** none.
- **Approval:** stage-owner review within plan r2.

### D-014 — The wallet seam between web and markets
- **Date / owner:** 2026-09-14 · S1 owner (before splitting 1b/1c)
- **Evidence:** Context7 `/llmstxt/privy_io_llms_txt`:
  - Privy v3 `useWallets` from `@privy-io/react-auth/solana` returns `ConnectedStandardSolanaWallet` (address, `signMessage({message}) → {signature}`, `standardWallet`).
  - `useSignTransaction({transaction: Uint8Array, chain: "solana:devnet"})`.
  - `useSignAndSendTransaction({…, options: {sponsor}})`.
  - "fully compatible with @solana/kit".
  - Masayume's seam was `SubmitterSessionProvider({ walletClient })` (viem).
- **Rule:**
  - `packages/markets/src/react/wallet-session.ts` `WalletSession { address, kind: embedded|external, signMessage(bytes), signTransaction(bytes), signAndSendTransaction(bytes, {sponsor}) }` replaces viem's `WalletClient` in `SubmitterSessionProvider`. It deals in wire bytes only.
  - The web Privy island (1c) builds it from Privy's hooks and imports no `@solana/*`.
  - Markets (1b) wraps it as a kit signer; the boundary stays "only markets imports `@solana/*`".
  - Embedded wallets use Privy's `sponsor`; external wallets use the `api/sponsor` co-sign (P§3.2) or pay their own fee.
- **User-visible:** none directly; social-login wallets don't need SOL for fees.
- **Approval:** within plan r2 S1 (Privy + Wallet Standard through one seam).

### D-015 — `@agari/markets` is an honest not-deployed stub until S4
- **Date / owner:** 2026-09-14 · S1 1b owner
- **Evidence:** `docs/plan/specs/markets-surface.md` (every consumer import at `ef188d3`; 186 of 215 symbols compile against the stub); markets + core + ops typecheck; 982 tests; the removed EVM tree (≈ 10k lines: DreamDEX SDK, viem, Solidity ABIs).
- **Rule:**
  - **Reads.** A chain read returns `err(diagnosis("not-deployed", …))`, never a fabricated market, price, balance or clock. `nowMs()` is device time.
  - **Known-without-chain answers keep Masayume's shapes:** no vault → `null` snapshot and zero holdings; settlement fee 0 (D-012); a product that isn't deployed → `null` state, empty lists, zero balances; a product quote or preview → its own `*_NOT_DEPLOYED` reason.
  - **Writes.** Every write refuses before anything is journaled or signed: the submitter's lanes, `submit*Open`, `submitStrategyTx`, `openPrivateBet`. Plain-promise writes (`sendArenaIntent`, `getVaultGrant`, `readPoolTop`, `distributeSeasonPrizes`, faucet chain steps) throw the not-deployed reading.
  - **Boot facts.** A read that needs a failed boot fact now resolves to that fact's error (was: null forever). Product reads declare `needs: []` because their first branch is the local deployment check, so `CapabilityPending` renders instead of an error.
  - **Names.** A consumer symbol is kept when its concept exists on Solana (types reshaped per D-010…D-012) and removed when it's EVM-only (gas/wei, EIP-712/2771, ERC-6909 outcome ids, DreamDEX addresses, viem clients). The surface doc names each removal's owning stage.
  - **Signers.** `SubmitterSession` signs with `{ wallet: WalletSession }` (D-014) or `{ secretKey }`, a 64-byte Solana keypair whose address is its last 32 bytes (`parseSecretKey` accepts the CLI JSON array or base58). Ops role keys use the same format. `session.contracts` = `{ signer, deployment }`.
  - **Recovery.** Solana has no account nonce: recovery keys on the signature plus `readRecoveryCursor().fromSlot`. The strategy-attempt row stores `nonce: 0` until S9 reshapes it; `XReceipt.expectedNonce` is null.
  - **Fees.** `submitter.checkGas(lane)` keeps its name (fee sufficiency in lamports, `FEE_RESERVE_LAMPORTS`).
  - Masayume's Shannon spikes (`scripts/spike`, `services/ops/src/spike`) and season tools are deleted; S12 rebuilds the season tools.
- **User-visible:** every chain surface shows "not deployed" states until the engine and adapter land.
- **Approval:** within plan r2 S1 ("every route renders against a stub adapter returning honest unavailable Readings").

### D-016 — Invariant rules for the Solana boundary
- **Date / owner:** 2026-09-14 · S1 1b owner
- **Evidence:** `scripts/invariants/{rules.mjs,lib/chain-rules.mjs}`; each new rule was shown to fire on a planted violation (EVM import, `@solana/*` outside markets, web3.js 1 outside `prices/legacy`, IDL `destination`/`recipient`, `declare_id!` ≠ Anchor.toml, stale allowlist entry), then reverted.
- **Rule:**
  - **Added:**
    - `no-evm`: imports and manifests, with a shrinking `no-evm.allow.json` (35 entries at 1b: the 32 web files + 3 web deps). A stale entry fails; the S1 gate requires the file empty.
    - `kit-import-boundary`: `web/src/providers` is exempt for the Privy island.
    - `idl-no-destination`: AD-5 on `anchor/target/idl` and `packages/clients` IDLs; exceptions go in `idl-destination.allow.json` with a reason.
    - `program-id-drift`: `declare_id!` vs Anchor.toml `[programs.*]` vs `addresses.devnet.json`.
  - **Changed:** `write-boundary` now also bans `sendAndConfirmTransaction`/`signAndSendTransaction` outside markets, with `web/src/providers` exempt (the island wraps the wallet's own send for markets).
  - **Removed:** `sdk-import-boundary`, `sdk-version-pin`, `address-drift`, `generated-abi`, `vault-abi-shape` (the DreamDEX SDK and Solidity ABIs are gone); `banned-wagmi-hooks` (subsumed by `no-evm`); `order-lane-ioc`, `status-gate-enum`, `expiry-from-headroom` (they asserted the EVM order-lane files; S4 re-adds them against the Solana lane). `file-length` already covered `.rs`.
- **User-visible:** none.
- **Approval:** within plan r2 S1 (Invariants deliverable).

### D-017 — Privy wallet shell: a lazy Solana-only island
- **Date / owner:** 2026-09-14 · S1 1c owner
- **Evidence:**
  - Context7 `/llmstxt/privy_io_llms_txt` (Solana getting-started, configuring networks, migrating to 3.0): `appearance.walletChainType: "solana-only"`, `embeddedWallets.solana.createOnLogin`, `externalWallets.solana.connectors: toSolanaWalletConnectors()`, and `solana.rpcs` (needed only for embedded-wallet UIs). Peers are `@solana/kit` + `@solana-program/{memo,system,token}`. `useSignAndSendTransaction` takes `options.sponsor`.
  - Installed types (`@privy-io/react-auth` 3.42.0): `ConnectedStandardSolanaWallet`, and hook signatures that satisfy the seam without a cast.
  - Node 25 WebCrypto `Ed25519` (32-byte raw keys).
- **Rule:**
  - **Island.** `web/src/providers/privy.tsx` is the only web file that value-imports Privy or `@solana/kit`, reached solely through `next/dynamic` (`ssr: false`).
    - `WalletShellProvider` loads it on first connect intent (warmed on hover/focus) or at once when `agari.wallet.remembered` marks a returning session.
    - The island renders no children: it publishes state into a Privy-free context, so loading it never remounts the app.
  - **Config.** Solana-only; `createOnLogin: "users-without-wallets"`; external wallets via Privy's Wallet Standard connectors; `solana.rpcs["solana:devnet"]` from `NEXT_PUBLIC_SOLANA_RPC_URL`/`_WS_URL` (public devnet by default, never Helius).
    - Login methods are the dashboard's (no `loginMethods` override).
    - The accent is read from the `--vermilion` token (AD-12: no hex literals).
  - **Seam.** The active wallet is Privy's most recently connected Solana wallet, while authenticated.
    - `kind = embedded` when its address is the user's `walletClientType: "privy"` Solana linked account.
    - `signAndSendTransaction` asks for `sponsor` only on embedded wallets (D-014).
  - **`useWalletSession()`** keeps `address/isConnected/isConnecting/isRightChain/switching`.
    - `isRightChain === isConnected`: no wallet-side chain exists on Solana.
    - `switchToShannon` and `chainId` are removed; `kind`, `available`, `login`, `logout`, `prefetch` are added.
    - `useOwnerWalletClient` (viem) → `useOwnerWallet()` (the seam); `signText(wallet, text)` returns the base58 signature for core's signed texts.
  - **Server.** `web/src/lib/auth/verify-signed-message.server.ts` `verifyWalletMessage` = core `verifySignedMessage` + WebCrypto Ed25519.
  - **Removed:** `wagmi.ts`, `rainbowkit-theme.ts`, `NetworkBanner`, `@rainbow-me/rainbowkit`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. The Privy-pulled `@reown/appkit` build script is denied in `allowBuilds`.
- **User-visible:** "Connect" opens Privy (email/social login creates a Solana wallet; Phantom, Backpack and Solflare connect directly); the header shows a truncated base58 address; no "Wrong network" state; without a Privy app id the control reads "Sign-in unavailable".
- **Approval:** within plan r2 S1 (Privy from S1, D-004).

### D-019 — S2 admin and roller implementation choices
- **Date / owner:** 2026-09-14 · S2 owner (step S2.4)
- **Evidence:**
  - `cargo metadata` against anchor-lang 1.2: litesvm 0.8.2 fails (`solana-sdk-ids ~3.0` vs anchor's `^3.1`); 0.12/0.15/0.16 resolve, and 0.16 shares `solana-instruction 3.4.1` and `solana-address 2.6.1` (behind `solana-pubkey 3.0`'s 1.1 shim) with Anchor, so `Pubkey`/`Instruction` types unify.
  - LiteSVM 0.16 loads `bpf_loader_upgradeable` programs from a Program + ProgramData pair (`accounts_db::load_program`).
  - `events-instructions.md` §1 account lists (no `+E` on admin instructions); Anchor 1.2 `#[account(zero)]`/`init` codegen runs before the handler.
- **Rule:**
  - **Test harness:** `anchor/tests` is an isolated Cargo workspace with its own lock (never moves the program's `solana-program 3.0.0` pin), on **litesvm 0.16.0**, loading `target/deploy/agari_events.so` deployed upgradeable so `admin_init_config`'s upgrade-authority check is exercised.
  - **Arguments:** `admin_add_policy_version(index, version: PolicyVersionArgs)`, a Borsh mirror without padding (zero-copy state has no Borsh); the IDL names it `PolicyVersionArgs`.
  - **Events:** admin instructions emit with `emit!` (their account lists carry no event-CPI accounts, and they carry no `seq`); `roller_open_window` and every later Market-scoped instruction use `emit_cpi!`.
  - **Error precedence:** the spec's check order governs handler checks. Anchor's account validation (signer, owner/discriminator, `init` of the Market/Ledger/mvault PDAs, `#[account(zero)]`) runs first, so a malformed account fails with Anchor's own code before e.g. `NotRoller`; every such failure still reverts. `admin_init_config` maps unparsable mint or treasury data to `WrongMint`.
  - **Check policy:** a check follows the same per-source rules as a primary (source ∈ 1..4, non-zero feed id) and `check_admission_sec ≠ ADMIT_UNTIL_LOCK` (a check deadline is always `T + check_admission_sec`).
- **User-visible:** none.
- **Approval:** within plan r2 S2 (implementation of the frozen spec).

### D-020 — S2 matching, cancel and set implementation choices
- **Date / owner:** 2026-09-14 · S2 lane M (steps S2.7–S2.9)
- **Evidence:** `anchor/programs/agari-events/src/{book,matching}/**`; native tests (the §2.2 worked examples, the eight fill rows, edges, and 30,000 randomized operations with the §8.3 invariants checked after each); LiteSVM `anchor/tests/events_orders.rs`; the planted refund and open-order mutations the harness caught (seed 1, ops 24 and 53).
- **Rule:**
  - **A pure core.** Matching, seats, funding, cancels and sets are functions over `&mut Book`, the node slice, `&mut Ledger`, the seat slice and `&mut Market` (`matching::Venue`), with no Anchor account types and no token I/O. Handlers bind accounts, call the core, then move tokens by the amounts it returns. The randomized harness drives exactly this code.
  - **Seat hint `u16::MAX`.** An authority that already holds a seat gets `SeatMismatch` (it passes its index); the empty-seat scan covers `0..capacity`, the existing-owner scan `0..seats_used`.
  - **Taker proceeds.** `cash_received` is credited before funding, so `use_credit` can spend it; `withdraw_proceeds` then sweeps the whole credit (§4.3).
  - **Stop reason.** A PostOnly that rests reports `PostOnlyRested`; everything else reports the loop's reason.
  - **`series` in the cancel family and the sweep.** `user_cancel_orders`, `user_cancel_all` and `public_sweep_expired` also take `series` (read-only, bound to the market). events-instructions.md §3.2/§3.5 omit it, but a cancelled buy refunds `lots × ticks × cash_unit`, and only the Series stores the cash unit. `user_reduce_order` already listed it.
  - **Handles in the IDL.** Events and instruction args use the program's own `events::OrderHandle` (same layout as `agari_common::Handle`, which has no IDL build); `PlaceResult` return data keeps `agari_common::Handle`.
- **User-visible:** none beyond the spec.
- **Approval:** within plan r2 (spec-conformant implementation detail).

### D-021 — Pyth receiver choice, print cost and settlement details (S2 lane P)
- **Date / owner:** 2026-09-14 · S2 lane P
- **Evidence:**
  - **Receivers on a devnet fork:** Surfpool 1.5.0 `start --network devnet` (fork at slot 498,141,672). `@pythnetwork/pyth-solana-receiver` 0.16.0, in a scratch project outside the repo, posted the archived trial accumulator update for T = 2026-09-11T20:00:00Z (`data/archive/pyth/2026-09-11.jsonl`) through both pairs:
    - default `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ` + Wormhole `HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ`;
    - `pro-compatible` `rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp` + Wormhole `HDw2E7P8X1SkCyjvoGsfBGAVUutKcj874bXjHrpVYrVL`.
  - Both posts confirmed. Both `PriceUpdateV2` accounts read back `verification_level: Full`, TSLA price 36,547,600 × 10⁻⁵, conf 6,068, `publish_time == T`, `prev_publish_time == T − 1`.
  - The default receiver's account bytes (134 B) are the LiteSVM fixture `anchor/tests/vectors/prints/pyth-tsla-1789156800.account.b64`.
  - **LiteSVM costs:**
    - RedStone, 5 packages: **148,365 CU, 1,040 transaction bytes**, with no compute-budget instruction.
    - RedStone, 3 packages: 93,226 CU, 796 B (including a `SetComputeUnitLimit`).
    - Attested (ed25519 + print): 9,181 CU, 678 B.
- **Rule:**
  - **Pyth uses the SDK's default feature** (`rec5EK…`). Both generations verify the trial update, and the default is what the receiver JS SDK posts to without overrides, so the S3 relay and the program can't silently disagree. Accounts owned by `rec2HH…` are refused by Anchor's owner check (3007, tested). Moving to the other generation is a feature flag plus a program upgrade before any Window lists on it; policy versions don't change.
  - **RedStone 5-package prints need no ALT and no compute-limit instruction:** 192 B and ≈ 51.6k CU of headroom under the legacy 1,232 B and default 200k CU. The relay may still set a limit.
  - **Settle and void** share one accounts struct, `PublicResolveWindow` (`payer S w · series · market w · result init · system · +E`). A second resolution fails at Anchor's `init` of the existing `MarketResult` before the handler (D-019 precedence), so a resolved Window can never resolve again.
  - **Cross-check order** follows prints.md §5 exactly: `CrossCheckPending` is evaluated before divergence, so a diverging check with the other check missing voids only after `expiry + check_admission_sec`.
  - **`public_copy_open_from_prev`** compares the `market`/`prev_market` keys before loading; the same account in both slots would otherwise fail on the borrow rather than with `PrintNotAdjacent`.
  - **Not LiteSVM-tested:** the attested `get_stack_height` (CPI) refusal needs a caller program; it's covered by code review, the precompile-offsets test and the stack-height check.
- **User-visible:** none.
- **Approval:** within plan r2 S2 (closes the D-002 receiver open item).

### D-022 — S2 redeem and closure implementation choices
- **Date / owner:** 2026-09-14 · S2 owner (redeem + closure step)
- **Evidence:**
  - Spec: `docs/plan/specs/events-engine.md` §8.4–8.5 and `events-instructions.md` §5.2–5.7 and §4.5.
  - Native tests: `matching/tests/redeem.rs` (example 8 under Up, Down and void with a 250,000 bond; refusals; PROGRAM partial redeem), plus the post-settlement randomized run in `matching/tests/random.rs` (12 seeds, a mutation check caught a one-unit overpayment in all four tests).
  - LiteSVM: `anchor/tests/events_redeem.rs`.
- **Rule (redeem):**
  - `user_redeem(seat_idx, outcome, lots)` and `public_redeem_for(seat_idx)` also take `series` (read-only) for `cash_unit`, as the cancels do (D-020). Everything else follows the spec's account lists and check order.
  - Full redeem folds `locked_cash`, `yes_locked` and `no_locked` into what it pays. §8.3 makes them zero once `open_orders == 0`, so the result equals the spec; the fold only guarantees escrow can never be stranded if that invariant ever broke.
  - A redeemed non-PROGRAM seat is cleared, so a second redeem (or crank) is refused with `SeatMismatch` instead of paying 0. A PROGRAM seat keeps its owner and only the `PROGRAM` flag after a full redeem, so a paid bond can't keep the Ledger from closing.
  - Partial redeem: exactly one `Some` → `InvalidOrderArgs`; non-PROGRAM → `PartialRedeemNotAllowed`; `outcome > 1` → `InvalidOrderArgs`; `lots == 0` → `InvalidQuantity`; `lots > free` → `InsufficientOutcome`.
  - `public_redeem_for` refuses the empty key as owner, derives the ATA with `config.token_program`, and also checks `owner_ata.owner == owner`. A crank creates the ATA idempotently in the same transaction.
- **Rule (closure, S2.13; LiteSVM `anchor/tests/events_closure.rs`):**
  - `public_release_book` follows §5.2 and doesn't zero the ladders: `order_count == 0` already means every level and bitmap bit is empty under §8.3. The free list and `next_seq` persist, so every handle into the old generation is stale after the next bind (tested on a recycled Book).
  - `public_close_ledger` sends the residue (`mvault.amount`, the only place accounting reads it) to the treasury, emits `LedgerClosed`, closes the mvault with a Market-PDA-signed `CloseAccount` to `rent_payer`, and closes the Ledger on exit (`close = rent_payer`). PROGRAM seats must be redeemed by their products first.
  - `public_close_market` takes the result as a typed `["result", market]` PDA, so a missing or look-alike result fails Anchor's account validation before the handler (D-019 precedence). A terminal Window always has one, since settle and void create it atomically. `result.market != market` → `MarketNotTerminal`.
  - `product_add_dependent` / `product_release_dependent`: the signer must be in `config.program_authorities`; releasing at 0 → `MathOverflow`.
  - `public_grow_ledger` reallocates by hand after the spec's checks rather than with Anchor's `realloc` constraint (which would run before them): a System transfer of the rent delta from the payer, then `AccountInfo::resize`, then `capacity`. 8 calls take 96 → 1,024 seats.
  - `user_release_seat` (§4.4) isn't built: closure doesn't need it, because redeem refunds the bond. It stays open for mid-Window seat reuse.
- **User-visible:** anyone can crank a finished Window's payouts into each user's own ATA; a repeated redeem is refused by name. Finished Windows return their rent, and a donation to a Window's vault goes to the treasury without changing anyone's payout.
- **Approval:** within plan r2 (S2 redeem and closure step).

### D-023 — Wallet Standard via the Kit wallet plugin replaces Privy
- **Date / owner:** 2026-09-14 · user decision (reverses the Privy line of D-004), researched and implemented by the S1 owner
- **Evidence:**
  - **npm weekly downloads (2026-09-14):** `@solana/kit` 1.80M; `@wallet-standard/app` 1.32M and `@solana/wallet-standard-features` 1.23M (the protocol Phantom, Solflare and Backpack implement); `@solana/wallet-adapter-react` 783k; `@privy-io/react-auth` 296k; `@reown/appkit-adapter-solana` 46k; `@dynamic-labs/solana` 28k.
  - **Guidance:** the solana-dev skill (Kit-first) recommends `@solana/kit-plugin-wallet` + `@solana/react` for new apps, and advises against `@solana/wallet-adapter-*` (web3.js v1 peer, which our Kit-only boundary forbids) and `@solana/client`/`@solana/react-hooks` (stale).
  - **Package:** `@solana/kit-plugin-wallet` 0.20.0 (Anza, released 2026-09-10; peers `@solana/kit` ^8.2, `@solana/react` ^8.2, React ^19.2, all of which match ours). Its README covers Wallet Standard discovery, connect/disconnect, localStorage auto-reconnect, `signMessage`, the connected account's Kit `TransactionSigner`, and SSR safety.
  - **Fidelity:** Masayume, the design authority, connected wallets only (RainbowKit), with no social login.
  - **Browser check (production build):** with no wallet installed, the picker states it and links Phantom/Solflare/Backpack. A spec-conformant Wallet Standard test wallet (real WebCrypto Ed25519) was discovered, connected (header shows the base58 address, the markets session binds its signer, and `agari.wallet` persists it) and signed the `/dev/wallet` text: the server verified it and rejected the one-byte-tampered copy.
- **Rule:**
  - **Web:** `web/src/providers/wallet/kit-wallet.ts` creates one `createClient().use(walletWithoutSigner({ chain, storageKey: "agari.wallet" }))`. Markets keeps fee payers and sends; the wallet client only discovers, connects, remembers and signs. `WalletShellProvider` reads the plugin's hooks, and `WalletPicker` (a sheet above the fixed chrome, z 1000) lists installed wallets.
  - **Seam (amends D-014):** `WalletSession = { address, signer: TransactionSigner, signMessage(bytes) }`. The byte-level transaction methods, `kind` and the `sponsor` option are gone, and the markets session re-keys on the address only.
  - **Fees:** a wallet pays its own fee in devnet SOL from the faucet top-up (D-012), or through the `api/sponsor` fee-payer co-sign (S7).
  - **Removed:** `@privy-io/react-auth` (448 transitive packages, including MetaMask/WalletConnect EVM SDKs), `@solana-program/{memo,system,token}` in web (Privy peers), `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, and the `@reown/appkit` build entry. `useWalletSession()` now exposes `connect()`/`disconnect()`/`connecting` instead of `login`/`logout`/`prefetch`/`available`/`kind`.
  - **S1 gate wording:** "Privy embedded wallet shows a base58 address" becomes "a Wallet Standard wallet (Phantom) connects and shows a base58 address". "Phantom connects" and "signed-message verify works" stand.
- **User-visible:**
  - **Sign-in:** there is no email/Google sign-in or embedded wallet. "Connect" opens a list of the Solana wallets installed in the browser (Phantom, Solflare, Backpack, …), and the last one reconnects silently.
  - **Phones:** users open Agari in their wallet app's browser. Solana Mobile Wallet Adapter for Android Chrome is an optional add-on under Q-006.
  - **No dashboard:** nothing needs setting up with a vendor.
- **Approval:** user, 2026-09-14 ("we have to replace Privy").

### D-024 — Programs build for SBPF v0 (Anchor 1.2 defaults to v3)
- **Date / owner:** 2026-09-14 · S2 owner (devnet deploy)
- **Evidence:**
  - The first `solana program deploy` refused the binary locally, before sending anything: `ELF error: Detected sbpf_version required by the executable which are not enabled`. Its `e_flags` = 3 (SBPFv3).
  - `anchor build --help` (1.2.0): `--tools-version [default: v1.57]`, `--arch [default: v3]`.
  - `solana feature status --url devnet`: `BUwGLeF3…` "SIMD-0178/0179/0189: Enable deployment and execution of SBPFv3 programs" is **inactive**. LiteSVM enables every feature, which is why all tests had passed on v3.
  - Rebuilt with `--arch v0`: `e_flags` = 0, 764,200 B (v3 was 726,056 B). All 33 LiteSVM tests pass on the v0 binary. Compute is within 0.4% of v3: 10-fill IOC 29,888 CU, RedStone 5-package print 148,406, redeem 13,991.
- **Rule:** every program build uses `NO_DNA=1 anchor build --arch v0` (`pnpm anchor:build`, CLAUDE.md gate) until SBPFv3 is active on the target cluster. The platform tools stay at Anchor's v1.57. Compute and size figures in stage files are the v0 ones.
- **User-visible:** none.
- **Approval:** within plan r2 S2 (deploy step).

### D-025 — Codama client shape (S2 codegen)
- **Date / owner:** 2026-09-14 · S2 owner (codegen step)
- **Evidence:**
  - Context7 `/codama-idl/codama` and the installed `@codama/renderers-js` 2.4.0 README: `renderVisitor(packageFolder, { generatedFolder, kitImportStrategy, syncPackageJson })`.
  - Pinned: `codama` 1.10.2, `@codama/nodes-from-anchor` 1.5.5, `@codama/renderers-js` 2.4.0 (root devDependencies).
  - The default `preferRoot` output imports `@solana/program-client-core`. `@solana/kit` 8.3.0 exports the same module as `./program-client-core`.
  - The first render failed typecheck: Codama names every type X's encoder input `XArgs`, so the program's Borsh `PrintPolicyArgs` collided with zero-copy `PrintPolicy`'s generated `PrintPolicyArgs`.
  - The decoders' fixed sizes equal `events-accounts.md` §3: GlobalConfig 856, Series 1,368, Market 456, MarketResult 256. Two consecutive renders are byte-identical.
- **Rule:**
  - **One package, one subpath per program:** `@agari/clients` at `packages/clients`, with `@agari/clients/agari-events` → `agari-events/src/generated/index.ts`. The only dependency is `@solana/kit` (`kitImportStrategy: "rootOnly"`).
  - **The IDL is checked in** at `packages/clients/<program>/idl.json`. `pnpm codegen` copies a fresh `anchor/target/idl` over it first, so the codegen diff gate also catches IDL drift. The IDL publish reads the same file.
  - **Collisions:** a defined type `XArgs` next to a type `X` renders as `XInput` (codegen visitor). The program and its IDL keep their names.
  - **File cap:** `file-length` skips `packages/clients/*/src/generated/**`. Generated code is never edited by hand.
  - Book nodes and Ledger seats are past the fixed headers the IDL describes. Their hand decoders are S4's (`events-accounts.md` §3.8–3.9).
- **User-visible:** none.
- **Approval:** within plan r2 S2 (codegen step).

### D-026 — S2 venue bootstrap on devnet (init-events and IDL publish)
- **Date / owner:** 2026-09-14 · S2 owner (deploy + init-events step)
- **Evidence:**
  - `admin_init_config` requires `admin == upgrade authority` (events-instructions.md §1.1), and the program has no admin-transfer instruction (S2 handoff deferral).
  - `kit-import-boundary` scans `scripts/`, so a `scripts/deploy/init-events.mjs` importing `@solana/kit` fails the fast gate.
  - `anchor idl init` (1.2.0) prints "Skipping IDL initialization on localnet" for `127.0.0.1` and shells out to `npx` (npm warnings in its output). `http://127.1:8899` reaches Surfpool without the skip.
  - On a Surfpool devnet fork, the same init-events run created every account (1.621 SOL at mainnet rent), a re-run was a no-op, and two planted drifts were refused. Devnet: 9 txs, 1.183 SOL; IDL 13 txs, 0.0569 SOL (acceptance.md, 2026-09-14 13:59–14:03).
- **Rule:**
  - **Admin:** the GlobalConfig admin is the `deployer` role (the upgrade authority). The `admin` role key is unused by agari-events until a D-entry adds an admin transfer.
  - **Collateral:** tUSDC is a plain SPL Token mint with 6 dp, mint authority `faucet-mint-authority` and no freeze authority. Its address comes from a create-once `tusdc-mint` role keypair, so re-runs and other clusters derive the same address. The treasury is the admin's tUSDC ATA.
  - **Authorities:** rollers `[roller]`, attestors `[price-attestor]`, the five D-002 RedStone signers in `price-sources.json` order with threshold 3, and no program authorities (S10).
    - The Switchboard queue is the zero key with `min_oracles 0` as a placeholder. S6 sets both through `admin_set_authorities`, which replaces every field, so S6 re-sends the full set.
    - `result_retention_sec` is 21,600.
  - **Series:** the LiteSVM launch grid: lot = tick = 1,000 base units, `min_lots` 1,000, 0.25 tUSDC seat bond, `min_rest_slots` 50, `max_lead_sec` 400,000, fills 16, evictions 16. Each Regular 5m Series gets 2 × 512-node Books.
    - A RedStone **check** policy uses `strict_sec` 60 (prints.md §2.1), which lives in `@agari/markets/deploy`, not in `price-sources.json`.
    - A missing Series is registered in the same transaction as all its versions.
  - **Code:** transaction building lives in the server-only subpath `@agari/markets/deploy`, which the package root doesn't re-export. `scripts/deploy/init-events.ts` (tsx, `pnpm deploy:init-events [--cluster devnet|localnet]`) only reads files and replaces the plan's `.mjs`.
    - Ensure-style: existing state is compared field by field, and any drift throws rather than being corrected.
    - Books are reconciled from the record and the Series free list before any is created.
    - `--cluster localnet` targets Surfpool and writes the gitignored `addresses.localnet.json`.
  - **IDL publish:** `pnpm dlx @solana-program/program-metadata@0.9.3 write idl <program> packages/clients/agari-events/idl.json --keypair <deployer> --priority-fees 0`, the same canonical `idl` seed and zlib encoding `anchor idl` writes. Anchor's `idl init`/`upgrade` aren't used, because they call npx. The metadata address is recorded as `programs.agari_events.idlMetadata`. Re-publish after every program upgrade that changes the IDL.
- **User-visible:** explorers decode agari-events instructions on devnet. Test collateral is "tUSDC" at `5i61C4kH…`.
- **Approval:** within plan r2 S2 (deploy + init-events step).

### D-027 — The S2 events drive: live boundaries, time travel only forward, drive-only test Series
- **Date / owner:** 2026-09-14 · S2 owner (Surfpool drive step)
- **Evidence:**
  - Surfpool `surfnet_timeTravel` moves the clock forward only (Context7 `/solana-foundation/surfpool`). On a fresh fork the chain clock trailed the wall clock by 2–3 s.
  - The first drive run failed on A's second order with `SeatMismatch` (6115): `seat_hint = u16::MAX` from an authority that already holds a seat is refused (D-020).
  - The Pyth receiver SDK lane (`@pythnetwork/pyth-solana-receiver` 0.16.0) needs an override: `jito-ts` pins web3.js ~1.77.3, whose CJS build deep-imports `rpc-websockets/dist/lib/client`, and pnpm resolves that to rpc-websockets 9 (`ERR_PACKAGE_PATH_NOT_EXPORTED`).
  - The second Surfpool run passed end to end (acceptance.md 2026-09-14 14:30–14:50Z): 41 transactions and exact payouts.
- **Rule:**
  - **Live prints, forward time travel:** prints must exist in reality at T, so the drive runs one real 5-minute boundary pair during NYSE hours. Surfpool's clock is pulled level with the wall clock before every print. Time travel is used only to pass deadlines (the missing-print void at `T + 900`).
  - **Order of a boundary:** RedStone checks first, since the check window closes at `T + 120`. Then Pyth (post → record), then the attested print once the chain clock is at least `T + min_delay_sec`.
  - **Drive-only test Series:** ticker id **900** (never in the core registry, so the app never lists it), Regular 5m, one 256-node Book. The primary is attested (feed `"agari-drive-attested:TSLA"`, min delay 10 s, bars 60 s, admission 900 s) and the check is the TSLA RedStone check policy. The drive attests 1% above RedStone's median, so the Window must void with `CrossCheckDivergence`. It exists to exercise attested prints and the divergence void on real data.
  - **Seats:** callers pass their existing seat index (`seatHintFor` reads the Ledger), and `ANY_SEAT` only for a first order.
  - **Attested pair:** ed25519 offsets use `u16::MAX` ("this instruction"), so Kit's planner may place its compute-budget instruction anywhere. The precompile still sits immediately before the record.
  - **RedStone values** are parsed from the JSON source text (`JSON.parse` reviver `context.source`) and scaled ×10⁸ exactly; more than 8 decimals is refused.
  - **Pyth posting** (`@agari/markets/prices/legacy`) uses `@pythnetwork/pyth-solana-receiver` 0.16.0 and `@solana/web3.js` 1.98.4, with the pnpm override `jito-ts>@solana/web3.js: 1.98.4` and `allowBuilds` false for `bigint-buffer`/`protobufjs`. It uses its own confirm-and-resend sender. `reclaim_rent` batches keep the default compute limit, because a tight budget sets 0. Update accounts are closed after recording.
  - **Book recycling:** before opening, the drive sweeps and releases any Book whose Window has locked (`recycleBooks`). The roller (S3) owns this in production.
- **User-visible:** none (drive tooling). Series 900 is visible on-chain on devnet but never listed.
- **Approval:** within plan r2 S2 (Surfpool and devnet drive steps).

### D-028 — S3 starts before S1's Phantom check; the venue-ops contract and lanes
- **Date / owner:** 2026-09-14 · S3 owner (foundation step)
- **Evidence:**
  - Plan §7.2 S3 preconditions are "S1 (session types), S2 (IDL, clients, addresses)". S1's code is complete (every step ticked); its only open gate item is the manual Phantom check at `/dev/wallet`, which no S3 deliverable touches. `stage/S1-solana-shell` is ahead of `stage/S2-events-engine` only in `STATUS.md`.
  - The user asked to continue building on 2026-09-14 while the Phantom check was still pending.
  - Hermes `/v2/price_feeds` returns the `schedule` attribute without a key; Alpaca `/v2/calendar` answered with the root keys; the first agreed calendar (09-07..09-28) had no disputed dates.
  - The `kit-import-boundary` rule forbids `@solana/*` and `@agari/clients` in `services/`, and a wildcard subpath export (`./ops/*`) resolves under `moduleResolution: Bundler` (typecheck green).
  - Role keys `roller`, `price-relay`, `settler`, `maker` hold 0 SOL and the deployer 4.48; S3's devnet run needs ≈ 21 SOL (stage-03 Findings).
- **Rule:**
  - **Branching:** `stage/S3-venue-ops` is cut from `stage/S2-events-engine` plus S1's STATUS commit. `main` still receives S1, then S2, then S3, and only after S1's gate passes.
  - **Contract:** `docs/plan/specs/venue-ops.md` is the S3 contract (roles and payers, runtime, chain access, discovery, each actor's rules, lane file ownership).
  - **Chain surface:** `@agari/markets/ops` (shared client, `sendOps` + `ENGINE_ERROR`, venue reads) and per-lane `@agari/markets/ops/<lane>`. `services/ops` never imports the chain SDKs.
  - **Payers:** each actor's own role key pays its transactions and rent and receives the refunds (roller: Market/Ledger/mvault; settler: MarketResult). Nothing signs with `deployer` at runtime.
  - **Runtime:** actors run `runActor` loops with heartbeats, DRY_RUN by default, and a shared `SessionService` (Alpaca ∩ Pyth schedule) and `SpotFeed` injected through `VenueDeps`.
  - **Scope held for S6:** Gap and token lanes, Switchboard, the Jupiter attested fallback. S3 actors act on Regular Series of core-registry tickers only.
  - **Lanes:** 3a roller, 3b prices, 3c settler + seed maker, 3d indexer, in parallel worktrees with disjoint file ownership. The stage owner alone edits `main.ts`, the shared runtime, package manifests and the lockfile.
- **User-visible:** none yet (the soak lists Windows on devnet).
- **Approval:** within plan r2 S3; the pre-gate start follows the user's "continue building" (2026-09-14) and keeps `main` untouched.

### D-029 — S3 lane merges: spec amendments, main.ts wiring, late-open rule
- **Date / owner:** 2026-09-14 · S3 owner (lane merges + integration smoke)
- **Evidence:**
  - Lane 3c's live fill: a maker BUY_NO at `price_ticks = fair + half` filled against a taker BUY_YES at the same YES price. events-engine.md §2 quotes every kind in YES ticks, and a resting BUY_NO escrows `1000 − p`.
  - Lane 3b's primary RedStone slots refused 3–4 signer sets before T + 300. prints.md §4.2: `required = now < T + strict_sec ? 5 : 3`, with primary `strict_sec` 300.
  - Lane 3c releases the Book before waiting on PROGRAM seats. `public_redeem_for` takes `series`.
  - Integration smoke: TSLA-1h/NVDA-1h 16:00–17:00Z were opened at 16:35, past `open_deadline` 16:15, and voided with `MissingPrint` immediately. TSLA-15m opened at T + 300 missed its check window (T + 120).
- **Rule:**
  - **§8.2:** the seed maker's ask is BUY_NO with `price_ticks = fair + half`.
  - **§6.2:** RedStone needs all 5 configured signers until `T + strict_sec` (60 for checks, 300 for primaries), then ≥ `threshold`. Unknown signers are dropped before posting.
  - **§7:** the settler releases the Book before any wait on PROGRAM seats. `public_redeem_for` carries `series`.
  - **§5.2:** the roller's candidate Window must still admit its opening prints (`now + 45 ≤ open_deadline`, and `≤ T + check_admission_sec` when the version has a check). Otherwise the next Window is the candidate.
  - **§2.5:** `OPS_ACTORS` defaults to the six venue actors (`relay, roller, settler, maker, indexer, http`); `all` adds the Masayume-era actors, which idle until their stages. `MAKER_MODE` defaults to `seat`.
- **User-visible:** after downtime, a lane shows its next full Window instead of a Window that would void at once or settle without its cross-check.
- **Approval:** within plan r2 S3 (spec corrections found by the lanes' live proofs).

### D-030 — Operator RPC: paced, retried transport; shared websockets; crash-only supervision
- **Date / owner:** 2026-09-14 · S3 owner (devnet soak)
- **Evidence:**
  - **Helius limits:** the soak's first hour on Helius devnet (27 Series) hit 429s at boundary bursts and `fetch failed` on half-closed sockets.
  - **Hung pass:** a Kit `sendTransaction` confirmation never resolved, and the roller was stuck ≈ 50 min.
  - **Retry bug:** undici's `interceptors.retry` over `fetch` POST fails with `UND_ERR_REQ_CONTENT_LENGTH_MISMATCH` on the first retry (local repro), so it never retried.
  - **Websockets:** Helius refused extra websockets (`WebSocket failed to connect`) with one subscriptions instance per client.
  - **Pyth budget:** the Pyth receiver's `post_update` exceeded the SDK's tight compute budget on 3-feed updates.
  - Stage-03 Findings list each fix's before/after window.
- **Rule:**
  - **One client composition** for every operator client (`createDeployClient`, `createOpsClient`): kit-plugin-rpc's `solanaRpc` plugins around `createSolanaRpcFromTransport(retryingRpcTransport(url))`.
    - The transport paces each call (`RPC_MAX_RPS` 8, `sendTransaction` also `RPC_SEND_TPS` 3), sends through one bounded undici agent (16 connections, 30 s timeouts, 4 s keep-alive), and retries 429/5xx/socket errors with jittered backoff (6 tries).
    - Subscriptions are one instance per URL, and the legacy Pyth lane shares one Connection per URL.
  - **Timeouts:** every send aborts after 120 s; the next pass reconciles from chain.
  - **Supervision:** crash-only. `main.ts` exits with 70 when any actor's pass runs longer than `OPS_STUCK_PASS_MS` (10 min), and a supervisor restarts it. Every actor rebuilds its state from chain on boot.
  - **Pyth posts** use the SDK's non-tight compute budget.
  - **Endpoints:** HTTP RPC on Helius, websockets on the public devnet endpoint (`SOLANA_WS_URL`), when Helius websockets are refused.
- **User-visible:** Windows keep rolling and settling through provider rate limits; a stuck actor recovers within ≈ 10 min instead of silently stopping.
- **Approval:** within plan r2 S3 (soak hardening; plan §9 risk "Helius 10 RPS (batch, cursor backfill)").

### D-031 — The S4 contract and lanes
- **Date / owner:** 2026-09-14 · S4 owner (foundation)
- **Evidence:** `docs/plan/specs/first-call.md` (spec architect pass over the ports, the S1 stub, S2/S3 Solana code, the web consumers and Masayume `68f7a09`, with file:line citations); the S3 soak (live Windows, maker quotes, prints, an indexer lagging ≈ 2 s); D-030 (a free Helius key saturates from ops alone).
- **Rule:**
  - **Sources:** a read comes from the chain when it gates a write or must be head-fresh (the Window snapshot, Books, seats, balances, clock). Lists and history come from the indexer through `/api/index/*`. Spot and session state come from ops HTTP.
  - **Browser pacing:** the browser has its own paced transport, `runtime/transport.ts` (Node-only undici stays server-side).
  - **Lanes:**
    - 4a reads (its first slice, 4a.1 = the §2.1 runtime, merges first);
    - 4b writes;
    - 4c faucet;
    - 4d surfaces.
  - **Merge order:** 4a.1 → 4a → 4b → 4c → 4d, with file ownership per spec §7. The stage owner alone edits manifests, the lockfile, `core/ports`, `markets/{env,index}.ts`, web providers and env, `services/ops`, invariants and docs.
  - **Invariants:** `order-lane-ioc`, `status-gate-enum` and `expiry-from-headroom` are re-pointed at the Solana order-lane files (optional until 4b lands them).
- **User-visible:** none yet.
- **Approval:** within plan r2 S4.

### D-032 — The settler leaves user seats to their owners for 300 s
- **Date / owner:** 2026-09-14 · S4 owner (spec Q-S4-3, recommended default taken; the user had said SOL float is not a concern)
- **Evidence:** venue-ops.md §7 has the settler `redeem_for` every user seat right after settle, so S4's Claim (L-33/L-34) would almost never be seen. A grace of 300 s keeps Ledgers open ≈ 5 min longer, ≈ 0.9 SOL more roller float in a full session.
- **Rule:** the settler releases the Book at once but waits until `resolved_ts + SETTLER_REDEEM_GRACE_SEC` (default 300) before `redeem_for` on non-PROGRAM seats; after that it pays whatever is left. The UI shows "Paid automatically" with the crank signature for a seat the settler paid (`13121f8`, venue-ops.md §7 amended by this entry).
- **User-visible:** after a Window settles, winners have 5 minutes to press Claim themselves; otherwise they are paid automatically.
- **Approval:** stage owner on the spec default; reversible by env.

### D-033 — Solana write semantics for the order and redeem lanes; journal recovery by signature
- **Date / owner:** 2026-09-14 · S4 owner (foundation)
- **Evidence:**
  - events-engine.md §3 and §8.4: an IOC with no fill reverts with 6110, partial redeem is PROGRAM-only (6232), and the first order in a Window takes the seat bond.
  - Masayume's order lane (`submitter/order-lane.ts:68-110`).
  - Solana has no nonce: a signature with no status past its blockhash's `lastValidBlockHeight` never landed.
- **Rule:**
  - **Orders:** Up = BUY_YES IOC, Down = BUY_NO IOC, at the confirmed quote's limit. Simulation 6110 → requote (or no-liquidity); a landed 6110 → `nothingFilled`. Funding counts the seat bond and seat credit (`use_credit: true`).
  - **Redeem:** one full `user_redeem` per Window; a seat already paid by the settler reconciles to `confirmed` from the indexer's `Redeemed`.
  - **Fees:** the wallet is the fee payer.
  - **Port addition (additive):** `IntentRecord.lastValidBlockHeight?` and `IntentJournal.markSent(id, txHash, lastValidBlockHeight?)`.
  - **Reconcile:** `getSignatureStatuses` → `confirmed` / `reverted` / `absent` (past the block height) / `unknown`. Nothing is re-signed.
- **User-visible:** a stale ticket asks again instead of failing; an order the book outran says nothing was taken; a closed tab mid-send resolves on return.
- **Approval:** within plan r2 S4.

### D-034 — The S4 faucet: one challenge signature, server-sent SOL top-up and tUSDC mint
- **Date / owner:** 2026-09-14 · S4 owner (spec Q-S4-1, recommended default)
- **Evidence:** tUSDC's mint authority is the server role `faucet-mint-authority` (D-026), so a wallet cannot mint alone. A wallet-built transaction co-signed by the authority breaks when a wallet modifies the transaction (Wallet Standard `signTransaction` may). Masayume's SOL faucet service, challenge and quotas already exist in `web/src/features/funding`.
- **Rule:**
  - **Claims:** the user signs one free challenge message. The server then sends a SOL top-up (new role `sol-faucet` `HL3ZUNsP…`: SOL source, fee payer and ATA rent payer) and/or a tUSDC `mintToChecked` (signed by `faucet-mint-authority`) through the faucet service.
  - **Quotas:** journaled with Masayume's quotas plus the new tUSDC policy (10,000 tUSDC per claim, one per wallet and 10 per IP per 24 h, 2,000,000 per 24 h globally).
  - **RPC:** the faucet uses public devnet by default.
  - **Keys:** env vars on a server; locally, the role files in `~/.config/agari/devnet/`. They are never copied into `.env` files.
- **User-visible:** "Get test funds" needs one signature and no transaction popup; tUSDC arrives without the user paying a fee.
- **Approval:** stage owner on the spec default.

### D-035 — S4 gate wording and browser RPC
- **Date / owner:** 2026-09-14 · S4 owner (spec §4, Q-S4-2)
- **Evidence:**
  - D-023 moved the sponsor co-sign to S7 and removed Privy.
  - Public Solana endpoints limit per IP (100 req / 10 s), so each browser brings its own budget.
  - A Helius key in a browser bundle would leak, and the free key already saturates from ops (D-030).
- **Rule:**
  - **Gate rows:** "sponsored fill (fee payer = sponsor)" becomes "wallet-paid IOC fill: fee payer = the user's wallet, SOL from the faucet top-up; sponsored fills move to S7". "Manual fresh-Privy end-to-end" becomes "a fresh Phantom (Wallet Standard) wallet".
  - **Browser RPC:** browsers use `NEXT_PUBLIC_SOLANA_RPC_URL`/`_WS_URL`, which default to public devnet, through the paced browser transport. There is no `/api/rpc` proxy in S4; revisit at S16.
- **User-visible:** the first call needs a little devnet SOL from the faucet top-up.
- **Approval:** stage owner, following the user's D-023.

### D-036 — Masayume visual fidelity is exact; the wallet connect is a RainbowKit-replica modal
- **Date / owner:** 2026-09-14 · user instruction (voice, while testing the S1 connect), S4 lane 4e audit
- **Evidence:**
  - The user: "exact replica … same colors everywhere … the modals, the header, the footer, nothing is left out"; the only intended difference is asset logos; performance with TanStack Query caching as Masayume does.
  - The audit `docs/plan/audits/ui-fidelity-2026-09-14.md` (36 findings) found styles, layout, UI kit, fonts and the query client byte-identical. The visible drift was:
    - empty data surfaces;
    - the connect picker as a right-side shadcn Sheet on `--color-surface-3` (#404040) instead of RainbowKit's centred compact modal;
    - leftover Masayume/Somnia copy.
- **Rule:**
  - **Replica standard:** every web surface is built and reviewed against Masayume's source and live app (masayume.app) at 390/768/1440 in both themes. Drift is fixed, not waived, except asset logos, D-entried product differences, and states whose programs are not deployed.
  - **Wallet connect (amends D-023's UI wording):** it is a centred modal (a bottom sheet on phones) replicating RainbowKit's compact modal and account modal, over the same Wallet Standard seam. `useWalletSession()` adds `openAccount()`; `connect()` opens the connect modal. Wallet artwork lives in `web/public/wallet/` (attributions in `THIRD_PARTY_NOTICES.md`).
  - **Performance:** Masayume's query-client defaults, persisted read cache, lazy chart bundle and fonts stay byte-identical. Live prices and Books are push subscriptions (spot SSE, ref-counted `accountNotifications`). Endpoint failover (`health.ts`) is S16.
  - **Audit upkeep:** the audit doc is updated at each stage that touches web.
- **User-visible:** "Connect" opens the same modal Masayume users know; the app looks like Masayume except for stock logos.
- **Approval:** user, 2026-09-14.

### D-041 — The S5 contract, lanes, foundation and default answers
- **Date / owner:** 2026-09-15 · S5 owner (spec architect pass, reviewed)
- **Evidence:** `docs/plan/specs/proof-analytics.md`:
  - Portfolio history already reads real data after S4a.
  - The index holds only 4 fills (S2 drive), so boards and recount need real fills.
  - The relay's hourly sweep closes every `PriceUpdateV2` its key wrote (`ops/prints/leftovers.ts:12-24`), so a proof replay can't use `price-relay`.
  - Measured devnet rent for a replay: 3 × 1,330,960 lamports `PriceUpdateV2` + ≈ 6.7M encoded VAA (refundable), ≤ 50,000 lamports fees per boundary.
- **Rule:**
  - **Lanes:**
    - 5a record + Trader Edge (ET session buckets);
    - 5b boards, stats, traction, recount, traders drive;
    - 5c status probes (a new `expected` flag → "closed (expected)" off-hours);
    - 5d surface, share and the Pyth proof replay (`/proof/<market>`).
  - **Merge order:** 5c → 5a → 5b → 5d.
  - **Foundation (stage owner):**
    - ops `/session` adds `calendar.recent` (last five opened sessions) and `sources.pythTrialLastCloseSec` (S3 `26a7f00`, live in the soak);
    - `print_proofs` DDL (`schema-proofs.ts`);
    - lane index paths resolved in `queries-{tape,status,proof}.ts` before the base table, with `IndexQuery.run(reader, db)`;
    - `PROOF_PATH`;
    - `@agari/markets/proof`;
    - `@agari/db` for scripts;
    - root `drive:{recount,proof-replay,traders}`;
    - role `proof-replay` `4WJ7SXG9…` funded 0.1 SOL.
  - **Defaults:**
    - Q-S5-1: replay both by script and by a one-click server route, with idempotency and quotas; the route ships only if `pnpm build` stays green.
    - Q-S5-2: seed maker and settler are excluded from the leaderboard and `/stats`.
    - Q-S5-3: a 3-keypair traders drive on the next session (≈ 0.01 SOL).
    - Q-S5-5: Restore waits for S10d (L-46 Partial).
    - Q-S5-6: edge buckets Opening hour / Late morning / Midday / Power hour.
    - Q-S5-7: replay accounts are kept 24 h, then closed.
- **User-visible:** a replayable on-chain proof behind every Pyth-settled Window; session-aware `/status`; per-ticker and this-session boards; Trader Edge by ET session hour.
- **Approval:** stage owner on the spec defaults.

### D-051 — The S6 contract, lanes, foundation and cross-stage boundaries
- **Date / owner:** 2026-09-15 · S6 owner (foundation, from the spec architect pass)
- **Evidence:**
  - `docs/plan/specs/session-lanes.md` (frozen by this entry) and `stage-06-session-lanes.md`, cut from `stage/S4-first-call` @ `c5ddb60` plus `stage/S3-venue-ops` @ `26a7f00` (merged: `/session` `calendar.recent` and `sources`).
  - Before S6, every venue actor filtered `basis === 0` (roller `execute.ts:47`, relay `tracker.ts:36`, settler `index.ts:41`, maker `seat/index.ts:33`), the relay skipped Switchboard slots (`relay-pass.ts:142`) and `policyFor` threw for switchboard/attested (`policies.ts:87`).
  - `@switchboard-xyz/on-demand` 3.10.6 and `@switchboard-xyz/common` 5.8.5 (Context7 `/websites/switchboard_xyz`: `queue.fetchQuoteIx(crossbar, feedHashes, { numSignatures, payer })`) resolve on the existing `@solana/web3.js` 1.98.4 with no new override. Both import in Node ESM; the crossbar client is `CrossbarClient` from common, not `sb.Crossbar`.
- **Rule:**
  - **Contract:** the S6 contract is the spec. Changes need a D-entry.
  - **Lanes** (spec §6; disjoint ownership):
    - 6a Gap: `slice/S6a-gap`, `../agari-wt/s6a`, Surfpool 9061/9062;
    - 6b token: `slice/S6b-token`, `../agari-wt/s6b`, Surfpool 9063/9064;
    - 6c halts, voids, earnings, corporate actions: `slice/S6c-halts-voids`, `../agari-wt/s6c`, Surfpool 9065/9066;
    - 6d states, copy, fixtures, hedge: `slice/S6d-states-hedge`, `../agari-wt/s6d`, web 3064.
  - **Merge order:** foundation → 6c → 6a → 6b → 6d.
  - **Foundation (frozen interfaces):**
    - Core types (`types/session-lanes.ts`): `HaltReason`, `HaltBoard`, `EarningsEvent`, `EarningsFlag`, `CorporateSkip` (+ `lanes?`), `MultiplierChange`, `VoidDetail`; `LANE_BASES`/`laneBasisOf`; blocker kinds `session-closed | halted | lane-paused | gap-listed | corporate-action` with the spec §5 strings; Ondo mints, `SHARE_TOKENS` and `laneKey` in `tickers.ts`.
    - Lane keys: `TSLA-5m` (unchanged), `TSLA-gap`, `TSLAx-5m`, one helper (`laneKey`, ops `seriesLaneKey`) for the roller, relay, settler, maker and `/session.lanes`.
    - Basis dispatch: roller `plan-basis.ts` → `plan-gap.ts` (6a) / `plan-token.ts` (6b); relay `gap-slots.ts` (6a, takes slots first), `switchboard-pass.ts` and `jupiter-attest.ts` (6b) returning `LanePassResult`; maker `lane-quote.ts` → `gap-fair.ts` (6a) / `token-fair.ts` (6b) overriding phase, fair and cap in `tendWindow`. Every stub reports `paused: lane not built` and sends nothing.
    - The settler takes every registry Series of a known basis with no stub: settle and void rules are unchanged for Gap and token Windows (spec §1.5, §2.4).
    - `policyVersions(symbol, sources, basis)`: Gap = the ticker's versions with `primary.open_admission_sec = ADMIT_UNTIL_LOCK`; token versions and switchboard/attested policies delegate to `policies-token.ts` (6b), which refuses until built.
    - Ops: `VenueDeps.halts` (in-memory board, `halt-watch` its only writer) and `VenueDeps.events` (corporate-actions.json re-read on change, earnings set by `calendar/earnings.ts`); actors `halts` and `earnings` in the default `OPS_ACTORS`; `/session` adds `halts`, `earnings` (null = unknown) and `skips`. The roller reads skips from `deps.events`; a Regular skip honours `lanes`.
    - Knobs: `ROLLER_GAP_LEAD_SEC` 172,800; `MM_GAP_MAX_CASH` 25 and `MM_TOKEN_MAX_CASH_PER_WINDOW` 10 tUSDC. A halted ticker's Regular quotes pull.
    - Barrels pre-wired with `export *` stubs so lanes never edit them: markets `deploy/series-{gap,token}.ts`, `ops/prints/switchboard.ts`, `prices/jupiter.ts`, `prices/legacy/switchboard-quote.ts`, `@agari/markets/holdings`; db `print-archive-read.ts`.
  - **Cross-stage boundaries (never edited by S6):** S5d `VerdictCard`, `print-source`, `MarketProofRows`, `features/share/**`; S5a `features/markets/{portfolio,balance,history}/**`; S13c `Marquee.tsx`, `/api/earnings`, `finnhub.server.ts`; S13b `features/markets/reels/**`. S6 adds no web Finnhub client and no earnings route (D-071): the ops fetch serves the flags (Q-S13-9), and the one `EarningsEvent` shape is reconciled at the second merge. Stage owners reconcile `copy.ts` hunks and `/session` fields at merge.
- **User-visible:** none yet (every new lane reports "paused: lane not built").
- **Approval:** stage owner on the spec (defaults below recorded as pending the user where marked).

### D-052 — Spike (b): the Gap's Monday print feed and the 09-18 listing set
- **Date / owner:** 2026-09-15 · S6 owner (spec §1.1; archive re-read by the foundation)
- **Evidence:** `/Users/abu/dev/hackathon/stocklana/data/archive/redstone/2026-09-14.jsonl` (main checkout, gitignored; the S0 archiver's 10 s grid 09:29–09:31 ET at the real Monday open), next to Pyth's exact-T blobs in `data/archive/pyth/2026-09-{11,14}.jsonl`. Medians of the archived signer values:
  - 09:29:50 ET: every regular feed still holds Friday's value (TSLA 365.4859, NVDA 218.2457; 5 signers each).
  - **09:30:00 ET:** TSLA 359.6240 and NVDA 211.2848 (5 signers), AAPL 334.7497 (5), **MSFT 497.0529, META 658.8857, AMZN 253.2305, GOOGL 342.8923 with 3 signers**. At T the regular feed agrees with `---EXTENDED` (TSLA 0.04 bps, NVDA 0.9 bps).
  - 09:30:10 ET: all seven have 5 signers.
  - Pyth TSLA at the same T: 359.81147 (`35981147e-5`, conf 4.4 bps). RedStone vs Pyth 5.2 bps at the open, 0.2 bps at the Friday 09-11 close; both inside the 25 bps check band.
- **Rule:**
  - The Gap's Monday print uses the **regular** RedStone data feed id (`TSLA`, not `---EXTENDED`) at T + 0. Its label is "oracle price at 09:30:00 ET", the first regular-session print, not the opening cross.
  - A 3-package print is admissible only after `T + strict_sec` (300 s) and before T + 900 (prints.md §4.2), so a 3-signer open still records, later.
  - 6a re-reads the 09-15, 09-16 and 09-17 open rows before listing; a RedStone name lists for 09-18 only if every archived open had ≥ 3 signers at 09:30:00 ET.
  - **Q-S6-1 (default taken by the stage owner, pending the user):** list the six RedStone single-name Gaps for 09-18 on this evidence. **Disclosed risk:** MSFT/META/AMZN/GOOGL sat exactly at the 3-signer threshold on 09-14; a Monday with fewer than 3 voids that Window 0.5/0.5 with "missing print".
  - **Q-S6-2 (default, pending the user):** keep the TSLA RedStone check on the Gap (the same D-003 policy); a divergence voids honestly.
- **User-visible:** the Gap verdict says "oracle price at 09:30:00 ET" and names its source.
- **Approval:** stage owner on the spec defaults; the user may change Q-S6-1/Q-S6-2.

### D-053 — Spike (a) first: the token lane's oracle count decides its minimum and caps
- **Date / owner:** 2026-09-15 · S6 owner (spec §2.1)
- **Evidence:** C:13 saw Surge answer with at most 2 signatures on a Sunday and HTTP 500 above the maximum; the queue `EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7` has 9 oracles. `RawPrint.price` is `i64` and $360 × 10¹⁸ overflows it (spec §2.2).
- **Rule:**
  - **No program code before the spike.** 6b builds the four `switchboardSurgeTask { source: WEIGHTED, symbol }` feeds (TSLAX/NVDAX/SPYX/QQQX), pins each hash in `price-sources.json` `tokenLane.<xStock>.feedHash` (null until then; the lane stays unregistered while any is null), and fetches one quote over all four for n = 1…5 signatures on devnet.
  - It decodes the quote (distinct oracle indices, slot, values), checks each value against Jupiter `usdPrice` (< 1.5%; basis "TSLAx/USD per token, UI amount"), and measures transaction bytes, CU (ALT if > 1,232 B) and the v0 `.so` size with the crate on a Surfpool fork.
  - **Outcome:** `switchboard_min_oracles = min(3, observed max)`.
  - **Q-S6-4 (default, pending the user):** a 2-oracle lane is accepted only with token caps halved and "signed by 2 oracles" disclosed on receipts and the ticket; below 2, or failing quotes, the lane is paused honestly ("Paused: no signed price source").
  - This entry is amended with the observed maximum, the hashes and the measured sizes when the spike lands.
  - **Outcome (2026-09-15 06:37–06:43Z, weekday pre-market, 6b 7ccc0cc):** asking for 5 signatures returned 4 distinct oracles (indices 0, 1, 4, 6) every round; asking for 3 or 4 sometimes returned one short; 2 and 6 returned HTTP 500. The feed's `minOracleSamples` doesn't force a count. Signed slot age on arrival 1–14 slots; values 13–28 bps from Jupiter. **`switchboard_min_oracles = 3`**; the Q-S6-4 halved-caps path is not needed (weekends unmeasured: a weekend round below 3 pauses the lane honestly). The relay requests 5, refuses below the minimum, and sends at most 4 (5 signatures exceed 1,232 B without an ALT). Measured on LiteSVM with the real quote: 3 oracles × 4 feeds 1,022 B / 12,258 CU; 4 oracles + compute limit 1,173 B / 12,857 CU. Feed hashes pinned in `price-sources.json` `tokenLane`.
- **User-visible:** a token receipt names how many oracles signed it.
- **Approval:** stage owner on the spec default; Q-S6-4 is the user's to change.

### D-054 — Gap versions, lead, check-bound rule and the honest pre-deadline path
- **Date / owner:** 2026-09-15 · S6 owner (spec §1.2–1.6)
- **Evidence:** `window_rules.rs:60-62` freezes `open_deadline = lock_at` for `ADMIT_UNTIL_LOCK`, which `policy_rules.rs:61-63` accepts only on a Gap Series. The 09-18 Gap is `[1789761600 Fri 20:00Z, lock 1789948800 Mon 00:00Z, expiry 1789997400 Mon 13:30Z]`. Surfpool time travel moves only forward (D-027). The foundation's `policyVersions(…, "gap")` gives TSLA v1 Pyth open 4,294,967,295 / close 900 with the RedStone check 120/120, TSLA v2 RedStone, QQQ/VOO/NVDA v1.
- **Rule:**
  - **Versions:** no new versions in `price-sources.json`; a Gap Series registers its ticker's versions with the Gap open admission (the `gap` doc block).
  - **Coverage:** the 09-18 Gap is v1 on all nine; the 09-25 Gap is TSLA v2 only, QQQ/VOO "paused: no signed source".
  - **Roller (6a):** earliest `gapWindows` candidate with `W.tradingStart ≥ lastExpiry`, `W.lockAt − now ≥ 60`, `W.tradingStart − now ≤ ROLLER_GAP_LEAD_SEC` (172,800: the 09-18 Gap lists from Wed 16:00 ET), a covering version, and `now + 45 ≤ open_deadline`. **Check-bound exception:** a Gap past its check bound still lists and settles `single_source`, because the next candidate is a week away. Corporate skip on the Friday **or** the Monday ET date. One 256-node Book per Gap Series.
  - **Relay:** Gap slots ride the Regular `(source, T)` units; a RedStone open past the gateway's ≈ 24 h history posts from `print_archive` (6a `gap-slots.ts`). The settler is unchanged (void at `lock_at + 1` without an open print).
  - **Honest pre-deadline proof:** a LiteSVM replay of the real 09-11 → 09-14 weekend (archived Pyth blobs; TSLA 365.47600 → 359.81147, QQQ and VOO all settle Down) with the PD-6 lock race in both orders; a Surfpool forward time-travel drive on drive-only Series 901 (attested, labelled drive data); Gap Series registered on devnet and the 09-18 Windows listed.
  - **Q-S6-3 (default taken, pending the user):** run the overnight devnet Gap drive Thu 09-17 20:00Z → Fri 09-18 13:30Z on drive-only Series 902 (basis 1, the TSLA Pyth version, ≈ 0.24 SOL) with real prints: the only real-print devnet Gap settlement possible before submission, 6.5 h to spare.
- **User-visible:** `/markets` shows the Gap lane as Listed from Wednesday ("Monday Gap · calls open Fri 16:00 ET · locks Sun 20:00 ET · settles on the Mon 09:30:00 ET print").
- **Approval:** stage owner on the spec defaults.

### D-055 — The Switchboard print instruction and the in-place program upgrade
- **Date / owner:** 2026-09-15 · S6 owner (spec §2.2–2.3)
- **Evidence:** D-024 (devnet has no SBPFv3: every build is `--arch v0`; today's binary is 764,200 B). D-026 (`admin_set_authorities` replaces every field; the queue is the zero key with `min_oracles 0` until S6). solana-cli 3.1.10 auto-extends program data. Devnet rent 5,080 lamports/B (acceptance.md).
- **Rule:**
  - **Program (6b):** `agari-common` feature `switchboard` with `print/switchboard.rs` (`check_quote_ix`, `quote_print` pre-normalized to expo −8); `PrintError` gains five variants mapped onto the existing codes 6214–6218 (no new codes); `agari-events` `public_record_print_switchboard(ctx, which)` in the order admit → stack height → queue → `check_quote_ix` at `cur − 1` → `QuoteVerifier` → `quote_print` → record → emit. Layouts unchanged, so the upgrade is in place; the IDL gains one instruction.
  - **Upgrade (stage owner only):** `NO_DNA=1 anchor build --arch v0` (size and sha256 recorded); the new `.so` at `cDcHZ…` on a Surfpool devnet fork runs 6b's proofs and `pnpm drive:events` as the regression; devnet `solana program deploy --program-id <agari_events keypair> --upgrade-authority deployer --buffer <fresh buffer keypair>` (resume with the same buffer); dump and compare sha256; `pnpm codegen`; IDL republished via program-metadata (D-026); then `admin_set_authorities` with the **full** current set plus the queue and D-053's `switchboard_min_oracles`. Every step is an acceptance row.
  - **SOL:** buffer ≈ `.so` bytes × 5,080 lamports (≈ 3.9–4.9 SOL, refunded), extension ≈ 0.5–1.0 SOL kept; peak ≈ 5.5 SOL on the deployer.
  - **Q-S6-6 (default, needs the user):** ask for ≈ 15 devnet SOL to the funding inbox `5zjywmmJ…` before Wed 09-16 (Gap 2.12 + token 5.55 + float ≈ 3.5 + upgrade peak ≈ 5.5, ≈ 1 kept). Balances are re-read before any deploy.
- **Amendment (2026-09-15, 6b f44c69c):**
  - **Crate hardening:** switchboard-on-demand 0.13.0's `QuoteVerifier` panics on a SlotHashes or signing-key mismatch, and maps `oracle_idx % 30` (index 30 aliases oracle 0), never deduping. The handler runs named checks first: SlotHashes lookup, queue signing keys, index < 30; `quote_print` dedupes by index **and** signer key. prints.md §4.4 follows this order.
  - **Proof venue:** Surfpool's SlotHashes repeat one fake hash and are rewritten every block, so a live quote can't verify there. The spec row "Surfpool fork: the upgraded `.so` verifies a live quote" becomes: LiteSVM with a real devnet quote and queue dump (`events_switchboard.rs`, real ed25519 precompile) **plus** the first devnet print after the upgrade. Surfpool still runs `pnpm drive:events` as the upgrade regression.
  - **Measured:** the v0 `.so` is 804,480 B (sha256 `5dbaa7a2…25e6`); devnet holds 764,200 B, so the upgrade extends program data by 40,280 B (≈ 0.205 SOL kept) with a ≈ 4.088 SOL buffer (refunded). Dry run for 12 token Series: 5.554492520 SOL.
- **User-visible:** none until the token lane lists.
- **Approval:** stage owner on the spec; the SOL is the user's.

### D-056 — Token Series, Books, caps and the Jupiter fallback rule
- **Date / owner:** 2026-09-15 · S6 owner (spec §2.4–2.5)
- **Evidence:** 1,632 token Windows/day with Markets retained 6 h (`venue-spec.ts:13`); keyless Jupiter Price v3 allows 0.5 RPS (C:13 §5); appending a version moves every future Window of a Series and a Series holds at most 8 (`constants.rs:29`).
- **Rule:**
  - **Series:** TSLA/TSLAx 1, NVDA/NVDAx 2, SPY/SPYx 10, QQQ/QQQx 8 × 300/900/3,600, basis 2, two 256-node Books each: 5.554 SOL kept, ≈ 3 SOL steady float, ≈ 0.04–0.07 SOL/day fees.
  - **v1:** Switchboard primary, `feed_id` = the D-053 hash, min delay 10, admission 60/60, max slot age 20, no check, valid from the upgrade day, open-ended.
  - **Roller:** `tokenWindows` back-to-back, lead 120 s, no calendar; skipped only for multiplier changes and issuer halts. **Relay:** one quote per T at T + 10 for every due close slot, one retry on a stale slot with ≥ 5 s left; opens by `public_copy_open_from_prev`. A missed slot voids at T + 61.
  - **Maker:** 24/7, `MM_TOKEN_MAX_CASH_PER_WINDOW` 10 tUSDC (halved under Q-S6-4). **Chart spot:** Jupiter `usdPrice` for the four verified mints every 5 s, labelled "chart follows Jupiter"; it never settles anything.
  - **Jupiter attested fallback:** built and proven on Surfpool only ("Attested demo", median of T − 40/T − 20/T, ×10⁸ exact).
  - **Q-S6-5 (default):** no Jupiter demo version is appended on devnet unless D-053 pauses Switchboard **and** the user opts in.
- **User-visible:** "Settles on the Switchboard TSLAx token price observed ≤ 60 s after each boundary · chart follows Jupiter".
- **Approval:** stage owner on the spec defaults.

### D-057 — Halts, void reasons, earnings flags and the corporate-actions shape
- **Date / owner:** 2026-09-15 · S6 owner (spec §3)
- **Evidence:** no licensed halt feed exists (C:02 §B); `MarketResult` stores `VoidReason { None, MissingPrint, CrossCheckDivergence }` and the empty prints show the slot; Masayume's `ClaimWinnings.tsx:50-57` branches only on a loss, so a void shows the "You won" trophy.
- **Rule:**
  - **Halts (6c `halt-watch`):** in regular hours a Pyth tick with `conf × 10⁴ > price × 50` → `pyth-wide`, `publish_time` older than 15 s → `pyth-stale`; RedStone latest package older than 60 s → `redstone-stale`; xStocks `isMarketTradingHalted` (60 s poll) → `issuer-halt`; three failed token quotes → `quote-unavailable`. Effects: the roller opens nothing for that asset, the maker pulls, the ticket shows `halted`; nothing changes on chain.
  - **Q-S6-9 (default):** only `pyth-wide` and `issuer-halt` say "Trading halted"; the others say "Signed price stale".
  - **Void reasons:** Masayume's line first, verbatim ("Void — no reliable print, both sides pay 0.5"), then one reason line from core `voidDetail` (`missing-print` names the source, the boundary and the deadline; `cross-check-divergence` names the 0.25% band). A halt is never asserted as a verdict's cause. S5d renders the verdict and share card; 6d the claim card and row.
  - **Q-S6-7 (default, pending the user):** a void claim card shows the void stamp and "Returned" with the reason line, **not** Masayume's "You won" trophy (plan §7.4 #8, honest data); recorded as an Adapted row.
  - **Earnings (6c):** ops fetches Finnhub `/calendar/earnings` 14 days ahead once per 6 h (`FINNHUB_API_KEY` server-only, redacted); `earningsFlag` gives `earnings-session` / `earnings-gap`; a ticket warning line and `/session.earnings`; tighter caps are an S10 flag only.
  - **Corporate actions:** `corporate-actions.json` `skips[]` gains `lanes?`, a new `multipliers[]` holds `{ xstock, effectiveSec, from, to, why }` with decimal strings; core `skipApplies` matches Regular on the start date, Gap on the Friday or Monday, token on an `effectiveSec` inside the span. `scripts/drive/corporate-check.ts` proposes entries and never writes.
- **User-visible:** paused and halted lanes say why; a void names its reason; earnings days carry a warning.
- **Approval:** stage owner on the spec defaults; Q-S6-7 is the user's to change.

### D-058 — The holdings-aware hedge
- **Date / owner:** 2026-09-15 · S6 owner (spec §4; mints verified by the foundation)
- **Evidence:** public mainnet RPC `getMultipleAccounts` (2026-09-15): TSLAon `KeGv7bsf…ondo`, NVDAon `gEGtLTPN…ondo`, SPYon `k18WJUUL…ondo`, QQQon `HrYNm6jT…ondo` are Token-2022 mints with 9 decimals, matching metadata symbols and a `scaledUiAmountConfig` (e.g. NVDAon multiplier `1.0017152487959897`). The xStock mints were already pinned (D-011). Impostor tickers exist (C:13 §5).
- **Rule:**
  - **Reader (6d, `@agari/markets/holdings`, server-only):** Helius **mainnet** `getTokenAccountsByOwner` (Token-2022, jsonParsed), verified mints only (`SHARE_TOKENS`, keyed by mint), the effective multiplier (`newMultiplier` once `now ≥ newMultiplierEffectiveTimestamp`), integers only: `multiplierE12` (floored from the decimal string, which can carry 16 decimals), `sharesE8`, `exposureUsdE6` on ops `/prices/latest`.
  - **Route:** `GET /api/holdings?owner=` validates the owner, caches 60 s per owner, 30 requests/min per IP, stores nothing; the Helius URL is never logged.
  - **Card:** Masayume `SeasonBanner` anatomy under the `/markets` hero, only for a wallet with a verified holding; foot "Placed on Solana devnet with test tUSDC. It does not move, sell or protect your mainnet TSLAx. Not investment advice."
  - **Q-S6-8 (default):** stake preset `min(exposure × 1,000 / 10⁴, ticket max, tUSDC balance)`; the write is the unchanged S4 order lane.
- **User-visible:** a wallet holding TSLAx sees "12.5 TSLAx ≈ $4,497 of TSLA exposure this weekend" and one tap to a devnet Down or Gap hedge.
- **Approval:** stage owner on the spec defaults.

### D-059 — The S6 gate restated for the Friday deadline
- **Date / owner:** 2026-09-15 · S6 owner (spec clock facts, §1.6)
- **Evidence:** submissions close **Fri 2026-09-18 20:00Z** (09-18 is a Friday; the brief said Thursday). In EDT that is **16:00 ET**, exactly the opening boundary T (`1789761600`) of the 09-18 Gap Window, which then locks Mon 09-21 00:00Z and settles on the 09-21 13:30Z prints. The Pyth trial covers TSLA/QQQ/VOO boundaries through `2026-09-25T20:00Z`.
- **Rule:**
  - **No Gap Window can trade or settle before submission.** The plan's "RedStone Gap Window recorded on a real weekend" and "real-weekend token settlement" become **post-deadline evidence rows** in `acceptance.md`, never submission claims: the 09-19/20 token weekend, the 09-18 Gap open prints and 09-21 settlements, and the 09-25 lane switch (TSLA Gap on v2, QQQ/VOO paused).
  - **Pre-deadline gate:** full gate (`pnpm typecheck && pnpm invariants`, `pnpm build`, `NO_DNA=1 anchor build --arch v0`, clean codegen diff); the Gap LiteSVM real-weekend replay and lock race, the Surfpool Gap drive, Gap Series registered and the 09-18 Windows listed, the overnight devnet drive if Q-S6-3 stands; halt/void LiteSVM voids naming their reason; the Switchboard refusals (LiteSVM, then Surfpool on the upgraded `.so`); the program upgraded on devnet and ≥ 1 settled token Window per xStock on a weekday; every spec §5 state fixture-proven and browser-checked; the hedge reading a real mainnet holder and placing one devnet hedge.
- **User-visible:** the submission claims only what devnet shows before Fri 20:00Z.
- **Approval:** stage owner (a factual correction of the calendar, not a scope change).
### D-061 — The S7 contract and lanes; S7 starts before the S4 gate
- **Date / owner:** 2026-09-15 · S7 owner (foundation)
- **Evidence:**
  - `docs/plan/specs/vault.md` and `docs/plan/specs/tap-trading.md`: the spec architect's pass over Masayume `68f7a09` (`EventVault`, `VenueGateway`, `VaultTally`, the funding/trading/caps tests, `packages/markets/src/vault`, `web/src/features/{vault,session}`), the S4 head `c5ddb60` stubs and the web consumers, with file:line citations.
  - Plan §7.2 S7's precondition is S4. S4's code is merged (every lane box ticked). Its open items are the devnet drive, the browser pass and the tag, which need NYSE hours and a funded wallet, and no S7 file touches them.
  - The web already mirrors Masayume's vault and session surfaces file for file (tap-trading.md §4), and core `simulateCaps` plus its vectors are ported.
- **Rule:**
  - **Contract:** vault.md (program) and tap-trading.md (adapter, session key, sponsor, web, lanes) are frozen at this foundation. A change needs a D-entry; an IDL change after the 7a.1 freeze also needs a re-codegen before 7b continues.
  - **Branching:** `stage/S7-trading-balance` is cut from `stage/S4-first-call` @ `c5ddb60`. Nothing merges to `main` before the S1–S4 gates.
  - **Lanes:** 7a program (`slice/S7a-vault-program`, Surfpool 8980/8981), 7b adapter (`slice/S7b-vault-adapter`, Surfpool 8990/8991, DB `agari_s7b`), 7c web (`slice/S7c-vault-web`, web 3007). Merge order: foundation → 7a.1 → codegen → (7b ∥ 7c) → 7a → 7b → 7c. File ownership per tap-trading.md §6; the stage owner alone edits manifests, the lockfile, core ports and `vault/types.ts`, markets `env`/`index`, web providers and env, `services/ops`, invariants, deploy scripts, `Anchor.toml`/`Cargo.toml`, keypairs, deploys and `docs/plan`.
- **User-visible:** none yet.
- **Approval:** within plan r2 S7; the pre-gate start was directed by the session lead and keeps `main` untouched.

### D-062 — agari-vault account model: Masayume → Solana deltas
- **Date / owner:** 2026-09-15 · S7 owner (foundation; vault.md §1–3, spec Q-S7-3)
- **Evidence:** vault.md §1 table (each row cites `EventVault.sol`/`VenueGateway.sol`/`VaultTally.sol`); plan §3.2's vault row (`00-plan.md:367`); `events-engine.md` §4.3 (IOC with `withdraw_proceeds` leaves no seat credit) and §6 (PROGRAM seats); `events-instructions.md` §5.5 check 5 (a Ledger with a non-drained PROGRAM seat can't close).
- **Rule (amends plan §3.2's vault row):**
  - **Custody:** per owner, an SPL token account `["custody", owner]` owned by the `["seat"]` PDA, instead of 8 USDC shards. No shared write lock across owners; a bug is bounded to one owner.
  - **Positions:** 16 inline `PositionSlot`s in `VaultAccount ["acct", owner]` (1,160 B, ≈ 0.00654 SOL rent), instead of `VaultPosition` PDAs and `VaultWindow`. The tap path has no `init`, so the sponsor never pays rent. **Q-S7-3 answered: 16 slots** (32 would cost ≈ 0.0117 SOL); the settler cranks within ≈ 5 min of settle, so 16 open Windows per owner is the ceiling.
  - **Grants:** `Grant ["grant", grant_id u64 LE]` with a global `VaultConfig.next_grant_id` and `VaultAccount.active_grants[3]` (index = kind), instead of `["grant", owner, kind]` plus a nonce. The port routes by `grantId` alone; the owner comes from the Grant. Kinds are SESSION, EXECUTOR, STRATEGY (GAME_SESSION and CLAIM_ONLY are dropped; nothing in Masayume consumes them).
  - **Not on chain:** `VaultTally` (the indexer derives tallies from `Executed`/`Settled`, D-068); `sweep` (IOC + `withdraw_proceeds` keeps the seat's credit at 0, so `vault-sweep` refuses); `creditFor`/`creditPrivateFor` (no Masayume caller). The private bucket is built.
  - **No `product_add_dependent`** (amends plan §3.2's PD-7 line for the vault): a vault position lives in the PROGRAM seat, which already keeps the Ledger, Market and result alive until every slot is cranked. The vault never reads `MarketResult`.
  - **Settle delta:** a slot sold down to 0 still settles (pays 0, releases its grant counters). Masayume reverts `NothingToSettle` there and leaks `openPositions`; buys count exactly as Masayume, so every caps vector is unchanged.
- **User-visible:** a first-time Trading Balance costs ≈ 0.008 SOL of rent (+ ≈ 0.0015 SOL per grant), paid once by the owner; at most 16 Windows held through the vault at a time.
- **Approval:** stage owner on the spec defaults.

### D-063 — `program_authorities` fixed index table and `set-authorities`
- **Date / owner:** 2026-09-15 · S7 owner (foundation; vault.md §5.1, spec Q-S7-2)
- **Evidence:** `admin_set_authorities` replaces every field (`events-instructions.md:33-39`); `roller_open_window` pre-allocates PROGRAM seats from `program_authorities` (`roller_open_window.rs:169-174`); `venue-spec.ts:100` sets `pad([], 8)` and `ensure-config.ts:74` throws on any drift; S6 (Switchboard queue) and S8 (maker) also need the instruction.
- **Rule:**
  - **Q-S7-2 answered: a fixed table.** Index 0 agari-vault · 1 agari-maker · 2 agari-leverage · 3 agari-private · 4 agari-arena · 5–7 reserved. The entry is each program's `["seat"]` PDA. Programs still find their index at runtime, so a table change never needs a product upgrade.
  - **`scripts/deploy/set-authorities.ts`** (new, ensure-style, D-026 client): reads `GlobalConfig`, rebuilds `SetAuthoritiesArgs` from every current field, sets only its own index, passes `treasury = config.treasury`, signs as `deployer` (= `config.admin`), skips when identical, and refuses when the index holds a different non-zero key.
  - `venue-spec.ts:100` carries the table, so `ensureConfig` stops calling it drift.
  - **One writer at a time:** the S6, S7 and S8 stage owners serialize their runs; each run re-sends every field.
  - **Existing Windows:** Windows listed before registration keep whatever holds seat 0, so the vault refuses them with `WindowPredatesVault` (7207) and the UI says "Trading Balance opens with the next Window". Full coverage arrives after each Series rolls once (≤ 60 min).
- **User-visible:** for up to an hour after the vault registers, some Windows accept wallet orders only.
- **Approval:** stage owner on the spec default.

### D-064 — Vault error range 7000–7299 and the engine CPI client
- **Date / owner:** 2026-09-15 · S7 owner (foundation; vault.md §5–6)
- **Evidence:** engine errors occupy 6000–6307; a CPI failure surfaces as `Custom(code)` at the *vault* instruction's index, so overlapping ranges would force log parsing. Anchor 1.2's `declare_program!` reads `idls/<name>.json` from the nearest ancestor `idls/` directory and generates `cpi`, `accounts` (zero-copy types implementing `ZeroCopy`/`Owner`), `program`, `errors` and `events` (Context7 + `anchor-attribute-program` 1.2.0 source, stage-07 Findings). The path dependency with `features = ["cpi"]` shares the engine's state types with `load_checked`.
- **Rule:**
  - **Errors:** `#[error_code]` with explicit discriminants from 1000, so codes are 7000–7299: 7000 funding, 7100 grants/caps, 7200 trading/settle (vault.md §6 table). The adapter maps kinds per Masayume's `vault/errors.ts` (Insufficient → `insufficient-collateral`, 71xx → `grant-refused`, 7201/7207 → `market-not-trading`, 7202 → `not-settled`, 7203 → `already-claimed`, 7208 → `contract-revert`).
  - **CPI client:** (a) `agari-events = { path, features = ["cpi"] }` by default; (b) `declare_program!(agari_events)` over the checked-in IDL if (a)'s binary exceeds 600 KB. **7a supplies the evidence:** the v0 `.so` size of both options, recorded in vault.md §9 and the stage Findings. Option (b) needs an `idls/agari_events.json` beside the vault crate's ancestors (a copy of `packages/clients/agari-events/idl.json`, refreshed by `pnpm codegen`).
  - **Signing:** `CpiContext::new(events_program.key(), …).with_signer(&[&[b"seat", &[seat_bump]]])`; return data is read right after the CPI and its program id checked. No vault write happens before a CPI returns; loaders are dropped first.
  - **Outcome (2026-09-15, 7a ebf9259):** (a) is 516,904 B, (b) 513,056 B (22/22 vault tests, CU within 0.6%). **Keep (a)**: under 600 KB, and (b) saves 3.8 KB for a hand-kept Seat mirror. The default release profile stays; `opt-level = "z"` (427,904 B, −0.45 SOL rent, +8–12% CU) is not applied because CU headroom matters more to the sponsored fill than a one-time refundable deposit. S7 SOL budget ≈ 6 SOL.
- **User-visible:** none.
- **Approval:** within plan r2 S7.

### D-065 — Sponsor fee-payer co-sign policy (moved here from S4)
- **Date / owner:** 2026-09-15 · S7 owner (foundation; tap-trading.md §3, spec Q-S7-1)
- **Evidence:** plan §3.2 fees and gas (`00-plan.md:376-385`); D-023 (no Privy sponsorship; external wallets and session keys use `api/sponsor`); Masayume `SPONSORABLE_FUNCTIONS` (`M:packages/markets/src/vault/sponsor.ts:25-27`) and its per-signer/per-device gates (`M:F/session/sponsor.server.ts:21-23`); Kit 8.3 `partiallySignTransactionMessageWithSigners` accepts a plain-address fee payer and leaves its signature slot empty (stage-07 Findings). Q-S7-1: a fresh wallet at the D-012 0.02 SOL top-up enabling tap trading **without** a sponsor needs ≈ 0.0197 SOL.
- **Rule:**
  - **Flow:** the client builds a v0 message with fee payer = the sponsor from `GET /api/sponsor`, signs partially as the key (or owner), and posts `{ transaction, lastValidBlockHeight }` with `x-agari-device`. The server checks the policy, signs as fee payer only, stores a `sponsor_cosigns` row and returns `{ signature, transaction, instruction }`. **The server never sends**; the client journals `markSent` and sends on the S4 lane.
  - **Policy, in order** (pure `packages/markets/src/sponsor/policy.ts`, server subpath `@agari/markets/sponsor`): v0 with no address-table lookups (400); key 0 = sponsor with an empty slot (403); ≤ 2 signatures and the other one verifies (403); ≤ 3 instructions, ComputeBudget only within `SPONSOR_MAX_COMPUTE_UNITS` (≤ 400,000) and `SPONSOR_MAX_MICRO_LAMPORTS` (0 on devnet), exactly one agari-vault instruction in {`actor_place_for`, `public_crank_settle`, `owner_withdraw`, `owner_withdraw_private`, `owner_revoke`} and no other program (403); the sponsor in no instruction's account list (403); blockhash valid with ≥ 20 blocks left (409); `getFeeForMessage` ≤ `SPONSOR_MAX_FEE_LAMPORTS` 10,000 (403); simulation clean, units within the limit, sponsor delta ≤ fee (409); gates signer 30/h, device 60/h, device 5,000,000 and global 500,000,000 lamports/day, breaker below 200,000,000; an empty device id refuses (429/503).
  - **Keys:** `SPONSOR_PRIVATE_KEY`, else the `sponsor` role file (`AGARI_KEYS_DIR`), as D-034; `SPONSOR_RPC_URL` defaults to public devnet. Deposits and grants are never sponsored.
  - **Fallback:** a refusal returns null plus the reason; owner intents pay their own fee; a key tap is paid by the key when it holds `FEE_RESERVE_LAMPORTS`, else the ticket signs from the wallet.
  - **Q-S7-1 answered: the sponsor is on by default and the SOL faucet target stays 0.02** (D-012). The unsponsored enable folds the key's top-up (`SESSION_KEY_TOPUP_LAMPORTS`, 10,000,000) into the same one-signature transaction; the faucet target is raised to 0.05 only if the sponsor stays off.
  - **P-11:** `useSponsorStatus` fetches only while the enable or manage sheet is open or a key is armed.
  - The games route (S12) shares the `sponsor` role, not this policy.
- **User-visible:** tap trading needs no SOL in the key; three taps show zero wallet popups. When the sponsor refuses, the key pays (or the wallet signs) and the app says why.
- **Approval:** stage owner on the spec defaults, following the user's D-023.

### D-066 — The session key is a non-extractable CryptoKeyPair
- **Date / owner:** 2026-09-15 · S7 owner (foundation; tap-trading.md §2)
- **Evidence:** `@solana/keys` 8.3.0 `generateKeyPair(extractable = false)` calls `crypto.subtle.generateKey("Ed25519", extractable, ["sign","verify"])`; `createSignerFromKeyPair(keyPair)` signs with it. WebCrypto marks `CryptoKey` `[Serializable]` and structured clone keeps `[[extractable]]`, so IndexedDB (`idb-keyval` `set`) stores the key without exposing it. Ed25519 WebCrypto ships in Chrome 137, Firefox 129 and Safari 17; Safari's Ed25519 signatures are randomized (valid, but a re-sign changes the txid, which D-033's "never re-sign" already covers). The S1 web keygen exported PKCS#8 bytes (`web/src/features/session/keygen.ts:18-27`), and web may not import `@solana/kit`.
- **Rule:**
  - `@agari/markets` exports `generateSessionKey(): Promise<{ address, keyPair }>` (`sessions/session-key.ts`, added at this foundation; the signature is frozen). A `SessionSigner` variant `{ keyPair }` joins `{ wallet } | { secretKey }` (7b).
  - **Storage:** IndexedDB key `agari.sessionKey.<owner>`, record v2 `{ v: 2, address, keyPair, createdAtMs }`. v1 base58 records read as "no key" and the owner re-enables (devnet only, no migration). No IndexedDB → `STORAGE_UNAVAILABLE`.
  - **Invariant `session-key-non-extractable`:** `packages/markets/src/sessions/**` and `web/src/features/session/**` may not contain `exportKey(`, `extractable: true` or `generateKeyPair(true)`. It is `optional` only while the S1 keygen still exports its key (that one file is waived; every other file is held now); 7c's v2 store removes the waiver, and the S7 gate needs the rule to run, not skip.
- **User-visible:** the tap-trading key can't be copied out of the browser; clearing site data or forgetting the key ends tap trading on that device until re-enabled.
- **Approval:** within plan r2 S7.

### D-067 — Cash-out ports (L-35)
- **Date / owner:** 2026-09-15 · S7 owner (foundation; tap-trading.md §1.4, §5)
- **Evidence:** Masayume never built a sell (`M:F/how-it-works/content.ts:201-202`), and Q-001 says build Masayume's unfinished items; plan `00-plan.md:1001` ("no exit liquidity" when closed); core `exitWalk` (`core/market/book-math.ts:118`); `events-engine.md` §9 (outcome terms, `quote_stake` padding).
- **Rule (additive ports):**
  - **Core type** `ExitQuote { contractsRaw, limitPriceRaw (YES terms), expectedProceedsBase, minProceedsBase, avgPriceBps }`.
  - **Read port** `MarketsProvider.freshExitQuote(target: QuoteTarget, side, contractsRaw): Promise<Reading<ExitQuote | null>>`, null when nothing would fill.
  - **Write port** `CashOutRequest { market, side, contractsRaw, displayedExit, wallet, route? }`; `Submitter.submitCashOut(request, onPhase?): Promise<CashOutOutcome>`, where `CashOutOutcome` is `OrderOutcome` with the requote variant carrying `exit: ExitQuote`; `BookedOrder.proceedsBase?` (a sell books `costBase: 0`).
  - **Semantics (7b):** Up sells `SELL_YES` into bids, Down sells `SELL_NO` into asks inverted; `lots = min(held, filled)`; the own-terms limit is the last level reached minus `max(⌊p × 300 / 10,000⌋, 10)` ticks, floored at 1; `minProceedsBase = lots × limit_own × cu`. `filled == 0` → `no-liquidity` "No exit liquidity right now"; not Trading → `market-not-trading` "No exit liquidity: this Window has locked, it pays at settlement". Routes: wallet `user_place_order` (IOC, own seat, `use_credit false`, `withdraw_proceeds true`); `vault` `owner_place(is_buy false)`; `vault-grant` `actor_place_for(is_buy false)`, sponsorable. A fresh `minProceeds` below the displayed one → requote.
  - Also additive: `vault-deposit-and-grant.keyTopUpLamports?` (D-065).
  - Until 7b, `freshExitQuote` answers not-deployed and `submitCashOut` refuses not-deployed before anything is journaled (D-015).
- **User-visible:** an open bet shows "Cash out" before lock; it sells back to the book or says there is no exit liquidity.
- **Approval:** within plan r2 S7 (Q-001).

### D-068 — The settler cranks the vault seat; the indexer decodes vault events
- **Date / owner:** 2026-09-15 · S7 owner (foundation; vault.md §1, §5.1 step 5; tap-trading.md §1.1)
- **Evidence:** `venue-ops.md` §7:110 "a PROGRAM seat not drained → wait"; a vault slot drains only through `public_crank_settle` (vault.md §3.5), so without a crank a vault-touched Ledger never closes and its rent never returns; D-032's 300 s grace; Masayume's tallies came from `VaultTally` storage only because Somnia had no log history (`VaultTally.sol:7-10`).
- **Rule (amends venue-ops.md §7):**
  - **Settler:** after `resolved_ts + SETTLER_REDEEM_GRACE_SEC`, it sends `public_crank_settle` (its own role key as fee payer) for every owner with an unsettled slot on the Market, then closes the Ledger as today. Owners come from the index (`planVaultCranks(market)`, `ops/settle/vault-crank.ts`, 7b); the stage owner wires it into the settler.
  - **Indexer:** agari-vault joins the `logsNotifications` program set (`venue-ops.md:140`). `ops/indexer/vault-decode.ts` decodes the vault's `emit_cpi` events into `idx_vault_fills` / `idx_vault_settlements` (`packages/db/src/idx/vault.ts`), with the tally query and the unsettled-slots-by-market query.
  - **Read route:** `GET /api/index/wallet/:w/vault-tallies` feeds `listVaultTallies` (Masayume `VaultTally` fields).
- **User-visible:** a settled Window's Trading Balance credit arrives within ≈ 5 minutes even if nobody presses Settle; Trading Balance history shows per-Window results.
- **Approval:** within plan r2 S7.

### D-069 — `VaultDeployment` reshape, the vault program id, and the sponsored-fill gate row
- **Date / owner:** 2026-09-15 · S7 owner (foundation; tap-trading.md §1.1, §5)
- **Evidence:** Masayume's `VaultDeployment.forwarder` was the ERC-2771 forwarder, which Solana has no use for; the adapter needs the seat and config PDAs on every read; D-023 and D-035 moved "sponsored fill (fee payer = sponsor)" out of S4.
- **Rule:**
  - **Type:** `VaultDeployment { chainId, eventVault, seat, config, collateral, fromBlock }` (drops `forwarder`; `eventVault` is the program id, `seat` the `["seat"]` PDA, `config` the `["vault-config"]` PDA, `fromBlock` the deploy slot). `VAULT_NOT_DEPLOYED` = "agari-vault is not deployed on this cluster yet". The dev fixtures follow the shape.
  - **Program id:** `84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9`, from the create-once keypair `~/.config/agari/programs/agari-vault.json` (never regenerated). It is recorded in `anchor/Anchor.toml` `[programs.localnet|devnet] agari_vault` and `scripts/deploy/addresses.devnet.json` `programs.agari_vault.programId`; 7a's `declare_id!` uses it. `program-id-drift` now also holds Anchor.toml devnet == the addresses file for a program whose crate isn't written yet.
  - **Env:** `NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID` (markets `vaultProgramId`, web env, `web/.env.example`, `web/.env.local`). `resolveVaultDeployment(env)` returns null while it is absent (7b builds it; the foundation stub still returns null).
  - **Exports:** `@agari/markets/sponsor` (server-only; the root re-exports only `SponsorStatus`, which gains `reason?`) and `generateSessionKey` (D-066).
  - **Gate row moved here:** "sponsored fill (fee payer = sponsor)" becomes S7's "3 session taps with zero popups, fee payer = `sponsor`, signer = session key". This is the D-entry S4's "Sponsor → S7" step names.
- **User-visible:** none until 7b and 7c land.
- **Approval:** stage owner, following the user's D-023.
### D-071 — The S13 contract, lanes and default answers
- **Date / owner:** 2026-09-15 · S13 owner (spec architect pass, reviewed)
- **Evidence:** `docs/plan/specs/social-assistant.md`:
  - Code state at `c5ddb60`: Sensei, Room, Takes, alerts, news, reels and brain are already ported and signing works.
  - Gaps: `POST /api/room/bet` returns 503, so the bettors registry is never written; the Room gate only counts open lots; news is crypto RSS; Sensei lacks session/earnings/positions; alerts truncate to dollars; the marquee shows a failure headline off-hours; cashtags, ticker rooms, profiles, follows, the activity feed and notifications don't exist.
- **Rule:**
  - **Contract:** the S13 contract is the spec.
  - **Lanes:**
    - 13a Sensei;
    - 13b Room, Takes, Reels (plus ticker rooms and cashtags; the only lane editing `lib/copy.ts` REELS);
    - 13c news, alerts, marquee (plus the frozen Finnhub client);
    - 13d profiles, follows, activity feed, lifecycle notifications.
  - **Merge order:** 13c.1 → 13b.1 → 13a → 13c → 13b → 13d.
  - **Room gate:** the registry, then the index's "ever bet", then the on-chain seat; registry writes are verified against `idx_fills`.
  - **Data:** lanes write only social tables in the shared `agari` DB, never `idx_*`.
  - **Defaults** (spec §6, recommended; the user may change them):
    - Q-S13-1: crowd-flow sentiment from the index (`CROWD 62% UP`, `—` below 20 fills), not CNN Fear & Greed.
    - Q-S13-2: keep `generateText`.
    - Q-S13-3: the ticker-room gate is "ever traded that ticker".
    - Q-S13-4: moderation by rate limits only.
    - Q-S13-5: in-tab notifications only (Masayume parity); `/activity` is the durable record.
    - Q-S13-6: Finnhub free tier for the devnet demo, credited and disclosed in the README.
    - Q-S13-7: no free-text handles.
    - Q-S13-8: the second of S5/S13 to merge mounts the Friends tab.
    - Q-S13-9: one `EarningsEvent` type, reconciled with S6 at merge.
    - Q-S13-10: the shared DB.
- **User-visible:** stock news, a stock/session-aware Sensei, Rooms that stay open to anyone who bet, cashtag takes, profiles, follows, ticker hubs, an activity feed and in-tab notifications.
- **Approval:** stage owner on the spec defaults (user decisions Q-S13-1/5/6 flagged to the user).

### D-072 — Sensei refinements found in lane 13a
- **Date / owner:** 2026-09-15 · S13 owner (lane 13a report)
- **Evidence:**
  - Sensei's prompt style rule bans dashes in replies, and a dash in the prompt invites one.
  - 13c's Finnhub client makes one call per ticker from a web budget of 10 calls/min; ETFs never report earnings.
  - Latency on a production build, n = 20: p50 3,460 ms, p95 4,630 ms; in-session (synthetic snapshot) p50 3,655 ms, p95 4,996 ms.
- **Rule:**
  - **Session wording:** the prompt's session rule reads "09:30 to 16:00 ET" (no dash).
  - **Earnings:** the line asks for the seven registry stocks only (TSLA, NVDA, AAPL, MSFT, META, AMZN, GOOGL), cached 6 h, waiting at most 1.5 s. A null or late read renders "The earnings calendar could not be read this turn. Do not guess report dates."; "no earnings report within 14 days" appears only when a non-null list has nothing in range.
  - **Response mode:** Sensei stays non-streaming (`generateText`, Q-S13-2); the p50 ≤ 4 s gate is met.
  - **Off-hours:** a refusal still offers a Window read at the open.
  - **Rate-limit key:** the IP comes from `x-forwarded-for` (as `previewGate`); the host must overwrite that header in production (S16), and the 600/h house cap bounds cost meanwhile.
- **User-visible:** Sensei says when earnings are unknown instead of guessing; off-hours it points to the open.
- **Approval:** stage owner.

### D-073 — Switchboard prints: the recorder is gated until T+40 and the queue is verified (amends D-055)
- **Date / owner:** 2026-09-15 · S6 owner, from the security review of lane 6b's f44c69c
- **Evidence:** a Surge quote proves "these oracles ran the job around slot S", never "at T": with T+10 ≤ now ≤ T+60 and a 20-slot age bound, any validly signed quote from ≈ T+2 to T+60 was admissible and the first transaction to land chose the price; off-hours xStocks barely move and ties go Up. The crate's `QuoteVerifier` trusted every key slot below 30 (an expired oracle's slot could verify), the queue account was pinned by address only, and `switchboard_min_oracles` was unbounded.
- **Rule:**
  - `public_record_print_switchboard` takes a `recorder` signer; until `T + 40` the recorder must be a `config.attestors` key (6209 `UnknownAttestor` otherwise), after which the path is public as a liveness fallback. The relay signs token prints with the price-attestor role from T+10 and falls back to the public window at T+40 with one log line when the key is missing.
  - A direct Open print for Window N+1 is refused with 6228 `PrintNotAdjacent` while Window N's Close is recorded, so only `public_copy_open_from_prev` fills it; `prev_market` (`["market", series, index − 1]`) is required whenever `index > 0`.
  - `check_signers` refuses `idx >= min(30, queue.oracle_keys_len)`; the queue account's owner must be the on-demand program for the cluster and its discriminator `[217,194,55,127,184,83,138,1]`, checked in the print handler and in `admin_set_authorities` (new optional `queue` account); `switchboard_min_oracles` is bounded 1..=8 when a queue is set.
  - No new error codes; the IDL gains `recorder`, optional `prev_market` and optional `queue`.
- **User-visible:** none; token prints land from the attestor key, and price-attestor becomes a paying writer (≈ 0.04–0.07 SOL/day).
- **Approval:** stage owner, 2026-09-15.

### D-081 — Fidelity reconciled: Masayume exact where it exists, creative where it does not (amends D-036)
- **Date / owner:** 2026-09-15 · user (voice) + S18 owner
- **Evidence:** the user, testing while NYSE was closed: the app must never be empty, must carry real stock logos, and the news page and take cards should be designed "creatively" with 21st.dev; the D-036 replica rule had no answer for surfaces Masayume never had (a 24/7 crypto venue has no closed state).
- **Rule:** Masayume stays the authority for everything it has (chrome, modals, market cards, ticket, portfolio, tokens, type, spacing). Creative license, from 2–3 generated 21st directions with one chosen and recorded, applies to (a) surfaces Masayume never had (closed-market state, asset identity, ticker hub, activity, pre-open calls) and (b) surfaces the user flagged (`/news`, the take card and composer), implemented in Masayume's tokens. Byte-identical Masayume CSS values are never "inconsistency".
- **User-visible:** the app looks like one product; new states and the news/take surfaces gain their own design.
- **Approval:** user, 2026-09-15.

### D-082 — `/news` and the take card are redesigned (amends social-assistant.md §1.4 "layout unchanged")
- **Date / owner:** 2026-09-15 · S18 owner (lane 18d)
- **Evidence:** `NewsFeed.tsx` + `news.css` and `TakeReelCard.tsx` + `take.css` are byte-identical Masayume ports; the user finds the wire "not the way the card is"; `Article.symbols` is on the wire but never shown.
- **Rule:** keep the lead-plus-wire structure, `.news-page` tokens, mono meta, hairlines, display type, skeleton, poll and `Article` shape. Add sentiment-tinted edges, asset-mark chips with `$TICKER` cashtags, and one shared `.news-row` grammar used by `/news`, the activity feed and the ticker hub; the take chip carries the asset mark and a cashtag link. The direction is chosen from `21st generate --variants 3` and recorded here with its generation id and take number.
- **User-visible:** the news page and takes read as cards with the stocks on them.
- **Approval:** user (design scope), lane report for the chosen take.
- **Amendment (2026-09-15, lane 18d):** `21st generate` is locked on this account (`21st usage`: "21st AI generation: not enabled"; `generate` answers `ai_subscription_required`), so no generation id or take number exists. Three hand-drafted directions in Agari's tokens live in `web/../data/18d-directions/` on the 18d worktree (kept locally, gitignored; its README lists them with 390/1440 screenshots): V1 Ledger (dense rows, a 2 px tone edge on every row and the lead, aligned columns), V2 Broadsheet (airy rows, the edge only as the lead's top band), V3 Wire (timestamps, square tone marks, cashtag pills). **The user chose V1 Ledger with two tweaks on 2026-09-15:** cashtags into the meta line after the source, and under 640 px the tone moves to the meta row so titles keep their width. Built as `NewsRow` + `styles/news-wire.css` (S18d.4–S18d.7); the tone is a dot + word in place of the bordered pill; the row is a list item whose title is its only link (a row that is itself an anchor cannot carry cashtag links).

### D-083 — Cleanup scope for S18
- **Date / owner:** 2026-09-15 · S18 owner (lane 18e)
- **Evidence:** `21st review web/src`: 15 `a11y-interactive-div`, 10 `focus-outline-none`, 2 `a11y-autofocus`, 1 `responsive-fixed-width`, 3 `interaction-disabled-pointer`; the closed-market sentence is duplicated (`MARKETS.closedWindows`, `REELS.closed`); `useTickerNews` keys on `"masayume"`; 217 identity hits in 137 files.
- **Rule:** fix the review errors, the duplicated copy, the query key, user-visible identity strings outside `features/{pitch,demo}` (S15's), and knip-confirmed dead exports. Nav honesty first: every route of a deferred stage renders its existing "not live" state. Never touch `styles/yosuku/**` values, `components/ui/**`, or anything byte-identical to Masayume; review warnings on Masayume values are skipped.
- **User-visible:** keyboard-reachable cards, no stray Masayume wording.
- **Approval:** stage owner.

### D-084 — Scope cut for the deadline: S8–S12 and S14 deferred; W2 = S18
- **Date / owner:** 2026-09-15 · user
- **Evidence:** Fri 2026-09-18 20:00Z deadline; W1 (S5, S6, S7, S13) is gating this week; the always-on, pre-open-call, identity and editorial work is the user's priority over more programs.
- **Rule:** S8 (Earn maker vault), S9 (agents), S10 (specialist tickets), S11 (X + Blinks), S12 (games programs) and S14 (add-ons) ship after the deadline. Their web surfaces stay and render honest "not live" states. `00-plan.md` §7.3 waves updated. S15/S16/S17 follow S18.
- **User-visible:** those features show "coming soon" states rather than half-built flows.
- **Approval:** user, 2026-09-15.

### D-085 — Asset marks: real stock logos in Masayume's mark grammar (amends D-011)
- **Date / owner:** 2026-09-15 · S18 owner (lane 18c)
- **Evidence:** D-011 kept logos off as trademarks; the user asked for real logos everywhere ("a product, not a demo"); nominative use to identify the traded asset is standard brokerage practice; simple-icons publishes CC0 glyph paths and brand hexes for TSLA, NVDA, AAPL, MSFT, META, AMZN, GOOGL; no clean Invesco/Vanguard/SPDR SVG exists; `design-literals` scans only `web/src/{app,components,features,providers}` TSX.
- **Rule:** `Ticker.brand { slug, hex }` in `packages/core/src/market/tickers.ts` is the single source; `icons.css` mirrors `--brand-<slug>` and a vitest asserts they match. Marks are vendored inline SVG paths (`components/icons/asset-marks/`), drawn as Masayume draws BTC/ETH (`viewBox 0 0 32 32`, own brand-colour circle, white glyph). QQQ/VOO/SPY keep their monogram on the issuer colour. xStocks reuse the underlying's mark with an "x" badge. Canvas and OG code read `TICKERS[sym].brand.hex` by import. `THIRD_PARTY_NOTICES.md` gains an "Asset marks" section (simple-icons version pinned; marks identify the assets and imply no endorsement). No runtime fetch, no `remotePatterns`, nothing under `web/public/`.
- **User-visible:** every disc, the marquee, the ticker hub, Sensei cards, portfolio rows and share cards carry the real mark.
- **Approval:** user (logos), stage owner (sources).

### D-086 — Always-on data: the last price and the last session never disappear
- **Date / owner:** 2026-09-15 · S18 owner (lane 18a)
- **Evidence:** `services/ops/src/http/spot-sse.ts` drops quotes older than 60 s, so overnight `/prices/latest` can be `{}`; the spot feed is in-memory, so an ops restart leaves nothing until a source ticks; `print_archive` holds a signed 5-minute series per ticker per session (RedStone rows keyed by ticker) with no read path; the web hero chart reads only a Window's open/close prints.
- **Rule:** `/prices/latest` and the SSE snapshot never drop a symbol; rows carry `ageSec` and `fresh`; when the feed is empty the newest `print_archive` row is served with `source: "archive"`. A public index query `archive/<TICKER>?from&to` serves the archive series with `IndexQuery.cacheSec` = 60. The web's 1D history is the last regular session from the archive plus the live tick; daily closes derive from the archive's session boundaries. Closed surfaces label aged readings "last close · as of <time> ET", never through `StaleTick`, and poll at 60 s. Alpaca bars (`data.alpaca.markets`, `feed=sip` for history, keys server-only) are a stretch for longer ranges.
- **User-visible:** prices, change and a chart at any hour.
- **Approval:** stage owner.

### D-087 — Session words: pre-market, after hours, weekend and holiday are visible states
- **Date / owner:** 2026-09-15 · S18 owner (lane 18a)
- **Evidence:** `SessionState` already has `pre | post | holiday | closed | early-close | halted`, but `useMarketSession` flattens them to "Closed" and the raw enum leaks only on `/dev` boards (the user's "post stuff").
- **Rule:** `packages/core/src/copy/session-words.ts` (pure, tested) gives `sessionStateWord` and `sessionPhrase` ("Pre-market · opens in 1h 12m", "After hours · reopens Tue 09:30 ET", "Open · closes in 2h 05m"). The chip, marquee, hero foot and cards use them; the enum is unchanged. The chip mounts in the global header above 768 px.
- **User-visible:** the session state is a word and a countdown, everywhere.
- **Approval:** stage owner.
- **Amendment (2026-09-15, 18a 83404ea):** the header chip mounts from **1024 px**, not 768: at 768 the desktop nav already fills the bar and the chip pushed Connect off it; below 1024 the marquee's session cell carries the state. Verified at 390/768/1024/1440.

### D-088 — Pre-open calls: post-only orders may rest on a Listed Window; takers are refused
- **Date / owner:** 2026-09-15 · user ("trade in advance") + S18 owner; program change carried by lane 6b in its upgrade
- **Evidence:** `matching/place.rs:60-62` is the only pre-open refusal; `MarketStatus::Listed` is clock-derived and unused by any instruction; PostOnly walks `Walk::CrossCheck` and can never fill; cancel/reduce work in every status (D-009); escrow refunds through `evict.rs::remove_node`; the roller sweeps at lock; redeem folds `locked_cash` and the seat bond; 6121 is the next free code. A call resting until `lock_at` would be taken by the venue's own maker whenever fair drifted through its price mid-Window.
- **Rule:** `check_order` admits every order type while Trading, only PostOnly while Listed, and returns `PreOpenTakerRefused` (6121) otherwise; `expire_ts ≤ lock_at`, `check_mode`, seat funding and `MAX_OPEN_ORDERS_PER_SEAT` are unchanged; two crossing pre-open users get the existing 6109. The web's default expiry for a scheduled call is `trading_start + 90 s` ("fills within the first minute after the bell or your stake returns"); "rest until the lock" is an opt-in. Copy states: the wallet signs; the stake is held until fill, cancel or expiry; the 0.25 tUSDC seat bond returns after the Window settles; no fill is promised; the venue's maker or any trader may take a resting call at its price; nothing fills before the open boundary; an unfilled call loses nothing if the Window voids. LiteSVM covers rest, refusal, cross, fill at the resting price, cancel, and expiry → sweep → redeem.
- **User-visible:** "Schedule a call" on listed Windows while the market is closed; "Resting for the open" rows in Portfolio with Cancel.
- **Approval:** user (mechanism), 2026-09-15.

### D-089 — The seat maker's order type is a knob; post-only stays the default until the bell drive
- **Date / owner:** 2026-09-15 · S18 owner (lane 6a)
- **Evidence:** the seat maker quotes PostOnly and pulls inside the opposite best, so it can never fill a user's resting call; a Normal order that stops on FillCap cancels its remainder, which `window.ts` would record as `placed`.
- **Rule:** `MM_ORDER_TYPE=post-only|limit`, default `post-only`. With `limit` the maker quotes Normal orders, stops pulling inside the opposite best, keeps `cancelAll` before every requote and `selfMatch = CancelMaker`, `max_fills` 16, and reads `rested_lots`/`stop_reason` from `OrderExecuted` before marking a quote placed. The soak runs `limit` for the Thursday bell drive; it becomes the default after that proof.
- **User-visible:** scheduled calls can be filled by the venue's maker at the bell.
- **Approval:** stage owner; the default flip needs the drive's acceptance rows.

### D-090 — The roller prelists the first Window of the next session at the prior close
- **Date / owner:** 2026-09-15 · S18 owner (lane 6a)
- **Evidence:** Windows may exist up to `Series.max_lead_sec` 400,000 s ahead (Fri→Mon 235,800 s fits); each Series has two Books and both are free overnight; the 60m lane's first Window is 10:00–11:00 with an `Intraday` open (`windows.ts:44-57`), so an `openKind` trigger would skip it; a listed Window holds ≈ 0.0665 SOL (Market 456 B + Ledger 8,552 B + mvault 165 B), ≈ 1.8 SOL for 27 Series, refunded at `close_ledger`/`close_market`.
- **Rule:** with `ROLLER_PRELIST` (default on) and `ROLLER_PRELIST_CADENCES` (default `300,900,3600`), a Regular Series' first Window of the next session lists as soon as no session is live and `tradingStart − now ≤ maxLeadSec − PRELIST_MARGIN_SEC (3,600)`; halt, corporate, version and free-Book checks run after it; later Windows keep the 120 s lead; `grow()` runs on listed Windows too; the roller logs its SOL balance in the prelist state. Unfilled pre-open escrow returns via the lock sweep to venue credit, paid by the crank redeem; the settler crank-redeems zero-balance bonded seats so the Ledger can close.
- **User-visible:** tomorrow's first Windows exist tonight, so a call can be scheduled.
- **Approval:** stage owner; enabling on the soak needs the roller to hold ≥ 3 SOL.

### D-091 — Auto-fire from the Trading Balance is a follow-on; the grant gains a market scope before its first deploy
- **Date / owner:** 2026-09-15 · S18 owner (with S7)
- **Evidence:** `actor_place_for` is IOC-only and grants (`state/grant.rs`) carry money caps and expiry but no market or side scope; the vault is not deployed yet, so a layout change now costs nothing.
- **Rule:** before agari-vault's first devnet deploy, `Grant._reserved` becomes `market: Pubkey` (default = any; size unchanged; layout tests updated), `actor_place_for` checks it, the IDL/codegen and `GrantTerms.caps.market?` follow. An ops `opening-bell` actor that fires a user's pre-declared IOC at `trading_start` under a market-scoped EXECUTOR grant is recorded, not built.
- **User-visible:** none yet.
- **Approval:** stage owner.

### D-092 — S15 opens while S18's evidence collects
- **Date / owner:** 2026-09-15 · S15 owner
- **Evidence:** every S18 lane is merged (stage 810b87e, `integration/w1` b09eae9, served on :3000 and :3018); the three remaining S18 boxes are timed evidence (prelist 20:00Z, devnet Phase B + C 20:21Z, the Wed bell) and the gate, none of which any S15 deliverable depends on. The deadline is Fri 09-18 20:00Z.
- **Rule:** `stage/S15-public-story` is cut from `integration/w1` @ b09eae9 now; four lanes (15a landing + OG, 15b story pages, 15c README/notices/submission/docs, 15d compliance + brand) run in their own worktrees on disjoint files; the S18 owner role continues in the same session for the timed evidence. S18's parity rows still advance only at S18's gate.
- **User-visible:** the public story lands a day earlier.
- **Approval:** stage owner.

### D-093 — The landing page and OG images are Agari's own design in Masayume's tokens
- **Date / owner:** 2026-09-15 · S15 owner
- **Evidence:** Masayume's `web/src/app/page.tsx` redirects to `/markets` ("The landing page lands in Epic 4"); Masayume has no `opengraph-image` routes; Q-001 (2026-09-13) says build Masayume's unfinished items in its design language; D-081 makes surfaces Masayume never had creative surfaces.
- **Rule:** `/` is an editorial landing composed from existing Agari pieces (18a asset hero, 18c marks, `InstallCta`, the index proof reads) with copy in Masayume's voice and no new data path; OG images use `next/og` with the vendored fonts and marks. `R:yosuku/app/page.tsx` stays closed unless the user asks for that layout.
- **User-visible:** `/` stops redirecting; link previews show the wordmark, a ticker's mark and its last close.
- **Approval:** stage owner; the user may override the layout.

### D-094 — The docs site is a fresh `agari-docs` fork with only shipped surfaces documented
- **Date / owner:** 2026-09-15 · S15 owner
- **Evidence:** `masayume-docs` has 62 content files in nine sections; Agari ships S3–S7, S13 and S18 this week (D-084 defers S8–S12, S14); every fact must be rewritten and every capture retaken.
- **Rule:** lane 15c copies `masayume-docs` to `/Users/abu/dev/hackathon/agari-docs` with a fresh `git init`, rewrites start/trading/architecture/explore/help/status for Agari (new pages: sessions and lanes, pre-open calls, halts and voids), collapses games/agents/builders to one honest "after the hackathon" page each, and builds green. Deploy waits for the user's go in S16 (Q-S15-1).
- **User-visible:** a docs site whose every page is true for Agari.
- **Approval:** stage owner.

### D-095 — Geofence: US visitors browse; funded actions are read-only and server routes answer 451
- **Date / owner:** 2026-09-15 · S15 owner
- **Evidence:** plan §7.2 S15 "Compliance"; Next 16 replaced `middleware.ts` with `proxy.ts`; Vercel supplies `x-vercel-ip-country`.
- **Rule:** `web/src/proxy.ts` marks `US` requests (or `AGARI_REGION_OVERRIDE=US` locally) with header `x-agari-region: restricted` and a readable cookie `agari.region`; the client renders Masayume's disabled state with "Not available in your region" on the ticket, schedule, faucet, sponsor, private-desk and trade-from-x actions; `api/sponsor`, `api/faucet`, `api/private/*`, `api/x/*` return `451 { error: "region_restricted" }`. No header → open (local, ops). Markets, proof, news and portfolio reads stay open everywhere.
- **User-visible:** a US visitor can read everything and fund nothing.
- **Approval:** stage owner; the country list is the user's to change.
- **Amended 2026-09-15 20:50Z (lane 15d report):** exits stay open to held visitors: `api/private/cashout` and `api/x/unlink` answer as before, because taking money out or unlinking is not funding. `api/x/callback` stays open because it completes a flow `x/start` already held. The held set is `api/faucet`, `api/faucet/challenge`, `api/sponsor`, `api/private/open`, `api/x/bind`, `api/x/start`. Country list: US only until the user says otherwise.

### D-096 — Program credibility: verifiable builds and on-chain IDLs after tonight's upgrade
- **Date / owner:** 2026-09-15 · S15 owner
- **Evidence:** tonight's devnet sequence (20:21Z) upgrades `agari-events` (813,328 B, sha256 2e4bf8cc…) and deploys `agari-vault` (519,296 B, sha256 b6eab3a1…); Docker 29 is installed, `solana-verify` is not.
- **Rule:** after the sequence, the stage owner runs `anchor build --verifiable` for both programs, publishes both IDLs on-chain, and writes the deployed binaries' sha256, the build command and explorer links into the README. If the verifiable build cannot reproduce the deployed hash before Wed 20:00Z, the README states the measured hash and the exact toolchain instead, and the verified upload moves to S17.
- **User-visible:** a reader can check the program bytes against the source.
- **Approval:** stage owner.

### D-097 — The demo is recorded Wed after the bell drive; `/demo` is honest until then
- **Date / owner:** 2026-09-15 · S15 owner
- **Evidence:** plan L-13 "recorded Mon–Thu during market hours"; the S18 fills drive is Wed 13:30Z; the `direct-demo-video` skill is installed.
- **Rule:** the recording happens Wed 09-16 after the 13:30Z bell on `:3000` (Thu fallback); until `web/public/video/agari-demo.mp4` exists, `/demo` shows "Recording Wed 16 Sep during NYSE hours" with the proof table live. Provenance goes in `docs/submission/demo-media-provenance.json`.
- **User-visible:** no placeholder video, ever.
- **Approval:** stage owner.

### D-098 — Ops must exit when an actor fails to start; until it does, the health check watches for it
- **Date / owner:** 2026-09-15 · S18/S3 owner
- **Evidence:** on 09-15 the window-roller logged `failed to start: fetch failed ← getaddrinfo ENOTFOUND devnet.helius-rpc.com` at 19:09Z. The other actors kept the process alive, so `data/soak/run.sh` never restarted it, `/session` served `lanes: {}`, and the 20:00Z prelist did not run until ops was killed by hand at 20:25Z, 98 minutes later. The S3 gate re-measure found the same pattern at 18:47Z. A second case on 2026-09-16: the watchdog exited ops on a stuck seed-maker pass at 03:09Z and the supervisor restarted it, but on that boot the **indexer** failed to start with `write CONNECT_TIMEOUT localhost:5432` and stayed silent while every other actor logged; Postgres itself never went down. The index froze until ops was killed by hand at 03:17:28Z. So the rule covers any actor, not only the roller, and a silent actor hides behind a healthy-looking process.
- **Rule:** a start failure in any actor is fatal: ops logs it and exits non-zero so the supervisor restarts the whole process, with the supervisor's existing 10 s sleep as the backoff. **Built 2026-09-19** (`main.ts` `boot()` exits 78 with the reason in the log; the deadline moved to 09-25, so the crash-loop worry of the night-before no longer applies). It deploys with the next soak tag after the OPENAI three-Window proof; until that restart the hourly health check keeps its `failed to start` grep and the `/session` lanes check.
- **User-visible:** an outage in one actor stops the venue rolling until someone notices; the checks cap that at an hour.
- **Approval:** stage owner.

### D-099 — A quote-source outage must not be able to deadlock a token lane
- **Date / owner:** 2026-09-16 · S18/S6 owner
- **Evidence:** Switchboard's gateway has returned `Gateway.fetchSignaturesConsensus failed (status 500, ERR_BAD_RESPONSE)` since 05:50:16Z; a read-only `fetchTokenQuote` probe still got 500 in 3.3 s at 14:36Z. `QUOTE_FAILURES_TO_HALT = 3` flagged every xStock `quote-unavailable` at 05:50:59Z (`confirmPasses = 2`), pausing all 12 token lanes. Clearing requires `tokenHaltReason` to return null → streak < 3 → `recordQuoteResult(..., true)`, which only the relay's Switchboard pass calls, and only for a due print slot on a live token Window. The roller opens none while halted, so after the last Windows expired at 11:51Z no quote was ever attempted again: 529 minutes halted, 0 token Windows open, and the lane would stay paused even after the upstream recovered. Regular lanes were unaffected throughout (today 150 resolved / 2 voided, against the token lanes' 54 / 302).
- **Rule:** the halt must be able to clear without a successful print quote. Either halt-watch ages an untested streak out (no quote attempted for N minutes → treat as unknown, not halted), or the relay probes the quote source on a timer while a lane is halted and reports the result through `recordQuoteResult`. **Built 2026-09-19, the probe:** `xstocksToProbe` names every xStock whose streak sits at the halt threshold with no quote attempt for 5 min; the relay's Switchboard pass fetches a read-only quote for their Surge symbols on every pass that finds one due (even with no slot to print) and reports it exactly as a print's quote would, so the halt clears through halt-watch's normal two-observation confirm when the gateway recovers and stays while it does not. Aging the streak out was rejected: it would reopen Windows that void during the outage, the very cost this entry warned about. Deploys with the next soak tag after the OPENAI three-Window proof. **Measured again 2026-09-19 11:37Z:** the gateway still answers 500 (`Gateway.fetchSignaturesConsensus failed`, 174 ms, for one symbol and for four), and the live soak's last quote attempt was 10:40Z — `quoteFailures` sits at exactly 3 for TSLAx, NVDAx and SPYx with nothing since, which is this entry's stuck state, observed. **So the soak-8 cutover is held:** a restart clears the in-process streaks, the roller opens xStock Windows again, and they void on missing prints within minutes — the cost this entry already warned about, and a dry boot of the new build confirmed it (`DRY roller_open_window TSLAx-5m opening #111`). The halted lanes are behaving correctly meanwhile: they say `quote-unavailable` instead of listing Windows that would void. The fix deploys at the next restart that is not during an outage. **Operationally until then:** a halted token lane is cleared by an ops restart (the streaks are in-process), but **only after the upstream recovers** — restarting during the outage reopens Windows that void on missing prints within minutes and burns roller float for nothing. Cost of the restart: one `pkill -f 'src/main.ts'`, the supervisor relaunches with the same env; no code or config change.
- **Also recorded:** the `xstock-spot` Jupiter timeouts are a separate, cosmetic fault and did **not** cause this halt (an earlier STATUS note wrongly said so). That poller feeds the chart, the token maker's reference and the opt-in attested fallback, and never settles anything; it polls the keyless lite endpoint (0.5 RPS) every 5 s with a 5 s abort. Fix: set `JUPITER_API_KEY` in the ops env or slow the poll to match the keyless rate.
- **User-visible:** token markets stop listing during a quote outage and say so, instead of listing Windows that would void.
- **Approval:** stage owner.

### D-100 — The PreStocks bounty track is a Pre-IPO lane on the attested print path, not a new program
- **Date / owner:** 2026-09-18 · S18 owner
- **Evidence:** the venue already deploys `public_record_print_attested` with `config.attestors` carrying the price-attestor `BCK1izTw…`; PreStocks publishes a keyless catalogue of eight pre-IPO tokens with a `markPrice` (the SPV's valuation) and a `tokenPrice` (what the token trades at on Solana).
- **Rule:** the Pre-IPO lane is a Series like any other — `SOURCE.attested`, 60 s bars, a 10 s correction delay — so PreStocks support costs a configuration change and two files, no program change and no redeploy. The lane prints `tokenPrice`, the only price a holder can realise; `markPrice` rides along for the UI. Agari does not trade the PreStocks token: it runs Up/Down markets **on** its price, which is what a prediction venue can honestly offer against a pre-IPO name.
- **User-visible:** OPENAI first. Any of the eight can be listed by ticker id without touching the program.
- **Approval:** stage owner, on the user's choice of the PreStocks + Pyth lanes.
- **Measured 2026-09-19 02:42–02:44Z (4 samples, 136 s, overnight in the US):** `markPrice` was frozen for 7 of the 8
  names while `tokenPrice` moved for 5 of them — OPENAI fell 1,138.42 → 1,123.65, about 1.3% in two minutes. This is the
  data behind printing `tokenPrice`: the mark is an SPV valuation that barely updates, so a lane settling on it would
  return FLAT almost every Window. It also shows the token price is genuinely live outside US hours, because it is an
  on-chain DEX price, which is what makes a 24/7 Pre-IPO lane meaningful rather than a lane that idles overnight.
  Liquid enough for a 5 m cadence: OPENAI, ANTHROPIC, NEURALINK, ANDURIL, POLYMARKET. Quiet over the same window:
  FIGUREAI, KALSHI, SPACEX — those would settle FLAT more often, so OPENAI stays the first listing.

### D-101 — The Pre-IPO lane runs attested-primary with no cross-check, and says so
- **Date / owner:** 2026-09-18 · S18 owner
- **Evidence:** every other lane carries a second source (Pyth ↔ RedStone, Switchboard) and voids on divergence. No second venue publishes a pre-IPO mark for OpenAI, so a check source would void every Window. (Amended 2026-09-19: Jupiter quotes the same mint, so a second *read* of the token price exists, but it is the same DEX liquidity through another router, not an independent source; using it as the check would only ever agree with itself and would not be the redundancy the equity lanes have.) `validate_policy_version` (policy_rules.rs §4) admits `Source::None` **only** when the check policy is the zero default and `max_divergence_bps` is 0 — the shape this lane uses.
- **Rule:** what a Pre-IPO settlement trusts is the venue's own ed25519 signature over the 158 B `agari-print-v1` message, not PreStocks. The README and the lane's UI must say that plainly rather than implying oracle-grade redundancy the lane does not have. A single-source lane is honest; a single-source lane pretending to be checked is not.
- **User-visible:** the Pre-IPO lane is labelled single-source and attested by Agari.
- **Approval:** stage owner.

### D-102 — A pre-IPO name is a first-class registry ticker with no exchange listing
- **Date / owner:** 2026-09-19 · S18 owner
- **Evidence:** a Series only rolls in ops and lists in the app if its on-chain `ticker` resolves through `SYMBOL_BY_SERIES_ID`, which is built from `TICKERS` in three places (`ops/venue.ts:51`, `runtime/accounts.ts:61`, `ops/indexer/rpc.ts:50`). The roller drops a null-symbol Series silently (`window-roller/execute.ts:57`), the relay does the same (`price-relay/tracker.ts:36`), and the app drops a null-symbol row (`provider/rows.ts:29`). So `PRE-OPENAI-5m` (ticker 910) was invisible everywhere. The registry assumed every asset is exchange-listed: `alpacaSymbol` and `pythFeedId` were non-nullable and `kind` was `"stock" | "etf"`.
- **Rule:** model the asset honestly rather than faking a listing. `kind` gains `"preIpo"`; `alpacaSymbol` and `pythFeedId` become nullable; a new `preIpo: { symbol, mint }` field carries the PreStocks token, null for every listed ticker. OPENAI joins `TICKERS` at series id 910 with `launch: false`. The four call sites that assumed a Pyth feed now include it only where it exists. A test asserts the rule from both sides: every listed ticker has a well-formed Pyth feed and an Alpaca symbol, and every pre-IPO name has neither, nor a RedStone feed or an xStock.
- **Rejected:** a placeholder Pyth feed id to satisfy the old type. It would be a lie in the registry, and `symbolOfPythFeed` could match a real feed against it.
- **Hazard:** this step alone must not reach the running ops. Once 910 resolves, the roller opens OPENAI Windows and the relay routes their attested slots to `attest-sign.ts`, which values them from RedStone, finds none, and voids every Window. It ships together with the PreStocks relay pass.
- **User-visible:** none yet; the lane appears once the relay pass lands.
- **Approval:** stage owner, on Abu's direction to make the Pre-IPO lane usable in the app.

### D-103 — A pre-IPO name lists only on the 24/7 lane; Regular and Gap refuse it everywhere
- **Date / owner:** 2026-09-19 · S18 owner
- **Evidence:** once OPENAI resolved in `TICKERS` (D-102), the roller would discover the drive-only Series 910 (basis Regular) from chain and open Windows on it at Monday's bell; the relay would value their attested slots from RedStone, find none, and void every one. `parseLaneKey("OPENAI-5m")` also returned Regular, so `landing/data.ts` and `lanes/next-window.ts` would have computed NYSE windows for a name with no NYSE session.
- **Rule:** one predicate in core, `laneListable(symbol, basis)`: a `kind === "preIpo"` ticker is listable only on the token lane. The roller (`window-roller/execute.ts`) and the maker (`market-maker/seat/index.ts`) filter Series through it; `laneKey` returns an off-lane key `#SYMBOL-basis-cadence` for a refused pair, which `parseLaneKey` answers with null; a bare pre-IPO symbol (`OPENAI-60m`) parses as its token lane. The 24/7 planner still needs a lane-asset notion beyond xStocks (Step 3 of the plan).
- **User-visible:** none until the 24/7 OPENAI Series exists; then it appears under the 24/7 tab and nowhere else.
- **Approval:** stage owner, from the approved 2026-09-19 plan (Step 0.3, "never cut").

### D-104 — Sensei is told what the wallet holds, as a fact with one use; its per-turn block grows from 2 KB to 2.5 KB
- **Date / owner:** 2026-09-19 · S18 owner
- **Evidence:** the approved plan's Sensei note ("holdings summary in `useSenseiContext.ts`; `ADVICE_TRIPWIRE` unchanged; add turn tests"). Measured: the S13 per-turn block already sat at ≈2,007 bytes at its ceilings (eight positions, four Windows, the full earnings list), so no holdings line fits under the 2 KB guard, not even one row; four rows at their own ceiling add ≈390 bytes.
- **Rule:** the request carries `holdings` (≤ 4, largest value first; name, symbol, issuer, token amount as text, integer `valueCents` or null when the only price is stale; never the wallet or a mint), read from the same TanStack entry the cover card and "Your stocks" use, only while the drawer is open and a wallet is connected. The turn line states it as a fact ("real tokens, read-only, not test funds") with the one allowed use: a DOWN Window on that name is cover with test funds, UP adds to it, "never advise on the tokens themselves". `ADVICE_TRIPWIRE` is unchanged (adding "tokens" would trip Agari's own "buy Up tokens"); the system prompt's advice line still refuses real-money advice. The block's ceiling test moves to 2,560 bytes with four holdings included.
- **User-visible:** with a wallet that holds a recognised stock token, Sensei can say "you hold 4.2 OPENAI; a DOWN Window on OpenAI is cover" instead of not knowing; asked whether to sell the token it still refuses in one sentence.
- **Approval:** stage owner, from the approved 2026-09-19 plan (engineer notes, Sensei).

### D-105 — A stock token that has barely moved is never offered a cover bet, and the threshold is measured
- **Date / owner:** 2026-09-19 · S18 owner
- **Evidence:** the approved plan §2, from the user's own instinct ("if the stock isn't moving you're not in danger, don't suggest it") and the 09-19 measurement: SpaceX traded $8,708 in a day and did not move at all over five minutes, Anduril and Figure AI likewise, while OpenAI and Anthropic moved. Agari resolves a flat Window as Up (`resolve_rules.rs:49-50`), so on a token that does not move, Down loses almost every time; offering it as "cover" would be selling a holder a bet the house nearly always wins.
- **Rule:** `/prestocks/latest` now reports `move` per name — window, sample count, high-to-low `rangeBps` and first-to-last `changeBps`, all integer basis points over the samples the feed still holds (≈ 2 h). The web calls a name **calm** at `rangeBps < 20` (0.2%) with at least 15 minutes of samples (`web/src/features/hedge/calm.ts`). A calm name is skipped by `pickAllHedges`, so it never appears on the cover card or in Reels; "Your stocks" states the fact instead ("SpaceX has barely moved in the last 2 h. Nothing to cover right now."), and the card's new `calm` teaser state says the same. A name that is not calm shows what it did move ("Moved 2.3% high to low in the last 2 h"). Nothing is hardcoded per symbol: a name that wakes up is offered cover on the next read, and a name that goes quiet stops being offered, with no deploy.
- **Why not a hardcoded list:** the plan's table was one measurement on one day. A list would be wrong within a week and would have to be maintained by hand; the feed already knows the answer.
- **The drop bell is unaffected:** it states a fact ("SpaceX fell 3.4% in the last hour"), it does not offer a bet, so it stays available on a calm name — that is exactly when its holder would want to hear from it.
- **User-visible:** a holder of a quiet token is told the truth rather than shown a Down bet; a holder of a moving token sees how much it moved.
- **Approval:** stage owner, from the approved 2026-09-19 plan (§2, "decided by measurement, not by my opinion").

### D-106 — The unit is tUSDC and keeps its casing; the app does not explain or justify the currency
- **Date / owner:** 2026-09-19 · feedback pass on `integration/w1`
- **Evidence:** the user's first note: the unit read as "USDC" and as "TUSD". A runtime walk of text nodes on `:3000` found the cause of the second reading: ported label classes carry `text-transform: uppercase`, so "tUSDC" rendered as "TUSDC" (another, real token's name) on the ticket, the Lucky stake, the parlay and range place buttons, the balance plate, the earn withdraw button and the strategies desk.
- **Rule:**
  - **Collateral:** unchanged from D-026: tUSDC, Agari's own 6-dp SPL mint on devnet, minted by the faucet. `config.collateral_mint` is set at init and every vault is bound to it, so another mint means a fresh venue; a mainnet venue would be initialised with USDC.
  - **Casing:** the symbol never uppercases. `.sym { text-transform: none }` (`styles/tokens.css`), `<KeepCase>` for a symbol inside an uppercased label, `<Money>` carries it, and the two bare unit slots (`.tk-amount-unit`, `.lk-stake-unit`) stop uppercasing. A deliberate deviation from the reference's label style (D-081): a token's name is not decoration.
  - **No explanation in the product.** A first version of this pass added a "What is tUSDC?" section to the add-funds modal, tooltips on the pill and the ticket unit, an FAQ entry ("Why not bet in SOL, or in Circle's USDC?") and a docs section. The user's call the same evening: "who cares about using USDC or not USDC … you don't have to mention it at all." All of it is removed (modal, tooltips, FAQ, docs). The existing FAQ line "What currency does Agari use?" is the reference's own and stays as it was.
- **For the record, not for the UI:** Circle's public faucet gives "20 USDC on testnet every 2 hours, per address, and per blockchain", behind reCAPTCHA, web only (faucet.circle.com, read 2026-09-19), and only Circle can mint USDC, which is why the faucet and the house maker run on a mint of our own. The tUSDC mint has no Metaplex metadata (`BVgYScK2…` does not exist); the mint authority is ours, so one devnet transaction would add a name, symbol and icon if the user ever wants wallets to stop showing an unknown token.
- **User-visible:** the unit reads "tUSDC" everywhere, never "TUSDC". Nothing else changed about money.
- **Approval:** the user, 2026-09-19.

### D-107 — Code and copy name what the venue lists; a gate rule keeps the reference's assets, brand and chain out
- **Date / owner:** 2026-09-19 · feedback pass on `integration/w1`
- **Evidence:** the user opened `/games/lucky` and saw BTC. The 09-15 identity audit grepped `masayume` only and deferred the games copy (D-084); nobody had searched for assets. Full list in `docs/plan/audits/venue-identity-2026-09-19.md`. Four of the leftovers were functional: Lucky drew from `["BTC","ETH"]` and could never be dealt a Window; the parlay preset filtered for BTC Windows and always refused; the X reply named an asset only when it was BTC or ETH, so every stock receipt lost its ticker; the X permission panel linked Solana signatures to the Somnia explorer.
- **Rule:**
  - **Lucky policy v2:** the draw is over `[...LAUNCH_TICKERS, "OPENAI"]` (the nine Regular-lane names, then the one live 24/7 pre-IPO lane). Order is part of the policy, so a name is only appended under a new version. The browser check now pins the list to the policy version (`luckyPolicyAssets`), so a server cannot steer the draw by reordering it; a seed sealed under a retired version is refused at reveal. Outside regular hours the stage says, before the reels move, that only OPENAI trades.
  - **Parlay:** the one-tap streak names the stock with the most Windows live.
  - **Words:** "gas" becomes "network fee" / "SOL for fees" in copy (identifiers such as `out-of-gas` stay); "testnet" becomes "devnet"; "A duel on Masayume" becomes "A duel on Agari"; strategy descriptions name "each listed stock".
  - **Price scale:** the reference drew whole dollars from $1,000 up, which suited BTC and ETH. OPENAI trades near $1,130 and settles to the cent, so the Reel asked "Will OPENAI be above $1,132?" for a line of $1,132.74, and Sensei was handed $1,133. `WHOLE_DOLLARS_FROM` is now $10,000 (`hero/units.ts`, shared with `sensei/units.ts`, equal to the range ticket's band threshold), so every listed price and line carries its cents; the Range and Moonshot tickets show the opening print with cents too.
  - **Sensei's hours:** its system line said Windows list only in the NYSE session, which contradicted a live OPENAI Window in the same turn's data. It now names the lanes that never close.
  - **Guard:** invariant `venue-identity` fails the fast gate on BTC, ETH, Bitcoin, Ethereum, Masayume, Yosuku, Somnia, DreamDEX, Flicky or `shannon-explorer` in non-comment, non-test code under `web/src`, `packages/{core,markets,db,brain}/src` and `services/ops/src`. `venue-identity.allow.json` holds the four deliberate lines, each with a reason; a stale entry fails the rule.
- **User-visible:** no crypto asset appears anywhere in the app; Lucky, the parlay streak and X replies work on stocks.
- **Approval:** stage owner, from the user's 2026-09-19 instruction to look beyond the two places named.

### D-108 — `agari-parlay`: legs are decided in the order their Windows close, and the stale sweep cannot void an answered ticket
- **Date / owner:** 2026-09-20 · S10a on `integration/w1`
- **Evidence:** the reference's `resolveLeg` lets any pending leg be settled in any order, a lost leg kills the ticket and a voided Window refunds it. So a ticket with one lost leg and one voided leg ends Lost or refunded depending on which is cranked first, and the crank is permissionless: the owner can always reach for the voided leg. Separately, `agari-range`'s `public_void_stale` checks only the clock (`now > expiry + 3,600`), so a winning round nobody settled within the hour can be voided by anyone, and the people with a reason to are the providers it was about to cost.
- **Rule:**
  - **Order:** `public_resolve_leg` accepts only the pending leg with the earliest boundary, lowest index first on a tie (`ParlayTicket::next_leg`); any other leg is `LegOutOfOrder`. This is exactly what a prompt keeper would have produced under the reference, with the dependence on who cranks removed. `nextParlayLegIdx` in `packages/core/src/parlay/order.ts` mirrors it and the slip offers Settle on that one leg.
  - **Idempotent cranks:** a finished ticket or an already decided leg is a no-op, as in the reference, so two cranks racing never fail each other. A Window that has not settled refuses with `LegNotSettled`.
  - **Stale sweep:** `public_void_stale` takes the Market of the leg that is next to be decided and refuses with `MustResolve` while the venue holds that Window and has resolved or voided it. It voids only what the venue cannot answer: a Window still waiting on its print, or a Market account the engine has closed. `VOID_GRACE_SEC` is 3,600 past the ticket's last boundary.
  - **Owed to S10b:** port the same guard to `agari-range`.
- **User-visible:** on a multi-leg ticket only the next leg shows Settle; a settled leg waiting its turn reads as settling.
- **Approval:** stage owner. Deviation from the reference, recorded for the user's override.

### D-109 — `agari-parlay` prices a leg from rested depth only; the oracle fair-value bound of PD-2 is not built
- **Date / owner:** 2026-09-20 · S10a
- **Evidence:** plan PD-2 asks for (a) orders rested `min_rest_slots`, (b) a bound against an independent oracle fair-value model with refusal on disagreement, (c) the reference's caps. (b) needs a live price inside the open transaction, which means a Pyth or Switchboard update posted alongside it; nothing on chain holds a spot between boundaries. `agari-range` shipped without (a) or (b): it prices on `market.last_price`.
- **Rule:**
  - **Built:** (a) via `agari_common::book_walk::outcome_levels` with `rested_only`, at `max(series.min_rest_slots, params.min_rest_slots)`; a depth floor `price_depth_raw` and never less than the payout, so a spoofed offer must be large and must sit takeable for about 20 s; (c) the per-ticket, exposure and per-boundary caps, `min_combined_prob_raw`, the margin and the correlation floor. An optional spread guard (`max_spread_ticks`, refusing a one-sided or wide book) is in the program and ships **off**: on a one-sided devnet book it would refuse every leg.
  - **Not built:** (b). The caps bound the loss to a manipulated book. On devnet that is test money; before mainnet the bound is required.
  - **Same arithmetic both sides:** levels are scaled to the client's own units (`ticks × tick_base`, `lots × lot_base`) before the VWAP, so `quoteParlayOnchain` and the program run one algorithm over the same integers. Ticket 1 was worked by hand, quoted and booked at the same 1,892,800.
- **User-visible:** right after the maker requotes, a leg is refused as thin for about 20 s. That is the filter working.
- **Approval:** stage owner. A recorded gap against the plan, not a silent one.

### D-110 — Per-boundary locks are 32 slots in the parlay reserve, not a PDA per boundary
- **Date / owner:** 2026-09-20 · S10a
- **Evidence:** `agari-range` keeps an `ExpiryBook` PDA per boundary, which suits a round with one boundary. A ticket touches up to four, each needing an init-if-needed account at open and again at every crank; the plan's own row for `agari-parlay` specifies `expiry_locks[32]` in the Reserve.
- **Rule:** `ParlayReserve.expiry_locks: [ExpiryLock; 32]`. A slot with nothing locked is free whatever instant it names, so slots recycle without a sweep. A ticket locks each distinct boundary once however many legs share it, as the reference's `seenBefore` does. A thirty-third live boundary refuses with `TooManyExpiries`. `public_resolve_leg`, `public_void_stale` and `public_claim_parlay` need no boundary accounts at all.
- **Known limit, seen on devnet 2026-09-20:** as in the reference, a ticket's boundary locks are released only when the whole ticket ends. Ticket 5's leg on the 07:00Z boundary won and the ticket lives on until Monday, so its slot for 07:00Z stays occupied although that print is decided and nothing more can ride on it. A per-boundary PDA would not care; a 32-slot table does: enough long-lived tickets across enough distinct short boundaries would refuse new tickets with `TooManyExpiries` while capital is free. The right rule is to release a boundary the moment its leg is decided and no pending leg shares it. That needs a per-leg released flag, which changes the ticket's layout, so it is an upgrade to make with no live tickets, not under them.
- **User-visible:** none.
- **Approval:** stage owner; follows the plan.

### D-111 — The parlay builder opens on 1 and 4, not the reference's 5 and 40
- **Date / owner:** 2026-09-20 · S10a
- **Evidence:** a leg is priced over rested depth no smaller than the payout. The house maker rests `MM_QUOTE_LOTS` = 5,000 lots a side, which is 5 tUSDC of payout. The reference's defaults ask for roughly 10 to 40, so the first quote a visitor saw was a thin-book refusal on every Window.
- **Rule:** the builder's initial stake is 1 and its initial payout 4. The reserve's cap stays 50 tUSDC: the binding limit is the venue's depth, and it lifts when the maker's size is raised at the held ops cutover (suggested `MM_QUOTE_LOTS=50000`, subject to `maxCashPerWindow`).
- **User-visible:** the parlay builder opens on a ticket the venue can price.
- **Approval:** stage owner. A deliberate deviation from the reference's values (D-081), for the user's override.

### D-112 — `agari-strategy` keeps a strategy's words on chain, written in pieces and sealed against a declared hash
- **Date / owner:** 2026-09-20 · S9 on `integration/w1`
- **Evidence:** the reference's `StrategyRegistry.publish` takes `metadata` as one unbounded string, and its creators' words are "stored in the open". On Solana one transaction carries about 780 bytes of it after the runner, the hashes, the envelope and the accounts; the studio allows a 64-character name, a description and a 600-character persona inside the spec (`AGENT_PERSONA_MAX_CHARS`), which does not fit. The 4,000-character playbook is already off chain in `strategy_playbooks` with the creator's signature, so it is not part of this.
- **Rule:**
  - **Declared first:** `creator_publish` and `creator_update` take a `Revision` with `spec_hash`, `metadata_hash` (sha256 of the whole string), `metadata_len` (at most `MAX_METADATA_LEN` = 2,048) and whatever first piece fits. `creator_write_metadata(offset, chunk)` writes the rest in any order. `creator_seal` hashes what is there with the sha256 syscall and seals only on an exact match.
  - **Nobody subscribes to unfinished text:** `subscriber_subscribe` needs `active` and `sealed`. A new revision unseals the strategy until it is sealed again; subscriptions already on record are untouched, as in the reference.
  - **Considered and not chosen:** the hash on chain with the text served from Postgres. It is smaller, but it would make the runner and every reader depend on our database for the words a subscriber consented to, and the reference keeps them on chain.
  - **No custody, so no money gate:** the registry holds no vault. The only transfer is the fee, signed by the subscriber, straight to a token account Anchor checks belongs to the creator. It reads the vault's zero-copy `Grant` through `AccountLoader`, which checks `agari-vault` owns it, and applies the vault's own liveness rule (`caps::require_live`: not revoked, live through the second it expires).
  - **Added over the reference:** `max_fee_base` on subscribe. The fee the subscriber was shown is a ceiling, so a creator who raises it between the read and the signature gets a refusal.
  - **A vault fact that shapes the product:** `agari-vault` keeps one active grant per kind per account, and a new strategy grant revokes the last. A wallet follows one strategy at a time.
- **User-visible:** publishing a strategy with a long persona is two or three signatures instead of one.
- **Approval:** stage owner, for the user's override.

### D-113 — Every deferred feature is built in full; the deadline is never a reason and is never raised
- **Date / owner:** 2026-09-20 · the user
- **Evidence:** `handoff-deferred-stages.md` told sessions that the remaining programs and the deadline "do not both fit" and to offer taking unfinished pages out of the nav. On 2026-09-20 a session did exactly that, recommending Boost be built and Private desk and the Duel arena be hidden. The user: "I keep telling you deadline's not an issue … Don't make compromise … I don't want you come here and tell me that just because of deadline you're not integrating some stuff." The rule had been stated on 2026-09-18 as well and was already in STATUS ("the deadline is never a reason to compromise scope or quality"); it kept being lost across context clears because the handoff said the opposite.
- **Rule:** no feature is cut, hidden, deferred or thinned, and no session tells the user something will not fit or asks which to drop. S10c Boost, S10d Private desk and S12b Duel arena are all built, in that order, each with the full money gate (`00-plan.md` §7) and the same evidence standard as the programs before them. D-084's deferral is over: it was a scope cut for a deadline that moved, and every stage it named is now either done or next. The rule is in `docs/plan/working-rules.md`, which every session reads first, and the handoff's contrary text is withdrawn. (`CLAUDE.md` itself was deleted the same day at the user's request: he does not keep tool configuration files in his codebase. Its rules moved to that document unchanged.)
- **User-visible:** nothing in the app will say "not live", because everything in it will be live.
- **Approval:** the user, 2026-09-20.

## Open questions

| Q | Question | Status / default | Blocks |
|---|---|---|---|
| Q-001 | Build Masayume's own unfinished items? | ✅ Yes (user, 2026-09-13) | L-11, L-23, L-35, L-56, L-57, L-71, Range takes, notifications, sentiment cell, Range band, Duel sparkline |
| Q-002 | Do routes Masayume removed on 2026-09-04 stay removed? | ✅ Stay removed (user, 2026-09-13) | Y-01…Y-05, Y-18 → Excluded |
| Q-003 | Build Yosuku-only extras? | ✅ Not built (user, 2026-09-13) | Y-07…Y-13, Y-15 → Excluded |
| Q-004 | "Bet against" depth: A-1b inverse position; Phoenix perps (mainnet-only)? | Open. Default: A-1a/A-1c built; A-1b after approval; Phoenix not built on devnet | A-1b (S10c) |
| Q-005 | Yield: Kamino/Jupiter Lend are mainnet-only | Open. Default: honest "mainnet only" state + Earn reserves as yield | A-2a (S14) |
| Q-006 | Solana Mobile / Seeker beyond the PWA? | Open. Default: PWA only | — |
| Q-007 | Public repo licensing for Yosuku-derived CSS | ✅ Answered (user, 2026-09-15): Agari's code is **MIT** (`LICENSE`); the repositories stay **private for now**. Third-party material keeps its own terms (`THIRD_PARTY_NOTICES.md`); going public is a later user call | Public visibility |
| Q-008 | Agari X account + X API keys; geofence method; corporate-action source | Partly answered: X keys not a blocker (user, 2026-09-13); geofence S15; corporate actions S6 | S11 live test |
| Q-S6-1 | List the six RedStone single-name Gaps for 09-18 on the 09-14 archive? | Open. Default (stage owner, pending the user): yes, per name, if every archived open 09-14…09-17 had ≥ 3 signers at 09:30:00 ET; 3-signer risk disclosed (D-052) | 6a listing set |
| Q-S6-2 | TSLA Gap: keep the RedStone check? | Open. Default: keep (D-052) | — |
| Q-S6-3 | Overnight devnet Gap drive Thu 20:00Z → Fri 13:30Z (Series 902, ≈ 0.24 SOL)? | Open. Default (pending the user): yes (D-054) | Gap pre-deadline gate row |
| Q-S6-4 | Surge signs with only 2 oracles? | Open. Default (pending the user): min 2 with halved caps and "signed by 2 oracles" disclosed, else pause (D-053) | 6b token lane |
| Q-S6-5 | Jupiter attested demo version on devnet? | Default: no, unless Switchboard is paused and the user opts in (D-056) | — |
| Q-S6-6 | ≈ 15 devnet SOL for S6 | Open. Needs the user: send to inbox `5zjywmmJ…` before Wed 09-16 (D-055) | Gap/token registration, program upgrade |
| Q-S6-7 | A void claim shows Masayume's "You won" trophy? | Open. Default (pending the user): void stamp, "Returned" and the reason line (D-057) | 6d claim card |
| Q-S6-8 | Hedge placement and size | Default: under the `/markets` hero, 10% of exposure, devnet tUSDC only (D-058) | — |
| Q-S6-9 | Halt wording without a licensed halt feed | Default: "Trading halted" only for `pyth-wide` / `issuer-halt`, else "Signed price stale" (D-057) | — |
| Q-S15-1 | Deploy `agari-docs` as its own Vercel project alongside the web app? | ✅ Answered (user, 2026-09-15): yes, its own project on the app's docs subdomain, as Masayume ran `docs.masayume.app`; the exact domain comes from the user at S16 (D-094) | Docs URL in README |
