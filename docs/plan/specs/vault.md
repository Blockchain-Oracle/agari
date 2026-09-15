# `agari-vault` spec (S7): Trading Balance, grants, taps through the engine

**Authority:** Masayume `68f7a09` `contracts/src/vault/{EventVault,IEventVault,VenueGateway,VaultTally}.sol`, `contracts/test/{EventVault.funding,EventVault.trading,CapsVectors}.t.sol`, `packages/core/src/vault/caps.vectors.json`, `context/41`. Plan §3.2 vault row (`00-plan.md:367`), §3.3, §3.4, §7.2 S7 (`00-plan.md:985-1009`). `events-engine.md` §4, §6, §8; `events-instructions.md` §1.2, §3.1, §5.3; `events-accounts.md` §2, §4–6. D-006, D-008, D-009, D-019, D-022, D-024, D-026. Companion: [`tap-trading.md`](tap-trading.md). Frozen at the S7 foundation commit (D-061); changes need a D-entry.

M: = `reference/masayume`. Everything below marked **new** does not exist yet.

**Code state (S4 head `c5ddb60`):**
- No vault program: `anchor/programs/` holds only `agari-events`.
- `resolveVaultDeployment` returns `null` (`packages/markets/src/vault/read.ts:9-11`), and so does `getVaultDeployment` (`packages/markets/src/runtime/read-runtime.ts:96`).
- Vault reads return `null` and zeros (`packages/markets/src/provider/reads.ts:25-31`), and `vaultBase` is `null` (`packages/markets/src/provider/wallet.ts:123`).
- Every non-wallet route is refused (`packages/markets/src/submitter/order-lane.ts:63`).
- No program authorities are registered: `packages/markets/src/deploy/venue-spec.ts:100` sets `pad([], 8)`, and `packages/markets/src/deploy/ensure-config.ts:74` throws on any drift from it.
- The web already mirrors Masayume file for file (tap-trading.md §4), and core `simulateCaps` plus the vectors are already ported (`packages/core/src/vault/caps.ts:50-70`).

## 1. Model: Masayume → Solana (D-062)

| Masayume | Agari (new) | Why |
|---|---|---|
| One contract holds the tokens (`VenueGateway` trades as itself, `VenueGateway.sol:11-16`) | Program `agari-vault`. Its engine seat is the `["seat"]` PDA (`anchor/crates/agari-common/src/seeds.rs:44-47`), the PROGRAM seat in each Ledger (`events-engine.md` §6) | Plan §3.2 common rules |
| `_accounts[owner]` (`EventVault.sol:26`) | `VaultAccount ["acct", owner]` | — |
| Pooled ERC-20 balance | **Per-owner custody** SPL token account `["custody", owner]`, owned by the seat PDA. Replaces the plan's 8 shards | No shared write lock across owners. A bug is bounded to one owner. The engine's `authority_token.owner == authority` check holds (`events-instructions.md:16`) |
| `positionOf` / `positionGrantOf` mappings (`EventVault.sol:31-33`) | **Inline slots** `positions[16]` in `VaultAccount`. Replaces the plan's `VaultPosition` PDA | No `init` in the tap path, so the sponsor never pays rent (plan §3.2 fees) and nothing is `init_if_needed` (§3.4) |
| `_grants[]` 1-based ids, `activeGrantOf[owner][kind]` (`:28-29`) | `Grant ["grant", grant_id u64 LE]`, `VaultConfig.next_grant_id`, and `VaultAccount.active_grants[3]` | The port routes by `grantId` alone. The key's route has `wallet = key` (`web/src/features/session/useTicketRoute.ts:79-81`), so the owner comes from the Grant, as `grantOf` did (`M:packages/markets/src/vault/order.ts:48-53`) |
| Kinds SESSION, EXECUTOR, STRATEGY (`IEventVault.sol:8-12`) | The same 3 (`u8` 0–2). The plan's GAME_SESSION/CLAIM_ONLY are dropped | No Masayume consumer (`core/vault/types.ts:5-7`) |
| `VaultTally` storage (`VaultTally.sol:12-72`) | **Not on chain.** Tallies come from the indexer decoding `Executed`/`Settled` (tap-trading.md §1) | The storage existed only because Somnia had no log history (`VaultTally.sol:7-10`). S3's indexer exists |
| `sweep(pool)` (`VenueGateway.sol:47-52`) | **Not built.** The `vault-sweep` intent refuses | IOC-only plus `withdraw_proceeds = true` keeps the seat's credit at 0 (`events-engine.md` §4.3) |
| `creditFor` / `creditPrivateFor` (`EventVault.sol:51-65`) | Deferred to the stage that consumes them | No caller in Masayume |
| Private bucket: `moveToPrivate` / `withdrawPrivate` (`:77-94`) | Built | Used by the port (`ports/submitter.ts:69-70`) and the panel (`web/src/features/vault/TradingBalancePanel.tsx:43`) |
| Plan: `product_add_dependent` per position | **Not called** | A vault position lives in the PROGRAM seat, so `public_close_ledger` can't run until every slot is cranked (`events-instructions.md` §5.5 check 5). That keeps the Market and its result alive. The vault never reads `MarketResult` |
| ERC-2771 forwarder / `NoDepositViaForwarder` (`EventVault.sol:230-233`) | The sponsor pays the fee only. "Deposits never sponsored" is sponsor policy (tap-trading.md §3) | Solana has no meta-transactions |

