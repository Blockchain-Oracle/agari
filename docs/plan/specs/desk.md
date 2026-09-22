# `agari-desk` spec (S21): a desk holds a basket of PreStocks for its owner, inside limits the program enforces

**Authority:** the approved plan (`~/.claude/plans/quizzical-booping-ocean.md` §4–§5 UX, §8 Lane C), D-126, and the source being ported, Shijima (`open-serv`): `contracts/src/Desk.sol` (the guards), `packages/core/src/wake/{needs,pregate,deferral,gate,plan,record}.ts`, `packages/core/src/serv/prompts/timing.ts`, `packages/shared/src/{hashing,schemas/timing,schemas/mandate,presets}.ts`, `packages/core/src/jobs/grade.ts`. Precedents in this repo: `agari-vault` (owner-only ATA payout, PDA signing, caps, compile-time PDAs, layout tests), `agari-common/print/attested.rs` + `agari-events/instructions/record_print_sources.rs` (ed25519 through the instructions sysvar), `agari-common/print/pyth.rs`. Frozen at the S21 C0 commit; changes need a D-entry.

**Words (plan §5.1):** desk, mandate, basket, check, decision, record, practice, mark, "above its mark". Never "hedge" (it is "cover"), never a profit promise.

## 0. The promise, in words a non-expert can check against the program

1. **It is your account.** Only `owner` can take money out (`owner_withdraw`), and only to the owner's own associated token account of that mint. No instruction names any other destination.
2. **It stays inside your limits, and the program enforces the money limits.** The operator's buys and sells are capped per action and per fixed 24 h window, may only touch the names the owner allowed, must land within 8 % of the venue-attested price, and a buy must not pay more than `max_premium_bps` above the mark (or above Pyth's index when the owner requires it).
3. **It always explains itself, including every time it does nothing.** Every operator action, `operator_checkpoint` included, carries a `decision_hash` and advances `seq` and `head`.
4. **The record cannot be quietly changed.** `head = sha256(head ‖ seq ‖ decision_hash)` is written in the same transaction as the trade; the record's canonical bytes hash to `decision_hash`.
5. **You can stop it at any moment.** `pause` (owner or operator), `owner_withdraw`, `owner_revoke_operator`; none of the owner's instructions is ever blocked by pause, caps, the band, a stale reference or a revoked operator.

**Worst case, one sentence:** if the operator key were stolen, the thief could only make bad trades, at most `daily_cap` (twice across a window boundary) minus the band, until the owner pauses.

**Trust boundary (D-126):** the price attestor and the operator are both ops keys today. The 8 % band and the premium ceiling defend against a stolen *operator* key only while the attestor secret is kept apart from it. The Pyth `Equity.Index` leg (`require_pyth_index`) is the independent reference the owner can demand once the venue is entitled to the feed.

## 1. Model: Shijima → Solana

| Shijima (`Desk.sol`) | Agari (`agari-desk`) | Why |
|---|---|---|
| One EIP-1167 clone per owner, tokens held by the contract | `Desk ["desk", owner]` PDA; the desk's ATAs (USDC under Token, names under Token-2022) are owned by the PDA and it signs their transfers | A PDA can hold Token-2022 accounts (`defaultAccountState: initialized`) |
| Constants `USDG`, `ROUTER`, `VAULT` | `DeskConfig ["desk-config"]` carries `usdc_mint` and `swap_program` (Jupiter v6 on mainnet, a stub in tests) | Tests pin a test mint and a stub router without a rebuild |
| Chainlink `latestRoundData` + `MAX_FEED_AGE = 6 days` | `DeskRef ["desk-ref", mint]`, venue-wide, posted permissionlessly with an ed25519 attestation over a 114-byte message; fresh ≤ 900 s | PreStocks names have no on-chain oracle; the venue already attests their prices (D-100) |
| Pinned Uniswap pool, `fee` never an operator argument | The whole route is an operator argument (`swap_data` + remaining accounts) but the *outcome* is checked: exact spend, `received ≥ max(min_out, floor)`, no leaked token account | On Solana the route is a list of accounts; what the program can pin is the money, not the path |
| `PRICE_SCALE = 1e20` (18 + 8 − 6) | `VALUE_SCALE = 10^23` (9 + 12 + 8 − 6): every token amount is `raw × multiplier_e12 / 10^21` UI tokens; prices are per UI token × 10^8 | PreStocks mints are 9 dp with a ScaledUiAmount multiplier; the mint's f64 is never read on the money path |
| `sweepToVault` / `redeemFromVault` | Not built (no savings leg on the desk) | Plan §8: "minus the savings vault" |
| `session` key (7-day browser key) | Not built; the owner's wallet signs every owner call | A Wallet Standard signature is one tap; nothing needed it |
| `batch` (delegatecall) | A Solana transaction is the batch | — |
| `keccak256(abi.encode(head, seq, hash))` | `sha256(head ‖ seq LE u64 ‖ hash)` | The sha256 syscall is the cheap hash on Solana; the browser recomputes it with WebCrypto |

