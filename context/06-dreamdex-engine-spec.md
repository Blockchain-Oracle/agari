# 06: DreamDEX Event Contracts engine spec (for the Agari Solana rebuild)

> Source: planning-session explore agent, 2026-09-13; transcribed by the main session after plan approval. Masayume at `68f7a09`.
> - Evidence tags: [C] = confirmed, [I] = inferred.
> - Referenced by `docs/plan/00-plan.md` §3 as C:06.
> - Where the approved plan's §3 differs, the plan wins: exact 0.001 grid, per-boundary print policies, admission deadline, `MarketResult`, growable Ledger.

**No verified Solidity source exists publicly.**
- `gh repo list somnia-chain` shows 7 public repos, none with contracts.
- `somnia-chain/somnia-markets` (the SDK repo) is private.
- `gh search code "mintCompleteSet" --owner somnia-chain` returns nothing.

So this spec is reconstructed from three sources:
- the SDK's ABIs and comments, which were written against deployed bytecode;
- the DreamDEX docs;
- Masayume's own fork runs and live runs.

**Path roots:**

| Short | Path |
|---|---|
| `SDK` | `/Users/abu/dev/hackathon/sommina-events/reference/markets-sdk/package/src/` |
| `DOCS` | `/Users/abu/dev/hackathon/sommina-events/reference/dreamdex-docs/` |
| `KIT` | `/Users/abu/dev/hackathon/sommina-events/reference/dreamdex-bot-kit/` |
| `CTX` | `/Users/abu/dev/hackathon/sommina-events/context/` |
| `MS` | `/Users/abu/dev/hackathon/sommina-events/` (Masayume at 68f7a09) |

---

## 1. Order model

**Entry point** [C] (`SDK/tradeAbi.ts:22-23`):

```
placeBinaryOrder(uint8 kind, uint256 price, uint256 quantity, uint64 expireTimestampNs,
                 uint8 orderType, uint8 selfMatchingOption, address builder,
                 uint96 builderFeeBpsTimes1k, uint64 userData)
  returns (bool success, uint128 id)
```

- There is also `placeBinaryOrderFor(owner, …)`.
- On a binary pool, the generic `placeOrder`, `placeOrders`, `amendOrder` and `amendOrders` all revert with `UseBinaryPlacement` (`SDK/tradeAbi.ts:15-21`, `SDK/trade.ts:1738`).

| Field | Semantics |
|---|---|
| `kind` | 0 BUY_YES, 1 SELL_YES, 2 BUY_NO, 3 SELL_NO [C] (`SDK/writer.ts:79-84`). Masayume computes it as `outcomeIdx*2 + (isBuy?0:1)` (`MS/contracts/src/leverage/LeverageGateway.sol:159`). |
| `price` | **Always the YES price, for all four kinds** [C] (`SDK/tradeAbi.ts:19`). A fork run confirmed a BUY_NO at `p` escrows `one−p` per contract (`CTX/44-…:18-22`). |
| `quantity` | Raw outcome-token units. Must be a `lotSize` multiple and ≥ `minQuantity` (errors `InvalidQuantity`, `QuantityBelowMinimum`). Price must be a `tickSize` multiple (`InvalidPrice`) [C] (`DOCS/developers/contracts/errors.md:31-33`). |
| `expireTimestampNs` | Nanoseconds. Must satisfy `now < exp ≤ pool.marketExpiryNs()`, otherwise `OrderAlreadyExpired` / `OrderExpiryBeyondMarket`. No GTC; the SDK defaults it to the market expiry [C] (`SDK/trade.ts:163-175`, `SDK/orders.ts:888-895`). |
| `orderType` | 0 Normal (limit, remainder rests), 1 FOK, 2 IOC, 3 PostOnly. There is no "market" enum: a market order is an IOC at a protective limit [C] (`SDK/trade.ts:295-304`). |
| `selfMatchingOption` | 0 CancelTaker, 1 CancelMaker [C] (`SDK/trade.ts:542-547`). The SDK always sends 0 (`SDK/orders.ts:912`). |
| builder fee | uint96 in bps×1000. Needs a per-pool `approveBuilder`. The binary ceiling is frozen at init (`BuilderFeeExceedsCap`) [C] (`SDK/tradeAbi.ts:40-47`, `SDK/trade.ts:1589-1597`). |
| `userData` | Opaque uint64. Since v2 the side is **not** stored here; it comes from the `BinaryOrderPlaced(orderId, kind)` event [C] (`SDK/eventsAbi.ts:276-292`). |

