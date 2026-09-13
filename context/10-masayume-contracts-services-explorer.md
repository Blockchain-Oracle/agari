# 10 — Masayume contracts, ports and ops actors: the spec to re-implement on Solana

> **Source:** planning-session explore agent, 2026-09-13; transcribed by the main session after plan approval. Masayume @ `68f7a09`. Cited in `docs/plan/00-plan.md` §3.2 and §4 as C:10. No secret values included.
>
> **Conventions:**
> - `M/` = `/Users/abu/dev/hackathon/sommina-events/`.
> - [C] = read in source this pass; [I] = inferred.
> - Only key **names** are listed. No secret values were read or printed.
>
> **Entry-buffer conflict:** this report uses the current 30 s flat entry buffer (approved 2026-09-10). Doc 05 still says `max(30, min(300, 0.4×interval))`.

## 0. What every contract assumes about DreamDEX

This applies to all Solidity families except StrategyRegistry and SeasonPrizePool.

**Resolving and trading a window**
- Each contract resolves a `marketId` in the same transaction into `(market, pool, yesId, noId, expiry, oracleQuestionId, venueId)`, via `IBinaryModule.markets()`.
- It refuses to act unless `IBinaryMarket.status()==1` (Trading).
- It trades with IOC (type 2) or post-only (type 3) orders, always priced in YES terms (`NO price = one − YES`). It measures actual token deltas, and redeems via `module.redeem`.

**Settlement**
- A window is settled when `isResolved()||isVoided()`.
- Winner pays 1 (minus a fee, which is 0 on DreamDEX); loser pays 0; void pays 0.5 per side.
- `payoutNumerators()` identifies the winner.
- The book is read with `getBookLevels(isBid, 32)` plus the grid from `getOrderBookParameters()` (tick, minQty, lot).

**Invariants**
- **AD-5** [C]: no function takes a payout destination, and permissionless cranks pay the recorded owner.
- **AD-10** [C]: storage and events carry market ids, never pool addresses.
- Both are asserted in tests (`test_AD5_*`, `test_AD10_*`).

**Reserve LP math shared by Parlay, Range, Leverage and Maker** [C]
- `shares = (supplyShares==0||tv==0) ? amount : amount*supplyShares/tv`
- `withdraw amount = shares*tv/supplyShares`, paid from `liquid` only.
- Pause stops new opens and new supply only. Settlement, claims and withdrawals never pause.

**What this means for Solana.** Our own engine must provide:
- A Window: asset, intervalSec, tradingStart, expiry, opening and closing prints, status, void.
- Per-side prices or depth, for everything built on VWAP.
- Per-owner outcome balances.
- Redeem at 1/0/0.5, plus a permissionless void after grace.

Doc 04's parimutuel design has no book. Without one, Parlay/Range centre pricing, the Leverage mark, Maker quoting and Private/Arena stake-first sizing all need a substitute price source, such as a keeper-signed quote or pool-implied odds [I].

## 1. Contract families (`M/contracts/src`)

### EventVault (683 lines: EventVault 391, IEventVault 93, VaultTally 72, VenueGateway 127)

**State**
- `Account{available, privateAvailable, totalDeposited, totalWithdrawn}`
- `Grant[]` (id 1-based): `{owner, actor, kind∈SESSION|EXECUTOR|STRATEGY, revoked, expiresAtSec, spentDay, openPositions, Caps{maxStakePerTrade u128, maxDailySpend u128, maxOpenPositions u32, maxPriceRaw u64 (0=none)}, budget, spentToday}`
- `activeGrantOf[owner][kind]`, `positionOf[owner][outcomeId]`, `positionGrantOf`
- `tallyOf[owner][marketId]` = `{costBase, proceedsBase, payoutBase, boughtUp/DownRaw, soldUp/DownRaw, first/last/settledAtSec, fillCount}`, plus paged `marketsOf(owner,offset,limit)`

**External functions**
- `deposit(amt)` and `depositAndGrant(amt, kind, actor, caps, expiresAtSec, budget)`. The payer must call directly; through the forwarder these revert `NoDepositViaForwarder`.
- `creditFor(owner, amt)` and `creditPrivateFor`.
- `withdraw`, `moveToPrivate`, `withdrawPrivate`: owner only, paid to the owner.
- `grant(kind, actor, caps, expiresAtSec, budget)`: moves `budget` out of available and auto-revokes the previous grant of the same kind.
- `fundGrant(id, amt)`: owner, live grant only.
- `revoke(id)`: owner; returns the remaining budget.
- `place(marketId, outcomeIdx, isBuy, priceRaw, quantityRaw, expireNs)`: owner. `placeFor(grantId, …)`: grant actor.
- `crankSettle(owner, marketId)` and `sweep(pool)`: anyone. `crankSettle` redeems both sides into `available`.
- Views: `accountOf`, `grantOf`, `grantCount`, `isGrantLive`.