## 2. Accounts (zero-copy, explicit padding; `layout_tests.rs` pins every size and offset)

Mainnet rent = `(bytes + 128) × 6,960` lamports (the mainnet rate at 2026-09-22; devnet is 5,080).

| Account | Seeds | Struct | Account | Payer |
|---|---|---|---|---|
| `DeskConfig` | `["desk-config"]` | 296 B | 304 B | admin, once |
| `Desk` | `["desk", owner]` | 528 B | 536 B | owner, at open |
| `DeskRef` | `["desk-ref", mint]` | 168 B | 176 B | whoever inits it (ops) |
| desk USDC ATA | ATA(desk, usdc_mint, Token) | 165 B | — | owner, at open |
| desk name ATA | ATA(desk, mint, Token-2022) | 165 B + extensions | — | owner, at `owner_allow_token` |
| event authority | `["__event_authority"]` | — | — | — |

**`DeskConfig`** (296 B): `admin` Pubkey @0 (the upgrade authority at init) · `usdc_mint` @32 · `swap_program` @64 · `attestors` [Pubkey; 4] @96 · `cluster_tag` u8 @224 (core `CLUSTER_ID`: 101 mainnet, 103 devnet, 104 localnet) · `bump` u8 @225 · `_pad` [u8; 6] @226 · `_reserved` [u8; 64] @232.

**`Desk`** (528 B): `owner` @0 · `operator` @32 (default key = revoked) · `head` [u8; 32] @64 (genesis = 32 zero bytes) · `seq` u64 @96 · `per_action_cap` u64 @104 (USDC E6) · `daily_cap` u64 @112 · `spent_in_window` u64 @120 · `window_start_sec` i64 @128 · `tokens` [DeskToken; 8] @136 (each 40 B: `mint` @0, `enabled` u8 @32, `_pad` [u8; 7]) · `max_premium_bps` u16 @456 · `mode` u8 @458 (0 practice, 1 ask first, 2 on its own) · `paused` u8 @459 · `require_pyth_index` u8 @460 · `bump` u8 @461 · `token_count` u8 @462 · `_pad0` u8 @463 · `_reserved` [u8; 64] @464.

**`DeskRef`** (168 B): `mint` @0 · `pyth_feed_id` [u8; 32] @32 (zero = none; set by `admin_set_reference_feed`) · `token_price_e8` u64 @64 (PreStocks `tokenPrice` per UI token × 10^8) · `mark_price_e8` u64 @72 (PreStocks `markPrice`, the SPV's valuation per token) · `multiplier_e12` u64 @80 (the mint's ScaledUiAmount multiplier × 10^12, floored) · `fetched_at_sec` i64 @88 · `posted_by` @96 · `bump` u8 @128 · `_pad` [u8; 7] @129 · `_reserved` [u8; 32] @136.

## 3. The reference message (114 bytes, `agari-desk-ref-v1`)

An attestor signs, with the ed25519 precompile in the instruction **immediately before** `public_post_reference` (same rules as `agari-print-v1`: one signature, every offset naming its own instruction or `u16::MAX`, exact length), this message, all integers little-endian:

