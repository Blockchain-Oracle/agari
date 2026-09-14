# `agari-events` spec — accounts, layouts, errors, events (frozen at S2.1)

Companion to [`events-engine.md`](events-engine.md) (semantics), [`events-instructions.md`](events-instructions.md), [`prints.md`](prints.md).

## 1. Conventions

- **Every engine account is Anchor `#[account(zero_copy)]`** (`repr(C)`, `bytemuck::{Pod, Zeroable}`; Anchor 1.x zero-copy uses `repr(C)`, not `packed`). Products and the TS client read them by cast (`view::load_checked`, §6), and the hot path never Borsh-decodes. All padding is **explicit** (`_padN`), so `bytemuck::Pod` derives compile; a layout test asserts `size_of`/`offset_of` against the tables below.
- **Offsets** in the tables are within the struct. **Account byte offset = struct offset + 8** (Anchor discriminator). Account size = `8 + size_of::<T>()` (+ trailing slice for Book and Ledger).
- **Rent** = `(account_bytes + 128) × 5,080` lamports (devnet, measured 2026-09-13).
- **Numbers** are little-endian; `Pubkey` = `[u8; 32]`.
- **Optional values** use sentinels, never `Option`: `Pubkey::default()`, `Print.source == 0`, node ref 0, `valid_until_ts == i64::MAX`.
- **Node refs** inside the Book (`Level.head/tail`, `OrderNode.prev/next`, `free_head`) are **1-based, 0 = nil**, so a zeroed Book is a valid empty book. Public handles use the 0-based node index.

## 2. Seeds and constants

| Account | Kind | Seeds |
|---|---|---|
| `GlobalConfig` | PDA | `["config"]` |
| `Series` | PDA | `["series", ticker: u16 LE, cadence_sec: u32 LE, basis: u8]` |
| `Market` (the Window; `MarketId` = this address) | PDA | `["market", series, index: u64 LE]` |
| `Ledger` | PDA | `["ledger", market]` |
| `mvault` | SPL token account PDA, authority = Market PDA | `["mvault", market]` |
| `MarketResult` | PDA | `["result", market]` |
| `Book` | **keypair** account, owner = program | — |
| event authority | PDA (Anchor `#[event_cpi]`) | `["__event_authority"]` |
| product seat authority (in each product program) | PDA | `["seat"]` |

| Constant | Value |
|---|---|
| `PAIR_TICKS` | 1,000 |
| `PAYOUT_DENOMINATOR` | 10,000,000 |
| `MAX_FILLS_CAP` / `MAX_EVICTIONS_CAP` / `MAX_SKIPS` | 32 / 16 / 64 |
| `MAX_OPEN_ORDERS_PER_SEAT` | 16 |
| `MAX_CANCEL_HANDLES` | 16 |
| `LEDGER_INITIAL_SEATS` / `LEDGER_MAX_SEATS` / `LEDGER_GROW_MAX` | 96 / 1,024 / 116 |
| `BOOK_CAPACITIES` | 256, 512 |
| `MAX_POLICY_VERSIONS` / `MAX_FREE_BOOKS` | 8 / 4 |
| `MAX_GAP_DURATION_SEC` | 432,000 (5 days: Fri 16:00 → Tue 09:30 over a holiday Monday) |
| `ADMIT_UNTIL_LOCK` | `u32::MAX` (prints.md §3) |
| `DEFAULT_RESULT_RETENTION_SEC` | 21,600 |
| `ATTEST_DOMAIN` | `b"agari-print-v1"` (14 B) |

**Enums (stored as `u8`):**

