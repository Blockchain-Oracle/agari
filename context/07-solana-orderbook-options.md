# 07 — Solana order-book options for Agari's binary Event Contracts engine

> - **Source:** planning-session research agent, verified 2026-09-13; transcribed by the main session after plan approval.
> - **Referenced by:** `docs/plan/00-plan.md` §3.0 as C:07.
> - **Decision taken:** build our own Anchor CLOB.
> - **Rent note:** the 5,080 lamports/byte (incl. 128-byte header) figure used below was measured on devnet on 2026-09-13.

## Bottom line

Recommendation: **(c) write your own Anchor 1.2 order book** with a four-way matcher. Borrow code from Phoenix v1 (MIT since May 2026) and sokoban (MIT OR Apache-2.0). Use Manifest only as a design and verification reference.

The three existing order books all fall short in the same ways:
- Each would need a wrapper to fake mint-a-pair.
- None lets your program cut off trading at a set time.
- None supports recyclable markets.
- None has a TypeScript client built on `@solana/kit`.

## 1. Manifest

| Item | Evidence |
|---|---|
| Repo / status | `github.com/Bonasa-Tech/manifest` (the old `CKS-Systems` URL redirects). Commits through 2026-09-12; latest release tag `program-v3.0.19` (2026-07-21); `programs/manifest` Cargo.toml says 3.1.0. |
| License | Repo LICENSE is **GPL-3.0**. On crates.io, `manifest-dex` is stuck at 2.0.1 (2025-05-19) and `hypertree` at 1.0.0, both labelled GPL-2.0-or-later. The npm SDK is MIT. |
| Program ids | Core `MNFSTqtC93rEfYHB6hF82sKdZpUDFWkViLByLd1k1Ms` (upgrade authority is a 4-of-5 Squads multisig). Wrapper `wMNFSTkir3HgyZTsB7uqu3i7FA73grFCptPXgrZjksL`. UI wrapper `UMnFStVeG1ecZFc2gc5K3vFy3sMpotq8C91mXBQDGwh`. **All three are executable on devnet and mainnet** (checked with `getAccountInfo`). |
| Stack | Not Anchor. Uses `pinocchio 0.10.2`, `solana-program =2.2.1`, `spl-token-2022 9`, and a shank IDL. |
| Architecture | "hypertree": one account made of 80-byte blocks, holding three red-black trees (Bids, Asks, ClaimedSeats) plus a free list. `MARKET_FIXED_SIZE=256`, `RESTING_ORDER_SIZE=64`, `CLAIMED_SEAT_SIZE=64`. The account grows through `Expand`. No crank; trades settle straight into seat balances. |
| Order types | `Limit=0, ImmediateOrCancel=1, PostOnly=2, Global=3, Reverse=4, ReverseTight=5`. PostOnly and Global orders can never take. Client order ids, fill-or-kill and post-only-slide are left to wrapper programs. A recent release note says a crossing PostOnly now reverts the whole wrapper batch. |
| Expiry | `RestingOrder.last_valid_slot: u32`, where 0 means no expiry. It is **slot-based, not a timestamp**. The wrapper treats values below 10,000,000 as relative to the current slot. |
| Instructions | 0 CreateMarket, 1 ClaimSeat, 2 Deposit, 3 Withdraw, 4 Swap, 5 Expand, 6 BatchUpdate, 7–12 Global (create / add trader / deposit / withdraw / evict / clean), 13 SwapV2. **There is no CloseMarket**, so market rent can never be reclaimed. |
| Costs | Market creation 0.007 SOL. "No trading fees forever". Token-2022 is supported, with create-time checks for the MintCloseAuthority and PermanentDelegate extensions. Each order or seat block costs about 80 × 5,080 lamports ≈ **0.0004 SOL**; the rate is `getMinimumBalanceForRentExemption(1024)` = 0.00585216 SOL today. Global accounts allow up to 999 seats, with a 5,000-lamport gas deposit per global order. |
| Compute | Official benchmark (2026-09-10): Manifest p50/p95/p99 = 1,442 / 2,432 / 2,655 CU. Phoenix = 6,897 / 13,208 / 13,902 CU. |
| TypeScript SDK | `@bonasa-tech/manifest-sdk` 0.2.47 (2026-09-12) is built on **`@solana/web3.js ^1.99` + solita/beet**, not kit. You would generate a kit client with Codama from the shank IDL; that path is untested. |
| CPI | Signer checks only look at `is_signer`/`is_writable`, so a PDA can trade via `invoke_signed`. The trader identity is the payer: the seat is keyed by `payer.pubkey()`, and the deposit token account must be owned by the payer. Because the payer also funds `Expand`, the PDA must be a system-owned account with no data (my inference). The wrapper forwards calls with `invoke_passthrough`; a recent commit is "deduplicate accounts in cpi context (#710)". **Crate compatibility:** Anchor 1.2.0 (crates.io, 2026-09-04) depends on `solana-* ^3`, while the Manifest crates pin solana 2.2.1. Don't link the crate; build the raw instruction (`[6u8] + borsh(BatchUpdateParams)`). Linking GPL code into your program would also bring GPL obligations. |

