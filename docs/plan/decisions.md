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