**Grid** [C]
- Read from `getOrderBookParameters() → (tickSize, minQuantity, lotSize)` (`SDK/readsAbi.ts:36`).
- Mainnet: tick = lot = 1e15 on 18-decimal collateral (0.001).
- Testnet: tUSDC is 6 decimals; lot is 0.001 contracts (`CTX/01-…:77`, `CTX/48-…:62`).
- Price bounds are the open interval (0, one). The SDK caps protective limits at `one − tick` (`SDK/derivedReads.ts:676`). The contract-side bound is [I].

**Order ids**
- uint128, unique per pool, not globally [C] (`SDK/orders.ts:450`).
- `getOrder` reverts `IncorrectOrder` for any id that is not active (`SDK/readsAbi.ts:21-29`).
- `OrderIdMismatch` mentions "expired-and-reused" slots, which suggests an id bound to a book slot [I] (`DOCS/developers/contracts/functions.md:116`).
- **Conflict:** `SDK/tradeAbi.ts:25-31` says `reduceOrder` shrinks an order in place and keeps its queue priority. `SDK/orders.ts:515-516` says a reduce "re-keys the remainder under a new id".

**Cancel** [C]
- `cancelOrder(uint128)` refunds the remaining escrow and still works while Locked.
- `cancelOrders` is best-effort and skips stale ids (`DOCS/developers/contracts/functions.md:185-191`).
- `reduceOrder(s)` is atomic.
- `cancelExpiredOrders(ids)` and `sweepExpiredAtLevel(isBid, price, maxCount)` are permissionless (`SDK/tradeAbi.ts:24-39`).

**Open-order reads** [C] (`SDK/readsAbi.ts:17-20, 33`)
- `getOwnOpenOrders()` answers for msg.sender.
- `getAllOpenOrdersOffChain(isBid, maxCount, cursor)` requires msg.sender = 0x0.
- `getBookLevels(isBid, n)` returns aggregated levels and skips expired makers.
- The indexer `Order` entity is described at `SDK/orders.ts:833-842`.

## 2. Matching

**Priority:** price-time [C] (`DOCS/trading/common/order-types.md:90-97`).

**One YES-quoted book.** Each kind maps onto the base book's (isBid, price):

| Book side | Holds |
|---|---|
| **Bid** | BUY_YES@p, SELL_NO@p |
| **Ask** | SELL_YES@p, BUY_NO@p |

- BUY_NO resting as a YES ask is [C] (`CTX/44-…:18`).
- SELL_NO as a bid is [C] by consistency across three places:
  - `toBinaryBook` derives noBids from yesAsks (`SDK/orders.ts:407-414`).
  - `levelsToCross` sends SELL_NO to noBids (`SDK/derivedReads.ts:68-79`).
  - Masayume's exit walk reads asks for a NO exit (`MS/contracts/src/leverage/LeverageGateway.sol:183-186`).

**Four paths from one bid×ask cross**, classified by the matrix that mirrors `BinaryPool._isPair` [C] (`SDK/store.ts:317-335`). With fill price P (YES terms), quantity q and `one = 10^dec`:

| Bid × Ask | Kind | Cash flows [I except where noted] |
|---|---|---|
| BUY_YES × SELL_YES | DIRECT_YES | The YES buyer pays q·P/one to the seller; q YES moves to the buyer. |
| SELL_NO × BUY_NO | DIRECT_NO | The NO buyer pays q·(one−P)/one to the NO seller; q NO moves. |
| BUY_YES × BUY_NO | MINT_A_PAIR | The YES side pays q·P and the NO side pays q·(one−P). Their sum q backs a newly minted q YES + q NO; backing += q. **Confirmed live [C]:** the vault's post-only bid at 0.311 and BUY_NO ask at 0.337 were hit by a BUY_NO IOC and a BUY_YES IOC. The vault received 10 YES + 10 NO, with escrow 9.74 = 0.311×10 + 0.663×10 (`CTX/44-…:31-33`). |
| SELL_NO × SELL_YES | BURN_A_PAIR | q YES + q NO burn. The YES seller gets q·P and the NO seller gets q·(one−P); backing −= q. |