**Invariants (tested, §10):**
1. Per Window: `seat.yes_free == Σ_owners slot.yes_lots`, the same for NO, and the seat's `credit`, `locked_cash`, `*_locked` and `open_orders` are all 0 after every vault instruction.
2. Per owner: `custody.amount ≥ available + private_available + Σ live-or-revoked grant budgets`. It is an equality without donations. Accounting never reads `.amount` except the in-instruction delta asserts in §5.
3. AD-5: no instruction moves collateral anywhere except `custody(owner)` or `ATA(owner, mint)` (`EventVault.sol:13-16`).

## 2. Accounts (zero-copy, explicit padding; rent = (bytes + 128) × 5,080 lamports, `events-accounts.md` §1)

| Account | Seeds | Size | Rent | Payer |
|---|---|---|---|---|
| `VaultConfig` | `["vault-config"]` | 216 B | 1,747,520 ≈ 0.00175 SOL | admin, once |
| `VaultAccount` | `["acct", owner]` | 1,160 B | 6,543,040 ≈ 0.00654 SOL | owner, at `owner_open_account` |
| custody (SPL token, mint = collateral, authority = seat PDA) | `["custody", owner]` | 165 B | 1,488,440 ≈ 0.00149 SOL | owner, at open |
| `Grant` | `["grant", grant_id u64 LE]` | 176 B | 1,544,320 ≈ 0.00154 SOL | owner, per grant (never closed in S7) |
| seat PDA (no data) | `["seat"]` | — | — | — |
| event authority | `["__event_authority"]` | — | — | — |

A first-time owner pays ≈ 0.00803 SOL of rent, plus 0.00154 SOL per grant.

**`VaultConfig`** (208 B struct):
- `admin` Pubkey @0 (must be the program upgrade authority at init)
- `events_config` Pubkey @32
- `collateral_mint` Pubkey @64
- `seat` Pubkey @96
- `next_grant_id` u64 @128 (starts at 1)
- `seat_bump` u8 @136, `bump` u8 @137, `_pad` [u8;6] @138
- `_reserved` [u8;64] @144

**`VaultAccount`** (1,152 B struct): a 128 B header followed by `positions: [PositionSlot; 16]` @128.
- Header:
  - `owner` Pubkey @0
  - `available` u64 @32, `private_available` u64 @40, `total_deposited` u64 @48, `total_withdrawn` u64 @56
  - `active_grants` [u64;3] @64 (index = kind; 0 = none)
  - `custody_bump` u8 @88, `bump` u8 @89, `slots_used` u16 @90, `_pad` [u8;4] @92
  - `_reserved` [u8;32] @96
- `PositionSlot` (64 B): `market` Pubkey @0 (default = free) · `yes_lots` u64 @32 · `no_lots` u64 @40 · `yes_grant` u64 @48 · `no_grant` u64 @56 (0 = attended).

**`Grant`** (168 B struct):
- `owner` Pubkey @0, `actor` Pubkey @32
- `grant_id` u64 @64, `expires_at_sec` i64 @72
- `spent_day` u64 @80, `spent_today` u64 @88, `budget` u64 @96
- `max_stake_per_trade` u64 @104, `max_daily_spend` u64 @112 (both in base units)
- `max_open_positions` u32 @120, `open_positions` u32 @124
- `max_price_ticks` u16 @128 (own-side ticks; 0 = no cap)
- `kind` u8 @130, `revoked` u8 @131, `bump` u8 @132, `_pad` [u8;3] @133
- `market` Pubkey @136 (D-091: the one Window the grant may trade; `Pubkey::default()` = any. Took the reserved tail before the first deploy)

Masayume's caps are `uint128`/`uint64` raw (`IEventVault.sol:16-21`). On chain here they become u64 base units and u16 ticks. "No cap" in Masayume tests is `type(uint128).max` (`EventVault.trading.t.sol:104`), which maps to `u64::MAX`.

**Units:**
- `cu = series.cash_unit` (`events-accounts.md` §3.4 @24).
- Side price: `side_ticks(o, p) = o == 0 ? p : 1000 − p` (`VenueGateway.sol:112-114`).
- The port's `maxPriceRaw` becomes `max_price_ticks = maxPriceRaw / tick_base`, with `tick_base = 10^dec / 1000` venue-wide (`events-instructions.md` §1.4 check 3). The adapter refuses a remainder. The web default of 95¢ is 950 ticks (`web/src/features/session/caps.ts:24,48`).