**`placeFor` buy check order.** Mirrored by `core/vault/caps.ts simulateCaps`, with golden file `caps.vectors.json`.
1. Grant is live.
2. `sidePrice ≤ maxPriceRaw`.
3. `quantity*sidePrice/one ≤ budget` (worst-case escrow).
4. The IOC fills.
5. `spent ≤ maxStakePerTrade`.
6. `day = ts/86400`, and `today+spent ≤ maxDailySpend`.
7. `budget -= spent`.
8. If a new position opened: `openPositions+1 ≤ maxOpenPositions`.

**Accounting rules**
- Sale proceeds always go to `owner.available`, never back into a grant budget.
- Settling a position decrements the grant's `openPositions`.

**Events:** `Deposited`, `Credited`, `Withdrawn`, `PrivateMoved/Credited/Withdrawn`, `GrantCreated/Funded/Revoked(returned)`, `Executed(owner, marketId, grantId, outcomeIdx, isBuy, cashDelta, tokenDelta, actor, atSec)`, `Settled`, `Swept`.

**Sponsor policy** (`markets/src/vault/sponsor.ts`)
- Sponsorable: `placeFor`, `withdraw`, `withdrawPrivate`, `revoke`, `crankSettle`, `sweep`.
- Never sponsored: `deposit`, `depositAndGrant`, `grant`, `fundGrant`.

### StrategyRegistry (235 lines)

**State**
- `Strategy{creator, runner, specHash, metadata string, envelope Caps, subscriptionFee u128, active, createdAtSec, subscribers, revision}`
- `Subscription{grantId, subscribedAtSec, active}`, plus a paged `_subscribersOf`.

**Functions**
- `publish(runner, specHash, metadata, envelope, fee)`: the envelope's stake, daily and open caps must be non-zero.
- `update(id, specHash, metadata, fee)`: creator only; bumps `revision`. The envelope is fixed for life.
- `setRunner` and `deactivate`: creator only.
- `subscribe(id, grantId)`. Requirements:
  - The grant belongs to the caller, has kind STRATEGY, names the strategy's runner, and is live.
  - The grant's caps are within the envelope. For price: `env.maxPriceRaw==0 || (g.maxPriceRaw!=0 && ≤ env)`.
  - The fee is paid from the subscriber's **wallet** to the creator.
- `unsubscribe`, `isSubscriptionLive`.

**Spec hash:** `specHash` = keccak of `{"p","lb","th"}` or `{"p":"agent","persona","po","c"}` (`core/strategies/spec.ts`).

### Parlay (610 lines: ParlayReserve 269, ParlayPricing 149, ParlayMath 76, interface 116)

**Pricing**
1. 2 to `maxLegs` legs, no duplicate market, each leg Trading with `expiry>now`.
2. `depth = max(maxPayout, priceDepthRaw)`.
3. Leg price = ceil VWAP over depth. UP takes the YES asks; DOWN takes the YES bids, inverted. A book thinner than depth reverts `ThinBook`.
4. `combined = Π p_i/one`. If any two legs share an expiry: `combined = max(combined, minP*correlationBps/1e4)`.
5. Require `combined ≥ minCombinedProbRaw`.
6. `stake = ceil(ceil(maxPayout*combined/one)*(1e4+marginBps)/1e4)`, and require `stake < maxPayout`.

**Open and caps.** `openParlay(legs[], maxPayout, maxStake)` sets `houseLocked = maxPayout − stake` and requires:
- `liquid ≥ h`
- `(locked+h)*1e4 ≤ tv*maxExposureBps`
- `lockedByExpiry[e]+h ≤ maxExpiryLocked` for each distinct expiry

Here `tv = liquid + locked`.

**Settlement**
- `resolveLeg(id, idx)`: permissionless and idempotent.
  - LOST → `liquid += stake+h`.
  - VOID (voided Window, or a payout vector naming no winner) → refund the stake to the owner.
  - All legs WON → status WON.
- `claim(id)`: anyone; pays `maxPayout` to the owner.
- Views: `previewOpen`, `previewLegPrice`, `checkCapacity`, `parlaysOf`.

**Launch params:** margin 1200, exposure 6000, λ 4000, maxLegs 3, payoutCap 500, expiryCap 1000, minCombined 0.02, depth 20 units.

### Range + Moonshot (793 lines: RangeReserve 274, RangePricing 222, RangeMath 97, IRangeReserve 133, WindowQuestion 67)

**State**
- `Round{owner, status LIVE|WON|LOST|VOID|CLAIMED, side INSIDE|OUTSIDE, marketId, oracleQuestionId, expirySec, opening/low/high/closingPrint (cents), stake, maxPayout, houseLocked, probRaw}`
- `Basis{centerQE6, sigmaE8, tauSec}`

**Pricing math**
- `std = sigmaE8*isqrt(τ*1e4)/100`
- `z(p) = ((p−open)*1e8/open)*1e4/std`
- `μ = probit(centerQE6)`
- `P_in = Φ(z_hi−μ) − Φ(z_lo−μ)`, where Φ is an 81-entry table over 0..4 in 0.05 steps, linearly interpolated. `P_out = 1 − P_in`.
- `center = (VWAP_askYes + (one − VWAP_noFromBids))/2` over `centerDepthRaw`.
  - Refused if the book is too thin, if the spread exceeds `maxSpreadRaw`, or if it falls outside `[minCenterQE6, maxCenterQE6]` (`WindowDecided`).
