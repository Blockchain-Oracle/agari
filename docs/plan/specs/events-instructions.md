# `agari-events` spec — instructions (frozen at S2.1)

Companion to [`events-engine.md`](events-engine.md), [`events-accounts.md`](events-accounts.md), [`prints.md`](prints.md).

**Notation:**
- Accounts are listed in order. `S` = signer, `w` = writable, `r` = read-only.
- `+E` = the two `#[event_cpi]` accounts (`event_authority` PDA `["__event_authority"]`, `program`), appended last.
- **Checks run in the listed order.** The first failure is the error returned (tests assert these codes).
- **Common binding checks (`B`)** apply wherever the accounts are present:
  - `market.series == series` (SeriesMarketMismatch)
  - `market.book == book && book.market == market` (BookMarketMismatch)
  - `market.ledger == ledger && ledger.market == market` (LedgerMarketMismatch)
  - `mvault == market.mvault` (MvaultMarketMismatch)
  - `mint == config.collateral_mint` (WrongMint)
  - `token_program == config.token_program` (WrongTokenProgram)
  - token accounts: `mint == collateral_mint` (WrongMint), and for `authority_token`, `owner == authority` (WrongTokenOwner)
- **Seat index checks (`SI`):** `seat_idx < ledger.capacity` and `seats[seat_idx].owner == authority` (SeatMismatch).
- **Signing:** every transfer out of `mvault` is signed by the Market PDA seeds `["market", series, index LE, [bump]]`.
- **CPI callers** (products) may call every `user_*` instruction with their seat PDA as `authority`. Only `public_record_print_attested` refuses CPI.

## 1. Admin and roller

### 1.1 `admin_init_config(cluster_tag: u8, result_retention_sec: u32)`
**Accounts:** admin S w (payer) · config w (init PDA) · collateral_mint r · treasury r · token_program r · program r (self) · program_data r · system_program r
1. `program_data` is this program's ProgramData and `upgrade_authority == admin` (NotAdmin). Blocks deploy front-running.
2. `token_program == spl_token::ID`, `collateral_mint.owner == spl_token::ID` (WrongTokenProgram; Token-2022 rejected).
3. `treasury.mint == collateral_mint` (WrongMint).
4. `cluster_tag ∈ {101, 103, 104}` (BadAuthorities): core `CLUSTER_ID` (D-012, D-013).

**Effects:** config fields; `mode = Normal`; `collateral_decimals = mint.decimals`; authority arrays zero. **Event:** `ConfigInitialized`.

### 1.2 `admin_set_authorities(args: SetAuthoritiesArgs)`
**Args:** `rollers [Pubkey;4], attestors [Pubkey;4], redstone_signers [[u8;20];5], redstone_signer_count u8, redstone_threshold u8, switchboard_queue Pubkey, switchboard_min_oracles u8, program_authorities [Pubkey;8], result_retention_sec u32`

**Accounts:** `admin S · config w · treasury r · queue r?` (the queue account is required whenever `switchboard_queue` is set, and is checked like prints.md §4.4 step 1).
**Accounts:** admin S · config w · treasury r
1. `admin == config.admin` (NotAdmin).
2. The non-zero entries of each Pubkey array are unique. `1 ≤ redstone_threshold ≤ redstone_signer_count ≤ 5`. Signer entries `[0, count)` are non-zero and unique; the rest are zero. `1 ≤ switchboard_min_oracles ≤ 8` when the queue is non-zero, and that queue account is passed and checked (BadAuthorities).
3. `treasury.mint == config.collateral_mint` (WrongMint).

**Effects:** replace everything, `treasury = treasury.key()`. Listed Windows keep their pre-allocated PROGRAM seats. Later prints use the new signer and attestor sets. **Event:** `AuthoritiesSet`.

### 1.3 `admin_set_mode(mode: u8)`
**Accounts:** admin S · config w
**Checks:** NotAdmin; `mode ≤ 2` (InvalidMode). **Event:** `ModeSet`.