```
"agari-desk-ref-v1"   17 B   domain
program_id            32 B   agari-desk (so a devnet signature never verifies on mainnet's program)
cluster_tag            1 B   config.cluster_tag
mint                  32 B   the PreStocks mint
token_price_e8         8 B   u64
mark_price_e8          8 B   u64
multiplier_e12         8 B   u64
fetched_at_sec         8 B   i64
                     114 B
```

Vector (shared by `packages/markets/src/desk/reference.test.ts` and `anchor/tests/desk_reference.rs`): `anchor/tests/vectors/desk/reference-message.json`.

`public_post_reference` checks, in order: stack height is transaction level (`CpiNotAllowed`) · the previous instruction parses as ed25519 with a 114 B message (`BadAttestation`) · signer ∈ `config.attestors` and non-zero (`UnknownAttestor`) · message bytes equal (`BadAttestation`) · `token_price_e8 > 0`, `mark_price_e8 > 0`, `multiplier_e12 > 0` (`InvalidReference`) · `now − 900 ≤ fetched_at_sec ≤ now + 5` (`ReferenceStale`) · `fetched_at_sec > ref.fetched_at_sec` (`ReferenceNotMonotonic`) · write, `posted_by = payer`, emit `ReferencePosted`.

## 4. Instructions

### 4.1 Admin (the upgrade authority, once)
- `admin_init_config(cluster_tag, attestors[4])`: `usdc_mint` is an SPL Token mint (6 dp), `swap_program` is executable; `cluster_tag ∈ {101, 103, 104}`.
- `admin_set_attestors(attestors[4])`.
- `admin_set_reference_feed(pyth_feed_id)` on a `DeskRef`.

### 4.2 Public
- `public_init_reference`: creates `DeskRef` for a Token-2022 mint with 9 dp; payer anyone; `pyth_feed_id` zero until the admin sets it.
- `public_post_reference(token_price_e8, mark_price_e8, multiplier_e12, fetched_at_sec)`: §3.

### 4.3 Owner (never blocked by pause, caps, band, reference or operator state)
- `owner_open_desk(operator, per_action_cap, daily_cap, max_premium_bps, mode)`: `per_action_cap ≤ daily_cap` and both `> 0` (`BadConfig`); `operator ≠ owner` (`BadOperator`); `mode ≤ 2`; creates the Desk and the desk's USDC ATA (idempotent).
- `owner_allow_token`: the mint is Token-2022 with 9 dp and not `usdc_mint` (`BadToken`); at most 8 (`TooManyTokens`); an existing slot is re-enabled; creates the desk's ATA for the mint (idempotent, owner pays). Emits `TokenAllowed`.
- `owner_disallow_token`: `enabled = 0`; sells stay allowed so the desk can always exit.
- `owner_deposit(amount)`: `transfer_checked(owner_token → desk_ata)` signed by the owner, for `usdc_mint` or a configured mint (`TokenNotConfigured` otherwise). The mint's own transfer fee applies (100 bps on a PreStocks name); the program never reads or trusts the arriving amount.
- `owner_withdraw(amount)`: `amount == u64::MAX` means the whole balance at that moment. `transfer_checked(desk_ata → owner_ata)` signed by the desk PDA, where `owner_ata` must equal `get_associated_token_address_with_program_id(owner, mint, token_program)` and be owned by `owner` (`WrongTokenOwner`). Account named `owner_ata`, never `to`/`destination` (`idl-no-destination`).
- `owner_set_limits(per_action_cap, daily_cap, max_premium_bps, require_pyth_index)`.
- `owner_set_mode(mode)`.
- `owner_set_operator(operator)`: `≠ owner`, `≠ default` (`BadOperator`).
- `owner_revoke_operator`: `operator = default`, `paused = 1`.
- `owner_unpause`.

### 4.4 Owner or operator
- `pause`: `paused = 1`; emits `Paused { by }`.

### 4.5 Operator
`operator_buy(usdc_in, min_token_out, deadline_sec, decision_hash, swap_data)` — checks **in this order**:

