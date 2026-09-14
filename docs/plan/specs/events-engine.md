# `agari-events` engine spec — semantics (frozen at S2.1)

**Status:** frozen 2026-09-14 (S2 spec step). Changes only through a `D-` entry.

**Scope:** DreamDEX Event Contracts rebuilt as an Anchor CLOB (plan P§3.1). One truth for the S2 slices:

| Slice | Reads |
|---|---|
| 2a orders + matching | this file §1–§6, [`events-instructions.md`](events-instructions.md) §3 |
| 2b prints + settle + redeem | this file §7–§8, [`prints.md`](prints.md), [`events-instructions.md`](events-instructions.md) §2, §5 |
| 2c sets + admin + roller + deploy | this file §5, §8, [`events-instructions.md`](events-instructions.md) §1, §4 |
| 2d `book_walk`, TS mirror, codegen | this file §9, [`events-accounts.md`](events-accounts.md) |

**Companion files:**
- [`events-accounts.md`](events-accounts.md): byte layouts, sizes, rent, seeds, enums, errors, events, `PlaceResult`.
- [`events-instructions.md`](events-instructions.md): every instruction's accounts, args, checks in order, effects, events.
- [`prints.md`](prints.md): policy versions, admission deadlines, per-source verification, cross-check, void reasons.

**Evidence:** `C:06` (DreamDEX reconstruction), `C:08` (26 corrections), `R:dreamdex-docs/trading/common/order-types.md` (revert table, self-trade prevention), `R:dreamdex-markets-sdk/package/src/{store.ts:317-335 (fill-kind matrix), derivedReads.ts:556-700 (stake walk)}`, `R:phoenix-v1/src/state/markets/fifo.rs:1190-1330` (match loop), decisions D-002…D-009.

## 1. Units and grid

- **Collateral:** SPL Token (never Token-2022), `dec` decimals (tUSDC: 6). All cash is `u64` base units.
- **Price:** `price_ticks: u16 ∈ 1..=999`, **always in YES terms**. `PAIR_TICKS = 1000`; the NO price of a YES price `p` is `1000 − p`.
- **Size:** `lots: u64`. One lot is `lot_base` outcome base units.
- **Cash unit:** `cu = lot_base × tick_base / 10^dec`, fixed per Series (`Series.cash_unit`). Registration requires `tick_base × 1000 == 10^dec` and `lot_base × tick_base % 10^dec == 0`, so `cu ≥ 1` is an integer.
- **Launch grid:** `lot_base = tick_base = 1,000`, `dec = 6` ⇒ `cu = 1`. One contract = 1,000 lots; 1 lot at 620 ticks costs 620 base units (0.000620 USDC).
- **Exactness:** cash of a fill is `lots × p × cu` and `lots × (1000 − p) × cu`. They always sum to `lots × 1000 × cu`, the backing of `lots` pairs. Void payout `lots × 500 × cu` is exact. **No rounding happens anywhere in the engine** except the floor in the redeem formula (§8.4), which is exact on this grid.
- **Arithmetic:** every `+ − ×` on money uses `checked_*` → `MathOverflow`. Casts use `try_from`.
- **Time:** `now = Clock.unix_timestamp` (seconds). `slot = Clock.slot`.

## 2. Kinds, sides, the book

| Kind | Code | Book side | Escrow when it rests | Per-lot cash at price `p` |
|---|---|---|---|---|
| `BUY_YES` | 0 | Bid | `locked_cash += lots·p·cu` | pays `p·cu` |
| `SELL_YES` | 1 | Ask | `yes_free → yes_locked` (`lots`) | receives `p·cu` |
| `BUY_NO` | 2 | Ask | `locked_cash += lots·(1000−p)·cu` | pays `(1000−p)·cu` |
| `SELL_NO` | 3 | Bid | `no_free → no_locked` (`lots`) | receives `(1000−p)·cu` |

- **One YES-quoted book per Window.** Bids are ordered by price descending, asks ascending. Priority within a price is FIFO by arrival (price-time).
- **Crossing:** a bid-side taker at limit `L` crosses asks with `ask_price ≤ L`. An ask-side taker at `L` crosses bids with `bid_price ≥ L`.
- **Fill price = the maker's price `M`** (DreamDEX docs `market-structure.md:50`; C:06 §2). The taker's better-than-limit difference is never pulled (§4.1).