**Emulating a per-window binary book (Up mint as base, USDC as quote)**

What works:
- Buy Up and Sell Up are ordinary bids and asks.
- "Buy Down at 0.38": the wrapper takes 1 USDC, mints a complete set, gives the user Down, and rests an **Up ask at 0.62** from the wrapper PDA's seat.
- "Sell Down at 0.40": the user escrows Down plus 0.60 USDC as an **Up bid at 0.60**, and the wrapper burns Up+Down after the fill.
- A taker "Buy Down" IOC can be atomic in one transaction: mint the set, Swap-sell Up, merge back any unsold Up.

What breaks:
1. **No native mint-a-pair.** Manifest's matching loop only moves base atoms already credited to the maker's seat (to the taker) and quote the other way. There is no callback and no mint authority.
   - Two resting *buyers* (Buy Up 0.62 and Buy Down 0.38) can never cross, because a Down buyer only exists as an ask once Up has been minted in advance.
   - A resting Buy Down therefore locks 1.00 USDC instead of 0.38 (2.6×), and a Sell Down locks an extra (1−p).
   - Global orders move existing tokens just in time; they cannot mint.
   - Polymarket's exchange contract shows the native version: `_deriveMatchType` maps BUY×BUY to MINT, and `_executeMatchCall` mints the pair from the exchange's own collateral balance.
2. **Settlement after a fill needs a crank again.** Proceeds land in the wrapper PDA's seat, so the wrapper must map sequence numbers back to users. Burning the pair after a Sell Down fill needs a later transaction.
3. **Anyone can trade the book directly.** Anyone, including Jupiter, can call core `Swap` and skip the wrapper.
   - So your program cannot stop trading at window close or before oracle settlement.
   - Resting quotes can be sniped once the result is known.
   - Cancelling 512 wrapper orders does not fit in one transaction.
4. **Slot expiry drifts** against the window's unix end time.
5. **No tick grid.** Prices are a u32 mantissa plus a decimal exponent; the README itself asks "Is tickless a good idea?". The wrapper would have to enforce the grid.
6. **No recycling.** A market is bound to its base mint and cannot be closed. Per-window mints mean a new market every window: (288+96+24) × 0.007 ≈ **2.9 SOL/day per symbol**, unrecoverable.

## 2. Phoenix v1 and OpenBook v2