| Enum | Values |
|---|---|
| `Kind` | 0 BUY_YES, 1 SELL_YES, 2 BUY_NO, 3 SELL_NO |
| `OrderType` | 0 Normal, 1 FOK, 2 IOC, 3 PostOnly |
| `SelfMatch` | 0 CancelTaker, 1 CancelMaker |
| `Path` | 0 DIRECT_YES, 1 DIRECT_NO, 2 MINT_PAIR, 3 BURN_PAIR |
| `Mode` | 0 Normal, 1 ReduceOnly, 2 Halted |
| `Basis` | 0 Regular, 1 Gap, 2 Token24x7 |
| `BoundaryKind` | 0 Intraday, 1 SessionOpen, 2 SessionClose |
| `Source` | 0 None, 1 Pyth, 2 RedStone, 3 Switchboard, 4 Attested |
| `Which` | 0 Open, 1 Close, 2 CheckOpen, 3 CheckClose |
| `MarketState` | 0 Open (time-derived status), 1 Resolved, 2 Voided |
| `VoidReason` | 0 None, 1 MissingPrint, 2 CrossCheckDivergence |
| `Winner` | 0 Yes (Up), 1 No (Down), 2 Void |
| `StopReason` | 0 Filled, 1 NoCross, 2 FillCap, 3 SkipCap, 4 PostOnlyRested |
| `RemoveReason` | 0 Expired, 1 SelfMatch, 2 UserCancel, 3 CancelAll, 4 Sweep |
| `ClusterTag` | 1 devnet, 2 mainnet-beta, 3 localnet |

**Flags:** `Seat.flags` bit0 `PROGRAM`, bit1 `BONDED`. `OrderNode.flags` bit0 `LIVE`. `Print.flags` bit0 `COPIED_FROM_PREV`. `Market.flags` bit0 `BOOK_RELEASED`, bit1 `LEDGER_CLOSED`, bit2 `SINGLE_SOURCE`.

## 3. Layouts

### 3.1 `GlobalConfig` — 848 B struct, **856 B account, 4,998,720 lamports ≈ 0.0050 SOL**

| Off | Field | Type | Notes |
|---|---|---|---|
| 0 | `admin` | Pubkey | set at init; must equal the program upgrade authority |
| 32 | `collateral_mint` | Pubkey | SPL Token mint (Token-2022 rejected) |
| 64 | `token_program` | Pubkey | `== spl_token::ID` |
| 96 | `treasury` | Pubkey | **token account** of `collateral_mint` (close residue) |
| 128 | `rollers` | [Pubkey;4] | zero = unused |
| 256 | `attestors` | [Pubkey;4] | ed25519 keys |
| 384 | `program_authorities` | [Pubkey;8] | product **seat PDAs**; index i ⇒ Ledger seat i |
| 640 | `switchboard_queue` | Pubkey | S6 |
| 672 | `redstone_signers` | [[u8;20];5] | EVM addresses (D-002 list) |
| 772 | `redstone_signer_count` | u8 | ≤ 5 |
| 773 | `redstone_threshold` | u8 | liveness threshold after `strict_sec` (3) |
| 774 | `switchboard_min_oracles` | u8 | 3 |
| 775 | `mode` | u8 | `Mode` |
| 776 | `collateral_decimals` | u8 | copied from the mint |
| 777 | `cluster_tag` | u8 | `ClusterTag`, in the attested message |
| 778 | `bump` | u8 | |
| 779 | `_pad0` | u8 | |
| 780 | `result_retention_sec` | u32 | PD-7 |
| 784 | `_reserved` | [u8;64] | |

### 3.2 `PrintPolicy` — 56 B, align 4 (layout D-007)

| Off | Field | Type | Used by |
|---|---|---|---|
| 0 | `source` | u8 | `Source` |
| 1 | `_pad0` | u8 | |
| 2 | `grace_sec` | u16 | Pyth |
| 4 | `feed_id` | [u8;32] | Pyth feed id / RedStone ASCII id left-aligned zero-padded / Switchboard feed hash / attested source hash |
| 36 | `min_delay_sec` | u16 | Switchboard; attested correction cutoff; **0 for Pyth and RedStone** |
| 38 | `bar_len_sec` | u16 | attested |
| 40 | `max_conf_bps` | u16 | Pyth |
| 42 | `max_slot_age` | u16 | Switchboard |
| 44 | `open_admission_sec` | u32 | `ADMIT_UNTIL_LOCK` allowed (Gap open) |
| 48 | `close_admission_sec` | u32 | |
| 52 | `strict_sec` | u32 | RedStone all-signers window |