**Fill price**
- The taker pays the fill price, not its limit; the escrow difference is refunded [C] (`DOCS/developers/event-contracts/market-structure.md:50`).
- The fill price equals the maker's resting price [I-strong]. `SDK/fills.ts:136-139` says so for spot/perp, and `SDK/derivedReads.ts:553-554` says "fills still land at each resting level's own price".

**Rounding** [I]
- The SDK escrows buys at the ceiling: `ceil(q·p/one)` for BUY_YES, `ceil(q·(one−p)/one)` for BUY_NO (`SDK/writer.ts:734-745`).
- Masayume books escrow as a floor division, and it matched "to the unit" (`MS/contracts/src/maker/MakerGateway.sol:93`, `CTX/44-…:88-96`). On the 1e15 grid the two are exact either way.
- Spot pools expose `convertToQuoteAtPriceCeil` (`SDK/tradeAbi.ts:289-295`), so the pool likely rounds up.

**Order types and rejections** [C] (`DOCS/trading/common/order-types.md:56-73`)
- Singular placements **revert** on:
  - `ImmediateOrCancelNoFill` (an IOC that filled zero; confirmed on a fork, `CTX/41-…:37`)
  - `FillOrKillNotFillable`
  - `PostOnlyWouldCross`
  - `SelfMatchCancelTaker`
  - `OrderAlreadyExpired`
- A partly filled IOC succeeds and cancels the remainder.
- CancelMaker emits `OrderCancelledSelfMatch` (`SDK/eventsAbi.ts:82-90`).

**Self-matching and crossed books**
- A same-owner BUY_YES × BUY_NO cross is blocked as a self-match [I] (`KIT/strategies/ec-maker/src/index.ts:21`).
- The book was observed **crossed on-chain for 1-2 blocks** while a maker ladder was being re-laid; chain and SDK store agreed level by level [C] (`CTX/48-…:20-40`).

**Expired makers**
- Expired makers are skipped, not evicted, and no event fires [C] (`SDK/orders.ts:709-716`, `SDK/store.ts:651-663`). This contradicts the docs, which say `OrderExpired` fires "inline during matching" (`DOCS/developers/contracts/events.md:71`).
- An owner's expired escrow is refunded lazily inside that owner's *next* placement on the pool. This caused a `Panic(17)` in Masayume's cash-delta accounting [C] (`CTX/44-…:83-96`).

**Levels walked per match:** not documented. Masayume reads 32 levels (`MS/contracts/src/leverage/LeverageGateway.sol:28`, `MS/contracts/src/parlay/ParlayPricing.sol:20`). The SDK default depth is 10 (`SDK/orders.ts:623`).

**Events per match** [C]
- `OrderFilled(takerId, makerId, qty, takerRemaining, makerRemaining, fillPrice)` fires **before** the taker's `OrderPlaced` in the same tx (`SDK/eventsAbi.ts:10-15`, `SDK/reducer.ts:276-282`).
- `OrderPlaced` fires for every accepted order; `OrderRested` fires only if the order rests (`SDK/trade.ts:612-615`).
- `BinaryOrderPlaced` order within the tx is not guaranteed (`SDK/reducer.ts:71-75`).
- Batch placement emits `OrderRejected(reason indexed)` (`DOCS/developers/contracts/types.md:55-68`).

## 3. Escrow and balances