## 3. Instructions

Account lists follow `events-instructions.md` notation: S signer, w writable, +E = the vault's own `#[event_cpi]` pair, and **ENG** = the engine block `events_program r · events_config r · series r · market w · book w · ledger w · mvault w · collateral_mint r · token_program r · events_event_authority r`. Checks run in order after Anchor's account validation (D-019 precedence). The first failure is the code.

### 3.1 `admin_init_vault()` (new)
**Accounts:** admin S w · vault_config w (init) · seat r (PDA) · events_config r · collateral_mint r · program r · program_data r · system_program r
1. `program_data.upgrade_authority == admin` (NotAdmin), as `events-instructions.md` §1.1.
2. `events_config` passes `load_checked` against `agari_events::ID` (`anchor/crates/agari-common/src/view.rs:10`), and `collateral_mint == events_config.collateral_mint` (WrongCollateral).

**Effects:** set every field; `next_grant_id = 1`. **Event:** `VaultInitialized`.

### 3.2 Funding (Masayume `EventVault.sol:46-94`)

| Instruction | Accounts | Checks → effects | Event |
|---|---|---|---|
| `owner_open_account()` | owner S w · vault_config r · account w (init) · custody w (init token, authority seat) · seat r · collateral_mint r · token_program r · system_program r · +E | Anchor init only → `owner`, bumps | `AccountOpened{owner, custody}` |
| `owner_deposit(amount u64)` | owner S · vault_config r · account w · custody w · owner_ata w · collateral_mint r · token_program r · +E | `amount > 0` (ZeroAmount); `owner_ata.owner == owner`, mint (WrongTokenOwner / WrongCollateral) → `transfer_checked(owner_ata → custody, owner)`; `available += amount`; `total_deposited += amount` | `Deposited{owner, amount, available}` |
| `owner_withdraw(amount u64)` | owner S · vault_config r · account w · custody w · owner_ata w · seat r · collateral_mint r · token_program r · +E | ZeroAmount; `available ≥ amount` (Insufficient); `owner_ata == ATA(owner, mint)` and `.owner == owner` (WrongTokenOwner) → `available −= amount`; `total_withdrawn += amount`; `transfer_checked(custody → owner_ata)` signed `["seat", bump]` | `Withdrawn{owner, amount, available}` |
| `owner_move_to_private(amount u64)` | owner S · account w · +E | ZeroAmount; Insufficient → `available → private_available` | `PrivateMoved` |
| `owner_withdraw_private(amount u64)` | as `owner_withdraw` | same checks on `private_available` | `PrivateWithdrawn` |

The adapter prepends `owner_open_account` when the account is absent, and an idempotent ATA create (payer = owner) when the ATA is missing. That keeps a first deposit to one signature.

### 3.3 Grants (`EventVault.sol:98-133, 264-319`)

`CapsArgs { max_stake_per_trade u64, max_daily_spend u64, max_open_positions u32, max_price_ticks u16, market Pubkey }` (`market` default = any Window, D-091).

| Instruction | Accounts | Checks → effects |
|---|---|---|
| `owner_grant(grant_id u64, kind u8, actor Pubkey, caps CapsArgs, expires_at_sec i64, budget u64)` | owner S w · vault_config w · account w · grant w (init `["grant", grant_id]`) · previous_grant w (Option) · system_program r · +E | see steps below |
| `owner_deposit_and_grant(amount u64, grant_id, kind, actor, caps, expires_at_sec, budget)` | union of `owner_deposit` and `owner_grant` | the deposit effects, then the grant steps. One instruction, so "a grant never exists without its budget" (`EventVault.sol:106-115`) |
| `owner_fund_grant(amount u64)` | owner S · account w · grant w · +E | `grant.owner == owner` (NotGrantOwner); live (GrantIsRevoked, then GrantExpired); ZeroAmount; `available ≥ amount` (Insufficient) → `available −= amount`; `budget += amount`. `GrantFunded` |
| `owner_revoke()` | owner S · account w · grant w · +E | NotGrantOwner. Already revoked → success, no-op (`:297`). Else `revoked = 1`; `available += budget`; `budget = 0`; clear `active_grants[kind]` if it equals `grant_id`. `GrantRevoked{grant_id, owner, returned}`. Works on expired grants: the only way their budget comes back |

