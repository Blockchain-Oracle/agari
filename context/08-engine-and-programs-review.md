# 08 — Engine and product-program review (26 corrections, account/instruction spec, CPI map, security)

> Source: planning-session Plan agent, 2026-09-13; transcribed by the main session after plan approval. Referenced by `docs/plan/00-plan.md` §3 as C:08.
>
> **Rent correction.** Devnet `getMinimumBalanceForRentExemption`, measured 2026-09-13, is **5,080 lamports/byte including the 128-byte header**:
> - 1 KB ≈ 0.00585 SOL
> - 57,024 B ≈ 0.290 SOL
>
> This review used 6,960 lamports/byte, so scale its SOL figures by about 0.73. That gives a Book of ≈ 0.29 SOL and a 96-seat Ledger of ≈ 0.044 SOL.
>
> **Superseded by the approved plan.** These passages are kept below as history:
>
> | Earlier point | Replaced by |
> |---|---|
> | Single `print_source` (gap #3) | Per-boundary `open_policy`/`close_policy` (PD-1) |
> | Same-slot exclusion (gap #20) | Rested-age filter + oracle-model bound (PD-2) |
> | Fixed 96-seat Ledger (gap #12) | Growable Ledger + seat bond (PD-8) |
> | Market close / Unclaimed ideas (gap #14, partly) | `MarketResult` + `dependents == 0` (PD-7) |
> | Maker `open[16]` | `open[64]` |
> | Void timing | Print admission deadline (PD-6) |

This reviews §2.0, §2.2, §3.0–3.2, §4 and §9 of the draft plan against the Masayume Solidity contracts, the DreamDEX SDK/docs and the solana-dev references.

## 1. Bugs and gaps in the draft, each with its fix

**Blocking**

1. **PDA seeds vs top-level `createAccount`.** The draft gives `Book` PDA seeds `["book", series, slot]` and also says Book/Ledger are created by a top-level System `createAccount`. Those conflict: a PDA can only be created by the program signing inside a CPI, and CPI creation is capped at 10,240 B.
   - **Fix:** make `Book` a keypair account. Admin creates it via `createAccount` in the same transaction, runs `#[account(zero)]` + `load_init`, and stores its address in `Series.free_books`.
   - Keep `Ledger` a PDA of 8,528 B or less (96 seats), created by `init` inside `roller_open_window`. If you need more than 96 seats, make it a keypair account too.

2. **Choose a grid that removes rounding.** At 6 decimals, set tick = lot = 1,000 base units (0.001).
   - Then cash = `lots × ticks` exactly, and `q·p + q·(1−p) = q`.
   - Void 0.5 is exact as long as lots are 1,000 base units, so the draft's ceiling rules in §3.1 item 2 are unnecessary.
   - Store quantities as `lots: u64` and prices as `price_ticks: u16` in 1..=999.
   - `admin_register_series` must reject any grid where `lot_base * tick_base % 10^decimals != 0`.
   - Keep Masayume's `ceilDiv`/floor only in the product-program math.

3. **Fix the print source per window.** The draft allows either Pyth or attested prints, and the first print recorded wins. Pyth and Alpaca IEX prices differ by cents, so whoever records first can pick the source that suits them.
   - **Fix:** `Market.print_source` is set from `Series` when the window opens, and only that source is accepted for both prints.

4. **Session-close and Gap-open prints can't be proven with "first update ≥ T".** A regular-hours equity feed stops publishing around 16:00. The last regular window and the Gap window's opening print (Friday close) would either void or rest on an unprovable "last update before T".
   - Proving "last update ≤ T" takes two updates: U with `publish_time ≤ T`, and U2 with `U2.prev_publish_time == U.publish_time` and `U2.publish_time > T`. U2 only exists if the feed keeps publishing (extended-hours feeds).
   - **Fix:** add `Market.boundary_kind {Intraday, SessionClose, SessionOpen}`. SessionClose uses the two-update proof when an extended-hours feed is entitled, otherwise the attested source. This is open question 1 below.

5. **Order expiry must be bounded by `lock_at`, not `expiry`.** The rule `now < expire_ts ≤ window.expiry` breaks the Gap lane.
   - **Fix:** trading is allowed while `trading_start ≤ now < lock_at`, and `expire_ts ≤ lock_at`.
   - Product-program time checks (`minTimeLeftSec`, `minCardLifeSec`) also use `lock_at`.

6. **Roller authority contradiction.** §3.1 lists roller authorities in `GlobalConfig`, while §4 says opening windows is permissionless. The program can't know the NYSE calendar, so a permissionless open lets anyone create holiday windows and exhaust the free-book list.
   - **Fix:** `roller_open_window` requires a signer in `config.rollers`; everything after the open stays permissionless.
   - It must enforce: `index == series.next_index`, `trading_start ≥ series.last_expiry`, cadence alignment (Regular/Token), `lock_at ≤ expiry`, and a maximum horizon.

7. **Attested print replay.** Signed message: `"agari-print-v1" ‖ program_id ‖ cluster_tag ‖ market_pubkey ‖ which ‖ boundary_ts ‖ price_i64 ‖ expo_i32 ‖ source_ts ‖ source_id_u16`. The market pubkey already covers series and index.
   - Introspection checks:
     - the instruction at `current_index − 1` is `Ed25519SigVerify111…`
     - `num_signatures == 1`
     - all three `*_instruction_index` offsets point back into that same instruction (the known offsets bug)
     - the pubkey is in `config.attestors`
     - the message bytes match exactly
     - bar end equals `boundary_ts`
     - not called via CPI (`get_stack_height() == TRANSACTION_LEVEL_STACK_HEIGHT`)

8. **Opening-print reuse and void rules.**
   - Copy the previous window's closing print only when `prev.expiry == trading_start`, prev has a closing print, and the source matches. Otherwise record the open with the same uniqueness rule at `T = trading_start`. This stops Friday's close becoming Monday's 09:30 open.
   - `settle` needs both prints and has no deadline once both exist.
   - `void_expired` is allowed only when a print is still missing at `expiry + settlement_window`.
   - Halts: refuse a Pyth print when `conf × 10,000 > |price| × max_conf_bps`, so a halted feed voids instead of settling on a stale price.
   - Pyth `publish_time` has one-second granularity; `prev_publish_time < T` still picks exactly one update.

9. **Expired-order eviction.** DreamDEX deliberately skips expired makers without removing them (anti-griefing; SDK `store.ts:652`, `orders.ts:709`). Eager eviction is fine here because the Ledger is already write-locked, but it needs its own limit.
   - **Fix:** add `max_evictions` (default 16), separate from `max_fills`; past the limit, skip.
   - Eviction credit:
     - BUY_YES: `locked_cash −= lots × p`, `credit += lots × p`
     - BUY_NO: the same with `1000 − p`
     - SELL: locked outcome moves back to free
     - always `open_orders −= 1`
   - **An IOC that fills nothing reverts, which also rolls back its evictions**, so expired dust survives. Add:
     - a permissionless `public_sweep_expired` crank run by ops
     - a minimum order size
     - a per-seat cap of 16 open orders
   - **PostOnly's cross check must evict or skip expired top-of-book orders first.** Otherwise the maker's own expired quotes block its requote, the same class of bug as Masayume's lazy-refund `Panic(17)` (context/44).

10. **Order-type edge cases.**
    - A Normal order that uses up `max_fills` while its remainder still crosses must cancel the remainder, never rest it crossed.
    - FOK reverts unless fully filled; IOC cancels the rest.
    - CancelTaker cancels the taker's remainder, and only reverts through the IOC zero-fill rule.

11. **Book recycling, binding and release.**
    - Every engine instruction checks `book.market == market.key()` and `market.book == book.key()`.
    - An order handle is `(node_idx: u32, seq: u64)`, and cancel checks `seq` to prevent ABA after a slab slot is reused.
    - **Release as soon as the window is Locked and the book is empty**, not after settlement. All orders expire by `lock_at`, so a sweep can drain the book, and each series needs about 2 books.
    - Release increments `generation` and zeroes the ladder and bitmaps.

12. **Seat model.**
    - (a) Callers pass a `seat_hint: u16`; the engine verifies it, and a new trader gets the first empty seat.
    - (b) `roller_open_window` pre-allocates seats for the PDAs in `config.program_authorities` (vault, maker, leverage, arena, desk), flagged `PROGRAM`, so a squatted ledger can't lock the products out.
    - (c) **Private uses one desk seat, not "slot seats"**: in Masayume the desk is the single taker and slots are its own storage.
    - (d) A seat is reusable only when all balances are 0 and `open_orders == 0`.
    - (e) Add a `use_credit: bool` argument so the vault can turn off credit-first funding on its pooled seat.

13. **Return data instead of before/after deltas.**
    - `set_return_data(PlaceResult{filled_lots, cash_spent, cash_received, credit_used, transferred_in, refunded, rested_handle, evictions})`, ≤ 1,024 B.
    - Masayume measured deltas because its venue was external; here products book directly from the result. The maker's `escrowBack` becomes `credit_used`.
    - Callers must drop `AccountLoader` borrows before the CPI, or it fails with `AccountBorrowFailed`.

14. **Ledger closure, and why "Unclaimed records" doesn't work.** Writing unclaimed records would need N account inits and N rents.
    - **Fix:**
      - The settler calls `public_redeem_for(seat_idx)` for every non-PROGRAM seat. It pays to `seat.owner`'s ATA, which the cranker creates idempotently.
      - PROGRAM seats are redeemed only through their own programs.
      - `public_close_ledger` runs once `open_seats == 0` and sends rent to the recorded `rent_payer`.
      - That makes redeem-after-close impossible by construction.
    - Vault side: `vault_settle_window` redeems the whole vault seat once and stores `VaultWindow{yes_num, no_num}`. Per-owner `crank_settle` then credits `floor(position × num / 1e7)`, so closing the ledger doesn't wait on every owner.

15. **One token vault per window, not per series.** A series-level token account write-locks every token-moving trade in the series, and makes redemptions on window N contend with trading on N+1.
    - **Fix:** a `["mvault", market]` token account (165 B; CPI init is fine) with the market PDA as authority, closed together with the Ledger.
    - Invariants:
      - before settlement: `ΣYES == ΣNO == backing` and `mvault ≥ backing + Σcredit + Σlocked_cash`
      - after settlement: `mvault ≥ Σ unredeemed payouts`
    - Donations: anyone can send tokens to `mvault`, and `CloseAccount` fails on a non-zero balance. So sweep the residual to `config.treasury` first, then close.

16. **Redeem rules.**
    - Allowed only when the market is Resolved or Voided and the seat has `open_orders == 0`.
    - Payout = `credit + floor((yes × yN + no × nN) / 10^7)`.
    - Keep partial `redeem(outcome, lots)` for PROGRAM seats, matching DreamDEX's API.
    - `user_withdraw_credit` pays only a token account owned by the authority.

17. **Token program.** Pin `config.collateral_mint` and `config.token_program == spl_token::ID`, and reject Token-2022 mints. Use `transfer_checked`. Every payout goes to an ATA-constrained destination, which satisfies AD-5.

18. **Batch the fill events.** Each `emit_cpi!` counts toward the 64-entry instruction trace and costs compute; a vault-wrapped IOC with 32 fills would come close to the limit.
    - **Fix:** emit one `OrderExecuted{fills: Vec<FillRecord ≤ 32>, evicted: Vec<Handle>}` per instruction, about 3 KB, well under the 10 KB CPI data cap.

19. **Book views must walk order nodes.** `Level.live_lots` still counts expired orders that haven't been evicted.
    - `levels`, `vwap_over_depth` and `exit_walk` must walk the FIFO nodes and skip expired orders.
    - Cost is bounded by capacity: 512 nodes, about 20–30k CU worst case.

20. **Parlay/Range prices can be manipulated within one transaction.** An attacker rests post-only liquidity, opens a parlay or range priced off it, then cancels, all in one tx, at zero cost. The same exposure existed on Somnia.
    - **Fix (invisible to honest users):** each order node stores `placed_slot`, and `book_view` ignores orders placed in the current slot.

21. **Product-program iterables.** Masayume's `_open`, `lockedByExpiry` and `unsettledExpired` loops can't become PDAs passed as remaining accounts, and `init_if_needed` is banned.
    - **Fix:** fixed inline arrays in reserve state:
      - maker: 16 × (market, `lock_at`, WindowBook), about 2 KB
      - leverage: 256 × (id, expiry)
      - parlay and range: 32 × (expiry, locked), with zero entries reused

22. **Vault grant nonce.** A `Grant` PDA keyed by (owner, kind) gets overwritten when the owner re-grants.
    - **Fix:** `VaultPosition` stores `(kind, grant_nonce)`, and `openPositions` is decremented only when the nonce matches.

23. **Arena agent spend.** Masayume relies on ERC-20 allowance, but an SPL token account allows only one delegate.
    - **Fix:** at create/join, escrow `pot + perCardCap × deckSize` into the arena's token account; unspent budget goes to `creditOf` at finalize or refund.
    - Keep keccak256 (the `sol_keccak256` syscall) with the same packing, changing only `chainId` → cluster id and `arena` → program-id bytes. Only the golden vector gets regenerated.

24. **Private claim.** Masayume checks the desk-signed claim off-chain against the on-chain `desk` pubkey, but the draft says it is verified on-chain. Either drop that line or treat it as a new feature.
    - Charge and credit keys become marker PDAs `["charge"|"credit", owner, key]`: `init` fails on reuse, and they are never closed.

25. **Wrong or inconsistent plan facts.**
    - Rent: this review said 6,960 lamports per byte plus a 128 B header, making a 65 KB account ≈ 0.45 SOL. **Corrected by measurement to 5,080 lamports/byte (see header).**
    - The accounts table still says "red-black tree or sorted slab" but the design is a ladder.
    - Anchor is 1.1.2 in one place and `avm use 1.2.0` in another. Pin `anchor-*` to `=1.1.2`; `pyth-solana-receiver-sdk` 2.0.0 only needs `^1.0.2`.

26. **Behaviours to model, not fix.**
    - Ties are much more common for equities (0.01 ticks over 5 minutes), and "Up wins when close ≥ open" hands them to Up. The maker's fair value and the UI must account for that.
    - Complete-set mint/merge is Trading-only, so the maker actor must merge before `lock_at`.

## 2. Account and instruction spec

### `agari-events` state

Sizes include the 8-byte discriminator. This review computed rent as `(size + 128) × 6,960`; with the measured 5,080 lamports/byte, scale by 0.73.

| Account | Seeds / kind | Fields | Size | Rent (review's rate) |
|---|---|---|---|---|
| `GlobalConfig` | PDA `["config"]` | admin, mode u8, collateral_mint, token_program, treasury, rollers[4], attestors[4], program_authorities[8], max_conf_bps u16, bump, _reserved[64] | ~760 B | 0.006 |
| `Series` | PDA `["series", ticker u16, cadence u32, basis u8]` | ticker, cadence_sec, basis, print_source, pyth_feed_id[32], attest_source_id u16, lot_base/tick_base u32, min_lots u32, settlement_window_sec, print_grace_sec, fills_cap u8, evictions_cap u8, next_index u64, last_expiry i64, free_books[4], free_count, bump, _reserved[64] | ~340 B | 0.003 |
| `Market` | PDA `["market", series, index u64]` | series, index, trading_start, lock_at, expiry, boundary_kind, print_source, status, open/close `Print{price i64, expo i32, publish_ts i64, source u8}`, payout_yes/no u32 (denominator 10⁷), backing_lots, book, ledger, mvault, volume_cash, volume_lots, trade_count u32, last_price u16, last_trade_ts, event_seq, rent_payer, bumps, _reserved[64] | ~380 B | 0.0035 |
| `Book` | keypair, zero-copy, recycled | header{market, series, generation u32, next_seq u64, order_count u16, free_head u32, bid_bits[u64;16], ask_bits[u64;16], _reserved} ~440 B; `bids/asks: [Level{head u32, tail u32, live_lots u64}; 1000]` 32,000 B; `nodes: [OrderNode{lots u64, seq u64, expire_ts i64, placed_slot u64, price u16, seat u16, kind u8, flags u8, _pad[2], prev u32, next u32}; 512]` 24,576 B | 57,024 B | **0.398** (0.312 with 256 nodes) |
| `Ledger` | PDA `["ledger", market]`, zero-copy | header{market, seats_used u16, open_seats u16, rent_payer, _reserved} 72 B; `[Seat{owner, credit, locked_cash, yes_free, yes_locked, no_free, no_locked: u64; open_orders u16, flags u8, _pad[5]}; 96]` | 8,528 B | 0.060 |
| `mvault` | `["mvault", market]` token account | SPL token account, authority = market PDA | 165 B | 0.002 |

### `agari-events` instructions

Signer shorthand: w = writable, r = read-only, S = signer.

| Instruction | Signers / accounts | Checks → effects |
|---|---|---|
| `admin_init_config`, `admin_register_series`, `admin_add_book`, `admin_set_mode`, `admin_set_authorities` | admin S; Book pre-created (zeroed) in the same transaction | grid divisibility, feed id → init; push the book onto `free_books` |
| `roller_open_window(index, trading_start, lock_at, expiry)` | roller S, payer S; w series, market (init), ledger (init), mvault (init), book | checks from gap #6; binds book (`generation++`), pre-allocates PROGRAM seats → `WindowOpened` |
| `public_record_print_pyth(which)` | payer S; r series, `Account<PriceUpdateV2>`; w market | source == Pyth, Full verification, feed id, `prev_publish_time < T ≤ publish_time ≤ T + grace`, confidence cap, slot empty → `PrintRecorded` |
| `public_record_print_attested(which, price, expo, source_ts)` | r instructions sysvar | checks from gap #7 |
| `public_copy_open_from_prev` | r prev market (seeds with index − 1); w market | rule from gap #8 |
| `user_place_order(kind, price_ticks, lots, expire_ts, order_type, self_match, max_fills, max_evictions, seat_hint, use_credit, withdraw_proceeds, client_id)` | authority S (wallet, or PDA via CPI); r config, series; w market, book, ledger, mvault, authority_token; r mint, token_program, event_authority | See below |
| `user_cancel_orders(handles ≤ 16, withdraw)`, `user_reduce_order`, `user_cancel_all(max_scan)` | authority S | Trading or Locked; missing handles are skipped |
| `public_sweep_expired(max)` | anyone | evicts expired orders from the best levels; after lock, evicts all |
| `user_mint_complete_set(lots)`, `user_merge_complete_set(lots)` | authority S | Trading only; `backing ±= lots` |
| `user_withdraw_credit(amount)` | authority S | pays a token account owned by the authority |
| `public_settle_window` | anyone | both prints present → payout vector; close ≥ open means Up |
| `public_void_expired` | anyone | rule from gap #8 → 0.5/0.5 |
| `public_release_book` | anyone; w series, book | status ≥ Locked, `order_count == 0` |
| `user_redeem(outcome: Option, lots: Option)` | authority S | terminal market, `open_orders == 0` |
| `public_redeem_for(seat_idx)` | anyone; w owner ATA | seat is not PROGRAM |
| `public_close_ledger` | anyone | `open_seats == 0`; sweep mvault residual to treasury, close both → `rent_payer` |

`user_place_order` in detail:
- **Checks:** mode; `trading_start ≤ now < lock_at`; `0 < price < 1000`; lots is a multiple of the lot size and ≥ min; `now < expire_ts ≤ lock_at`; open-order cap.
- **Effects:**
  1. Escrow: credit first, then `transfer_checked`.
  2. Four-path match.
  3. Rest, cancel or revert.
  4. Refunds and counters.
  5. `PlaceResult` return data + `OrderExecuted` event.

**Errors:** `InvalidMode`, `NotAdmin`, `NotRoller`, `BadGrid`, `BadWindowIndex`, `WindowOverlap`, `BadAlignment`, `BadHorizon`, `NoFreeBook`, `BookMarketMismatch`, `LedgerMarketMismatch`, `MarketNotTrading`, `MarketNotLocked`, `MarketNotTerminal`, `MarketAlreadyTerminal`, `InvalidPrice`, `InvalidQuantity`, `BelowMinLots`, `OrderAlreadyExpired`, `ExpiryAfterLock`, `PostOnlyWouldCross`, `ImmediateOrCancelNoFill`, `FillOrKillNotFillable`, `BookFull`, `LedgerFull`, `TooManyOpenOrders`, `SeatMismatch`, `UnknownOrder`, `NotOrderOwner`, `ReduceNotSmaller`, `ExpiredOrderMustBeCancelled`, `InsufficientCredit`, `InsufficientOutcome`, `WrongMint`, `WrongTokenProgram`, `WrongPrintSource`, `PrintAlreadyRecorded`, `FeedIdMismatch`, `InsufficientVerification`, `PrintTooEarly`, `PrintNotUnique`, `PrintTooLate`, `ConfidenceTooWide`, `BadAttestation`, `UnknownAttestor`, `CpiNotAllowed`, `PrintsMissing`, `SettlementWindowOpen`, `OpenOrdersRemain`, `ProgramSeatNotPublic`, `LedgerNotEmpty`, `MathOverflow`.

### Product programs: what changes on Solana

**Common to all:**
- Engine accounts are read with `agari-common::view::load_checked`: `UncheckedAccount`, owner == `AGARI_EVENTS_ID`, discriminator, bytemuck cast, then the Market/Book binding check. `AccountLoader` only works for accounts the program owns.
- Engine writes go through `Program<'info, AgariEvents>` with typed CPI.
- Each program's seat owner is a `["seat"]` PDA.
- Product seats always pass `withdraw_proceeds = true`, so each program's token account equals its `liquid` (Masayume's `_collect` invariant).

| Program | Accounts it owns | Engine CPIs | Notes |
|---|---|---|---|
| vault | `VaultConfig`; `Account ["acct", owner]{available, private_available, totals}`; `Grant ["grant", owner, kind]{actor, caps, budget, expires, spent_day, spent_today, open_positions, nonce, revoked}`; `VaultPosition ["pos", owner, market]{yes, no, kind, nonce, tally fields}`; `VaultWindow ["vwin", market]`; 8 USDC token-account shards `["usdc", owner[0] % 8]` | `place`/`place_for` → `user_place_order` (IOC, CancelTaker, `use_credit = false`); `vault_settle_window` → `user_redeem` | Exact check order: live → price cap → worst-case escrow ≤ budget → place → per-trade cap on actual spend → daily → budget → open. Sale proceeds go to `available`. |
| strategy | `Strategy ["strategy", id]` (metadata ≤ 256 B), `Subscription ["sub", strategy, subscriber]` | none | Reads `Grant` (owner, seeds, kind check); fee via `transfer_checked` to the creator's ATA. Consider folding into the vault program to save deploy rent. |
| parlay | `Reserve{liquid, locked, shares, params, expiry_locks[32]}`, `Share ["share", owner]`, `Parlay ["parlay", owner, nonce]` with ≤ 8 inline legs | none | Legs = (Market, Book) pairs in remaining accounts, checked for duplicates and binding. Correlation floor, `floorStake` and void refund unchanged. |
| range | same reserve shape + `Vol ["vol", series]`, `Round` | none | Refuses to open until `Market.open` is recorded. Band stored in the print exponent. Settles on `Market.close` or voided; `void_stale` kept. |
| leverage | `Reserve` + inline open[256], `LWindow ["lwin", market]{fronted}`, `Position ["lpos", id]` | IOC buy/sell; partial `user_redeem` | Mark = `exit_walk(cost) − 1`. Knock-out refused once Locked (the engine rejects it anyway). |
| maker | `MakerVault{params, liquid, shares, maker, paused, open[16]{market, lock_at, WindowBook}}`, `Share` | `quote` → 2× PostOnly (BUY_YES@bid, BUY_NO@ask); `pull` → `user_cancel_all`; `merge` → merge set; `settle` → sweep + redeem | Escrow is exactly `lots × p` and `lots × (1000 − p)`. Withdraw checks the inline array, so no remaining accounts. |
| private | `Desk{pool, owed, in_slots, desk, params}`, `Budget ["budget", owner]`, charge/credit markers, `Slot ["slot", slot_id]` (no owner) | `mint_in_slot` → IOC; `settle_slot` → partial redeem | One desk seat. Stake-first walk, then cap size so escrow ≤ stake. |
| arena (+ season) | `Match ["match", id]` with cards[8], picks[16], masks, pnl, agents[2]; `Tier`; `Credit ["credit", player]`; `Season ["season", id]` | `place_pick` → IOC; `settle_card` → partial redeem per pick | Escrow per gap #23. `distribute` checks winner ATAs in remaining accounts. |

## 3. CPI map, locking and costs

**CPI depth** (limit 4):

| Path | Depth |
|---|---|
| wallet → events → token / self `emit_cpi` | 2 |
| wallet or session key → vault → events → token / emit | 3 |
| maker key → maker → events (×2) → token | 3 |
| user → leverage → token (stake) and events → token | 3 |
| desk → private → events → token | 3 |
| player/agent → arena → events → token | 3 |
| parlay/range → token | 2 |

No program should CPI another product program; strategy reads grants instead of calling the vault.

**Locking and parallelism:**
- One window's writes are `{market, book, ledger, mvault}`. Config and Series stay read-only during trading, so windows and lanes run in parallel.
- Globally serialized, and acceptable: the maker (one key) and the leverage/parlay/range reserve states on open.
- The vault avoids a global write by sharding its token accounts.
- Parlay's read locks on books serialize it with trades on those windows. That's fine.

**Estimated compute** (profile with Surfpool before trusting these):

| Operation | CU |
|---|---|
| plain IOC, 10 fills | 60–90k |
| vault-wrapped | 110–150k |
| maker quote (2 orders) | 80–120k |
| parlay open (4 legs, node walks) | 100–250k |
| leverage open | 150–200k |

**Recommended limits:**
- `max_fills` default 16, cap 32; `max_evictions` 16.
- Parlay `maxLegs` ≤ 4 on devnet.
- Compute limit = simulation + 10%.
- The blow-up risks are parlay legs × 512-node walks, and eviction storms.

**Devnet SOL** (review's 6,960 rate; scale by 0.73):
- **Programs:** about 3.5–5 MB of `.so` × 6.96 SOL/MB ≈ **25–35 SOL** locked, plus a refundable deploy buffer peaking at about 6 SOL.
- **Books:** 2 per series. 30 series (8 tickers × 3 regular lanes + 3 token tickers × 2 lanes) = 60 × 0.398 ≈ **24 SOL**. With 256-node books and 19 series, about 12 SOL.
- **Per-window float:** Ledger + mvault ≈ 0.062 SOL, returned at close; about 100 concurrent windows ≈ 6 SOL.
- **Markets:** 0.0035 SOL each, thousands per day. Add `public_close_market` after a retention period, or the balance never stops growing.
- **Total** with the draft's lane plan: ≈ 80–100 SOL (≈ 58–73 SOL at 5,080).

## 4. Security checklist

| Check | Result |
|---|---|
| Owner and type-cosplay on foreign zero-copy reads | ⚠ The draft only says "owner-checked". Specify owner + discriminator + binding in `load_checked`. |
| Signers | ✓ Authority is a `Signer`; PDA authority signs through `invoke_signed`. |
| Arbitrary CPI | ✓ `Program<AgariEvents>`, token program pinned. |
| Reinitialization | ✓ No `init_if_needed`; `#[account(zero)]` for books; marker PDAs. |
| Duplicate mutable accounts | ✓ Anchor 1.x rejects them by default; checked manually for parlay legs and arena cards. |
| PDA sharing | ✓ mvault authority is unique per market. ⚠ `program_authorities` must list the seat PDAs, not program ids. |
| Data matching | ⚠ Add the market↔book↔ledger↔mvault↔series bindings (gap #11). |
| remaining_accounts | ⚠ Parlay legs, arena cards, season winners and batched `redeem_for` must check count, owner, discriminator and seeds. |
| Rounding direction | ✓ Exact grid; floor on void; Masayume's reserve rounding kept. |
| Donation attacks | ⚠ Close can be blocked by a donation (gap #15). Never read `.amount` for accounting. |
| Stale state after CPI | ⚠ Drop loaders before CPI; use return data (gap #13). |
| Self-reentrancy | ✓ The engine never calls products; its only self-CPI is `emit_cpi`. |
| TOCTOU / front-running | ✓ `max_stake`, `min_qty`, `min_proceeds` kept. ⚠ Same-tx book manipulation (gap #20). |
| Sysvar / ed25519 | ⚠ Offsets plus CPI-height checks (gap #7). |
| Unchecked casts | `lots × ticks` in u64; normalize prints in i128 with `try_from`. |
| Upgrade authority | Devnet only; state the trust assumption in the README. |

## 5. Implementation order and minimum tests

1. **`crates/agari-common`:** grid math, `PlaceResult`, seeds, `view::load_checked`, book walks. **Freeze the account layouts and instruction signatures first**, even with stub handlers, so other agents aren't blocked.
2. **`agari-events` trading core:**
   - files: `state/{config,series,market,book,ledger}.rs`, `book/{ladder,slab}.rs`, `matching/{loop,paths,evict}.rs`, `instructions/*`
   - instructions: open, place, cancel, sweep, mint/merge
3. **`agari-events` settlement:** prints, settle/void, redeem, release, close. Then Codama clients and one Surfpool drive, which unblocks `packages/markets`.
4. **Parallel agents** once step 1 is frozen:

   | Agent | Scope | Can start after |
   |---|---|---|
   | A | vault + strategy | step 1 |
   | B | maker + leverage | step 2's CPI surface |
   | C | parlay + range | step 1 (views + Market layout only) |
   | D | private + arena/season | step 1 |

**Tests.** Mostly pure Rust over the math crates; LiteSVM only where a CPI or settlement is involved.
- **Engine (LiteSVM):**
  - four fill paths with exact cash and outcome amounts, and `ΣYES == ΣNO == backing`
  - eviction credit
  - IOC zero-fill revert; PostOnly with an expired order at the top of book
  - print rule: too early, too late, stale, wrong source, forged ed25519 offsets
  - redeem 1/0, void 0.5
  - a stale handle can't cancel on a recycled book
- **Vault:** replay `caps.vectors.json` in pure Rust; one `place_for` CPI booking; grant nonce.
- **Maker:** `credit_used` booked as `escrowBack`; withdraw blocked while a window is unsettled.
- **Leverage / parlay / range:** replay the `sizing`, `pricing` and `moonshot` vectors in pure Rust; parlay void refund.
- **Private / arena:** key reuse rejected; commitment vector; forfeit path.

## 6. Open questions for the user

The approved plan resolves these; this list is kept as history.

1. **Session-close and Gap-open prints (gap #4):** attested Alpaca close, or wait for a Pyth extended-hours entitlement? Resolved in PD-1.
2. **Devnet SOL budget vs lanes:** which lanes launch first, and should strategy be folded into vault and parlay into range? The plan keeps 9 programs, with folding as a fallback.
3. **Same-slot order exclusion (gap #20):** superseded by PD-2's defence in depth.

### Critical files for implementation
- `/Users/abu/.claude/plans/golden-stargazing-fiddle.md`
- `/Users/abu/dev/hackathon/sommina-events/contracts/src/vault/EventVault.sol`
- `/Users/abu/dev/hackathon/sommina-events/contracts/src/maker/MakerGateway.sol`
- `/Users/abu/dev/hackathon/sommina-events/contracts/src/leverage/LeverageMath.sol`
- `/Users/abu/dev/hackathon/sommina-events/reference/markets-sdk/package/src/tradeAbi.ts`