- **Buys** escrow collateral per the formulas above. Generic pools pull `principal + max(makerFee, takerFee) + builderFee`; fees are 0 on dreamDEX [C] (`DOCS/developers/contracts/functions.md:13`).
- **Sells** escrow the full quantity of the outcome id, moved under a single ERC-6909 operator grant to the pool [C] (`SDK/writer.ts:740-743`).
- **Vault and payout**
  - Each pool is an ERC20Vault. Placement spends the per-pool vault balance first, then pulls from the wallet.
  - Fills, cancels and expiries auto-deliver to the wallet. If delivery fails, the amount is credited to the vault (`PayoutFallbackToVault`) and can be `withdraw`n [C] (`DOCS/developers/contracts/functions.md:13-14`).
  - Binary pools have no manual vault mode (`SDK/tradeAbi.ts:171-174`).
  - Masayume's gateways sweep the vault credit on every call (`MS/contracts/src/maker/MakerGateway.sol:64-71`).
- **Complete sets** [C]
  - Pool: `mintSet(address yesTo, address noTo, uint256 amount)` and `burnSet(uint256 amount)` (`SDK/tradeAbi.ts:48-53`).
  - Module: `mintCompleteSet` / `mergeCompleteSet(uint32 operatorId, bytes32 venueId, bytes32 marketId, uint256 amount)` (`SDK/moduleAbi.ts:21-23`).
  - `SetMinted` / `SetBurned` move `setBacking` ±amount (`SDK/eventsAbi.ts:414-435`).
  - Allowed only while Trading (`DOCS/developers/event-contracts/market-structure.md:18-31`).
- **ERC-6909 ids** [C] (`SDK/ids.ts:9-17, 40-43, 72-74`)
  - `id = (uint160(pool)<<72) | (nonce<<8) | idx`; `marketKey = id>>8`.
  - `nonce` is 1 on a fresh pool and increments on each recycle (`SDK/eventsAbi.ts:222-224`).
  - Mint authority is `msg.sender == address(id>>72)`.
  - One `setOperator` grant covers every id (`SDK/readsAbi.ts:124-141`).

## 4. Market and window lifecycle

**Who creates windows** [C] (`SDK/machineryAbi.ts:122-148`, `SDK/marketCreatorAdmin.ts:92-117`)
- `MarketCreatorFactory.createMarketCreator(owner, core, adapter, operatorId, venueId, defaultBookParams)` mints a MarketCreator.
- `registerSeries(seriesId, {collateral, asset, numericDecimals, intervalSec ≥ 60, settlementWindow})` defines a series.
- `triggerRoll(seriesId)` and `armFirstRoll(seriesId, firesAtSec)` start rolling.
- The venue must not require a per-create signature, because rolls are automated (`SDK/marketCreatorAdmin.ts:55-60`).

**Auto-roll** [C]
- Driven by Somnia reactivity; there is no keeper.
- A decoded roll tx is a reactivity callback that, per window: calls `hub.getSchedulingCost` → `scheduleQuestion{1.296 STT}` → binds the market with a 0.2 STT `resolveReserve` (`CTX/43-…:29-31`).
- The MarketCreator is funded with native tokens and runs `reclaimOracleCredit` each cycle (`SDK/machineryAbi.ts:148`).
- Windows run back-to-back (`ROLL_GAP_SEC = 0`). Skipped windows and bootstrap partial windows do occur (`CTX/40-…:14`, `MS/packages/core/src/constants/timing.ts:29`).

**Question template** [C] (`CTX/43-…:33-45`)
- Text: "What is the price of BTC in USDC at unix time T UTC?"
- Sources: 6 exchange 1-minute candle closes.
- Parameters: `numericDecimals` 2, `resolutionTime` = expiry, `minAgreement` 4, subcommittee 3/2.
- Up/down markets use strike 0.
- The **opening print** is the answer to the closing question at `tradingStart` (`CTX/43-…:59-62`), linked via `MarketReferenceLink.referenceQuestionId` (`SDK/binary/settlement.ts:370-382, 419-428`).

**Creation event and record** [C]
- The module's 19-field `MarketCreated` carries: marketId, market, pool, oracleQuestionId, operatorId, venueId, creator, collateral, yesId, noId, nonce, outcomeSlotCount, marketType, tradingStart, expiry, voidPolicy, asset, strike, question, context (`SDK/eventsAbi.ts:207-236`).
- `markets(marketId)` returns the record (`SDK/moduleAbi.ts:61`).