**`owner_grant` steps:**
1. `grant_id == vault_config.next_grant_id` (StaleGrantId; the adapter re-reads and retries once).
2. `kind ≤ 2` (BadGrantKind).
3. `actor != default` (ZeroActor).
4. `expires_at_sec > now` (BadExpiry).
5. If `account.active_grants[kind] ≠ 0`: `previous_grant` must be present with that id (ActiveGrantMismatch), and it is revoked as in `owner_revoke`, budget back first (`:270-271`).
6. `available ≥ budget` (Insufficient).

**`owner_grant` effects:** `available −= budget`; the Grant gets its fields, `spent_day = spent_today = open_positions = 0`; `active_grants[kind] = grant_id`; `next_grant_id += 1`. Event: `GrantCreated{grant_id, owner, actor, kind, caps, expires_at_sec, budget}`.

### 3.4 Trading: IOC through the vault's PROGRAM seat (`EventVault.sol:138-187`, `VenueGateway.sol:85-104`)

`owner_place(outcome u8, is_buy bool, price_ticks u16, lots u64, expire_ts i64)`
**Accounts:** owner S · vault_config r · account w · custody w · seat r · ENG · +E. The fee payer is the owner's wallet; this is never sponsored (as Masayume `place`, `M:packages/markets/src/vault/sponsor.ts:25`).

`actor_place_for(grant_id u64, outcome u8, is_buy bool, price_ticks u16, lots u64, expire_ts i64)`
**Accounts:** actor S · vault_config r · grant w · owner r (== `grant.owner`) · account w (`["acct", owner]`) · custody w (`["custody", owner]`) · seat r · ENG · +E. The fee payer is the actor or the sponsor.

**Checks:** R = the shared resolve.
1. **`place_for` only:**
   - `actor == grant.actor` (NotGrantActor);
   - `grant.revoked == 0` (GrantIsRevoked);
   - `now ≤ grant.expires_at_sec` (GrantExpired; equality is live, `:318`);
   - `grant.market == default ∨ grant.market == market` (GrantMarketMismatch; D-091: a market-scoped grant trades one Window, buys and sells alike).
2. **R:**
   - `events_program == agari_events::ID`;
   - `load_checked` Market, Series and Ledger, with the bindings from `events-accounts.md` §6 (UnknownMarket);
   - `events_config.collateral_mint == vault_config.collateral_mint` (WrongCollateral);
   - `outcome ≤ 1` (BadOutcome);
   - `1 ≤ price_ticks ≤ 999` (BadPrice);
   - `i = events_config.program_authorities.position(seat)` exists (VaultNotRegistered);
   - `i < ledger.capacity`, `seats[i].owner == seat` and `flags & PROGRAM` (WindowPredatesVault).
   - This last check matters: without it the engine would *claim* an empty seat `i` for the vault and pull a bond from custody (`anchor/programs/agari-events/src/matching/seats.rs:38-62`).
3. **Buy, `place_for`:** `max_price_ticks ≠ 0 ∧ side_ticks > max_price_ticks` (OverPriceCap).
4. **Buy, both routes:**
   - `worst = lots × side_ticks × cu`, in checked u128 → u64 (MathOverflow);
   - `worst == 0` (ZeroAmount);
   - funding bucket (`grant.budget` or `account.available`) `< worst` (Insufficient; `:258-262`).
5. **Sell:**
   - `lots == 0` (ZeroAmount);
   - the slot for `market` holds `≥ lots` on that side (Insufficient).
   - Sells skip every cap (`:178-180`).
6. **Status:** `market.state == 0 ∧ trading_start ≤ now < lock_at` (MarketNotTrading), mirroring `_placeIoc` (`VenueGateway.sol:89-90`). The engine re-checks.
7. **Slot:**
   - buy: find `market`, else take a free slot (PositionSlotsFull);
   - sell: the slot must exist.

**CPI** (loaders dropped first; §5): `user_place_order` with:
- `kind = outcome·2 + (is_buy ? 0 : 1)` (`VenueGateway.sol:107-109`) and the caller's `price_ticks`, `lots`, `expire_ts`;
- `order_type = 2` (IOC), `self_match = 0` (CancelTaker; `VenueGateway.sol:20-21`);
- `max_fills = min(16, fills_cap)`, `max_evictions = min(16, evictions_cap)`;
- `seat_hint = i`, `use_credit = false`, `withdraw_proceeds = true`, `client_id = grant_id` (0 when attended).

An empty IOC reverts with the engine's 6110 and nothing is booked (context/41 "The venue reverts an empty IOC").

**Booking** from `PlaceResult` (`anchor/crates/agari-common/src/place_result.rs:50-57`; missing or foreign data → EngineResultMissing):
- **Buy:**
  - require `transferred_in == cash_spent ∧ withdrawn == 0 ∧ rested_lots == 0` (EngineAccountingMismatch);
  - `spent = cash_spent`, `gained = filled_lots`.
  - `place_for`: the §4 spend steps 4–7, then book.
  - `place`: `available −= spent` (Insufficient), then book with attribution 0.
  - Book: `before = slot.side_lots`; `slot.side_lots += gained`. `opened = before == 0 ∧ slot.side_grant == 0`.
  - If opened on the grant route: `slot.side_grant = grant_id`, then the position cap.