- `probRaw` must lie in `[minProbRaw, maxProbRaw]`. Stake uses the same floor as Parlay.

**Oracle wiring (DreamDEX-specific; replaced on Solana)**
- The opening print is the OracleHub answer to the `(asset, tradingStart)` question, i.e. the previous Window's close.
- The asset is proven by checking that the hub key for `(asset, expiry)` equals the Window's `oracleQuestionId`.
- `WindowQuestion` builds that key from 6 exchange candle URLs, 2 decimals, and `minAgreement 4`.

**Functions**
- `openRange(marketId, asset, side, low, high, maxPayout, maxStake)`. Timing guard: `minTimeLeft ≤ τ ≤ maxHorizon`.
- `settle(id)`: permissionless. Reverts `NotSettled` while the hub is pending. A voided answer refunds. The band is **inclusive**.
- `voidStale(id)`: after `expiry+staleAfterSec`, only while the question is unanswered.
- `claim`. Admin: `setVolatility(asset, sigmaE8)`.

**Launch params:** margin 1200, exposure 6000, maxSpread 0.20, centerDepth 20, center 3%–97%, prob 2%–97%, minTimeLeft 60 s, horizon 2 d, stale 6 h, caps 500/1000. σ: BTC 6200, ETH 7800 (×1e8 per √s).

**Moonshot** is a saturated band on this same reserve (`markets/src/range/moonshot.ts solveMoonshotQuote`, `core/range/moonshot.vectors.json`): LONG or SHORT toward a 2–25× target [C per doc 05; internals not read].

### Leverage / Boost (800 lines: LeverageReserve 308, LeverageGateway 254, LeverageMath 102, interface 136)

**Math**
- `deployScale = L*1e4 − (L−1e4)*premiumBps`
- `budget = stake*deployScale/1e8`
- `qty = walkBudget(levels, budget)`, floored to the lot.
- `terms(cost)`:
  - `nominal = ceil(cost*1e8/deployScale)`
  - `fronted = nominal*(L−1e4)/1e4`
  - `premium = fronted*premiumBps/1e4`
  - `stake = cost + premium − fronted`
- `winIfRight = qty − fronted` must exceed `stake`, and the entry price must sit inside the band.
- Knock-out allowed when `mark*1e4 < fronted*maintenanceBps`, where `mark` = exit-walk cost − 1.
- Exit split: `reclaimed = min(proceeds, fronted)`, and the remainder goes to the owner.

**Functions**
- `open(marketId, outcomeIdx, stake, leverageBps, minQty)`:
  - Sizes at execution and refunds `stake − charged`.
  - Books `liquid += premium − fronted` and `outstanding += fronted`.
  - Caps apply per position, per Window, and on aggregate exposure: `outstanding*1e4 ≤ tv*maxExp`.
- `close(id, minProceeds)`: owner.
- `knockOut(id)` and `settle(id)`: anyone.
- A partial sale leaves the position LIVE. A full exit books any unrecovered front as the reserve's loss.
- `withdraw` is blocked while `unsettledExpired()≠0`. `tv = liquid + outstanding`.
- Views: `openPositions()`, `markOf`, `sizeForStake`, `previewOpen`.

**Launch params:** maxLeverage 30000 (3×), premium 800, maintenance 12000, exposure 6000, entry 0.05–0.95, perPosition 200, perWindow 500, maxOpen 64, minTimeLeft 90 s.

### Maker / Earn (544 lines: MarketMakerVault 317, MakerGateway 151, interface 76)

**State**
- `WindowBook{escrowOut, escrowBack, merged, payout, opened/settledAtSec, quoteCount, settled}`
- `deployedOf = max(0, out − back − merged − payout)`
- `tv = liquid + Σdeployed`; `sharePriceRaw = tv*one/supplyShares`

**Functions**
- `quote(marketId, bidYes, askYes, qty, expireNs)`: maker only.
  - Rests a post-only BUY_YES at `bid` and a post-only BUY_NO at `ask`, with `ask ≥ bid + minSpread`.
  - Worst case if both fill: the vault ends up buying a complete set.
- `pull`: the maker at any time, or anyone after expiry.
- `merge`: anyone; merges `min(yes, no)` pairs.
- `settle`: anyone; pulls, redeems both sides, and emits `realized = back + merged + payout − out`.
- `withdraw`: blocked while an expired Window is unsettled.
- `setMaker`.

**Launch params:** exposure 6000, minSpread 0.02, price 0.05–0.95, qty 20, perWindow 200, maxOpenWindows 8 (hard max 64), minTimeLeft 45 s.

### Private (531 lines: PrivateDesk 234, PrivateGateway 207, interface 90)

**State**
- `pool`, `owed`, `inSlots`, with `balance == owed + pool + inSlots`.
- `balanceOf`, `allowanceOf`, `chargedOf[owner][chargeKey]`, `creditedOf[owner][creditKey]`.
- `Slot{marketId, outcomeIdx, funded/minted/settledAtSec, expirySec, quantityRaw, balance, costRaw, payout, swept}`.