**Pool recycling** [C] (`SDK/moduleAbi.ts:24-29, 49-59`, `SDK/readsAbi.ts:43-55`, `SDK/eventsAbi.ts:237-262, 293-310`)
1. `finalizeMarket(marketId)` sweeps backing and the resolution snapshot to BinarySettlement (`PoolFinalized`, backing → 0).
2. `releasePool(marketId)` requires `finalized && booksEmpty` and returns the pool to the creator's free list (`getFreePools(creator, collateral)`).
3. `PoolRecycled(nonce++, market)` re-points the pool.
- Confirmed resets: nonce (and so ids), `marketExpiryNs`, `finalized`, backing. Anything else is [I].
- The order-expiry cap exists so the book can be drained before release (`SDK/trade.ts:163-167`).

**Status** [C]
- Listed 0 → Trading 1 → Locked 2 → (Settling 3) → Resolved 4 | Voided 5.
- Time-derived; `poke()` is a no-op kept for the ABI (`MS/contracts/src/interfaces/IDreamDex.sol:42`, `SDK/trade.ts:2080`).
- Locked allows cancels only.
- The indexer's terminal status is `"Finalized"` (`SDK/derivedReads.ts:955-960`).

**Cadences** [C]
- Testnet venue: 1m, 5m, 15m, 1h, 4h, plus 24h in history (`CTX/40-…:16`, `CTX/41-…:33`).
- Mainnet: 15m and 1h (`CTX/01-…:7`).
- 10m was never observed; it appears only as a label example (`SDK/interval.ts:70`).

## 5. Settlement and redemption

- **Callback:** the hub emits `AnswerDelivered(qid, marketId, payoutDenominator, payoutNumerators, voided)` (`SDK/machineryAbi.ts:111`), then the market emits `Resolved(denominator, numerators)` (`SDK/eventsAbi.ts:403-412`). `isResolved` was true 2 s after expiry [C] (`CTX/43-…:21`).
- **Payout vector:** denominator 10,000,000. Outcome i redeems `amount × num[i] / 1e7`. The winner is the argmax; a void is uniform [C] (`SDK/trade.ts:1360-1364`).
- **`pokeOracle(uint256 oracleQuestionId)`** fans out to all markets bound to the question. Partial success counts as success. It reverts with `OracleNotAnswered` (none answered) or `UnknownOracleQuestion` [C] (`SDK/moduleAbi.ts:36-42`).
- **`BinaryMarket.voidExpired()`** can be called once `block.timestamp ≥ expiry + settlementWindow` (otherwise `SettlementWindowOpen`). It bypasses the module, so it must be followed by `syncSettlement` → `finalizeMarket` → `releasePool` [C] (`SDK/binary/settlement.ts:259-309`, `SDK/trade.ts:2017-2023`).
- **Fee** [C]
  - The settlement fee is skimmed once at finalize (`SettlementFeeCharged(marketKey, recipient, grossBacking, fee)`) and never on a void (`SDK/eventsAbi.ts:265-272, 337-346`).
  - `estPayoutFor`: void = amount/2; winner = amount×(10000−feeBps)/10000; loser = 0 (`SDK/derivedReads.ts:462-469`).
- **`redeem(uint32 operatorId, bytes32 venueId, bytes32 marketId, uint8 outcomeIdx, uint256 amount)`**: the module (an ERC-6909 operator) pulls the tokens, finalizes if needed and pays from settlement. Redeeming the losing side succeeds and pays 0 [C] (`SDK/moduleAbi.ts:18`, `SDK/binary/settlement.ts:37-84`, `CTX/01-…:112`).
- **Other redemption paths** [C]
  - `redeemMany` takes arrays (`SDK/moduleAbi.ts:19`).
  - `redeemFor(owner, nonce, deadline, sig, …)` uses EIP-712 domain `"SomniaMarkets"`/`"1"`/module. The struct is `owner, operatorId, venueId, marketId, outcomeIdx, amount, nonce, deadline`, and payout is pinned to the owner (`SDK/binary/settlement.ts:86-165`).
  - Direct on settlement: `redeem(outcomeId, amount, to)`, `finalizeAndRedeem`, and `claimOwed` as the push fallback (`SDK/readsAbi.ts:80-91`).