- **Sell:**
  - require `transferred_in == 0 ∧ withdrawn == cash_received` (EngineAccountingMismatch);
  - `slot.side_lots −= filled_lots`; `account.available += cash_received`. Proceeds go to the owner, never to the budget (`:348-352`). The slot's attribution stays until the crank (§4 note).
- **Both:** the slot's market is set on first use; `slots_used` is kept. **Event:** `Executed{owner, market, grant_id, outcome, is_buy, cash_delta, lots_delta, actor, at_sec, fills}` (`IEventVault.sol:57-67`; Masayume's market id is the Market PDA).

### 3.5 Settlement: permissionless crank, credit always to the owner (`EventVault.sol:193-205, 364-376`)

`public_crank_settle()`
**Accounts:** cranker S (fee payer only) · vault_config r · owner r · account w · custody w · yes_grant w (Option) · no_grant w (Option) · seat r · ENG minus `book` · +E
1. R (as §3.4 step 2), then `market.state ∈ {Resolved, Voided}` (MarketNotSettled).
2. A slot for `market` exists (NothingToSettle).
3. For each side with `side_grant = g ≠ 0`, the matching Option account must be present at PDA `["grant", g]` (GrantAccountMissing). When both sides share `g`, it is passed once as `yes_grant`. Anchor denies duplicate mutable accounts (plan §3.4).
4. For each side with `lots > 0`: CPI `user_redeem(i, Some(o), Some(lots))`, a PROGRAM partial redeem (`events-instructions.md` §5.3).
   - `expected = ⌊lots × 1000 × cu × payout[o] / 10⁷⌋`. That is exact for win (10⁷) and void (5·10⁶).
   - Assert the custody delta after `reload()` equals `expected` (EngineAccountingMismatch).
5. Each attributed grant: `open_positions = open_positions.saturating_sub(1)` (`:373`).
6. `available += Σ payout`; clear the slot (`market = default`, all zero); `slots_used −= 1`.

**Event:** `Settled{owner, market, payout, yes_redeemed, no_redeemed, by, at_sec}` (`IEventVault.sol:68-70`).

**Deliberate delta from Masayume (D-062):** a slot whose sides were sold to 0 still settles, paying 0 and releasing its grant counters. Masayume reverts `NothingToSettle` there and leaks `openPositions` after a sell-out and re-buy (`_bookSale` never decrements, `EventVault.sol:349-352`). Buys count exactly as Masayume does, so every caps vector is unchanged.

## 4. Caps: the exact rules (Masayume `placeFor` order; core `simulateCaps`, `packages/core/src/vault/caps.ts:50-70`)

| # | Rule | Error |
|---|---|---|
| 1 | `grant.revoked` | GrantIsRevoked |
| 2 | `now > expires_at_sec` | GrantExpired |
| 3 | buy ∧ `max_price_ticks ≠ 0` ∧ `side_ticks(o, p) > max_price_ticks` | OverPriceCap |
| 4 | `budget < lots × side_ticks × cu` (escrow at the limit, before placing) | Insufficient |
| 5 | place IOC; `spent = cash_spent` | engine 6110 on no fill |
| 6 | `spent > max_stake_per_trade` (actual charge) | OverStakeCap |
| 7 | `day = ⌊unix_ts / 86,400⌋`; `today = spent_day == day ? spent_today : 0`; `today + spent > max_daily_spend` | OverDailyCap |
| 8 | `budget < spent`, else `budget −= spent`; `spent_day = day`; `spent_today = today + spent` | Insufficient |
| 9 | opened ∧ `open_positions + 1 > max_open_positions`, else `+= 1` | OverPositionCap |

Any refusal reverts the whole transaction, fill included (`EventVault.trading.t.sol:153`). The daily clock is UTC ("resets 00:00 UTC", `caps.ts:33-36`).

**Vector replay** (`anchor/tests/vault_caps.rs`, new) reads `../../packages/core/src/vault/caps.vectors.json` as `CapsVectors.t.sol:16` does. Each vector runs in fresh LiteSVM state with 5,000 tUSDC deposited (`:17`).