**Functions**
- Owner: `deposit`, `allow`, `depositAndAllow(amt, allowance)`, `revoke()` (sets the allowance to 0), `withdraw` (to `msg.sender`).
- Desk-only. Each call names **either** the owner **or** the slot, never both:
  - `chargeToPool(owner, amt, chargeKey)`: stake band, single-use key, balance and allowance checks.
  - `fundSlot(slotId, amt)`.
  - `mintInSlot(slotId, marketId, outcomeIdx, minQty)`: stake-first, `cost ≤ stake`, dust stays in the slot.
  - `sweepSlotToPool(slotId)`.
  - `creditFromPool(owner, amt, creditKey)`.
- Anyone: `settleSlot`, `sweep(marketId)`. Admin: `setDesk`.

**Launch params:** stake 1–25, minTimeLeft 60 s.

### Games (1,102 lines: GameArena 328, ArenaMatches 135, ArenaAgents 74, ArenaGateway 234, ArenaCommitment 46, IGameArena 175, SeasonPrizePool 110)

**Types**
- Status: `WAITING→ACTIVE_UNREVEALED→PICKING→SETTLING|FORFEITED|REFUNDED→FINALIZED`.
- `RefundReason{CREATOR_CANCELLED, JOIN_TIMEOUT, REVEAL_UNAVAILABLE, BOTH_INCOMPLETE}`.
- `Tier{potBase, perCardCapBase, enabled}`.
- `PickRecord{placed, settled, outcomeIdx, quantity, costBase, payoutBase}`.
- `Agent{agent, expiresAtSec, budgetBase = perCardCap*deckSize, spentBase}`.

**Match lifecycle**
- `createMatch[WithAgent](matchId, challenger, tier, deckHash, deckSize, policyVersion[, agent, ttl])`. The payable variant forwards `msg.value` to the agent key as gas.
- `joinMatch[WithAgent]`: named challenger only, within the join window.
- `revealDeck(matchId, serverSeed, clientSeeds[], cards[])`: permissionless.
  - The hash must match.
  - Every card is a same-venue Window with `expiry ≥ now + minCardLife`, with no repeats.
- `placePick[For](…, cardIndex, outcomeIdx, stake, minQty)`:
  - `stake ≤ perCardCap`, pulled from the **player wallet**; the remainder is refunded.
  - The last pick moves the match to SETTLING.
- `lockPicks`, after the deadline:
  - Both players complete → SETTLING.
  - One complete → FORFEITED.
  - Neither → both refunded.
- `settleCard`: anyone. Redeems both seats into `creditOf`; `pnl += payout − cost`.
- `finalize`:
  - A forfeit's winner is the complete player; otherwise the higher pnl wins.
  - A tie splits the pot, with odd dust going to the creator.
  - The pot is `2×potBase`.
- Other calls: `cancelMatch`, `refundUnjoined`, `refundUnrevealed`, `claimCredit(player)` (pays the player), `authorizeAgent(matchId, agent, ttl ≤ 1 d)` (agent 0 revokes), `setTier`.

**Commitment:** `keccak256(encodePacked(chainId, arena, matchId, uint256 policyVersion, serverSeed, len, clientSeeds, len, cards))`. The golden vector is in `ArenaVectors.t.sol` and `core/games/commitment.test.ts`.

**Launch params:** join 180 s, reveal 120 s, pick 180 s, deck 3–5, minCardLife 240 s. Tiers: 0 free (cap 1), 1 pot 1, 2 pot 5, 3 pot 10; per-card cap 1.

**SeasonPrizePool**
- `deposit(amt)`: anyone.
- `distribute(winners[], amounts[])`: admin, single-shot.
- `withdrawRemainder(to)`: admin.
- `endsAtSec` is informational only.

### Foundry tests (`M/contracts/test`, 6,768 lines): the behavioural spec

| Family | Test files (test count) | Behaviours asserted |
|---|---|---|
| Vault | `EventVault.funding` (12), `.trading` (25), `.fork`, `CapsVectors` | Forwarder can't deposit; a grant replaces the previous one; per-trade cap reverts the whole tx; daily cap buckets by UTC day; price cap in the side's own terms; sale proceeds go to the owner; void pays half to both sides; `AD5_no_divert` |
| Strategy | `StrategyRegistry.t` (10) | Caps outside the envelope refused; fee paid to the creator; a revoked grant ends liveness |
| Parlay | `.pricing` (12), `.lifecycle` (11), `ParlayVectors`, `.fork` | Same-instant surcharge; first losing leg kills the ticket; a payout vector naming no winner is a void; racing crankers are idempotent; three legs at one instant release once |
| Range | `.pricing` (11), `.lifecycle` (10), `RangeMath` (6), `RangeVectors`, `MoonshotVectors`, `OracleHub.fork` | Band inclusive; stale void only after grace; the book moves the centre |
| Leverage | `.open` (20), `.lifecycle` (15), `LeverageVectors` | Knock-out on a gapped book books the shortfall; a thin-book partial sale stays live; share price counts the front at cost and the premium as income |
| Maker | `.quoting` (8), `.lifecycle` (11) | Lazy refund booked; merge realizes the spread; withdraw waits on expired Windows |
| Private | `.budget` (9), `.lifecycle` (9) | Slot-side txs never name the owner; one credit per key |
| Arena | `.picks` (22), `.lifecycle` (14), `.agents` (7), `ArenaVectors`, `SeasonPrizePool.t` (4) | — |