### 1.4 `admin_register_series(args: RegisterSeriesArgs)`
**Args:** `ticker u16, cadence_sec u32, basis u8, lot_base u64, tick_base u64, min_lots u64, seat_bond u64, min_rest_slots u32, max_lead_sec u32, fills_cap u8, evictions_cap u8`
**Accounts:** admin S w (payer) · config r · series w (init PDA) · system_program r
1. NotAdmin.
2. `basis ≤ 2`. Regular/Token: `cadence_sec ≥ 60`, `cadence_sec % 60 == 0`, `3,600 % cadence_sec == 0` (ET offsets are whole hours, so only cadences dividing an hour stay on the ET clock). Gap: `cadence_sec == GAP_CADENCE_SEC` (604,800) (BadAlignment). D-013.
3. `pow = 10^collateral_decimals`: `tick_base × 1000 == pow`, `lot_base × tick_base % pow == 0`, `min_lots ≥ 1` (BadGrid).
4. `1 ≤ fills_cap ≤ 32`, `evictions_cap ≤ 16`, `max_lead_sec ≥ 1` (BadSeriesParams).

**Effects:** `cash_unit = lot_base × tick_base / pow`; counters zero. **Event:** `SeriesRegistered`.

### 1.5 `admin_add_book(capacity: u16)`
**Accounts:** admin S · config r · series w · book w (`#[account(zero)]`)
The book is created earlier in the same transaction by `SystemProgram.createAccount(space = 8 + 32,384 + 48·capacity, owner = agari_events)`.
1. NotAdmin.
2. `capacity ∈ {256, 512}` and `book.data_len == 8 + 32,384 + 48·capacity` (BadBookSize).
3. `series.free_book_count < 4` (TooManyBooks).

**Effects:** `load_init`: `series`, `capacity`, everything else zero; push to `free_books`. **Event:** `BookAdded`.

### 1.6 `admin_add_policy_version(index: u8, version: PolicyVersion)`
**Accounts:** admin S · config r · series w
1. NotAdmin.
2. `index < version_count` → PolicyVersionImmutable; `index > version_count || index ≥ 8` → UnknownPolicyVersion.
3. Validation (prints.md §2.2) → BadPolicy.

**Effects:** `policy_versions[index] = version`; `version_count += 1`. Never modified afterwards. `scripts/deploy/set-policies.mjs` is ensure-style: skip an identical existing version, **fail loudly on a differing one**. **Event:** `PolicyVersionAdded`.

### 1.7 `roller_open_window(args: OpenWindowArgs)`
**Args:** `index u64, trading_start i64, lock_at i64, expiry i64, policy_version u8, open_kind u8, close_kind u8`
**Accounts:** roller S · payer S w · config r · series w · market w (init PDA) · ledger w (init PDA, space `8 + 96 + 88·96`) · mvault w (init token PDA; mint = collateral, authority = market) · book w · collateral_mint r · token_program r · system_program r · +E
1. `roller ∈ config.rollers` (non-zero) (NotRoller).
2. `config.mode == Normal` (InvalidMode).
3. `B` (mint, token program).
4. `index == series.next_index` (BadWindowIndex).
5. `trading_start < lock_at ≤ expiry` and `lock_at > now` (BadHorizon).
6. `trading_start ≥ series.last_expiry` (WindowOverlap).
7. **Alignment:**
   - Regular/Token: `trading_start % cadence_sec == 0`, `expiry − trading_start == cadence_sec`, `lock_at == expiry` (BadAlignment). No partial Windows: the 60 m lane starts at 10:00 (core `market/windows.ts`, D-011, D-013).
   - Gap: `expiry − trading_start ≤ MAX_GAP_DURATION_SEC` (BadHorizon).
8. `trading_start ≤ now + series.max_lead_sec` (BadHorizon).
9. `open_kind ≤ 2`, `close_kind ≤ 2` (BadAlignment).
10. `policy_version < version_count` (UnknownPolicyVersion). The chosen version covers both boundaries **and** no higher-index version does (SourceNotCovered), prints.md §2.3.
11. `book ∈ series.free_books[..free_book_count]` (NoFreeBook). `book.order_count == 0 && book.market == default` (BookMarketMismatch).

**Effects:**
- Swap-remove the book from `free_books`; `book.market = market`; `generation += 1`.
- Market: `series, book, ledger, mvault, rent_payer = payer, index, trading_start, lock_at, expiry, policy_version, open_kind, close_kind, basis = series.basis, bumps`. Deadlines per prints.md §3.
- Ledger: `market, rent_payer = payer, seat_bond = series.seat_bond, capacity 96, seats_used 8, bump`; PROGRAM seats per events-engine.md §6.
- `series.next_index += 1`; `series.last_expiry = expiry`.

**Event:** `WindowOpened` (seq 1).

## 2. Prints