### 2.1 The four paths (fill-kind matrix, `store.ts:317-335`)

For a fill of `q` lots at maker price `M` (`cu = 1` below):

| Taker × maker | Path | Taker | Maker | `backing_lots` |
|---|---|---|---|---|
| BUY_YES × SELL_YES | `DIRECT_YES` (0) | pays `q·M`; `yes_free += q` | `yes_locked −= q`; `credit += q·M` | — |
| SELL_YES × BUY_YES | `DIRECT_YES` (0) | `yes_free −= q`; receives `q·M` | `locked_cash −= q·M`; `yes_free += q` | — |
| BUY_NO × SELL_NO | `DIRECT_NO` (1) | pays `q·(1000−M)`; `no_free += q` | `no_locked −= q`; `credit += q·(1000−M)` | — |
| SELL_NO × BUY_NO | `DIRECT_NO` (1) | `no_free −= q`; receives `q·(1000−M)` | `locked_cash −= q·(1000−M)`; `no_free += q` | — |
| BUY_YES × BUY_NO | `MINT_PAIR` (2) | pays `q·M`; `yes_free += q` | `locked_cash −= q·(1000−M)`; `no_free += q` | `+= q` |
| BUY_NO × BUY_YES | `MINT_PAIR` (2) | pays `q·(1000−M)`; `no_free += q` | `locked_cash −= q·M`; `yes_free += q` | `+= q` |
| SELL_YES × SELL_NO | `BURN_PAIR` (3) | `yes_free −= q`; receives `q·M` | `no_locked −= q`; `credit += q·(1000−M)` | `−= q` |
| SELL_NO × SELL_YES | `BURN_PAIR` (3) | `no_free −= q`; receives `q·(1000−M)` | `yes_locked −= q`; `credit += q·M` | `−= q` |

"Taker pays" is funded at the end of the placement (§4.1). "Taker receives" is credited to the taker's `credit`, then optionally withdrawn (§4.3). A taker's sell lots are debited from `*_free`; the placement checks `*_free ≥ lots` before matching.

### 2.2 Worked numbers (launch grid, `cu = 1`, amounts in base units; 1 USDC = 1,000,000)

Seats A, B, C, D in one Window. `credit`/`transferred_in` are base units; YES/NO are lots.

1. **DIRECT_YES.** A holds 5,000 YES and rests `SELL_YES 5,000 @ 540` → A `yes_free 0, yes_locked 5,000`. B sends `BUY_YES 3,000 @ 560 IOC`. The best ask 540 ≤ 560 → one fill of 3,000 @ 540.
   - B pays 3,000 × 540 = **1,620,000** (worst case at the limit 1,680,000; `refunded` 60,000, never pulled). B `yes_free 3,000`.
   - A `yes_locked 2,000` (still resting), `credit 1,620,000`. Backing unchanged.
2. **DIRECT_NO.** A holds 2,000 NO and rests `SELL_NO 2,000 @ 450` (bid; A receives 550 per lot). C sends `BUY_NO 2,000 @ 430 IOC` (pays at most 570 per lot). The bid 450 ≥ 430 → fill 2,000 @ 450.
   - C pays 2,000 × 550 = **1,100,000** (worst 1,140,000; `refunded` 40,000). C `no_free 2,000`.
   - A `no_locked 0`, `credit += 1,100,000`.
3. **MINT_PAIR.** A rests `BUY_YES 10,000 @ 620`: A `locked_cash 6,200,000`, pulled by transfer. `mvault = 6,200,000`. D sends `BUY_NO 4,000 @ 600 IOC`. The bid 620 ≥ 600 → mint 4,000 @ 620.
   - D pays 4,000 × 380 = **1,520,000** (worst 1,600,000; `refunded` 80,000). D `no_free 4,000`.
   - A `locked_cash 3,720,000`, `yes_free 4,000`. `backing_lots 4,000` (= 4,000,000 base = 2,480,000 from A + 1,520,000 from D).
   - `mvault = 7,720,000 = locked 3,720,000 + backing 4,000,000` ✓.
4. **BURN_PAIR.** A (4,000 YES) rests `SELL_YES 4,000 @ 700`. D (4,000 NO) sends `SELL_NO 4,000 @ 720 IOC` (accepts ≥ 280 per NO). The ask 700 ≤ 720 → burn 4,000 @ 700.
   - D receives 4,000 × 300 = **1,200,000**; A receives 4,000 × 700 = **2,800,000**. Both credited.
   - `backing_lots −= 4,000`, releasing 4,000,000 = 2,800,000 + 1,200,000 ✓.