Golden vectors under `M/packages/core/src/{vault/caps,parlay/pricing,range/pricing,range/moonshot,leverage/sizing}.vectors.json` are shared by forge and vitest.

## 2. `packages/markets` (10.7k lines; `M/packages/markets/src`)

**Exports:** `.`, `./faucet`, `./chain`, `./env`, `./games`, `./identity`, `./leverage`, `./maker`, `./parlay`, `./perf`, `./private`, `./range`, `./react`, `./runtime`, `./sessions`, `./strategies`, `./vault`, `./x`.

### Ports (in `M/packages/core/src/ports`): product-level, keep verbatim

**`MarketsProvider`.** Every method returns `Reading<T>` and never throws for a chain failure.
- `listLiveLanes(venueId)` → `LaneSet`
- `getMarket(marketId)`, `listSettled(venueId, limit?)`
- `getOnchain(marketId)` → `OnchainSnapshot{isResolved, isVoided, …}`
- `getBookDepth({marketId, poolAddress, decimals}, depth?)`, `getBookParams(pool)`
- `freshQuoteStake(QuoteTarget{…, intervalSec}, side, stakeBase)` → `Quote|null`
- `getOpeningPrice(marketId)`
- `getAssetPrice(asset)` → `{priceRaw, emaRaw, decimals}`; `getPriceHistory(asset, from, to)`
- `settlementFeeBps(marketId)`
- `listOpenPositions(wallet)`, `getHoldings(wallet, onchain)`, `listClaimables(wallet, venueId)`, `listWalletHistory(wallet)`, `getBalanceSheet(wallet)`
- `syncClock()`, `nowMs()`
- `nextWindow(market)`, `getResolution(marketId)`
- `getVaultSnapshot(wallet)` → `{grants:{session, executor, strategy}, …}|null`
- `getVaultHoldings(wallet, onchain)` → `{upRaw, downRaw, upGrantId, downGrantId}`

**`Submitter`**
- `submitOrder(OrderRequest{market, side, stakeBase, displayedQuote, wallet, route: wallet|vault|vault-grant{grantId}}, onPhase)` returns one of:
  - `confirmed{booked:{contractsRaw, costBase, avgPriceBps, txHash, fillCount}}`
  - `nothingFilled`, `requote{quote}`, `refused`, `reverted`, `unknown`
- `submitTx(TxIntent)` covers:
  - faucet, approve, redeem
  - `vault-*`: deposit, withdraw, move-private, withdraw-private, grant, deposit-and-grant, fund-grant, revoke, crank-settle, sweep
  - `strategy-*`, `parlay-*`, `range-*`, `maker-*`, `leverage-*`, `private-*`, `arena-*`
- `hasSigner()`
- Supporting types: `WritePhase` (composing→submitted→confirming→confirmed|reverted|unknown), `IntentJournal{record, markSent, markConfirmed, markFailed, markUnknown, listUnresolved}`, `StopGate`, `AttributionHook`.

### DreamDEX- and EVM-specific implementation: rewrite for Solana

- `runtime/read-runtime.ts`: `configureMarkets(env)`, `ensureMarkets`, `getClient()` (the SomniaMarkets SDK), `subscribeBook`, `bookSnapshot`.
- `venue.ts resolveVenueId(configured)`: the env venue, or the busiest live venue.
- `provider/*`:
  - `quotes.ts quoteFromBook`, using the SDK's `quoteBinaryStakeOverBook`
  - `markets.ts`, using `listLiveBinaryMarkets` limit 100
  - `claimables.ts`
- `sessions/submitter-session.ts createSubmitterSession({env, authority, signer:{walletClient|privateKey|account}, journal, stopGate, sponsor})` → `{address, submitter, trader, contracts:{walletClient, publicClient, deployment, sponsor}, dispose()}`, with one nonce queue per session.
- `sessions/session-key.ts`: `generateSessionKey`, `createSessionKeySession`, `topUpSessionGas`, `keyGasBalance`.
- `vault/*`:
  - `sponsor.ts`: ERC-2771 `signForwardRequest`, `executeSponsored`
  - `order.ts`: vault-route pre-checks using `simulateCaps`
  - `recovery.ts recoverVaultExecution`
  - `history.ts listVaultTallies`
- `private/*`: `openPrivateBet`, `cashOutPrivateBet`, `deriveSlotKeys`, `sign/verifyPrivateClaim` (EIP-712).
- `games/*`: `logs.ts listArenaEvents`, `arenaHeadBlock`, `read`, `write`, `season.ts distributeSeasonPrizes`.
- `faucet createFaucetChain`.
- `contracts/*.abi.ts`, `addresses.ts assertAddressesMatchSdk`.

### Reusable product-level pieces