### 3.3 `PolicyVersion` — 136 B, align 8

| Off | Field | Type |
|---|---|---|
| 0 | `valid_from_ts` | i64 (inclusive) |
| 8 | `valid_until_ts` | i64 (inclusive; `i64::MAX` = open-ended) |
| 16 | `primary` | PrintPolicy |
| 72 | `check` | PrintPolicy (`source == None` ⇒ no check) |
| 128 | `max_divergence_bps` | u16 |
| 130 | `_pad0` | [u8;2] |
| 132 | `check_admission_sec` | u32 |

### 3.4 `Series` — 1,360 B struct, **1,368 B account, 7,599,680 lamports ≈ 0.0076 SOL**

| Off | Field | Type | Notes |
|---|---|---|---|
| 0 | `ticker` | u16 | registry id (`core/market/tickers.ts`) |
| 2 | `basis` | u8 | `Basis` |
| 3 | `bump` | u8 | |
| 4 | `cadence_sec` | u32 | 0 for Gap |
| 8 | `lot_base` | u64 | |
| 16 | `tick_base` | u64 | `× 1000 == 10^dec` |
| 24 | `cash_unit` | u64 | `lot_base × tick_base / 10^dec` |
| 32 | `min_lots` | u64 | |
| 40 | `seat_bond` | u64 | base units, copied into each Ledger at open |
| 48 | `next_index` | u64 | |
| 56 | `last_expiry` | i64 | |
| 64 | `min_rest_slots` | u32 | PD-2 |
| 68 | `max_lead_sec` | u32 | listing horizon |
| 72 | `fills_cap` | u8 | ≤ 32 |
| 73 | `evictions_cap` | u8 | ≤ 16 |
| 74 | `version_count` | u8 | ≤ 8 |
| 75 | `free_book_count` | u8 | ≤ 4 |
| 76 | `_pad0` | [u8;4] | |
| 80 | `free_books` | [Pubkey;4] | entries `≥ free_book_count` are zero |
| 208 | `policy_versions` | [PolicyVersion;8] | append-only, immutable |
| 1296 | `_reserved` | [u8;64] | |

The plan's `settlement_window_sec` is dropped: PD-6 per-boundary deadlines replace "expiry + settlement window" (D-007).

### 3.5 `Print` — 24 B, align 8

| Off | Field | Type | Notes |
|---|---|---|---|
| 0 | `price` | i64 | normalized, `> 0` |
| 8 | `source_ts` | i64 | Pyth `publish_time`; RedStone package ms / 1000; Switchboard: `T`; attested: `T` |
| 16 | `expo` | i32 | always −8 |
| 20 | `source` | u8 | 0 = slot empty |
| 21 | `signers` | u8 | Pyth 0; RedStone package count; Switchboard distinct oracles; attested 1 |
| 22 | `flags` | u8 | `COPIED_FROM_PREV` |
| 23 | `_pad0` | u8 | |

### 3.6 `Market` — 448 B struct, **456 B account, 2,966,720 lamports ≈ 0.0030 SOL**