| Vector field | Solana |
|---|---|
| `ONE = 1e6` | 6 dp; lot = tick = 1,000 base, `cu` 1 (D-026 grid) |
| `quantityRaw` | `lots = quantityRaw / 1,000` (50,000,000 → 50,000) |
| `priceRaw` (YES terms) | `price_ticks = priceRaw / 1,000` (700,000 → 700) |
| `maxPriceRaw` | `max_price_ticks` (650,000 → 650) |
| "fills YES at 0.60" | maker rests BUY_NO@600 (ask) before an outcome-0 order |
| "fills NO at 0.40" | maker rests BUY_YES@600 (bid) before an outcome-1 order |
| `prior` | placed through the same grant first; the positions vector then has the maker `user_cancel_all` and rest the bid |
| `expired` | grant `expires_at_sec = now + 1`, then warp +2 |
| `expect.spendBase` | `Executed.cash_delta` (e.g. 30,000,000 = 50,000 × 600) |
| `error` | OverStakeCap / Insufficient / OverDailyCap / OverPriceCap / OverPositionCap / GrantExpired / GrantIsRevoked → §6 codes; `ImmediateOrCancelNoFill` → engine 6110 |

The escrow is identical, not approximate: `quantityRaw × sidePriceRaw / ONE = lots × lot_base × ticks × tick_base / 10^6 = lots × ticks × cu`.

## 5. Engine integration

- **CPI client:** 7a step 1 picks one of two options (D-064) and records the `.so` size of each.
  - (a) the path dependency `agari-events = { path, features = ["cpi"] }` (`anchor/programs/agari-events/Cargo.toml:14-15`). This shares state types with `load_checked`.
  - (b) `declare_program!(agari_events)` over the checked-in IDL (`packages/clients/agari-events/idl.json`).
  - Default: (a), unless the binary exceeds 600 KB.
- **Signing:**
  - `CpiContext::new(events_program.key(), accounts).with_signer(&[&[b"seat", &[seat_bump]]])`, as in `anchor/programs/agari-events/src/instructions/venue_io.rs:62,75` (Anchor 1.2 takes a program id).
  - Read `get_return_data()` immediately after the CPI (`events-engine.md` §4.4) and check the program id.
- **Engine accounts passed:**
  - `user_place_order`: authority = seat, `authority_token` = custody, plus ENG (12 accounts with +E; `anchor/programs/agari-events/src/instructions/user_place_order.rs:18-37`).
  - `user_redeem`: the same without `book` (`anchor/programs/agari-events/src/instructions/redeem.rs:21-36`).
- **No pre-CPI writes:** every vault state change happens after the CPI returns, from `PlaceResult` or the redeem math. A failed CPI reverts everything. The engine never CPIs products (plan §3.4), so reentry into the vault is impossible.
- **CPI depth** (plan §3.3, max 4):

  | Path | Depth |
  |---|---|
  | key or owner → vault | 1 |
  | → events | 2 |
  | → SPL Token and the engine's self `emit_cpi` | 3 |
  | vault `emit_cpi` | 2 |

- **Engine mode:** ReduceOnly/Halted block vault buys at the engine (`events-engine.md` §7). Vault withdraw, revoke and crank never touch the engine's mode.

### 5.1 Registering the vault as a program authority (D-063; stage owner only)

1. **Fixed index table (new, shared with S8/S10/S12):** 0 agari-vault · 1 agari-maker · 2 agari-leverage · 3 agari-private · 4 agari-arena · 5–7 reserved. The program still finds its index at runtime (§3.4 R), so a table change never needs a vault upgrade.
2. **Script `scripts/deploy/set-authorities.ts`** (new, ensure-style, D-026 client):
   - reads `GlobalConfig`;
   - builds `SetAuthoritiesArgs` from **every current field** (`admin_set_authorities` replaces everything, `events-instructions.md:33-39`);
   - sets `program_authorities[0] = seat_address(agari_vault::ID)` and passes `treasury = config.treasury`;
   - signs as `deployer` (= `config.admin`, D-026);
   - skips when identical, and refuses when index 0 holds a different non-zero key.
3. **`venue-spec.ts:100`** gets the table, so `ensureConfig` (`ensure-config.ts:74`) stops calling it drift. S6 (Switchboard queue) and S8 (maker index 1) use the same script, and one writer at a time runs it.
4. **Effect:**
   - Windows opened afterwards pre-allocate seat 0 `{owner: seat, PROGRAM}` (`anchor/programs/agari-events/src/instructions/roller_open_window.rs:169-174`).
   - Windows already listed keep whatever holds seat 0 (`events-instructions.md:39`): any user may have claimed it (`events-engine.md:192`). The vault refuses them with WindowPredatesVault (7207), and the UI says "Trading Balance opens with the next Window".
   - Full coverage arrives after one cadence of each Series (≤ 60 min).
5. **Settler (venue-ops.md §7:110, "PROGRAM seat not drained → wait"):** amended by D-068. After `SETTLER_REDEEM_GRACE_SEC` (D-032), the settler cranks `public_crank_settle` for every owner with a slot on that Market (owners from the index, tap-trading.md §1), then closes the Ledger.

## 6. Errors (`#[error_code]`, explicit discriminants 1000+, so codes 7000–7299 never collide with engine 6000–6307)