- `strategies/agent-context.ts readAgentContext(market, stakeBase, nowMs)`: opening, EMA, spot, 12 samples, up/down cents at the stake. Chain-agnostic apart from the provider.
- `price-basis.ts openingOnFeedScale`: cents → feed decimals.
- React hooks (`react/*`): `useReads`, `useBook`, `useStakeQuote`, `useReadingQuery`, `session.tsx`.
- `submitter/{journal, recovery, reconcile}`: the pattern ports; the nonce lane doesn't.
- `env.ts marketsEnvSchema`: chainId, indexerUrl, rpcWs/HttpUrls, venueId, priceFeedUrl/Quote, and per-product address plus `FromBlock` overrides.

### Address files

- `addresses.masayume.json` = `{generatedBy:"contracts/export.mjs", deployments:{"50312":{collateral, eventVault, forwarder, fromBlock, strategyRegistry, parlayReserve, rangeReserve, marketMakerVault, leverageReserve, privateDesk, gameArena, seasonPrizePool, + <name>FromBlock}}}`
- `addresses.pinned.json` = `{chainId, sdkVersion:"0.28.1", addresses:{binaryModule, binaryPoolImpl, binarySettlement, clobFactory, collateral, collateralRouter, marketCreator, marketCreatorFactory, marketsCore, oracleHub, testUsdc}}`

## 3. `services/ops` (`M/services/ops`)

**Process model**
- `main.ts` boots every actor in one Node process, with a 30 s heartbeat and structured logs `{tsMs, actor, why}`.
- `runner-main.ts` boots only strategy-runner, for self-hosting creators.

**Deployment**
- `Dockerfile`: node 22, pnpm, `tsx src/main.ts`.
- `fly.toml`: app `masayume-ops`, region iad, **exactly one machine, never auto-stopped** (two instances would race nonces, AD-4), volume `/data` for the deck journal, WebSocket on 8787, health `GET /health`.

**Common failure rules**
- A missing key means scan-and-report only.
- Every cycle is try/catch-logged.
- Each actor is the single writer over its own key.
- **DRY_RUN inversion [C]:** maker, keeper and settler stay dry unless `DRY_RUN=0|false`; the runner stays live unless `DRY_RUN=1|true`.

| Actor | Cadence | What it does | Key / env |
|---|---|---|---|
| strategy-runner (741 L) | `RUNNER_INTERVAL_MS` 30 s (min 5 s), serial cycle | See details below | `RUNNER_PRIVATE_KEY`, `STRATEGY_IDS` (empty = discover strategies naming this key), `AGENT_MAX_CALLS_PER_HOUR` 60, `AGENT_TIMEOUT_MS` 20 s, `DATABASE_URL` (required to trade), AI keys |
| x-relay (905 L) | `X_POLL_MS` 20 s; separate reply loop every 15 s | See details below | `X_RETTIWT_API_KEY`, `X_HANDLE`, `X_EXECUTOR_PRIVATE_KEY`, `DATABASE_URL`, `X_POSTING_ENABLED`, `X_REPLY_IMAGES_ENABLED` |
| market-maker (273 L) | `MM_REFRESH_MS` 45 s | See details below | `MAKER_PRIVATE_KEY`, `MM_*` |
| leverage-keeper (114 L) | `LK_REFRESH_MS` 20 s | For each open position: settle if the Window resolved or voided; `knockOut` if knockable and there are bids to sell into | `LEVERAGE_KEEPER_PRIVATE_KEY` |
| game-room (944 L) | Event-driven WebSocket | Handles hello, resync, queue.join/leave, seed.reveal, pick.pending, chat, reaction; sends snapshots; hosts the matchmaker | `ROOM_TOKEN_SECRET` (≥16 chars, shared with web), `GAME_ROOM_HOST/PORT/REGION` |
| matchmaker (839 L) | 3 s queue tick | See details below | `GAME_DECK_KEY`, `GAME_DECK_JOURNAL`, `GAME_DECK_HORIZON_SEC`, `GAME_DECK_CREATE_LATENCY_SEC` |
| duel-projector (359 L) | `GAME_PROJECTOR_POLL_MS` 6 s | Log cursor `duel:<chainId>:<arena>`, 800-block spans × 25 per cycle; idempotent row writes; ratings applied once; broadcasts to rooms | `GAME_PROJECTOR_FROM/SPAN/SPANS` |
| duel-settler (270 L) | `GAME_SETTLER_REFRESH_MS` 30 s | See details below | `GAME_SETTLER_PRIVATE_KEY` |
| tools | Manual | `season-results.ts` (ladder, eligibility, pool balance) and `season-distribute.ts [--execute]` (pays out; receipt JSON to `contracts/deployments/seasons/`) | `SEASON_ID`, `SEASON_ENDS_AT`, `SEASON_PRIZE_SPLIT`, `SEASON_MIN_STAKED_DUELS`, `SEASON_ADMIN_PRIVATE_KEY` |