| Off | Field | Type | Off | Field | Type |
|---|---|---|---|---|---|
| 0 | `series` | Pubkey | 312 | `volume_cash` | u64 |
| 32 | `book` | Pubkey | 320 | `volume_lots` | u64 |
| 64 | `ledger` | Pubkey | 328 | `trade_count` | u64 |
| 96 | `mvault` | Pubkey | 336 | `last_trade_ts` | i64 |
| 128 | `rent_payer` | Pubkey | 344 | `event_seq` | u64 |
| 160 | `index` | u64 | 352 | `resolved_ts` | i64 |
| 168 | `trading_start` | i64 (open boundary T) | 360 | `payout_yes` | u32 |
| 176 | `lock_at` | i64 | 364 | `payout_no` | u32 |
| 184 | `expiry` | i64 (close boundary T) | 368 | `dependents` | u32 |
| 192 | `open_deadline` | i64 | 372 | `last_price` | u16 |
| 200 | `close_deadline` | i64 | 374 | `policy_version` | u8 |
| 208 | `open` | Print | 375 | `open_kind` | u8 |
| 232 | `close` | Print | 376 | `close_kind` | u8 |
| 256 | `check_open` | Print | 377 | `basis` | u8 |
| 280 | `check_close` | Print | 378 | `state` | u8 |
| 304 | `backing_lots` | u64 | 379 | `void_reason` | u8 |
| | | | 380 | `flags` | u8 |
| | | | 381 | `bump` / 382 `ledger_bump` / 383 `mvault_bump` | u8 ×3 |
| | | | 384 | `_reserved` | [u8;64] |

### 3.7 `MarketResult` — 248 B struct, **256 B account, 1,950,720 lamports ≈ 0.00195 SOL**

| Off | Field | Type | Off | Field | Type |
|---|---|---|---|---|---|
| 0 | `market` | Pubkey | 200 | `payout_yes` | u32 |
| 32 | `series` | Pubkey | 204 | `payout_no` | u32 |
| 64 | `rent_payer` | Pubkey (settler/voider) | 208 | `policy_version` | u8 |
| 96 | `open` | Print | 209 | `void_reason` | u8 |
| 120 | `close` | Print | 210 | `single_source` | u8 (bool) |
| 144 | `check_open` | Print | 211 | `winner` | u8 |
| 168 | `check_close` | Print | 212 | `bump` | u8 |
| 192 | `resolved_ts` | i64 | 213 | `_pad0` [u8;3], 216 `_reserved` [u8;32] | |

### 3.8 `Ledger` — header 96 B + `Seat` 88 B × capacity (D-006)

| Off | Header field | Type |
|---|---|---|
| 0 | `market` | Pubkey |
| 32 | `rent_payer` | Pubkey (roller payer) |
| 64 | `seat_bond` | u64 |
| 72 | `capacity` | u16 |
| 74 | `seats_used` | u16 (scan high-water) |
| 76 | `bump` | u8 |
| 77 | `_pad0` | [u8;3] |
| 80 | `_reserved` | [u8;16] |

| Off | Seat field | Type |
|---|---|---|
| 0 | `owner` | Pubkey (default = empty) |
| 32 | `credit` | u64 cash |
| 40 | `locked_cash` | u64 cash |
| 48 / 56 | `yes_free` / `yes_locked` | u64 lots |
| 64 / 72 | `no_free` / `no_locked` | u64 lots |
| 80 | `open_orders` | u16 |
| 82 | `flags` | u8 (`PROGRAM`, `BONDED`) |
| 83 | `_pad0` | [u8;5] |

Seats are a `bytemuck::cast_slice` over `data[8 + 96 ..]`; `seats.len()` must equal `capacity`.

| Capacity | Account B | Lamports | SOL |
|---|---|---|---|
| 96 (created by `init` in `roller_open_window`; ≤ 10,240 B CPI limit) | 8,552 | 44,094,400 | 0.0441 |
| +116 per `public_grow_ledger` (10,208 B ≤ `MAX_PERMITTED_DATA_INCREASE`) | +10,208 | +51,856,640 | +0.0519 |
| 1,024 (8 grow calls) | 90,216 | 458,947,520 | **0.4589** |

### 3.9 `Book` — fixed 32,384 B + `OrderNode` 48 B × capacity

| Off | Fixed field | Type |
|---|---|---|
| 0 | `market` | Pubkey (default = free) |
| 32 | `series` | Pubkey |
| 64 | `next_seq` | u64 (never reset) |
| 72 | `generation` | u32 (++ on bind) |
| 76 | `capacity` | u32 (256/512) |
| 80 | `order_count` | u32 |
| 84 | `free_head` | u32 (1-based ref) |
| 88 | `high_water` | u32 (nodes `≥ high_water` never used) |
| 92 | `_pad0` | u32 |
| 96 | `bid_bits` | [u64;16] (bit `p` = level `p` non-empty) |
| 224 | `ask_bits` | [u64;16] |
| 352 | `_reserved` | [u8;32] |
| 384 | `bids` | [Level;1000] (index = price; 0 unused) |
| 16,384 | `asks` | [Level;1000] |