The shared checks are in prints.md §4.0. Per-source instructions:

| Instruction | Args | Accounts (after shared `series r · market w`) |
|---|---|---|
| `public_record_print_pyth` | `which u8` | `price_update r` (`Account<PriceUpdateV2>`, owner = receiver compiled in) · +E |
| `public_record_print_redstone` | `which u8, payload Vec<u8>` | `config r` · +E |
| `public_record_print_attested` | `which u8, price i64, expo i32, bar_start_ts i64, fetched_at_ts i64` | `config r` · `instructions r` (sysvar) · +E |
| `public_record_print_switchboard` (**S6**) | `which u8` | `recorder S` (a `config.attestors` key until `T + 40`, D-088) · `config r` · `queue r` · `slothashes r` (sysvar) · `instructions r` (sysvar) · `prev_market r?` (required for an Open past index 0) · +E |
| `public_copy_open_from_prev` | — | `prev_market r` · +E |

No signer account is required (the fee payer is the caller). **Event:** `PrintRecorded`.

## 3. Orders

### 3.1 `user_place_order(args: PlaceOrderArgs)`
**Args:** `kind u8, price_ticks u16, lots u64, expire_ts i64, order_type u8, self_match u8, max_fills u8, max_evictions u8, seat_hint u16, use_credit bool, withdraw_proceeds bool, client_id u64`
**Accounts:** authority S · config r · series r · market w · book w · ledger w · mvault w · authority_token w · collateral_mint r · token_program r · +E
1. Mode: Halted → InvalidMode; ReduceOnly and `kind ∈ {BUY_YES, BUY_NO}` → InvalidMode.
2. `B`.
3. Not terminal, and `trading_start ≤ now < lock_at` (MarketNotTrading).
4. `kind ≤ 3`, `order_type ≤ 3`, `self_match ≤ 1`, `1 ≤ max_fills ≤ min(32, fills_cap)`, `max_evictions ≤ min(16, evictions_cap)` (InvalidOrderArgs).
5. `1 ≤ price_ticks ≤ 999` (InvalidPrice).
6. `lots > 0` (InvalidQuantity); `lots ≥ min_lots` (BelowMinLots).
7. `expire_ts > now` (OrderAlreadyExpired); `expire_ts ≤ lock_at` (ExpiryAfterLock).
8. Seat resolution and claim (events-engine.md §6): SeatMismatch / LedgerFull.
9. Sells: `yes_free ≥ lots` (SELL_YES) or `no_free ≥ lots` (SELL_NO) (InsufficientOutcome).
10. PostOnly: `open_orders < 16` (TooManyOpenOrders), then the cross walk (PostOnlyWouldCross).
11. Match loop (§3.3 of the engine spec); SelfMatchCancelTaker possible.
12. Remainder:
    - FOK: `remaining == 0` (FillOrKillNotFillable).
    - IOC: `filled_lots > 0` (ImmediateOrCancelNoFill).
    - Normal/PostOnly rest: TooManyOpenOrders / BookFull.
13. Funding (§4.1): `transfer_checked` in. Proceeds to credit. `withdraw_proceeds` transfer out (§4.3).
14. Counters; `event_seq += 1`; emit `OrderExecuted`; **then** `set_return_data(PlaceResult)`.

### 3.2 `user_cancel_orders(handles: Vec<Handle>, seat_idx: u16, withdraw: bool)`
**Accounts:** authority S · config r · market w · book w · ledger w · mvault w (Option) · authority_token w (Option) · collateral_mint r (Option) · token_program r (Option) · +E
1. `handles.len() ≤ 16` (InvalidOrderArgs).
2. `B`; `SI`.
3. `withdraw` ⇒ all four Option accounts are present (InvalidOrderArgs).

**Effects:**
- Per handle: stale → `skipped += 1`; live but `node.seat != seat_idx` → NotOrderOwner; else remove (engine §5.2, reason UserCancel).
- `withdraw` ⇒ pay `seat.credit` out.

**Event:** `OrdersCancelled`. Any status or mode.

### 3.3 `user_reduce_order(handle: Handle, seat_idx: u16, new_lots: u64)`
**Accounts:** authority S · series r · market w · book w · ledger w · +E
1. `B`; `SI`.
2. Handle live (UnknownOrder); `node.seat == seat_idx` (NotOrderOwner).
3. `new_lots < node.lots` (ReduceNotSmaller); `new_lots ≥ series.min_lots` (BelowMinLots).

