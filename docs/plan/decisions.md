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
  - **Privy** sign-in from S1.
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

## Open questions

| Q | Question | Status / default | Blocks |
|---|---|---|---|
| Q-001 | Build Masayume's own unfinished items? | ✅ Yes (user, 2026-09-13) | L-11, L-23, L-35, L-56, L-57, L-71, Range takes, notifications, sentiment cell, Range band, Duel sparkline |
| Q-002 | Do routes Masayume removed on 2026-09-04 stay removed? | ✅ Stay removed (user, 2026-09-13) | Y-01…Y-05, Y-18 → Excluded |
| Q-003 | Build Yosuku-only extras? | ✅ Not built (user, 2026-09-13) | Y-07…Y-13, Y-15 → Excluded |
| Q-004 | "Bet against" depth: A-1b inverse position; Phoenix perps (mainnet-only)? | Open. Default: A-1a/A-1c built; A-1b after approval; Phoenix not built on devnet | A-1b (S10c) |
| Q-005 | Yield: Kamino/Jupiter Lend are mainnet-only | Open. Default: honest "mainnet only" state + Earn reserves as yield | A-2a (S14) |
| Q-006 | Solana Mobile / Seeker beyond the PWA? | Open. Default: PWA only | — |
| Q-007 | Public repo licensing for Yosuku-derived CSS | Open. Default: keep repo private | Public visibility |
| Q-008 | Agari X account + X API keys; geofence method; corporate-action source | Partly answered: X keys not a blocker (user, 2026-09-13); geofence S15; corporate actions S6 | S11 live test |