`Level` (16 B): `head u32`, `tail u32` (1-based refs, FIFO oldest → newest), `live_lots u64`.

`OrderNode` (48 B) at `data[8 + 32,384 + 48·i]`: `lots u64` (remaining) · `seq u64` · `expire_ts i64` · `placed_slot u64` · `prev u32` · `next u32` · `price u16` · `seat u16` · `kind u8` · `flags u8` · `_pad0 [u8;2]`.

**Allocation:** pop `free_head` if non-zero; else use `high_water++` if `< capacity`; else `BookFull`. Free: `node.next = free_head`, `free_head = ref`, `flags = 0`. `admin_add_book` needs no per-level initialization.

| Capacity | Account B | Lamports | SOL |
|---|---|---|---|
| 256 | 44,680 | 227,624,640 | 0.2276 |
| 512 | 56,968 | 290,047,680 | 0.2900 |

### 3.10 `mvault` — SPL token account, 165 B, 1,488,440 lamports ≈ 0.00149 SOL

### 3.11 Corrections to plan P§3.1 sizes

| Account | Plan | Exact | Reason |
|---|---|---|---|
| `GlobalConfig` | 760 B ≈ 0.0045 | 856 B ≈ 0.0050 | + `redstone_signer_count`, `cluster_tag`, `collateral_decimals`; zero-copy alignment |
| `Series` | ≈ 1,400 B ≈ 0.0078 | 1,368 B ≈ 0.0076 | `PrintPolicy` 56 B with per-boundary admission; no `settlement_window_sec` |
| `Market` | ≈ 420 B ≈ 0.0028 | 456 B ≈ 0.0030 | + `open_deadline`, `close_deadline`, `basis`, `state`, `void_reason`, flags |
| `MarketResult` | ≈ 180 B ≈ 0.0016 | 256 B ≈ 0.00195 | + `rent_payer` (settler refunded), `winner`, `_reserved[32]` |
| `Ledger` growth | +150 seats/call | **+116 seats/call** | 150 × 88 = 13,200 B > 10,240 B realloc cap |
| `Ledger` 1,024 seats | ≈ 0.39 SOL | **0.4589 SOL** | seat 88 B (bond moved to the header; `BONDED` flag) |
| `Book` 512 / 256 | 57,024 B ≈ 0.290 / ≈ 0.23 | 56,968 B ≈ 0.2900 / 44,680 B ≈ 0.2276 | exact header |
| Per Window `Market + MarketResult` | ≈ 0.0044 | 0.00492 SOL | at ≈ 2,600 Windows/day with 6 h retention ≈ 3.7 SOL steady float (plan ≈ 3) |

## 4. Errors (`#[error_code]`, explicit discriminants + Anchor's 6000 offset)

`InvalidMode = 0 … MarketNotTrading = 100 …` → codes below. **New versus plan** marked ★ (D-006…D-009). S2's state step must confirm Anchor 1.2 honours explicit discriminants (Anchor's own `ErrorCode` uses them).