**Effects:** in place; refund the difference (§5.1 amounts). **Event:** `OrderReduced`.

### 3.4 `user_cancel_all(seat_idx: u16, max_scan: u16, withdraw: bool)`
**Accounts:** same as 3.2.
**Checks:** `B`; `SI`; the Option-account rule.
**Effects:** scan `min(high_water, max_scan)` nodes; cancel the seat's live nodes (reason CancelAll, ≤ 32 per call in the event; stop at 32); stop when `open_orders == 0`. **Event:** `OrdersCancelled`.

### 3.5 `public_sweep_expired(max: u8)`
**Accounts:** market w · book w · ledger w · +E
1. `B`.
2. `1 ≤ max ≤ 32` (InvalidOrderArgs).

**Effects:** engine §5.2 (reason Sweep). No-op success if nothing qualifies (an ops crank must not fail). **Event:** `OrdersCancelled` (only if ≥ 1 removed).

## 4. Sets and cash

### 4.1 `user_mint_complete_set(lots: u64, seat_hint: u16, use_credit: bool)`
**Accounts:** authority S · config r · series r · market w · ledger w · mvault w · authority_token w · collateral_mint r · token_program r · +E
1. Mode ∈ {Normal} (InvalidMode).
2. `B`.
3. Trading and not terminal (MarketNotTrading).
4. `lots > 0` (InvalidQuantity).
5. Seat resolution/claim.

**Effects:** engine §8.1; funding §4.1. **Event:** `CompleteSet{minted: true}`.

### 4.2 `user_merge_complete_set(lots: u64, seat_idx: u16, withdraw: bool)`
**Accounts:** same as 4.1.
1. `B`; Trading and not terminal (MarketNotTrading); `SI`.
2. `lots > 0` (InvalidQuantity); `yes_free ≥ lots && no_free ≥ lots` (InsufficientOutcome).

**Effects:** engine §8.1; optional withdraw. **Event:** `CompleteSet{minted: false}`.

### 4.3 `user_withdraw_credit(seat_idx: u16, amount: u64)`
**Accounts:** authority S · config r · market w · ledger w · mvault w · authority_token w · collateral_mint r · token_program r · +E
**Checks:** `B`; `SI`; `0 < amount ≤ seat.credit` (InsufficientCredit).
**Effects:** transfer out; `credit −= amount`. **Event:** `CreditWithdrawn`. Any status or mode.

### 4.4 `user_release_seat(seat_idx: u16)`
**Accounts:** same as 4.3.
1. `B`; `SI`.
2. Not PROGRAM (ProgramSeatNotPublic).
3. Drained (SeatNotEmpty).

**Effects:** transfer the bond (if `BONDED`); zero the seat. **Event:** `SeatReleased`.

### 4.5 `public_grow_ledger(extra_seats: u16)`
**Accounts:** payer S w · config r · market w · ledger w (realloc to `8 + 96 + 88·(capacity + extra)`, payer = payer, zero = false; never shrinks) · system_program r · +E
1. Mode ∈ {Normal} (InvalidMode).
2. `B`.
3. Not terminal and `now < lock_at` (MarketNotTrading).
4. `1 ≤ extra_seats ≤ 116` and `capacity + extra ≤ 1,024` (BadGrowAmount).

**Effects:** `capacity += extra`. The grown rent returns to `ledger.rent_payer` at close, even when a third party grew it (documented donation). **Event:** `LedgerGrown`.

## 5. Settlement and closure

### 5.1 `public_settle_window` / `public_void_expired`
**Accounts:** payer S w · series r · market w · result w (init PDA `["result", market]`, payer = payer) · system_program r · +E
**Checks and effects:** prints.md §5 (settle) and §6 (void). `result.rent_payer = payer`. **Event:** `WindowResolved`.

### 5.2 `public_release_book`
**Accounts:** series w · market w · book w · +E
1. `B`.
2. Status Locked or terminal (MarketNotLocked).
3. `book.order_count == 0` (OpenOrdersRemain).
4. `market.flags & BOOK_RELEASED == 0` (BookMarketMismatch).
5. `series.free_book_count < 4` (TooManyBooks).

**Effects:** `book.market = default`; push to `free_books`; set `BOOK_RELEASED`. **Event:** `BookReleased`.