| | Phoenix v1 ("Phoenix Legacy") | OpenBook v2 |
|---|---|---|
| License | **MIT since 2026-05-11** (commit "Change license from BUSL to MIT (#51)"). crates.io `phoenix-v1` is still 0.2.4 (2023), labelled "non-standard". | MIT, except `programs/openbook-v2/src/instructions/**` which is GPL-3.0. crates.io 0.1.0 is GPL-3.0-or-later. |
| Maintenance | Frozen: only license and doc commits since 2024-03. Docs renamed it "Phoenix Legacy" on 2026-02-04. Drift's fork `velocity-exchange/phoenix-v1` is archived. | Effectively unmaintained; last commit 2024-06-23 (v0.2.10). |
| Program id / devnet | `PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY`, mainnet and devnet. | `opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb`, mainnet and devnet. |
| Stack | Native: `solana-program =1.14.9`, `lib-sokoban =0.3.0`, shank. | Anchor 0.28, oracle dependencies (pyth, switchboard). |
| Crank | None; trader state lives in the market account. | **Required.** Fills go to an event heap (`MAX_NUM_EVENTS=600`) that `consume_events` must process. `settle_funds` and `prune_orders` are separate. |
| Order types / expiry | PostOnly, Limit and IOC packets with `last_valid_slot` **and `last_valid_unix_timestamp_in_seconds`**, plus `self_trade_behavior`, `match_limit`, `client_order_id`. | Limit, IOC, PostOnly, Market, PostOnlySlide, FillOrKill; `expiry_timestamp` (unix); oracle-pegged orders. |
| Seats / limits | Makers need a seat: `RequestSeat` (14), then the market authority approves with `ChangeSeatStatus` (104). Takers don't. Taker fees plus `CollectFees`. Market rent "3+ SOL" (per Manifest's comparison table). | `MAX_OPEN_ORDERS=24` per open-orders account. Market rent "2 SOL" (per Manifest's table). |
| SDK | `@ellipsis-labs/phoenix-sdk` 2.0.3 (2026-04), web3.js; the SDK repo has no license. | `@openbook-dex/openbook-v2` 0.2.10 (2024-06), Anchor-TS on web3.js. |
| CPI from Anchor 1.2 | Raw instructions only; its Rust types are on solana 1.14. | Raw instructions with Anchor discriminators; its anchor-lang 0.28 crate conflicts with 1.2. |

Both share Manifest's mint-a-pair, per-window-market and cut-off problems. On top of that they cost 300–400× more rent, and add a crank (OpenBook) or seat approval (Phoenix).

**Phoenix Perpetuals** was announced at Breakpoint 2025. Its "Rise" SDK (TypeScript and Rust) lives at `Ellipsis-Labs/rise-public`, has no license, and was pushed 2026-09-11. It is a perps venue, so it isn't relevant as the base for a spot binary book.

## 3. Existing Solana binary and prediction books

- **DFlow/Kalshi:** "Concurrent Liquidity Programs". Users write order intents on-chain, off-chain Kalshi liquidity providers fill them asynchronously, and yes/no SPL tokens are minted and redeemed. **No on-chain order book, and no open-source program found.**
- **Drift BET:** perp markets with `ContractType::Prediction` (`velocity-exchange/protocol-v2`, `programs/drift/src/state/perp_market.rs`, Apache-2.0).
  - It capped the AMM price to [0,1] ("lowest ask price is $0.05", "highest bid price is $0.95").
  - Positions were synthetic, with no complete sets. Matching went through Drift's off-chain order-book servers and keeper bots plus the AMM; those repos are now archived.
  - Drift was exploited on 2026-04-01 (reported $285M–$295M) and rebranded to Velocity in July 2026. The repos were renamed on 2026-06-23 and archived.
  - The relaunch is USDT-settled perps, with no sign of BET coming back.
  - Useful only as a reference for price-bounding logic.
- **Hedgehog:** parimutuel pools, an AMM, and separate yes/no books. The GitHub org is stale (`hedgehog-program-library` Apache-2.0, last push 2024-09; `hpl-parimutuel-eclipse` 2024-12). No usable order book.
- **Monaco Protocol:** the `MonacoProtocol` org now shows 0 public repos. The code survives at `BetDexLabs/protocol` (Apache-2.0, last push 2024-12-19; Anchor 0.29, solana 1.17.2; id `monacoUXKtUi6vKsQwaLyxmXKSievfNWEcYXTgkbCih`).
  - Design: a price ladder with per-price matching pools, filled first-in first-out.
  - Order flow is queued: `create_order_request` → `process_order_request` → operator-run `match_orders` / `process_order_match_{maker,taker}`.
  - It has **cross-outcome matching** (`open_market(enable_cross_matching)`, `update_market_liquidities_with_cross_liquidity`), the closest Solana analogue to mint-a-pair. It needs a crank and is stale.
- **Rust crates:**
  - `lib-sokoban` 0.3.3 (MIT OR Apache-2.0) provides RB tree, AVL, critbit, hash table, deque and node allocator. Its only dependencies are `bytemuck`, `thiserror` and `num-*`, so it **has no Solana version dependency and works with Anchor 1.2 zero-copy**.
  - `hypertree` is GPL. The crates.io `critbit` crate (Codeberg, 2025) is unrelated. `HkSolDev/orderBook` is an unlicensed toy.
- **MagicBlock:**
  - `magicblock-engine-examples/binary-prediction` (MIT, Anchor 1.0.2, `ephemeral-rollups-sdk` 0.16.2) is an **up/down bet where a pool takes the other side**, priced by an ephemeral oracle. It isn't an order book, but it's a good ephemeral-rollup plus oracle reference.
  - `kirarisk/manifest`, forked from `CLOB-ER/manifest` (GPL-3.0, last push 2025-07), is a Manifest-on-rollup prototype claiming under 50 ms. Its showcase page now returns 404.
- **Off-chain reference (EVM):** `Polymarket/ctf-exchange` (MIT) has `enum MatchType { COMPLEMENTARY, MINT, MERGE }`, the canonical four-path logic.

## 4. Building your own: design

**Book layout: one zero-copy `Book` account per pool slot**
- **Price ladder with a bitmap, not a tree.** Up prices sit in (0,1) on a tick grid (99 levels at 1¢, 999 at 0.1¢).
  - A dense `levels[N]` array of `{head, tail, total_qty}`, plus a u128 occupancy bitmap per side.
  - Orders live in a slab node allocator (sokoban's `NodeAllocator` pattern), linked into first-in-first-out lists per level.
  - Best price is O(1) via `leading_zeros`/`trailing_zeros`; insert at tail and cancel by index are also O(1).
  - Depth walks for VWAP are a linear scan of levels.
  - Use sokoban's RB tree only if you need unbounded or very fine prices.
- **Order record (~48–64 bytes):** `qty_lots u64, seq u64, expiry_ts i64, seat u16, kind u8 {BuyUp, SellUp, BuyDown, SellDown}, flags, prev/next u32, client_id u64`.
- **One Up-quoted book.** Correction to your brief: a Buy Down at q belongs on the **ask** side at 1−q, not the bid side.
  - Bid side: BuyUp@p (locks p USDC) and SellDown@1−q (locks 1 Down).
  - Ask side: SellUp@p (locks 1 Up) and BuyDown@1−q (locks q USDC).
  - A crossing bid/ask pair selects one of four paths:

| bid \ ask | SellUp (Up) | BuyDown (USDC) |
|---|---|---|
| **BuyUp (USDC)** | Direct Up trade | **Mint pair** (p + (1−p) = 1 USDC into the vault) |
| **SellDown (Down)** | **Burn pair** (1 USDC released) | Direct Down trade |

- Every resting order is fully collateralized with no pre-minting. This is Polymarket's MINT/MERGE logic on a Phoenix-style crankless engine.
- **Positions as an internal ledger.** Hold USDC, Up and Down balances per seat and per window epoch, instead of SPL mints per window. This avoids per-window mint and vault rent and makes recycling cheap. Tokenize later if needed.

**Seats and settlement (why no crank)**
- Synchronous settlement only works when maker balances live **inside the book account**. Phoenix keeps trader state in the market, and Manifest keeps ClaimedSeats in the market.
- OpenBook v2 keeps open orders in separate accounts, which is exactly why it needs an event heap and a crank.
- Makers use in-book seats (64 bytes: free/locked USDC, Up, Down, epoch). Evict empty seats, and require a small deposit to prevent seat squatting.
- Takers settle into their own `Position` PDA plus token accounts included in the transaction.
- The market-maker vault is just a seat owner acting through a PDA.

**Order types and expiry**
- Limit, IOC, PostOnly (reject; optionally slide), plus Phoenix-style `self_trade_behavior` and `match_limit`.
- Store a unix `expiry_ts` checked against `Clock::unix_timestamp`. Skip and evict expired orders lazily while matching, capped per instruction.
- Enforce the window end inside matching, so nobody can route around your program.
- Tick/lot grid: price in u16 ticks, size in lots. Round in the vault's favour and assert the pair-invariant totals.

**Size and rent** (formula: (bytes + 128) × 5,080 lamports)
- 128 orders/side: 256 × 80 + 128 seats × 64 + 512 header ≈ 29.2 KB ≈ **0.15 SOL**.
- 512 orders/side: ≈ 115 KB ≈ **0.59 SOL**.
- These are one-time costs per recycled pool slot, and reclaimable.
- Above 10,240 bytes the account can't be initialized through CPI. Create it with a direct System Program `createAccount`, then initialize it with Anchor's `#[account(zero)]` and `load_init` (Anchor zero-copy docs).

**Compute** (estimates, not measured)
- Manifest's whole place/match instruction is about 1.4k CU at p50. An Anchor zero-copy version will likely add a few thousand CU for account loading.
- Each fill with ledger updates: hundreds to ~1.5k CU.
- Keep SPL CPIs to taker in/out only (~4–6k CU each).
- Budget about 20–40k CU for a 10-fill IOC, and cap fills with `match_limit`.

**Recycling across windows**
- Tag orders with an `epoch`. A permissionless `reset` after settlement clears the ladder, bitmap and free list in O(1).
- It walks **seats, not orders**: locked balances move to free, and Up/Down convert at 1/0/0.5 into free USDC, auto-redeemed for makers.
- Takers redeem their `Position` PDAs lazily.

**What to borrow**

| Source | License | What to take |
|---|---|---|
| Phoenix v1 | MIT | Matching loop, order packets, self-trade handling, crankless trader state |
| sokoban | MIT OR Apache-2.0 | Node allocator |
| Polymarket ctf-exchange | MIT | MINT/MERGE logic |
| Monaco | Apache-2.0 | Price ladder, cross-matching |
| Manifest | GPL | **Ideas only**: reverse orders for the market-maker vault; the Certora property list (tree invariants, no loss of funds, withdraw always possible, correct matching attribution) as a test and fuzz checklist |
| OpenBook v2 | MIT parts only | Order-type semantics |

## 5. Recommendation: **(c) write your own Anchor 1.2 order book**

**Why:**
- **Faithful semantics.** Mint-a-pair and burn-a-pair need matching that mints and burns inside the loop. All three candidates would need a wrapper that pre-mints full sets (2.6× capital lockup) plus a post-fill settlement crank.
- **Enforceable cut-off.** Manifest and Phoenix markets can be traded directly without your program, so you can't enforce the window close. Only Phoenix has timestamp expiry.
- **Recycling.** Manifest has no market close. Phoenix/OpenBook cost 2–3+ SOL per market. A per-window-mint design costs about 2.9 SOL/day per symbol even on Manifest.
- **Composability.** Your vault and reserve programs get typed Anchor 1.2 CPI plus one Codama client (kit 8). Manifest and Phoenix pin solana 2.2.1 and 1.14, OpenBook is on Anchor 0.28, and none ships a kit SDK.
- **License.** Phoenix (MIT) and sokoban (MIT/Apache) can be vendored freely. Manifest (GPL-3.0) cannot be linked without GPL obligations.
- **Effort.** A Phoenix-derived fork (option b) would still mean porting 1.14 to Anchor 1.2 and rewriting the matcher for four paths, which amounts to option (c).

**Risks and mitigations:**
- **Unaudited matching engine:** property tests for the pair invariant (vault USDC = pairs outstanding + locked collateral) and for rounding on 1−p; LiteSVM/Mollusk fuzzing; an external audit.
- **Compute blow-ups on deep walks:** `match_limit` and lazy expiry.
- **One write-locked book per window:** every trade serializes on it, which is normal for an order book. Keep market-maker `batch_update` cheap.
- **Seat exhaustion or squatting:** deposits plus eviction.
- **Races around reset and oracle delay:** a state machine of Trading → Closed(ts) → Settled → Reset.
- **No outside liquidity:** routers like Jupiter won't route into your book. Acceptable for a closed binary venue.
- **Solana v1 transaction and account-limit changes:** keep `match_limit` configurable.
- **Fallback if time runs out:** a Manifest wrapper (option a) could demo Up-token trading on devnet today, since its programs are live there. It cannot reproduce resting mint-a-pair crosses or a trustworthy window close.

## Sources

- Manifest: [repo](https://github.com/Bonasa-Tech/manifest), [OrderType/RestingOrder](https://github.com/Bonasa-Tech/manifest/blob/main/programs/manifest/src/state/resting_order.rs), [instructions](https://github.com/Bonasa-Tech/manifest/blob/main/programs/manifest/src/program/instruction.rs), [constants](https://github.com/Bonasa-Tech/manifest/blob/main/programs/manifest/src/state/constants.rs), [CU benchmark](https://bonasa-tech.github.io/manifest/dev/bench/), [npm SDK](https://www.npmjs.com/package/@bonasa-tech/manifest-sdk), [crates.io manifest-dex](https://crates.io/crates/manifest-dex)
- Phoenix: [phoenix-v1](https://github.com/Ellipsis-Labs/phoenix-v1), [order_packet.rs](https://github.com/Ellipsis-Labs/phoenix-v1/blob/master/src/state/order_schema/order_packet.rs), [Phoenix docs](https://docs.phoenix.trade/sdk/on-chain-programs), [rise-public](https://github.com/Ellipsis-Labs/rise-public), [Perps announcement](https://www.ellipsislabs.xyz/blog-posts/introducing-phoenix-perpetuals)
- OpenBook: [openbook-v2](https://github.com/openbook-dex/openbook-v2), [LICENSE](https://github.com/openbook-dex/openbook-v2/blob/master/LICENSE)
- Data structures: [sokoban](https://github.com/Ellipsis-Labs/sokoban), [lib-sokoban](https://crates.io/crates/lib-sokoban), [Anchor zero-copy](https://www.anchor-lang.com/docs/features/zero-copy), [anchor-lang 1.2.0](https://crates.io/crates/anchor-lang)
- Drift/Velocity: [perp_market.rs](https://github.com/velocity-exchange/protocol-v2/blob/master/programs/drift/src/state/perp_market.rs), [The Defiant rebrand](https://thedefiant.io/news/defi/drift-protocol-rebrands-to-velocity-dex-ahead-of-relaunch), [CryptoTimes](https://www.cryptotimes.io/2026/07/02/drift-rebrands-to-velocity-ahead-of-private-beta-launch/)
- Monaco / Hedgehog: [BetDexLabs/protocol](https://github.com/BetDexLabs/protocol), [Hedgehog-Markets](https://github.com/Hedgehog-Markets/)
- DFlow: [Solana news](https://solana.com/news/dflow-prediction-markets-api), [QuickNode guide](https://www.quicknode.com/guides/solana-development/3rd-party-integrations/kalshi-prediction-markets-with-dflow)
- MagicBlock: [binary-prediction](https://github.com/magicblock-labs/magicblock-engine-examples/tree/main/binary-prediction/anchor), [kirarisk/manifest](https://github.com/kirarisk/manifest)
- Polymarket: [ctf-exchange Trading.sol](https://github.com/Polymarket/ctf-exchange/blob/main/src/exchange/mixins/Trading.sol)