**strategy-runner cycle**
1. `syncClock`.
2. Reconcile unresolved attempts from receipts and events. **Never resend**: an unknown attempt holds all new entries.
3. For each strategy:
   1. `settleStrategyPositions`: `crankSettle` only for Windows whose fills are proven to be this strategy's.
   2. Confirm the strategy is active and names this runner key; parse its spec.
   3. `listLiveSubscribers`.
   4. Scan for entries:
      - `momentum`/`reversion`: `moveBps(opening, EMA) ≥ thresholdBps`. Momentum takes the trend side; reversion takes the other.
      - `agent`: one gated LLM read per (strategy, Window), within an hourly budget.
   5. For each subscriber, at most one entry per Window:
      1. `stake = min(perTradeCap, dailyHeadroom, budget)`.
      2. `freshQuoteStake`.
      3. DB `beginStrategyAttempt`, recording the nonce.
      4. `submitOrder route:vault-grant`.
      5. `recordAttemptFill`.

**x-relay flow**
1. `recoverXExecutions`.
2. Fetch mentions since the cursor. The first-ever poll only sets the cursor.
3. Skip the relay's own replies.
4. Halt if a broadcast is unresolved.
5. Atomic DB claim.
6. `executeMention`:
   1. Link by author id.
   2. `parseInstruction`.
   3. EXECUTOR grant checks: actor = this executor, not expired, balance-only caps, `stake ≤ budget`.
   4. `selectXWindow`: exact asset and cadence, 30 s buffer, no substitution.
   5. Fresh quote, then a checkpoint with the nonce, then `submitOrder vault-grant`.
7. Store the receipt.

Replies are a 1200×600 PNG rendered with sharp/opentype, with 45 s deadlines, and never reposted.

**market-maker flow**
1. Tend open Windows: settle if resolved or voided; merge if both sides are held.
2. Quote Windows in the trading phase, filtered by `MM_INTERVALS` (default [300, 900, 3600]) and `MM_ASSETS`, soonest first.
3. Skip a Window when time left < `max(minTimeLeft, 30)`.
4. `fair = mid(bestBid, bestAsk)`. Build a pair with half-spread `MM_HALF_SPREAD_RAW` (default 0.015), size `MM_QUOTE_SIZE` 5, TTL `MM_QUOTE_TTL_SEC` 180.
5. Requote only when fair moves ≥ `MM_REQUOTE_TICKS` 3 ticks or the quote is near expiry. Pull the old pair first.

**matchmaker flow**
- In-memory queues keyed `mode:tier:region`; the Elo band widens from 100 to 400.
- Pair two players, then require both seeds revealed within 15 s.
- Deal a deck: policy v4, horizon 1 h, create latency 45 s.
- Seal the reveal material with AES-256-GCM. Append it to the journal file **first**, then Postgres `putDeck`.
- Send `deck.committed`.
- Deals wait up to 3 min for dealable Windows. A dissolved pairing is announced but not re-queued.

**duel-settler flow.** The worklist is the DB's live matches; every call is permissionless.
- WAITING past join → `refundUnjoined`.
- ACTIVE_UNREVEALED → reveal (decrypting from DB or journal); past the reveal deadline → `refundUnrevealed`.
- PICKING past deadline → lock.
- SETTLING or FORFEITED → `settleCard` for each played and settled card, then `finalize`.

## 4. Market lifecycle as the product sees it

**Cadences** [C]
- Lanes are derived from live `intervalSec`, never hardcoded (`core/market/lanes.ts`).
- Shannon lanes: 5m, 15m, 1h, 4h, 1d.
- X grammar: `1m|5m|15m|1h|4h|1d`. `AGENT_CADENCES_SEC=[300, 900, 3600, 14400, 86400]`.
- Windows run back-to-back: the next `tradingStart` equals the previous expiry.
- The 5m, 15m and 1h Windows lock together on aligned boundaries, so at the end of each cycle no duel deck can be dealt for a few minutes.

**Discovery**
1. `resolveVenueId`.
2. `listLiveLanes`: rows plus opening prints, grouped into lanes, with fixed-strike markets excluded.
- Word board horizons: ≤6 min, ≤65 min, later; minimum lead 20 s.
- Polling: markets 15 s, price 5 s, opening print 3 s, verdict 3 s.

**Phases** (`core/lifecycle`)
- `upcoming → pendingOpeningPrint → trading → noEntryBuffer → locked → settledUnclaimed | finalized | voided`.
- Entry buffer: `ENTRY_BUFFER_SEC=30` flat, owner-approved 2026-09-10. This conflicts with doc 05's `max(30, min(300, 0.4×interval))` [C].
- The countdown turns urgent at `min(60, 0.4×interval)`.

**Quoting**
- Stake → quantity via a book walk.
- Slippage = `costCapBufferBps − 10000`, where the buffer interpolates 16000 bps at 60 s down to 11000 bps at 3600 s, plus a minimum of 10 ticks.
- `Quote.maxCostBase` is the escrow at the buffered limit, so max loss is fixed.
- Admissible odds 2%–97%; minimum stake 1 unit; quick chips ¼ ½ ¾ Max.
- Requote every 12 s; a quote is stale after 20 s.
- At click time, a fresh `maxCostBase` above the displayed one returns `requote`, never a silent worse fill.
- IOC expiry is `min(expiry, now+30s)`. An empty fill returns `nothingFilled`.

**Settlement and claim**
- Wallet route: `listClaimables` from positions → `redeem` per outcome (the claim-all plate).
- Vault route: `crankSettle`, which anyone can call.
- Verdicts: win, loss, void (0.5 per side), both-sides-net. `getResolution` compares the opening and closing answers.