- **`getClaimable`** reads indexer portfolio positions, keeps those that are voided or have a `winningOutcome`, and fetches the fee per winning market [C] (`SDK/createClient.ts:382-407`).

## 6. Indexer and read model

- **Market row** [C] (`SDK/markets.ts:382-442`): marketId, poolAddress, marketAddress, yesTokenId, noTokenId, collateral, asset, question, oracleQuestionId, status (`clobStatus`), strike, tradingStart, expiry, intervalSec, lastPrice, lastTradeAt, cumulativeBaseVolume, cumulativeQuoteVolume, tradeCount, quoteDecimals, winningOutcome, payoutNumerators, payoutDenominator, voided, backing, nonce, finalized, netBacking, resolvedAtTimestamp, creator, context.
- **Fill row** [C] (`SDK/fills.ts:115-189`)
  - Fields: id, market, pool, fillPrice (YES), quantity, quoteQuantity (floored), maker, makerSide, takerSide, kind, takerIsBid, takerOrder.owner, timestamp, txHash.
  - On binary fills `Fill.taker` is null, so join through `takerOrder`.
- **Candles** [C]: buckets of 60/300/900/3600/14400/86400 s with OHLCV and tradeCount. They are keyed by **pool**, so scope queries by window times (`SDK/candles.ts:45-73`).
- **Other reads:** `getBookTops` [C] (`SDK/orders.ts:348-382`); `getMarketResolution` with closing and opening answers (`SDK/binary/settlement.ts:409-448`).
- **Live book** [C]
  - The SDK hydrates an Envio/Hasura snapshot, then materializes chain logs over WebSocket (`SDK/../package.json` description).
  - API: `watchMarket(pool)`, `watchMarkets({discover})`, `subscribeLive`, `getLiveBinaryOrderBookByMarket` (`SDK/somniaMarketsClient.ts:205-347`).
  - A wall-clock expiry cutoff is applied each block (`SDK/store.ts:651-663`).
- **Masayume's usage**
  - Live book via coordinator entries (`MS/packages/markets/src/runtime/coordinator.ts:67-113`).
  - A chain re-quote at depth 10 at click time (`MS/packages/markets/src/provider/quotes.ts:39-58`).
  - Successor window found by asset and `intervalSec` (`MS/packages/markets/src/provider/next-window.ts:18-31`).

## 7. Liquidity actors

- **Protocol**
  - No house or AMM quoting was found.
  - DreamDEX runs "Collateral Yield" on resting orders:
    - Proximity weight `W = e^{-(P−mid)²/2σ²}` (`DOCS/trading/common/yield-algorithm.md:27`).
    - `score = qty × W × seconds`, paid pro-rata from a fixed operator-funded pool by an off-chain batch (`DOCS/trading/common/yield-algorithm.md:56-72`).
    - Whether event-contract pools qualify is [I]. `DOCS/trading/common/fees.md` says "all open interest".
  - A symmetric maker ladder (200/330/460 contracts per level, re-laid every few seconds) quotes the testnet lanes; its owner is unknown (`CTX/48-…:28-33`).
- **ec-maker** (`KIT/strategies/ec-maker/src/index.ts`, `KIT/packages/ec-core/src/orders.ts`)
  - Fair value = top-of-book mid, else 0.5 (`index.ts:80`).
  - Half-spread 0.02, size 5, refresh 10 s, net cap 20 (`index.ts:59-64`).
  - Skips windows with less than `max(30, min(300, 0.4·interval))` s left (`orders.ts:351`).
  - Seeds inventory once with faucet + `mintSet` (`index.ts:109`).
  - Each cycle cancels all its open orders (`index.ts:131`), then places a post-only BUY_YES bid and a SELL_YES ask capped at holdings (`index.ts:157-164`).
  - Expiry is now + 300 s, capped at the window (`orders.ts:120`).