| Range | Code: name |
|---|---|
| **6000 admin / roller** | 6000 InvalidMode · 6001 NotAdmin · 6002 NotRoller · 6003 BadGrid · 6004 BadWindowIndex · 6005 WindowOverlap · 6006 BadAlignment · 6007 BadHorizon · 6008 NoFreeBook · 6009 BookMarketMismatch · 6010 LedgerMarketMismatch · 6011 UnknownPolicyVersion · 6012 PolicyVersionImmutable · 6013 SourceNotCovered · 6014 BadPolicy★ · 6015 BadSeriesParams★ · 6016 BadBookSize★ · 6017 TooManyBooks★ · 6018 BadAuthorities★ · 6019 SeriesMarketMismatch★ · 6020 MvaultMarketMismatch★ · 6021 NotProgramAuthority★ |
| **6100 orders** | 6100 MarketNotTrading · 6101 MarketNotLocked · 6102 MarketNotTerminal · 6103 MarketAlreadyTerminal · 6104 InvalidPrice · 6105 InvalidQuantity · 6106 BelowMinLots · 6107 OrderAlreadyExpired · 6108 ExpiryAfterLock · 6109 PostOnlyWouldCross · 6110 ImmediateOrCancelNoFill · 6111 FillOrKillNotFillable · 6112 BookFull · 6113 LedgerFull · 6114 TooManyOpenOrders · 6115 SeatMismatch · 6116 UnknownOrder · 6117 NotOrderOwner · 6118 ReduceNotSmaller · 6119 SelfMatchCancelTaker★ · 6120 InvalidOrderArgs★ |
| **6200 prints / settle** | 6200 WrongPrintSource · 6201 PrintAlreadyRecorded · 6202 FeedIdMismatch · 6203 InsufficientVerification · 6204 PrintTooEarly · 6205 PrintNotUnique · 6206 PrintTooLate · 6207 ConfidenceTooWide · 6208 BadAttestation · 6209 UnknownAttestor · 6210 BadRedStonePackage · 6211 RedStoneTimestampMismatch · 6212 UnknownRedStoneSigner (reserved: not raised on the SDK path, prints.md §4.2) · 6213 InsufficientRedStoneSigners · 6214 SwitchboardFeedMismatch · 6215 SwitchboardQueueMismatch · 6216 DuplicateOracle · 6217 TooFewOracles · 6218 QuoteSlotStale · 6219 CrossCheckPending · 6220 RetentionNotElapsed · 6221 CpiNotAllowed · 6222 PrintsMissing · 6223 SettlementWindowOpen (void not yet allowed) · 6224 OpenOrdersRemain · 6225 ProgramSeatNotPublic · 6226 LedgerNotEmpty · 6227 InvalidPrintValue★ · 6228 PrintNotAdjacent★ · 6229 DependentsRemain★ · 6230 BookNotReleased★ · 6231 LedgerNotClosed★ · 6232 PartialRedeemNotAllowed★ · 6233 BadPrintSlot★ |
| **6300 sets / cash** | 6300 InsufficientCredit · 6301 InsufficientOutcome · 6302 WrongMint · 6303 WrongTokenProgram · 6304 MathOverflow · 6305 WrongTokenOwner★ · 6306 SeatNotEmpty★ · 6307 BadGrowAmount★ |

`CrossCheckDivergence` and `MissingPrint` are `VoidReason` values, not errors. `UnknownOrder` is raised by `user_reduce_order` on a stale handle (cancel skips stale handles instead).

## 5. Return data and events

**`Handle`** (Borsh, 12 B): `node u32` (0-based; `u32::MAX` = none), `seq u64`.

**`PlaceResult`** (Borsh via `set_return_data`, 91 B ≤ 1,024 B), in order:
`filled_lots u64 · cash_spent u64 · cash_received u64 · credit_used u64 · transferred_in u64 · withdrawn u64 · refunded u64 · rested_lots u64 · cancelled_lots u64 · rested Handle · seat u16 · fills u8 · evictions u8 · self_cancels u8 · stop_reason u8 · path_mask u8` (bit per `Path` used).