A CPI failure surfaces as `Custom(code)` at the *vault* instruction's index. Disjoint ranges let the adapter tell vault from engine without parsing logs.

| Range | Codes |
|---|---|
| 7000 funding | 7000 ZeroAmount · 7001 Insufficient · 7002 WrongCollateral · 7003 WrongTokenOwner · 7004 NotAdmin · 7005 MathOverflow |
| 7100 grants / caps | 7100 NoSuchGrant · 7101 NotGrantActor · 7102 NotGrantOwner · 7103 GrantIsRevoked · 7104 GrantExpired · 7105 BadExpiry · 7106 ZeroActor · 7107 BadGrantKind · 7108 OverStakeCap · 7109 OverDailyCap · 7110 OverPositionCap · 7111 OverPriceCap · 7112 GrantAccountMissing · 7113 ActiveGrantMismatch · 7114 StaleGrantId · 7115 GrantMarketMismatch |
| 7200 trading / settle | 7200 UnknownMarket · 7201 MarketNotTrading · 7202 MarketNotSettled · 7203 NothingToSettle · 7204 BadOutcome · 7205 BadPrice · 7206 VaultNotRegistered · 7207 WindowPredatesVault · 7208 PositionSlotsFull · 7209 EngineResultMissing · 7210 EngineAccountingMismatch |

Adapter kinds follow Masayume's table (`M:packages/markets/src/vault/errors.ts:6-29`):
- Insufficient → `insufficient-collateral`;
- 71xx → `grant-refused`;
- MarketNotSettled → `not-settled`;
- NothingToSettle → `already-claimed`;
- 7201/7207 → `market-not-trading`;
- 7208 → `contract-revert` with the copy "settle a finished Window first".

## 7. Events (`emit_cpi!`; Borsh order)

- `VaultInitialized{config, admin, collateral_mint, seat}`
- `AccountOpened{owner, custody}`
- `Deposited{owner, amount, available}`
- `Withdrawn{owner, amount, available}`
- `PrivateMoved{owner, amount, private_available}`
- `PrivateWithdrawn{owner, amount, private_available}`
- `GrantCreated{grant_id, owner, actor, kind, max_stake_per_trade, max_daily_spend, max_open_positions, max_price_ticks, expires_at_sec, budget}`
- `GrantFunded{grant_id, amount, budget}`
- `GrantRevoked{grant_id, owner, returned}`
- `Executed{owner, market, grant_id, outcome, is_buy, cash_delta, lots_delta, actor, at_sec, fills}`
- `Settled{owner, market, payout, yes_redeemed, no_redeemed, by, at_sec}`

The indexer builds the Masayume tally (`VaultTally.sol:13-25`) from `Executed` and `Settled`.

## 8. Security checklist (plan §3.4 → vault)

| Area | Rule in the vault |
|---|---|
| Owner, type, binding | Vault state uses typed `AccountLoader` with PDA seeds. Engine state uses `load_checked` (owner `agari_events::ID`, discriminator, market↔series↔ledger bindings); the engine re-checks B during the CPI. Mint and token program are pinned to engine config (SPL Token only) |
| Signers | `owner_*`: `Signer` owner, whose account and custody seeds derive from `owner.key()`. `actor_place_for`: `Signer` == `grant.actor`; account and custody seeds from `grant.owner`. Crank: the cranker signs only as fee payer. The seat PDA signs only via `invoke_signed` |
| No caller-chosen destination (AD-5) | Collateral moves only to `custody(owner)` (engine proceeds and payouts) and `ATA(owner, mint)` (withdraw, with the address and `.owner` checked). Cranks credit the slot's owner. `idl-no-destination` (`scripts/invariants/lib/chain-rules.mjs:73,88-105`) passes with account names `owner_ata`/`custody` and no allowlist entries (`idl-destination.allow.json` stays empty) |
| Delegate compromise | A leaked session key can open in-cap positions that belong to the owner, and nothing else: it can't withdraw, fund or grant (`EventVault.trading.t.sol:288-308` ported as `vault_trading::ad5_no_divert`) |
| Init | `owner_open_account`, grants and config use explicit `init`; no `init_if_needed`. The tap path has no `init`, so the sponsor is never a rent payer |
| Duplicates | Anchor 1.x denies duplicate mutable accounts. `yes_grant`/`no_grant` must be distinct, and a shared grant is passed once |
| Reentrancy / stale state | No writes before a CPI; loaders dropped before the CPI; booking from return data, and for redeem from math plus a reload delta assert |
| Seat safety | PROGRAM flag and owner at index `i` are required before any CPI (WindowPredatesVault), so the engine can never bond-claim a seat for the vault. IOC only, so the vault seat never rests, never self-matches and never holds credit (invariant 1) |
| Math | u64 state; u128 intermediates; `checked_*`; `try_from` casts; floor on redeem, exact for 10⁷ and 5·10⁶ |
| Donation-safe | Balances are internal. `custody.amount` is read only for the in-instruction delta. Donated tokens sit unused (no sweep) |
| Grant hygiene | Global ids (no reuse). A replaced grant is revoked with its budget returned before the new one is taken (`:270-274`). Revoke works on expired grants. Crank refuses to skip a grant counter (GrantAccountMissing) |
| Upgrade / trust (README) | Vault upgrade authority `deployer` (devnet). Engine admin controls `program_authorities`. The sponsor key pays fees only |