5. **Credit-first funding.** A has `credit 3,720,000` and sends `BUY_NO 5,000 @ 300 Normal, use_credit = true`. Nothing crosses; the order rests. Need = 5,000 × 700 = 3,500,000 → `credit_used 3,500,000`, `transferred_in 0`, A `credit 220,000`, `locked_cash += 3,500,000`.
6. **Fill cap, remainder cancelled.** Asks: X 1,000 @ 550, Y 1,000 @ 560, Z 5,000 @ 580. B sends `BUY_YES 10,000 @ 600 Normal, max_fills = 2`.
   - Fills X and Y; the cap is reached while Z @ 580 still crosses → the 8,000 remainder is **cancelled, not rested** (§3.3).
   - `cash_spent 1,110,000`, `cancelled_lots 8,000`, `refunded` = 10,000 × 600 − 1,110,000 = 4,890,000.
7. **PostOnly over its own expired quote.** Maker M's `BUY_NO 2,000 @ 610` expired at `expire_ts ≤ now`. M sends `PostOnly BUY_YES 2,000 @ 612`.
   - The cross walk meets the expired ask @ 610 → evicts it (M `credit += 2,000 × 390`) → no live crossing order → rests. **No revert** (the Masayume `Panic(17)` class, `C:08` #9).
8. **Settle and redeem (from state 3).** After `lock_at`, a sweep evicts A's resting bid → A `credit 3,720,000`, `locked_cash 0`.
   - Up wins (close ≥ open): `payout_yes = 10,000,000`, `payout_no = 0`. A redeems 3,720,000 + ⌊4,000 × 1,000 × 10⁷ / 10⁷⌋ = **7,720,000**; D redeems 0. Total = `mvault` ✓.
   - Void instead (5,000,000 / 5,000,000): A 3,720,000 + 2,000,000 = 5,720,000; D 2,000,000. Total 7,720,000 ✓.

## 3. Placement and the match loop

### 3.1 Order types (DreamDEX numbering, `C:06` §1)

| Type | Code | Behaviour |
|---|---|---|
| Normal | 0 | Matches, then the remainder rests — except when matching stopped on a cap (§3.3), where it is cancelled |
| FOK | 1 | Matches; reverts `FillOrKillNotFillable` unless `remaining == 0` |
| IOC | 2 | Matches; the remainder is cancelled; reverts `ImmediateOrCancelNoFill` when `filled_lots == 0` |
| PostOnly | 3 | Never fills. Cross walk (§3.4) first; reverts `PostOnlyWouldCross` if a live crossing order exists; otherwise rests |

**A revert rolls back the whole transaction on Solana:** evictions, seat claims, fills and transfers performed earlier in the same instruction are all undone (and earlier instructions in the same transaction too). An IOC that fills nothing therefore also undoes its evictions, so expired dust survives until `public_sweep_expired` runs.

### 3.2 Self-match (DreamDEX docs `order-types.md` "Self-Trade Prevention")

A self-match is a live maker node whose `seat == taker seat`.
- **CancelTaker (0), default:** the placement **reverts `SelfMatchCancelTaker`**, exactly as DreamDEX's revert table lists it. This supersedes `C:08` #10 (D-008).
- **CancelMaker (1):** the maker node is cancelled (its escrow is returned to the seat, §5.2), one unit of the `max_fills` budget is consumed, and matching continues.
- Expired own nodes are **evicted** (§5.1), never treated as self-matches.

### 3.3 The match loop (`matching/engine.rs`)

Budgets per placement: `fills + self_cancels ≤ max_fills` (1..=`min(32, series.fills_cap)`), `evictions ≤ max_evictions` (0..=`min(16, series.evictions_cap)`), `skips ≤ MAX_SKIPS = 64`.

```
remaining = lots
for level in opposite side, best price first, while level.price crosses L:
  for node in level FIFO (head → tail):
    if remaining == 0: stop(Filled)
    if node.expire_ts <= now:                       # expired
      if evictions < max_evictions: evict(node); evictions += 1   # §5.1, credits the owner
      else: skips += 1; if skips == MAX_SKIPS: stop(SkipCap)      # left in place
      continue
    if node.seat == taker_seat:
      if self_match == CancelTaker: revert SelfMatchCancelTaker
      if fills + self_cancels == max_fills: stop(FillCap)
      cancel(node); self_cancels += 1; continue      # §5.2
    if fills + self_cancels == max_fills: stop(FillCap)
    q = min(remaining, node.lots); fill(node, q, M = level.price); fills += 1; remaining -= q
stop(NoCross)                                        # no crossing node left (expired skips may remain)
```

- **Remainder (Normal):** rests only on `NoCross` (or `Filled` with nothing left). On `FillCap`/`SkipCap` the remainder is **cancelled**, never rested crossed (plan P§3.1 item 4).
- **Resting over skipped expired nodes is allowed:** they are dead liquidity, ignored by every view (§9), and evicted by the next taker or sweep.
- **Rest:** `open_orders < 16` else revert `TooManyOpenOrders`; a free node else revert `BookFull`; append at the level tail; set the bitmap bit; `live_lots += remaining`; lock escrow (§2). The node gets `seq = book.next_seq++`, `placed_slot = slot`, `expire_ts`.
- **`fill(node, q, M)`:** applies §2.1 to both seats; `node.lots −= q`, `level.live_lots −= q`; if `node.lots == 0`, unlink, free the node, `order_count −= 1`, maker `open_orders −= 1`, and clear the bitmap bit if the level empties. Market counters: `volume_lots += q`, `volume_cash += q·M·cu` (YES notional, as DreamDEX `quoteQuantity`), `trade_count += 1`, `last_price = M`, `last_trade_ts = now`.

### 3.4 PostOnly cross walk

Walks the opposite side exactly like §3.3 but never fills: expired nodes are evicted (≤ `max_evictions`) or skipped (≤ `MAX_SKIPS`); a self-owned live node or any live crossing node → revert `PostOnlyWouldCross`; `SkipCap` → revert `PostOnlyWouldCross` (crossing can't be ruled out). Nothing crossing → rest. `open_orders < 16` is checked before the walk.

## 4. Escrow, funding, refunds, proceeds

### 4.1 Exact funding (D-008)

The engine matches first, then pulls exactly what the taker owes. The transaction is atomic, so a failed transfer reverts the matching too.

- `need = cash_spent + rest_escrow + bond` where
  - `cash_spent` = Σ taker "pays" amounts in §2.1 (buy kinds only);
  - `rest_escrow` = `rested_lots × p_cost` with `p_cost = L·cu` (BUY_YES) or `(1000−L)·cu` (BUY_NO), else 0;
  - `bond` = `ledger.seat_bond` if this placement claimed a new seat (§6), else 0.
- `credit_used = use_credit ? min(seat.credit, need) : 0`; `seat.credit −= credit_used`.
- `transferred_in = need − credit_used` via `transfer_checked(authority_token → mvault, authority)`, skipped when 0.
- `refunded` (report only, nothing moves) = `lots × p_cost − cash_spent − rested_lots × p_cost` for buy kinds; 0 for sells. It covers both the better-than-limit difference and the cancelled remainder.
- **Sells** lock or consume outcome lots only; a cancelled sell remainder stays in `*_free` (`cancelled_lots` reports it).

### 4.2 Maker side

Makers are never paid by transfer inside someone else's placement. All maker cash goes to `credit`; outcome goes to `*_free`. Makers collect with `user_withdraw_credit`, a `withdraw` flag on their next call, or at redeem.

### 4.3 `withdraw_proceeds` (Masayume `_collect`)

When `true`, after funding: `withdrawn = seat.credit` (the **whole** post-trade credit: this placement's proceeds plus earlier maker proceeds) is transferred `mvault → authority_token`, signed by the Market PDA; `seat.credit = 0`. Product seats always pass `true`, so a product's token account equals its `liquid`. With `use_credit = false` (the vault's pooled seat), a placement may both pull (`transferred_in`) and pay out (`withdrawn`). They are never netted, so products book each gross amount.

### 4.4 Return data

`PlaceResult` (layout in `events-accounts.md` §5) is written with `set_return_data` as the **last action** of the instruction, after `emit_cpi!` and every token CPI: the runtime clears return data before each CPI (Solana docs "CPI cost model: return data"). A product CPI caller reads `get_return_data()` immediately after the engine CPI and checks the returned program id equals `agari_events::ID`. It must drop its own `AccountLoader` borrows before the CPI.

## 5. Removing orders

### 5.1 Eviction (expired nodes; matching, PostOnly walk, sweep)

`evict(node)` = unlink + free + `order_count −= 1` + owner `open_orders −= 1` + refund escrow to the **owner's** seat:
- BUY_YES: `locked_cash −= lots·p·cu`, `credit += lots·p·cu`
- BUY_NO: `locked_cash −= lots·(1000−p)·cu`, `credit += lots·(1000−p)·cu`
- SELL_YES: `yes_locked −= lots`, `yes_free += lots`
- SELL_NO: `no_locked −= lots`, `no_free += lots`

Reported in `OrderExecuted.removed` (reason `Expired`) or `OrdersCancelled` (reason `Sweep`).

### 5.2 Cancel, reduce, cancel-all, sweep

- **`user_cancel_orders(handles ≤ 16)`:** each handle `(node, seq)` is live only if `node.flags & LIVE` and `node.seq == seq`; otherwise it is **skipped** (stale; ABA-safe across book recycling because `next_seq` never resets). A live handle whose `node.seat` isn't the caller's seat → `NotOrderOwner`. Refunds exactly as §5.1.
- **`user_reduce_order(handle, new_lots)`:** `min_lots ≤ new_lots < node.lots` (`ReduceNotSmaller`/`BelowMinLots`); **in place, queue priority kept** (tradeAbi comment; `C:06` §1 conflict resolved toward in-place). Refunds `(lots − new_lots)` per §5.1.
- **`user_cancel_all(max_scan)`:** scans nodes `0..high_water` (at most `max_scan` visited) cancelling the caller's live nodes; stops early when the seat's `open_orders` reaches 0.
- **`public_sweep_expired(max)`:** permissionless. Evicts up to `max` nodes (scan by node index) that are expired, **or every node** once `now ≥ lock_at` or the Market is terminal (all expiries are `≤ lock_at`, so after `lock_at` every node is expired anyway; a terminal void before `lock_at` also drains).
- **Status:** cancels, reduces, cancel-all and sweeps work in **every** status and mode (Locked and terminal included), so redeem is never blocked (D-009).

## 6. Seats (PD-8)

- **Seat addressing.** `seat_hint: u16`. If `seats[hint].owner == authority` → use it. If `seats[hint]` is empty (`owner == default`) → claim it. `hint == u16::MAX` → the engine takes the first empty seat (`LedgerFull` if none). Anything else → `SeatMismatch`.
- **Claim.** Scan `0..capacity` for an existing seat of `authority` (`SeatMismatch`: one seat per owner, so self-match detection and the 16-order cap hold). Set `owner`, `flags |= BONDED`, add `ledger.seat_bond` to the placement's `need` (§4.1), `seats_used = max(seats_used, hint + 1)`.
- **Claims happen only in** `user_place_order` and `user_mint_complete_set`.
- **PROGRAM seats.** `roller_open_window` writes `seats[i] = {owner: config.program_authorities[i], flags: PROGRAM}` for every non-zero `i ∈ 0..8`; `seats_used = 8`. A zero entry leaves seat `i` claimable. PROGRAM seats have no bond, are never released, and can't be paid by `public_redeem_for` (`ProgramSeatNotPublic`).
- **Caps.** `open_orders ≤ 16` per seat; `min_lots` per order; `capacity ≤ 1,024`.
- **Growth.** `public_grow_ledger(extra ≤ 116)`: a realloc must stay within `MAX_PERMITTED_DATA_INCREASE` = 10,240 B per top-level instruction, and `116 × 88 = 10,208` (plan's +150 is impossible; D-006). 96 → 1,024 takes 8 calls.
- **Release.** `user_release_seat` requires a drained seat (`credit = locked_cash = yes_* = no_* = 0`, `open_orders = 0`) and not PROGRAM → bond paid to the authority's token account, seat zeroed.
- **Drained.** "Drained" = all six balances 0 and `open_orders == 0` (bond excluded).

## 7. Lifecycle, status and mode

`status(m, now)`:
1. `m.state == Resolved` → **Resolved**; `m.state == Voided` → **Voided** (terminal).
2. `now < trading_start` → **Listed**; `now < lock_at` → **Trading**; else → **Locked**.

A void may make a Window terminal before `lock_at` (open print missing past `open_deadline`, prints.md §6). Trading stops at once: placement requires `Trading` **and** not terminal.

| Instruction family | Listed | Trading | Locked | Terminal |
|---|---|---|---|---|
| `user_place_order`, `user_mint_complete_set`, `user_merge_complete_set` | ✗ | ✓ | ✗ | ✗ |
| cancel / reduce / cancel-all / sweep | ✓ | ✓ | ✓ | ✓ |
| `user_withdraw_credit`, `user_release_seat` | ✓ | ✓ | ✓ | ✓ |
| prints (subject to `now ≥ T`) | ✓ | ✓ | ✓ | ✗ `MarketAlreadyTerminal` |
| `public_settle_window`, `public_void_expired` | per prints.md §5–6 | | | ✗ |
| `public_release_book` | ✗ | ✗ | ✓ | ✓ |
| `public_grow_ledger` | ✓ | ✓ | ✗ | ✗ |
| redeem, redeem-for, close ledger | ✗ | ✗ | ✗ | ✓ |

**Mode** (`GlobalConfig.mode`) never blocks cancel, sweep, withdraw, redeem, merge, prints, settle, void, release or close:

| Mode | Blocks |
|---|---|
| Normal (0) | nothing |
| ReduceOnly (1) | `roller_open_window`, buy kinds in `user_place_order`, `user_mint_complete_set`, `public_grow_ledger` |
| Halted (2) | `roller_open_window`, **all** `user_place_order`, `user_mint_complete_set`, `public_grow_ledger` |

## 8. Sets, settlement, redemption, closure

### 8.1 Complete sets (Trading only)

- **Mint `lots`:** `need = lots × 1000 × cu`, funded as §4.1 (`use_credit` arg); `yes_free += lots`, `no_free += lots`, `backing_lots += lots`. May claim a seat.
- **Merge `lots`:** requires `yes_free ≥ lots` and `no_free ≥ lots` (`InsufficientOutcome`); both `−= lots`, `backing_lots −= lots`, `credit += lots × 1000 × cu`; optional `withdraw` sweeps the credit (§4.3).

### 8.2 Payout

- **Denominator** `PAYOUT_DENOMINATOR = 10,000,000`. **Up (YES) wins iff `close.price ≥ open.price`** (PD-3; ties go to Up) → `(10⁷, 0)`, else `(0, 10⁷)`.
- **Void** → `(5,000,000, 5,000,000)`, reasons `MissingPrint` or `CrossCheckDivergence` (prints.md §5–6).
- `public_settle_window` / `public_void_expired` set `Market.state`, payouts, `resolved_ts`, `void_reason`, the single-source flag, and init `MarketResult`.

### 8.3 Invariants (checked by the randomized harness after every operation)

- **Pairs:** `Σ(yes_free + yes_locked) == Σ(no_free + no_locked) == backing_lots`.
- **Conservation (before settlement):** `mvault.amount ≥ backing_lots × 1000 × cu + Σcredit + Σlocked_cash + Σbond` (equality without donations). Accounting **never reads `mvault.amount`**; only the close sweep does.
- **Book:** `order_count` = live nodes; each level's `live_lots` = Σ its nodes' lots; the bitmap bit is set iff the level has a node; Σ nodes per seat = `open_orders`; each seat's `locked_cash` = Σ its resting buy escrow; `*_locked` = Σ its resting sell lots.
- **After settlement:** `mvault.amount ≥ Σ_seats (credit + locked_cash + bond + payout(seat))`, where Σ `payout` = `backing_lots × 1000 × cu` exactly (`yN + nN = 10⁷`, `ΣYES = ΣNO`).

### 8.4 Redeem

Requires terminal and `seat.open_orders == 0` (`OpenOrdersRemain`; a sweep drains orders after `lock_at` or terminal).
- **Full** (`outcome = None, lots = None`): `payout = ⌊(yes × 1000 × cu × payout_yes + no × 1000 × cu × payout_no) / 10⁷⌋` with `yes = yes_free`, `no = no_free` (locked outcome is 0 once orders are gone). `total = credit + payout + bond` (bond if `BONDED`). Transfer `total`; zero the balances; a non-PROGRAM seat is also cleared (`owner = default`, flags 0).
- **Partial** (`Some(o), Some(l)`): **PROGRAM seats only** (`PartialRedeemNotAllowed`). Pays `⌊l × 1000 × cu × num[o] / 10⁷⌋` and debits `l` from that outcome's free balance. Credit is untouched (use `user_withdraw_credit`).
- **`public_redeem_for(seat_idx)`:** the full redeem of a non-PROGRAM seat, paid only to the Associated Token Account of `(seat.owner, collateral_mint)` (AD-5); the cranker creates the ATA idempotently in the same transaction.

### 8.5 Closure (PD-7)

1. `public_release_book`: status Locked or terminal and `book.order_count == 0` → book back to `series.free_books`, `Market.flags |= BOOK_RELEASED`.
2. `public_close_ledger`: terminal, and every seat in `0..seats_used` is drained with no `BONDED` flag (`LedgerNotEmpty`). The settler first runs `public_redeem_for` on each non-PROGRAM seat (which also refunds bonds); products redeem their PROGRAM seats. **Donation-safe:** `residue = mvault.amount` → `config.treasury`; `CloseAccount(mvault) → rent_payer`; close the Ledger → `rent_payer`; `Market.flags |= LEDGER_CLOSED`. Redeem after close is impossible by construction.
3. `public_close_market`: `MarketResult` exists, `BOOK_RELEASED` and `LEDGER_CLOSED` set, `dependents == 0`, `now ≥ resolved_ts + config.result_retention_sec` (default 21,600) → close `Market` → `market.rent_payer` and `MarketResult` → `result.rent_payer`. A product claim after this finds no `MarketResult` and must use its own captured copy (tested scenario).
4. `product_add_dependent` / `product_release_dependent`: signer ∈ `config.program_authorities` (a seat PDA, not a program id); `dependents ± 1`. The engine doesn't enforce "captured first"; that is the product's obligation.

## 9. Views and book walks (`agari-common::book_walk`, TS mirror `packages/core/src/market/book-math.ts`)

**Shared vectors:** `anchor/tests/vectors/book.vectors.json`. Every walk operates on a checked Book (`view::load_checked`, events-accounts.md §6) and **traverses FIFO nodes**, never `Level.live_lots` alone (it still counts unevicted expired orders, `C:08` #19).

- **Node filter:** live (`flags & LIVE`), `expire_ts > now`, and, when `rested_only` is set (reserve pricing, knock-outs; PD-2), `placed_slot + series.min_rest_slots ≤ current_slot`.
- **`levels(book, side, n, filter) → Vec<(price_ticks u16, lots u64)>`:** best first (bids descending, asks ascending via the bitmaps), aggregating filtered lots per price and omitting levels whose filtered total is 0. `n ≥ 32` (Masayume reads 32).
- **`top_of_book(book, filter) → (Option<(u16,u64)>, Option<(u16,u64)>)`** = `levels(…, 1, …)` for bids and asks.
- **Outcome terms** (SDK `levelsToCross`): BUY_YES crosses asks as-is; SELL_YES crosses bids as-is; BUY_NO crosses **bids inverted** (`1000 − p`, best = highest bid); SELL_NO crosses **asks inverted**.
- **`vwap_over_depth(levels_in_outcome_terms, lots) → (vwap_ticks, filled_lots)`:** `cost = Σ take × price`, `vwap = ⌈cost / filled⌉` (Masayume `ParlayMath.vwap`, cost rounded up); `(0, 0)` when nothing fills.
- **`exit_walk(levels_in_outcome_terms, lots) → (proceeds_ticks_lots u128, filled_lots)`:** `Σ take × price`, exact. The "−1 unit" leverage mark is product math (`LeverageGateway._markOver`), not here.
- **`quote_stake(levels_in_outcome_terms, stake_cash, cu, min_lots, slippage_bps = 300, min_ticks = 10) → Option<StakeQuote>`:** port of `quoteBinaryStakeOverBook` with `tick = lot = 1`, `one = 1000`.
  1. Sweep cheapest first. `max_lots = ⌊stake / (price·cu)⌋`; stop when `max_lots ≤ taken`; `take = min(level_lots, max_lots − taken)`; `limit = price`; stop after a partial level.
  2. `padded = min(999, limit + max(⌊limit × slippage_bps / 10,000⌋, min_ticks))`.
  3. `lots = min(⌊stake / (padded·cu)⌋, taken)`; `None` if `lots == 0` or `lots < min_lots`.
  4. Return `{limit_ticks: padded (outcome terms), yes_price_ticks: padded for BUY_YES / 1000 − padded for BUY_NO, lots, escrow_cash: lots × padded × cu}`.