**Trading Balance**
- The vault's `available` bucket.
- The ticket's route selector offers Wallet, Trading Balance and Private.
- The portfolio plate never sums pools that can't be spent.

**Tap-trading** (bounded grants)
1. The browser generates an EVM session key.
2. One signature: `depositAndGrant(SESSION, key, caps)`. Defaults (`web/src/features/session/caps.ts`): per-trade 5, daily 25, 4 positions, price cap 95¢, expiry 24 h (options 6 h, 24 h, 7 d), deposit 25.
3. Each tap runs `simulateCaps`.
   - Pass: the key signs `placeFor`. It is sponsored via `/api/sponsor` (target, selector allowlist, value 0, `SPONSOR_MAX_GAS`, deadline, per-device and per-address hourly gates), or the key pays its own gas.
   - Fail: the wallet signs instead, and the reason is shown.
4. Revoke returns the remaining budget.

Other grant kinds: EXECUTOR for X (caps = uint128 max, 8 open, 30 d), STRATEGY for copy trading, and the duel key (`ArenaAgents`, separate from the vault).

**Private mode**
1. `depositAndAllow`.
2. The owner signs a human-readable message rebuilt server-side from the chain's own Window (TTL 5 min, canonical low-s).
3. `/api/private/open`, rate-limited to 20 per owner per hour and 60 per IP per hour.
4. Keys: `slotId/chargeKey/creditKey = keccak(keccak(sig) ‖ label)`.
5. The desk runs charge → fund → mint, resumable from chain state. A refused mint is swept and credited back.
6. The desk signs an EIP-712 claim: `Claim{owner, slotId, creditKey, marketId, outcomeIdx, stake, issuedAtMs}` (domain "Masayume Private Desk" v1, `verifyingContract` = desk).
7. The claim is stored in browser localStorage and can be backed up as `masayume.private.claims` v1.
8. Cash-out verifies the claim against the desk key the contract pins, then `settleSlot` → sweep → `creditFromPool` → owner withdraws.

The UI copy says outright: "not anonymous".

## 5. Environment variables and key names (names only)

**Contracts**
- `contracts/.env`: `DEPLOYER_ADDRESS`, `DEPLOYER_PRIVATE_KEY`.
- Deploy scripts read `COLLATERAL`, `OUTCOME_TOKEN`, `DEPLOY_TAG`, `MAKER_ADDRESS`, `PRIVATE_DESK_SIGNER` (required), `SEASON_ID`, `SEASON_ENDS_AT_SEC`, `EVENT_VAULT`.
- DreamDEX addresses and `VENUE_ID` are hardcoded constants.
- Output goes to `deployments/<chainId>[-tag].json`; `export.mjs` converts it to `addresses.masayume.json`.
- `foundry.toml`: RPC alias `shannon`, plus read permission on the core vector files.

**Ops:** every key and env name in §3, plus `VENUE_ID`, `DRY_RUN` and `DATABASE_URL`.

**Web (`web/.env.example`)**
- AI: `AI_API_KEY`, `AI_BASE_URL`, `AI_GATEWAY_API_KEY`, `AI_MODEL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`.
- Public: `NEXT_PUBLIC_{CHAIN_ID, RPC_HTTP_URLS, RPC_WS_URLS, INDEXER_URL, VENUE_ID, PRICE_FEED_URL, PRICE_FEED_QUOTE, EVENT_VAULT_ADDRESS, FORWARDER_ADDRESS, …_RESERVE/VAULT/DESK_ADDRESS + _FROM_BLOCK, X_HANDLE, X_EXECUTOR_ADDRESS, WALLETCONNECT_PROJECT_ID, APP_ORIGIN, DOCS_URL}`.
- Sponsor: `SPONSOR_{PRIVATE_KEY, RPC_URL, MAX_GAS, PER_ADDRESS_PER_HOUR, PER_DEVICE_PER_HOUR, GAME_MAX_WEI}`.
- Faucet: `STT_FAUCET_{ENABLED, PRIVATE_KEY, RPC_URL}`.
- Private desk: `PRIVATE_DESK_PRIVATE_KEY`, `PRIVATE_DESK_RPC_URL`.
- X: `X_API_KEY`, `X_API_KEY_SECRET`, `X_REDIRECT_URI`, `X_SESSION_SECRET`, `X_EXECUTOR_ADDRESS`.
- Other: `STRATEGY_RUNNER_ADDRESS`, `ROOM_TOKEN_SECRET`, `GAME_ROOM_PUBLIC_URL`, `DATABASE_URL`, `SEASON_*`.

**Faucet policy** [C]: top up when the balance is < 1 STT, to a 2 STT target; 40 STT per day; 10 STT reserve; 24 h cooldown; 5 min challenge; 10 claims per IP per day.

**Distinct signer roles to recreate on Solana:** deployer/admin, sponsor, STT faucet, X executor, strategy runner, maker, leverage keeper, game settler, private desk, season admin.

**Non-key secrets:** `ROOM_TOKEN_SECRET`, `GAME_DECK_KEY`, `X_SESSION_SECRET`, X/Rettiwt credentials, AI keys.