- **ec-oracle-follow** is a taker that expresses a bearish view as BUY_NO, never SELL_YES (`KIT/strategies/ec-oracle-follow/README.md:30`).
- **Masayume MarketMakerVault** (`MS/contracts/src/maker/MarketMakerVault.sol:125-235`, `MS/contracts/src/maker/MakerGateway.sol:84-96`)
  - `quote` places a post-only BUY_YES at `bidYes` and a post-only **BUY_NO at `askYes`**, both CancelTaker. It never sells.
  - Requires `ask − bid ≥ minSpread`. Escrow = `bid·q + (one−ask)·q`.
  - When both sides fill, `merge` recovers the spread via `mergeCompleteSet`.
  - `pull` cancels; `settle` redeems both outcomes.

## 8. Solana translation notes

**Must preserve (Masayume depends on these):**
1. **One YES-priced book** with the kind → side mapping, and all four paths in one match loop. Mint-a-pair is what lets Maker quote both sides without inventory. Masayume's escrow math assumes BUY_NO escrows `one−p`.
2. **Execution at the maker's price** with the taker's excess escrow refunded. Masayume's reserves measure spend as balance deltas (`MS/contracts/src/leverage/LeverageGateway.sol:150-165`).
3. **An aggregated level view** with expired orders skipped, at least 32 levels, readable in one account fetch (or as CPI-readable account data). It feeds:
   - Parlay and Range VWAP: `ParlayMath.vwap` rounds cost up (`MS/contracts/src/parlay/ParlayMath.sol:20-35`); Range's two-sided VWAP depth centre (`MS/contracts/src/range/RangePricing.sol:198-210`).
   - The Leverage mark: an exit walk minus 1 unit (`MS/contracts/src/leverage/LeverageGateway.sol:189-200`).
   - Stake-first sizing `quoteBinaryStakeOverBook` (`SDK/derivedReads.ts:631-700`): 300 bps / 10-tick slippage, quantity refit down to the lot.
4. **Order-type semantics.** IOC that reverts on zero fill, PostOnly that reverts on cross, FOK, CancelTaker, and a mandatory expiry ≤ window expiry. Takers send IOC with a 60 s life capped at the window (`MS/packages/markets/src/submitter/steps/send.ts:22-39`, `MS/contracts/src/leverage/LeverageGateway.sol:139-144`).
5. **A per-market tick/lot/minQuantity grid**, ceiling-rounded buy escrow, and sell escrow held in outcome tokens (no naked shorts).
6. **Complete-set mint/merge** with the invariant backing == outstanding pairs.
7. **Payout vector** (denominator 1e7) paying 1/0/0.5, permissionless `pokeOracle` and `voidExpired` after `expiry + settlementWindow`, and redeem-for-owner. On Solana, a crank paying the owner's ATA replaces EIP-712.
8. **Stable market identity** (series PDA + index); a pool is not a market's identity. Keep a stored opening print per window.
9. **Fill events that carry maker and taker owners, both sides and the path kind in one record.** The indexer builds lastPrice, cumulativeQuoteVolume, tradeCount and candles from them. This removes the EVM two-event bridge.

**Can drop:**
- Builder fees, `placeOrderFor` / operator registry (use delegates), amend.
- Vault auto-pull and `PayoutFallbackToVault`, Permit2 and the native router.
- Reactivity gas earmarks, EIP-712, the `msg.sender==0` view gate.
- Pool free-list recycling and nonce-packed ERC-6909 ids. Use per-market PDAs or mints, and close accounts to reclaim rent.
- **Do not reproduce the lazy in-placement refund of expired escrow** (`CTX/44-…:83-96`).

**Solana-specific** [I]
- Paying makers inside the match loop needs their accounts, which runs into CU and account-list limits.
- Recommended: a per-user, per-market position account holding collateral credit and YES/NO balances; fills credit those; a separate instruction settles, with a max-fills-per-instruction argument.
- This fits Masayume's contracts, which already collect venue credit explicitly after every call.