**Events** are `#[event]` structs emitted with `emit_cpi!` (feature `event-cpi`). The indexer decodes the inner instruction `EVENT_IX_TAG ‖ discriminator ‖ Borsh`. **Every Market-scoped event carries `seq = ++market.event_seq`**, so `(market, seq)` has no gaps (the indexer's gap detection). One event per instruction.

| Event | Fields (Borsh order) |
|---|---|
| `WindowOpened` | market, series, seq, index u64, trading_start, lock_at, expiry, open_deadline, close_deadline, policy_version u8, open_kind u8, close_kind u8, basis u8, book, ledger, mvault, generation u32 |
| `PrintRecorded` | market, seq, which u8, source u8, price i64, expo i32, source_ts i64, signers u8, copied bool, recorded_ts i64 |
| `OrderExecuted` | market, seq, taker Pubkey, taker_seat u16, kind u8, order_type u8, self_match u8, limit_price u16, lots u64, expire_ts i64, client_id u64, filled_lots, cash_spent, cash_received, credit_used, transferred_in, withdrawn, rested Handle, rested_lots, cancelled_lots, stop_reason u8, backing_lots u64, fills Vec<FillRecord> (≤ 32), removed Vec<RemovedRecord> (≤ 48 = evictions + self-cancels), ts i64, slot u64 |
| `FillRecord` (66 B) | maker Pubkey, maker_seat u16, maker_node u32, maker_seq u64, maker_kind u8, path u8, price u16, lots u64, maker_remaining u64 |
| `RemovedRecord` (58 B) | owner Pubkey, seat u16, node u32, seq u64, kind u8, price u16, lots u64, reason u8 |
| `OrdersCancelled` | market, seq, caller Pubkey (default for sweep), reason u8, removed Vec<RemovedRecord> (≤ 32), skipped u8, withdrawn u64 |
| `OrderReduced` | market, seq, owner, seat u16, handle Handle, kind u8, price u16, old_lots u64, new_lots u64 |
| `CompleteSet` | market, seq, owner, seat u16, minted bool, lots u64, cash u64, credit_used, transferred_in, withdrawn, backing_lots u64 |
| `CreditWithdrawn` | market, seq, owner, seat u16, amount u64 |
| `WindowResolved` | market, seq, state u8, winner u8, payout_yes u32, payout_no u32, void_reason u8, single_source bool, open Print, close Print, check_open Print, check_close Print, resolved_ts i64 |
| `Redeemed` | market, seq, owner, seat u16, yes_lots u64, no_lots u64, payout u64, credit u64, bond u64, total u64, partial bool, by_crank bool |
| `BookReleased` | market, seq, book, series |
| `LedgerGrown` | market, seq, payer, capacity u16 |
| `SeatReleased` | market, seq, owner, seat u16, bond u64 |
| `LedgerClosed` | market, seq, residue u64 |
| `DependentChanged` | market, seq, program_authority, added bool, dependents u32 |
| `MarketClosed` | market, seq, result |
| Admin (no `seq`) | `ConfigInitialized{config, admin, collateral_mint, cluster_tag}` · `AuthoritiesSet{config}` · `ModeSet{mode}` · `SeriesRegistered{series, ticker, cadence_sec, basis, cash_unit}` · `BookAdded{series, book, capacity}` · `PolicyVersionAdded{series, index, valid_from_ts, valid_until_ts, primary_source, check_source}` |

**Worst-case `OrderExecuted`:** ≈ 210 B header + 32 × 66 + 48 × 58 ≈ 5.1 KB, under the 10 KiB CPI instruction-data limit (`C:08` #18 estimated ~3 KB before self-cancels were listed).

## 6. `agari-common::view::load_checked`

For products reading engine accounts as `UncheckedAccount`, in this order:
1. `account.owner == agari_events::ID`.
2. `data.len() ≥ 8 + size_of::<T>()`, and the 8-byte discriminator equals `T`'s Anchor discriminator.
3. `bytemuck::from_bytes::<T>(&data[8..8 + size])` (the Book node slice and the Ledger seat slice via `cast_slice` with length `capacity`).
4. **Bindings:** Book ⇒ `book.market == market.key()` **and** `market.book == book.key()` (`BookMarketMismatch`); Ledger ⇒ both directions (`LedgerMarketMismatch`); Market ⇒ `market.series == series.key()` when a Series is supplied.
5. For `MarketResult`: address == PDA `["result", market]` (reject look-alikes).