1. signer == `desk.operator` and operator ≠ default (`NotOperator`)
2. `decision_hash ≠ 0` (`ZeroHash`), `usdc_in > 0` (`ZeroAmount`)
3. `now ≤ deadline_sec` (`DeadlinePassed`)
4. `paused == 0` (`IsPaused`)
5. `mode ≠ 0` (`ShadowMode`)
6. `token_mint` is configured (`TokenNotConfigured`) and enabled (`TokenNotEnabled`)
7. reference: `desk_ref.fetched_at_sec > 0` (`ReferenceUnavailable`), `now − fetched_at_sec ≤ 900` (`ReferenceStale`)
8. premium: with `require_pyth_index == 0`, `token_price_e8 × 10000 ≤ mark_price_e8 × (10000 + max_premium_bps)` (`PremiumTooHigh`); with it set, `price_update` must be passed (`PythIndexRequired`), fully verified, `feed_id == desk_ref.pyth_feed_id`, `price > 0`, `now − publish_time ≤ 60` (`PythIndexInvalid`), and the same inequality against the index price normalised to E8
9. caps (`guard::spend`): `usdc_in ≤ per_action_cap` (`OverPerActionCap`); a new window starts when `now ≥ window_start_sec + 86400`; `spent_in_window + usdc_in ≤ daily_cap` (`OverDailyCap`)
10. floor: `floor = usdc_in × 10^23 × 92 / (multiplier_e12 × token_price_e8 × 100)` (that is `× 9200 / 10000` reduced, so the u128 headroom reaches $37 M per action; beyond it `MathOverflow`); `min_out = max(min_token_out, floor)`
11. snapshot `desk_usdc.amount`, `desk_token.amount`
12. `invoke_signed(swap_program, remaining accounts as metas with the desk PDA flagged as signer, swap_data)` with seeds `["desk", owner, bump]`; `swap_program.key == config.swap_program` (`WrongSwapProgram`)
13. `reload()`: `usdc_before − usdc_after == usdc_in` (`UnexpectedSpend`); `received = token_after − token_before`; `received ≥ min_out` (`BelowOracleFloor`); `received > 0` (`NothingReceived`)
14. leak check: every remaining account that is a Token or Token-2022 account whose `owner` field is the desk PDA must be `desk_usdc` or `desk_token` (`DeskAccountLeak`)
15. `seq += 1`, `head = sha256(head ‖ seq ‖ decision_hash)`
16. `emit_cpi!(Bought { owner, seq, mint, usdc_in, token_out, token_price_e8, reference_e8, reference_source, decision_hash, head })`