## 9. Compute, transaction size, devnet SOL

| Instruction | CU estimate (engine measured: IOC 1 fill 17,708 and 10 fills 29,888, redeem 14,141; D-024, stage-04 Findings) | Tx bytes (v0, no ALT) |
|---|---|---|
| `actor_place_for` sponsored (2 sigs, 20 keys, 36 B args) | 35–45k (1 fill), 45–60k (10 fills) | ≈ 875 |
| `owner_place` (1 sig, 19 keys) | same | ≈ 810 |
| `public_crank_settle`, both sides (20 keys) | 35–45k (2 partial redeems) | ≈ 785 |
| enable: CU limit + SOL top-up + `owner_open_account` + `owner_deposit_and_grant` (14 keys) | 45–60k | ≈ 710 |
| `owner_withdraw` + idempotent ATA | 15–25k | ≈ 520 |

**Measured (7a, ebf9259; LiteSVM, SBPF v0, v0 tx, no ALT; +≈ 40 B with a SetComputeUnitLimit instruction):**

| Instruction | CU | Tx bytes |
|---|---|---|
| `actor_place_for` sponsored (2 sigs), 1 fill | 39,326 | 866 |
| `actor_place_for` sponsored, 10 fills | 50,995 | 866 |
| `owner_place`, 1 fill | 38,204 | 696 |
| `public_crank_settle`, both sides | 51,225 (over the 35–45k estimate) | 710 |
| enable (CU limit + top-up + open + `owner_deposit_and_grant`) | 40,320 | 708 |
| `owner_withdraw` + idempotent ATA | 19,228 | 527 |

The compute limit is simulation × 1.1, ≤ 400k (D-012). All sizes are under 1,232 B with no ALT; the sponsor refuses ALTs (tap-trading.md §3). Plan §3.3's 110–150k is the upper bound; LiteSVM measures in 7a.

**Program size and deploy:**
- `agari-events` v0 is 764,200 B with its oracle crates, and rent of 3.883 SOL (acceptance.md:20).
- A vault with 13 instructions, zero-copy state and a CPI client: **≈ 300–450 KB → 1.52–2.29 SOL** programdata rent (`(size + 45 + 128) × 5,080`).
- **Deploy peak ≈ 3.1–4.6 SOL** (buffer + programdata; the buffer is refunded). No `--max-len`; `solana program extend` if an upgrade grows.
- Plus IDL metadata ≈ 0.03 SOL (events' larger IDL cost 0.0569), `VaultConfig` 0.00175, `admin_set_authorities` fee.
- Sponsor role float 0.5 SOL; two drive owners 2 × 0.03 SOL.
- **Measured (7a):** option (a) path dependency 516,904 B → programdata rent ≈ 2.63 SOL, **deploy peak ≈ 5.25 SOL**; option (b) `declare_program!` 513,056 B. `opt-level = "z"` for the vault gives 427,904 B (≈ 2.18 SOL rent) at +8–12% CU; not applied (D-064 outcome).
- **S7 budget ≈ 6 SOL** (was 5.5 before the measured binary). Deployer held 3.32 SOL at 2026-09-14 16:50Z (STATUS), so the user needs to fund it (stage file Handoff).

## 10. Proofs (LiteSVM, `anchor/tests`, D-019 harness; loads `target/deploy/agari_vault.so` beside `agari_events.so`)

| File (new) | Asserts |
|---|---|
| `vault_caps.rs` | all 10 vectors (§4) |
| `vault_funding.rs` | ports of `EventVault.funding.t.sol:9-114`: round trip; over-withdraw; zero; private bucket; grant replaces previous and returns budget first; expiry/zero actor; revoke only owner and on expired; fund live only; deposit_and_grant one instruction |
| `vault_trading.rs` | ports of `EventVault.trading.t.sol:21-311`: actual cost booked; partial fill; 6110 nothing booked; NO in NO terms; sell proceeds and oversell; not trading; place_for spends budget not available; only actor; per-trade/daily (warp to 00:00 UTC)/position/price caps; sale to owner; budget ceiling; crank winner by stranger; void half and loser 0; AD-5 no-divert; **new:** WindowPredatesVault on a pre-registration Window; invariant 1 after every step; Ledger closes after the last crank |