### 5.3 `user_redeem(seat_idx: u16, outcome: Option<u8>, lots: Option<u64>)`
**Accounts:** authority S · config r · market w · ledger w · mvault w · authority_token w · collateral_mint r · token_program r · +E
1. `B`; `SI`.
2. Terminal (MarketNotTerminal).
3. `open_orders == 0` (OpenOrdersRemain).
4. Partial: both args are `Some`, PROGRAM seat (PartialRedeemNotAllowed), `outcome ≤ 1`, `lots ≤ free balance` (InsufficientOutcome). Exactly one arg `Some` → InvalidOrderArgs.

**Effects:** engine §8.4. **Event:** `Redeemed`.

### 5.4 `public_redeem_for(seat_idx: u16)`
**Accounts:** config r · market w · ledger w · mvault w · owner r · owner_ata w · collateral_mint r · token_program r · +E
1. `B`.
2. `seat_idx < capacity`, `seats[seat_idx].owner == owner != default` (SeatMismatch).
3. Not PROGRAM (ProgramSeatNotPublic).
4. `owner_ata == get_associated_token_address(owner, collateral_mint)` (WrongTokenOwner).
5. Terminal (MarketNotTerminal); `open_orders == 0` (OpenOrdersRemain).

**Effects:** full redeem (engine §8.4) to `owner_ata`; zero-amount seats still clear. **Event:** `Redeemed{by_crank: true}`.

### 5.5 `public_close_ledger`
**Accounts:** config r · market w · ledger w · mvault w · treasury w · rent_payer w · collateral_mint r · token_program r · +E
1. `B`.
2. `treasury == config.treasury` (WrongTokenOwner).
3. `rent_payer == ledger.rent_payer` (LedgerMarketMismatch).
4. Terminal (MarketNotTerminal).
5. Every seat in `0..seats_used` is drained and not `BONDED` (LedgerNotEmpty).

**Effects:** `residue = mvault.amount` → treasury (skip if 0); `CloseAccount(mvault)` → rent_payer; close the ledger → rent_payer; set `LEDGER_CLOSED`. **Event:** `LedgerClosed` (emitted before the closes).

### 5.6 `product_add_dependent` / `product_release_dependent`
**Accounts:** program_authority S · config r · market w · +E
1. `program_authority ∈ config.program_authorities` (NotProgramAuthority).
2. Add: no status restriction (the Market account must still exist; a product captures `MarketResult` later). Release: `dependents > 0` (MathOverflow: releasing an unregistered dependent is a product bug).

**Effects:** `dependents ± 1` (checked). **Event:** `DependentChanged`.

### 5.7 `public_close_market`
**Accounts:** market w · result w · market_rent_payer w · result_rent_payer w · config r · +E
1. `result` is the PDA of `market` and initialized (MarketNotTerminal if absent).
2. `market_rent_payer == market.rent_payer`, `result_rent_payer == result.rent_payer` (LedgerMarketMismatch).
3. `BOOK_RELEASED` (BookNotReleased); `LEDGER_CLOSED` (LedgerNotClosed).
4. `dependents == 0` (DependentsRemain).
5. `now ≥ resolved_ts + config.result_retention_sec` (RetentionNotElapsed).

**Effects:** emit `MarketClosed`; close `market` → `market_rent_payer`, `result` → `result_rent_payer`.

## 6. Transaction size and compute budget (targets S2 measures)

| Instruction | Accounts | Data | Est. tx bytes (legacy, 1 signer, + SetComputeUnitLimit) | CU estimate |
|---|---|---|---|---|
| `roller_open_window` | 13 + 1 | 43 B | ≈ 560 | 60–90k (8.5 KB ledger init) |
| `user_place_order` IOC, 10 fills | 12 | 43 B | ≈ 530 | 60–90k |
| `public_record_print_pyth` | 5 | 9 B | ≈ 330 (+ separate receiver post) | 20–40k |
| `public_record_print_redstone`, 5 packages | 6 | 8 + 1 + 4 + 724 = 737 B | **≈ 1,080 of 1,232** (no ALT needed; S2 measures) | 140–170k |
| `public_record_print_attested` | 6 + ed25519 ix (158 B msg + 32 + 64 + 16) | 29 B | ≈ 640 | 15–30k |
| `public_settle_window` | 7 | 8 B | ≈ 420 | 15–30k |

RedStone byte count: 65 (signature) + 3 (header) + 225 (7 keys incl. the ComputeBudget program) + 32 (blockhash) + 1 + 8 (budget ix) + 746 (print ix) = 1,080.