`operator_sell(token_in, min_usdc_out, deadline_sec, decision_hash, swap_data)` mirrors it: steps 1–5 the same; 6 configured suffices (a disallowed name can still be sold); 7 the same; no premium check; **early** `oracle_value ≤ per_action_cap` where `oracle_value = ((token_in × token_price_e8) / 10^11) × multiplier_e12 / 10^12` (USDC E6) (`OverPerActionCap`); `floor = oracle_value × 92 / 100`, `min_out = max(min_usdc_out, floor)`; CPI; `token_before − token_after == token_in` (`UnexpectedSpend`, the gross amount leaves: the transfer fee is the pool's problem); `received ≥ min_out`; leak check; caps counted at `counted = max(usdc_out, oracle_value)` (`guard::spend`); seq/head; `Sold { …, counted_usdc }`.

`operator_checkpoint(deadline_sec, decision_hash)`: steps 1–3 only. Allowed while paused and in mode 0 ("paused, did nothing" is a record too). seq/head; `Checkpoint`.

### 4.6 Errors (explicit discriminants from 1000 → Anchor codes 7000–7299)

7000 `NotAdmin` · 7001 `NotOwner` · 7002 `NotOperator` · 7003 `NotOwnerOrOperator` · 7004 `IsPaused` · 7005 `ShadowMode` · 7006 `ZeroHash` · 7007 `ZeroAmount` · 7008 `DeadlinePassed` · 7009 `BadConfig` · 7010 `BadOperator` · 7011 `BadClusterTag` · 7012 `MathOverflow` · 7013 `CpiNotAllowed` · 7100 `TokenNotConfigured` · 7101 `TokenNotEnabled` · 7102 `TooManyTokens` · 7103 `BadToken` · 7104 `WrongMint` · 7105 `WrongTokenOwner` · 7106 `WrongSwapProgram` · 7107 `DeskAccountLeak` · 7200 `OverPerActionCap` · 7201 `OverDailyCap` · 7202 `ReferenceUnavailable` · 7203 `ReferenceStale` · 7204 `ReferenceNotMonotonic` · 7205 `InvalidReference` · 7206 `BadAttestation` · 7207 `UnknownAttestor` · 7208 `PremiumTooHigh` · 7209 `PythIndexRequired` · 7210 `PythIndexInvalid` · 7211 `BelowOracleFloor` · 7212 `UnexpectedSpend` · 7213 `NothingReceived`.

### 4.7 Events (`emit_cpi!`, Borsh)

`ConfigInitialized`, `AttestorsSet`, `ReferenceInitialized`, `ReferenceFeedSet`, `ReferencePosted`, `DeskOpened`, `TokenAllowed`, `TokenDisallowed`, `Deposited`, `Withdrawn`, `LimitsSet`, `ModeSet`, `OperatorSet`, `OperatorRevoked`, `Paused`, `Unpaused`, `Bought`, `Sold`, `Checkpoint`. `Bought.reference_source`: 0 mark, 1 Pyth index.

## 5. The gate in TypeScript mirrors the program (`packages/core/src/desk/gate.ts`, `gate.vectors.json`)

`gate()` repeats the program's integer maths, rounding included, so the runner never sends what the chain refuses: the buy floor, the sell oracle value and floor, `counted = max(quoteOut, oracleValue)`, the premium inequality, the caps (the smaller of the chain's and the mandate's), plus two refusals tighter than the chain for an ordinary rebalance: `|gap| ≤ MAX_GAP_BPS (300)` and `cost ≤ MAX_COST_BPS (250)` (250 because the 100 bps transfer fee is inside every cost). `guard.rs`'s unit tests and `gate.test.ts` both assert every row of `gate.vectors.json`.

## 6. The record (`desk.v1`) and the hash chain (`record.ts`, `hashing.ts`)

- The body is strict zod, every absent field `null`, amounts as decimal strings (USDC to 6 dp, tokens to 9 dp, prices to 8 dp), basis points, counts and seconds as safe integers, never a float, never a bigint.
- Canonical bytes: RFC 8785 for this restricted domain (keys sorted by UTF-16 code units, `JSON.stringify` string escaping, `-0 → 0`). `hashRecord = sha256(utf8(canonicalJson(body)))` = the `decision_hash` sent on chain. `chainHead(prev, seq, hash) = sha256(prev ‖ seq LE u64 ‖ hash)` = the program's `head`.
- Fields: `schemaVersion "desk.v1"`, `kind "decision" | "execution"`, `chainId`, `desk` (owner address; a practice desk has no PDA and uses the owner too), `seq`, `prevHash`, `chain { seqBefore, headBefore }`, `decidedAt`, `wake { scheduledFor, trigger }`, `mode`, `mandate { version, fingerprint } | null`, `valuation`, `need`, `candidate`, `deferral`, `approvalOf`, `blockers[]`, `evidence[]`, `timing` (the model's answer, prompt version, model, latency, our own rejections) `| null`, `gate | null`, `override`, `outcome`, `ask`, `preview`.
- Outcomes: `ACTED, ACTED_IN_PART, ACTED_BY_OVERRIDE, WOULD_HAVE_ACTED, ASKED, WAITED, DECLINED, NOTHING_TO_DO, NOT_EXECUTED, BLOCKED_BY_LIMIT, FAILED_NO_DECISION`.
- A practice desk keeps `seq`/`prevHash` in the database only (`chain` is `{ seqBefore: 0, headBefore: zero }`); the same `hashRecord` runs over it, so "Check it" recomputes a practice record exactly like a live one, and only the on-chain comparison is absent.

## 7. Practice (paper) rules (`paper.ts`)

A practice desk is a database row with a paper ledger `{ cashE6, positions: { [symbol]: raw } }` and no on-chain account. Every check runs the full pipeline on real prices and real Jupiter quotes at the desk's size; a "would have acted" moves the ledger with `applyPaperFill(ledger, fill)`: a buy takes `amountIn` USDC off cash and adds `quoteOut × (10000 − feeBps) / 10000` raw tokens; a sell takes `amountIn` raw tokens off the position (the gross amount leaves) and adds `quoteOut × (10000 − feeBps) / 10000` USDC. `feeBps` is PreStocks' 100 bps transfer fee, applied to the received leg because whether Jupiter's `outAmount` already nets it is measured at C6.E; a measured `0` switches it off. Valuation, needs, the gate and the grade run on the ledger exactly as on a live desk. Six practice checks must exist before **Go live** unlocks (C5).

## 8. Off-chain arithmetic ported from Shijima (`packages/core/src/desk/`)

- **Units:** `VALUE_SCALE = 10^23`; `valueE6(raw, multiplierE12, priceE8) = raw × multiplierE12 × priceE8 / 10^23`; `rawFor(usdcE6, multiplierE12, priceE8) = usdcE6 × 10^23 / (multiplierE12 × priceE8)`.
- **Valuation:** total = cash + Σ priced holdings; an unpriced holding is listed, never valued at zero, never traded.
- **Needs:** `MIN_TRADE_E6 = 1_000_000`, `MAX_CANDIDATES = 3`, `COST_MULTIPLE = 5`, `TRANSFER_FEE_BPS = 100`, `DEX_FEE_BPS_EST = 10`, so the drift threshold is `max(driftToleranceBps, ceil(5 × 110)) = 550` bps unless the owner's tolerance is wider; `SELL_HEADROOM_BPS = 200`; sales first, then buys, largest drift first; a buy never takes cash below the mandate's cash target.
- **Pre-gate rules:** `DESK_NOT_ACTIVE, TOKEN_NOT_ALLOWED, REFERENCE_UNAVAILABLE, PREMIUM_TOO_HIGH, QUOTE_UNAVAILABLE, BEYOND_PRICE_BAND, PRICE_MOVING_FAST, MINT_PAUSED, ACCOUNT_FROZEN, ROUTE_TOO_LARGE, DID_THIS_MINUTES_AGO`.
- **Deferral:** a wait ends after 24 h, or when cash ≥ `MIN_TRADE_E6` arrived, the premium moved ≥ 100 bps, the spot moved ≥ 200 bps, or the drift grew ≥ tolerance / 2.
- **Timing:** one question, four answers `ACT_NOW | ACT_PART (25|50|75) | WAIT | DECLINE`; strict zod; hard banned words fail closed; the prompt is byte-stable (`desk-timing.v1`) with evidence `e1..e7` and owner rules `r1..r10`.
- **Grade:** at 24 h, timing against the one alternative; `|difference| < 25 bps` is "no real difference".

## 9. Tests

- Core (vitest): needs, gate vectors, hashing (incl. the chain head against a Rust-asserted vector), timing, deferral, grade, mandate, paper, banned words over our own copy.
- Program (LiteSVM, `anchor/tests/desk_*.rs`): open/allow/deposit/withdraw (`u64::MAX`, wrong ATA refused, never blocked while paused), guards (`OverPerActionCap`, `OverDailyCap` across the window boundary, `PremiumTooHigh`, `BelowOracleFloor`, `UnexpectedSpend`, `DeskAccountLeak`, `ShadowMode`, `IsPaused`, a disallowed name still sells), reference (good post, stale, unknown attestor, wrong length, non-monotonic), chain (seq gap-free, head recomputed off-chain equals on-chain after buy/sell/checkpoint). A stub swap program under `anchor/programs/agari-swap-stub` moves the requested balances (or misbehaves on command) so the CPI path and every post-check are exercised, on a Token-2022 mint carrying TransferFee (100 bps) + ScaledUiAmount + Pausable + DefaultAccountState.
- Markets (vitest): the 114-byte message against the shared vector.
