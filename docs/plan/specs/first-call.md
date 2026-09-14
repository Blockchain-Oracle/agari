# First-call spec (S4): Solana reads, writes, faucet, index API, web rewiring

**Authority:** plan §5, §7.2 S4; `events-engine.md` §2–4, §8–9; `events-accounts.md` §3, §5; `venue-ops.md` §6–9; D-010…D-016, D-023, D-025…D-030; Masayume `packages/markets/src/{provider,submitter,runtime,faucet}` @ `68f7a09`. Frozen at the S4 foundation commit (D-031). Changes need a D-entry. Every lane reads §1–3 and §7, then its own section.

**Code state (S3 head `9434741`):** every read is the S1 stub (`packages/markets/src/provider/reads.ts:35-86`), the coordinator watches nothing (`runtime/coordinator.ts:15-25`), both write lanes refuse (`submitter/create.ts:45-46`), reconcile answers `unknown` (`submitter/reconcile.ts:11`), and the SOL faucet's chain adapter throws (`faucet/index.ts:16-28`). The Solana pieces S2/S3 already have are server-side: the Codama client, Series/Market reads (`ops/venue.ts:48-100`), the Ledger seat decoder (`ops/settle/ledger.ts:37-56`), level-only Book reads (`ops/maker/book.ts:8-20`), place-order/redeem builders (`deploy/cycle/window.ts:85-108`, `resolve.ts:87-94`), the event decoder (`ops/indexer/decode.ts:55`) and the paced transport (`deploy/rpc-transport.ts`).

## 1. Architecture

| Source | Serves | Why |
|---|---|---|
| **Chain** (browser Kit RPC) | `getOnchain` (write gate), Books (coordinator + click-time quote), Ledger seats (holdings, claimables, credit), token and SOL balances, clock, the focused Window's opening print, `GlobalConfig.mode`, mint decimals | Head-fresh; the only source that may gate a write (canon #1) |
| **Indexer** (`/api/index/*` over `packages/db/src/idx/read.ts`) | lane lists, Window rows with prints and resolution, settled lists, next Window, wallet fills/positions/actions, print history | Lists over 27 Series would need `getProgramAccounts`; lag < 10 s (S3 gate) is fine for listing; never gates a write |
| **Ops HTTP** (`NEXT_PUBLIC_PRICE_FEED_URL` = ops base, `services/ops/src/http/server.ts:24-30`) | spot (`/prices/latest`, `/prices/stream`), session and lane states (`/session`, new, §6) | Data-provider keys stay server-only (plan §6) |

- **Browser RPC:** `NEXT_PUBLIC_SOLANA_RPC_URL` / `NEXT_PUBLIC_SOLANA_WS_URL`, defaulting to public devnet (`packages/markets/src/env.ts:6-10`, `web/src/lib/env.ts:4-8`). **Never Helius:** the key must not leak (plan §6), and the soak showed the free 10 RPS key saturates from ops alone (D-030). Public Solana endpoints publish 100 requests / 10 s, 40 per method, 40 connections **per IP**, so each user brings their own budget. No `/api/rpc` proxy in S4 (it would funnel every tab into one server key). Q-S4-2.
- **Browser transport:** not `deploy/rpc-transport.ts` (it imports undici, `:10`, Node-only). New `runtime/transport.ts`: Kit's default transport plus a token bucket (4 RPS, `sendTransaction` 1 TPS) and 429/503 retries honouring `Retry-After` (≤ 3 tries). The same file serves SSR and route handlers.
- **Bundle rule:** nothing reachable from `@agari/markets`, `/react` or `/runtime` value-imports `deploy/client.ts`, `deploy/rpc-transport.ts`, `ops/client.ts` or `prices/legacy/**`; `pnpm build` must stay green.
- **Per-tab steady budget (≤ 1 RPS + one websocket):** focused `getOnchain` every 5 s; opening print every 3 s only while pending; balance sheet 3 calls / 15 s; claimables 2 calls / 15 s; clock every 60 s; Books through ref-counted `accountNotifications` (≤ 12 at once, base64, ≈ 57 KB per change for a 512-node Book).

## 2. Reads

**Units.** Prices are YES ticks `1..999`. `priceRaw = ticks × tick_base` (= probability × 10^dec, `core/units/bps.ts:11-18`). `contractsRaw`/`quantityRaw = lots × lot_base`. Cash in base units = `lots × ticks × cash_unit`. Prints are `i64` at expo −8 (`PRINT_EXPO`, `core/market/tickers.ts:20`). Series parameters are read from the Series account, never hardcoded (launch grid: lot = tick = 1,000, `cu` 1, `min_lots` 1,000, bond 250,000; D-026).

### 2.1 Shared runtime (lane 4a's first merge, 4a.1; signatures frozen here)

```ts
// runtime/solana.ts
solana(): { rpc: Rpc<SolanaRpcApi>; subscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>; cluster: Cluster }
// runtime/accounts.ts: decoders lifted from ops/venue.ts, ops/settle/ledger.ts, deploy/cycle/accounts.ts
interface VenueFacts { config: Address; collateralMint: Address; decimals: number; treasury: Address; mode: 0 | 1 | 2 }
interface SeriesFacts { address: Address; symbol: TickerSymbol | null; basis: number; cadenceSec: number; lotBase: bigint; tickBase: bigint;
  cashUnit: bigint; minLots: bigint; seatBond: bigint; fillsCap: number; evictionsCap: number; minRestSlots: bigint }
interface BookState { address: Address; market: Address; series: Address; bids: BookSideView; asks: BookSideView; slot: bigint }
readVenue(): Promise<VenueFacts>                     // mint/decimals cached forever, mode ≤ 15 s
readSeries(series: Address): Promise<SeriesFacts>    // cached forever (registration params are immutable)
readMarket(market: Address): Promise<{ address: Address; data: Market } | null>
readSeat(ledger: Address, owner: Address): Promise<{ seat: LedgerSeat | null; seatBond: bigint } | null>  // null = Ledger closed
readBook(book: Address): Promise<BookState | null>; decodeBook(address: Address, bytes: ReadonlyUint8Array, slot: bigint): BookState
readTokenBalance(owner: Address, mint: Address): Promise<{ ata: Address; amountBase: bigint | null }>  // null = no ATA
// runtime/mappers.ts (pure)
toOnchainSnapshot(m, series: SeriesFacts, venue: VenueFacts, nowSec: number): OnchainSnapshot
toBookDepth(book: BookState, series: SeriesFacts, decimals: number, nowSec: number): BookDepth
quoteFromBook(book: BookState, series: SeriesFacts, target: QuoteTarget, side: Side, stakeBase: bigint, nowSec: number): Quote | null
```

**Book decode** (`events-accounts.md` §3.9; account offsets include the 8 B discriminator): `market` @8, `series` @40, `high_water` u32 @96, `bid_bits` [u64;16] @104, `ask_bits` @232, `bids` levels @392 and `asks` @16,392 (16 B each: `head` u32 1-based), nodes @32,392 + 48·i for `i < high_water` (`lots` u64 @0, `expire_ts` i64 @16, `placed_slot` u64 @24, `next` u32 @36, `flags` u8 @45, `LIVE` = bit0). This is a money path: a targeted test checks it against `anchor/tests/vectors/book.vectors.json` and a captured devnet Book compared with `readBookTop`.

### 2.2 `MarketsProvider` (`packages/core/src/ports/markets-provider.ts:22-50`)

| Method | Source | Decode / mapping | Empty or failure |
|---|---|---|---|
| `listLiveLanes(venue)` | index `markets?state=open&expiryFrom=now` | rows with a registry `symbol` and basis 0 → `toEventMarket` (§2.3) → `groupIntoLanes` (`core/market/lanes.ts:26`) | none → `{ venueId, lanes: [] }`; DB absent → `indexer-down` |
| `getMarket(id)` | index `markets/:id` | `toEventMarket` | no row → `null` |
| `listSettled(venue, 50)` | index `markets?settled=1` | expiry descending | `[]` |
| `getOnchain(id)` | chain `readMarket` + `readSeries` + `readVenue`, chain clock | `status`: `marketStatus` (`ops/venue.ts:29`) → `ONCHAIN_STATUS` Listed 0 / Trading 1 / Locked 2 / Resolved 4 / Voided 5 (`core/lifecycle/status.ts:2-9`; Settling never); `pool` = `book`; `nonce` = `index`; `backing` = `backing_lots × lot_base`; `finalized` = `state ≠ 0`; `winningOutcome` = `payout_yes == 10⁷ ? 0 : payout_no == 10⁷ ? 1 : null` | Market closed after retention: snapshot from the index row; otherwise `market-not-trading` "Window not found" |
| `getBookDepth(target)` / coordinator | chain `readBook(pool)`; the coordinator adds `accountNotifications(book, { encoding: "base64", commitment: "confirmed" })` and re-filters every 5 s (expiry drops nodes without a write) | `Book.market ≠ target.marketId` → empty (recycled, canon #3). Else `toBookDepth`: `upAsks` = `bookLevels(asks,"ask",32)`, `upBids` = `bookLevels(bids,"bid",32)`, `downAsks` = YES bids as `1000 − p`, `downBids` = YES asks as `1000 − p` (`book-math.ts:69,89`); level `priceRaw = p × tick_base`, `priceBps = p × 10`, `quantityRaw = lots × lot_base`; filter `{ now: chainNowSec, slot, restedOnly: false }`. `decideBookEmit`/`reuseBookValue` unchanged (`runtime/book-reading.ts`). New export `bookStateSnapshot(marketId)` for `useStakeQuote` | Book gone → empty; socket down → last reading stale `offline` |
| `getBookParams(pool)` | chain Book → `readSeries` | `{ tickSizeRaw: tick_base, lotSizeRaw: lot_base, minQuantityRaw: min_lots × lot_base }` | cached forever |
| `freshQuoteStake(t, side, stake)` | chain `readBook` + `readSeries` (never the subscription) | `quoteFromBook`: up → BUY_YES, down → BUY_NO; `outcomeLevels(kind,…,32)`; `quoteStake(levels, kind, stake, cash_unit, min_lots, bufferToSlippageBps(costCapBufferBps(intervalSec)), 10)` (Masayume `provider/quotes.ts:29-35`, `core/sizing/cost-cap.ts:8`). Quote: `contractsRaw = lots × lot_base`; `expectedCostBase = exitWalk(levels, lots).proceeds × cu` (exact Σ take × price); `avgPriceBps = vwapTicks × 10`; `maxCostBase = escrowCash`; `limitPriceRaw = yesPriceTicks × tick_base`; `payoutIfRightBase = contractsRaw`; `fillableStakeBase = maxCostBase`; `partial = stake − maxCost > oneCent`; `feeBps` 0 | nothing fillable or `< min_lots` → `null` |
| `getOpeningPrice(id)` | chain `getAccountInfo(market, dataSlice { offset: 216, length: 24 })` | `Print.source ≠ 0 ? price : null`; cached once non-null | account gone → index open print |
| `getAssetPrice(sym)` | ops `/prices/stream` (one shared `EventSource`, new `runtime/spot-stream.ts`), else `/prices/latest` | `{ priceRaw: priceE8, emaRaw: priceE8, decimals: 8, publishTimeSec }` (`PRICE_BASIS` is spot) | none → `null`; ops down → `rpc-down` |
| `getPriceHistory(sym, from, to)` | index `prints/:symbol` | one point per `source_ts_sec` (lowest `source` id first) | `[]` |
| `settlementFeeBps` | none | 0 (D-012, `reads.ts:59-61`) | — |
| `listOpenPositions(w)` | index `wallet/:w/positions` (`state = open`) | up/down = `yes_lots`/`no_lots × lot_base`; `costBasisBase = paid_ticklots × cu + set_paid_base`; `realizedPnlBase = received_ticklots × cu + set_received_base`; `markValueBase` = held × `last_price_ticks` in own terms | `[]` |
| `getHoldings(w, onchain)` | chain `readSeat(ledger, w)` | up = `(yes_free + yes_locked) × lot_base`, down likewise. Terminal and no seat (paid by `redeem_for`) → held at settlement from the index: `bought − sold + minted − merged` per side (`idx/apply.ts:146-158` decrements lots on `Redeemed`) | zeros |
| `listClaimables(w, venue)` | index positions `unredeemed=1` in terminal Windows → one `getMultipleAccounts` over their Ledgers | live seat → `enumerateClaimables` (`core/claims/enumerate.ts:32`) with the row as `SettledMarket` | seat gone or Ledger closed → no row |
| `listWalletHistory(w)` | index fills (1,000 × 5 pages), actions, `markets?ids=` | Masayume `provider/history.ts`. `LedgerFill.side` = `taker_kind` when `taker == w`, else `maker_kind`; `quantityRaw = lots × lot_base`; `yesPriceRaw = price_ticks × tick_base`; `txHash` = signature → `buildLedgers` → `settleRound`; claim = `redeemed ? paid : to-collect` | `complete: false` past 5,000 fills |
| `getBalanceSheet(w)` | chain `getBalance`, `readTokenBalance`, Ledgers of ≤ 10 unredeemed Windows (index) in one call | spendable = ATA amount; `orderEscrowBase` = Σ `locked_cash`; `venueCreditByMarket` = seat `credit`; `vaultBase` null | no ATA → 0 |
| `syncClock()` | chain Clock sysvar (slot @0, unix_timestamp @32; `deploy/cycle/accounts.ts:26-30`) | `offsetMs = ts × 1000 + rtt/2 − Date.now()`, `applyClockSync` | `rpc-down` |
| `nowMs()` | unchanged (`provider/clock.ts:8`) | | |
| `nextWindow(m)` | index `markets?series=&expiryFrom=m.expirySec+1` | lowest expiry | `null` |
| `getResolution(id)` | index `markets/:id` | opening/closing = print 0/1 price; `printSource` = close print source (1 pyth, 2 redstone, 3 switchboard, 4 attested); `singleSource`; `settlementTxHash` = `resolved_signature`; `voidReason` 1 missing-print, 2 cross-check-divergence | open → nulls |
| `getVaultSnapshot` / `getVaultHoldings` | none | unchanged `null` / zeros (S7) | — |

**Non-port exports:** `resolveVenueId` (Codama `findConfigPda`; an env override must equal it; `source` adds `"derived"`), `loadCollateral` (config mint → decimals byte 44; symbol `tUSDC`), `getWalletCollateral` (`readTokenBalance`), `getMarketsLite` (`markets?ids=`), `laneNextStart` (the cadence's last expiry), `readRecoveryCursor` (`getSlot`), `listWalletFills` (index). `readVenueBoard` stays not-deployed (S5).

### 2.3 Core types on Solana (D-010/D-011 already reshaped most)

- **`EventMarket` from an index row:** `marketId`/`marketAddress` = `market`; `venueId` = config; `asset` = `symbol`; `lane` from `basis`; `intervalSec` = `cadence_sec`; `tradingStartSec`/`lockAtSec`/`expirySec`; `poolAddress` = `book`; `seriesAddress`; `nonce` = `market_index`; `policyVersion`; `printSource` = the open print's source, else the policy primary; `collateral`/`decimals` from `readVenue`; `openingPriceRaw` = print 0; `volumeQuoteRaw = volume_ticklots × cu`; `lastPriceRaw = last_price_ticks × tick_base`; `resolvedAtMs`.
- **No Solana meaning; S4's handling:**
  - `EventMarket.question`: synthesized as "Will {asset} close at or above its opening print?".
  - `IndexedStatus` `Settling`/`Finalized`: never emitted, and `finalized` = `state ≠ open`.
  - `Quote.feeBps`: always 0.
  - `ClaimKind "vault-credit"` and non-wallet `OrderRoute`: S7; they refuse.
  - `ClaimableRow`: has no field for seat `credit` or bond. Legs stay payout-only; the claim receipt shows the actual `Redeemed.total`.
  - `IntentRecord`: lacks `lastValidBlockHeight` (§3.4).

## 3. Writes (lane 4b)

### 3.1 `submitOrder` (wallet route; `core/ports/submitter.ts:26-55`), Masayume's order-lane order (`submitter/order-lane.ts:68-110`)

| Step (`submitter/steps/*.ts`) | Rule |
|---|---|
| `status-gate` | Fresh `getOnchain` (stale → `rpc-down`); `status === ONCHAIN_STATUS.Trading`; `readVenue().mode === 0`; not `insideNoEntryBuffer(nowMs, { lockAtSec, intervalSec })`. Otherwise `market-not-trading` |
| stop gate | `checkAndReserve(wallet, displayed.maxCostBase)` (allow-all) |
| `quote` | Masayume `steps/quote.ts:21-35` over `freshQuoteStake`: below min stake, `null` → `no-liquidity`, admissibility band, fresh `maxCostBase > displayed` → `requote` |
| `expiry` | `orderExpirySec(nowSec, { lockAtSec, intervalSec })` (`core/lifecycle/headroom.ts:36`); `null` → `market-not-trading` |
| funding (`submitter/funding.ts`) | `readSeat(ledger, w)`: `bond = seat ? 0 : seatBond`, `credit = seat?.credit ?? 0`; `need = maxCost + bond − min(credit, maxCost + bond)` ≤ ATA balance, else `insufficient-collateral`; `checkGas("order")` |
| `build` | v0 message, fee payer = `wallet.signer` (D-023). `getUserPlaceOrderInstructionAsync`: kind 0 up / 2 down; `priceTicks = limitPriceRaw / tick_base`; `lots = contractsRaw / lot_base`; `expireTs`; `orderType: ORDER_TYPE.ioc` (2); `selfMatch` 0; `maxFills = min(16, fillsCap)`; `maxEvictions = min(16, evictionsCap)`; `seatHint = seat?.index ?? 0xFFFF` (D-027); `useCredit: true`; `withdrawProceeds: false`; ATA as `authorityToken`. Blockhash + `lastValidBlockHeight` from `getLatestBlockhash("confirmed")`. Simulate (`sigVerify: false`) → compute limit = units × 1.1, ≤ 400,000 (D-012) |
| journal → `sign` | `journal.record({ kind: "order", wallet, summary, pool: book, marketId })`, `onPhase("submitted")`, then sign (§3.4) and `markSent(id, signature, lastValidBlockHeight)` |
| `send` → `confirm` | `sendTransaction(base64, { preflightCommitment: "confirmed" })` → `onPhase("confirming", { txHash })`. Poll `getSignatureStatuses` every 1.5 s, re-sending the same bytes every 2 s, until confirmed, failed, or `blockHeight > lastValidBlockHeight`. 90 s cap → `unknown` |
| book | `getTransaction(sig, { maxSupportedTransactionVersion: 0 })` → `decodeTransactionEvents` → `OrderExecuted`: `contractsRaw = filled_lots × lot_base`, `costBase = cash_spent`, `avgPriceBps` in own terms, `fillCount = fills.length` |

**Outcome mapping** (engine codes `events-accounts.md` §4):

| When | Signal | Outcome |
|---|---|---|
| simulation | 6110 `ImmediateOrCancelNoFill` | re-quote: `null` → refused `no-liquidity`; otherwise `requote(fresh)` |
| simulation | 6100, 6000 / 6107, 6108 / 6106 / 6104 | refused `market-not-trading` / `order-expired` / `below-min-quantity` / `invalid-price` |
| simulation | 6115 `SeatMismatch` | re-read the seat and rebuild once; otherwise `contract-revert` |
| simulation | token or SOL shortfall | `insufficient-collateral` / `out-of-gas` |
| wallet | code 4001 | refused `user-rejected`, `markFailed` |
| landed, `err` 6110 | IOC lost the race after preflight | `nothingFilled { txHash }` (stake untouched, fee paid) |
| landed, other `err` | | `reverted { diagnosis, txHash }` |
| landed, ok | | `confirmed { booked }` |
| no answer by expiry or cap | | `unknown` (`markUnknown`; recovery decides) |

Users send IOC only, so they never rest and can't self-match (6119); a maker account sharing a wallet would. The first order in a Window pulls the 0.25 tUSDC seat bond, which is refunded at redeem.

### 3.2 `submitTx` kinds in S4

- **`redeem`** (`ports/submitter.ts:83`):
  1. `readMarket`: not terminal → refused `not-settled`.
  2. `readSeat`: seat gone or Ledger closed → index `wallet/:w/actions` `Redeemed` for the Window → `confirmed { txHash }` (the settler's `redeem_for`, or an earlier leg's redeem); nothing found → refused `already-claimed`.
  3. Prepend `public_sweep_expired(32)` if `open_orders > 0`, and an idempotent ATA create if the ATA is missing.
  4. `user_redeem(seat_idx, null, null)`: a **full** redeem, since partial is PROGRAM-only (6232, engine §8.4). `outcomeIdx`/`amountRaw` are informational, so every leg of one Window resolves to one transaction.
  5. Sign, send, confirm and journal as §3.1 (`kind: "redeem"`, `marketId`).
- **`faucet`:** refused `faucet-refused` "test tUSDC comes from /api/faucet" (server-side mint, §4).
- **Every other kind:** refuses with its product's not-deployed reason (unchanged).

### 3.3 Fees, phases

- **Fees:** the wallet pays (D-023). No priority fee on devnet. `checkGas(lane)` = `getBalance ≥ FEE_RESERVE_LAMPORTS` (20,000; `core/constants/fees.ts:19`) plus 2,039,280 when the transaction creates an ATA.
- **Phases:**
  - `composing` through build and simulate;
  - `submitted` at `journal.record`, before the wallet popup;
  - `confirming` once the signature is sent;
  - then `confirmed`, `reverted` or `unknown`.
  - `usePlaceBet` already renders `nothingFilled` as confirmed (`web/src/features/markets/ticket/usePlaceBet.ts:22-34`).

### 3.4 Signer, journal, recovery

- **Wallet signer:** `WalletSession.signer` (`react/wallet-session.ts:11-17`) comes from `createSignerFromWalletAccount` (`@solana/wallet-account-signer` 8.3). It exposes `modifyAndSignTransactions` (`solana:signTransaction`) and/or `signAndSendTransactions`.
  - 4b uses modify-and-sign, reads the signature with `getSignatureFromTransaction` after the wallet returns (a wallet may add instructions), and markets sends.
  - Sending-only wallets fall back to `signAndSendTransactions`; the journal is written when the wallet returns.
  - New `sessions/wallet-signer.ts`; `{ secretKey }` sessions use `createKeyPairSignerFromBytes` (`sessions/keypair-signer.ts`). No Privy files (D-023).
- **Port change (D-entry, additive):** `IntentRecord.lastValidBlockHeight?: number` and `IntentJournal.markSent(id, txHash, lastValidBlockHeight?)`; `journal.ts` stores it.
- **Reconcile** (`submitter/reconcile.ts`, used by `features/recovery/WriteRecovery.tsx:39`):
  - With a `txHash`: `getSignatureStatuses([sig], { searchTransactionHistory: true })`. `err` → `reverted`; confirmed or finalized → `confirmed`; `null` and `getBlockHeight() > lastValidBlockHeight` → `absent`; otherwise `unknown`.
  - No `txHash` (closed before signing): after 120 s, an order with index fills since `createdAtMs` on that Window → `confirmed`; otherwise `absent`.
  - Nothing is ever re-signed (AD-3).
- **Context7 first:** Kit 8.3 `sendAndConfirmTransactionFactory`, the compute-unit estimate helper, and whether it needs `@solana-program/compute-budget` (stage owner adds the dependency).

## 4. Faucet (lane 4c)

- **Today:**
  - SOL service: service, routes, challenge and quotas exist (`web/src/features/funding/faucet-service.server.ts`, `app/api/faucet{,/challenge}/route.ts`), and tables `faucet_challenges`/`sol_faucet_claims` exist in the local DB; only the chain adapter is missing.
  - tUSDC: still Masayume's wallet-signed public mint via `submitTx({ kind: "faucet" })` (`web/src/features/markets/faucet/useFaucet.ts:110`). On Solana, tUSDC's mint authority is the server role `faucet-mint-authority` (D-026), so a wallet cannot mint alone.
- **Contract (default, Q-S4-1):** a server-built, server-signed, server-sent mint, journaled exactly like the SOL claim.
  - One free challenge signature covers both; `faucetChallengeMessage` (`core/faucet/index.ts:67-78`) names SOL and 10,000 tUSDC.
  - `POST /api/faucet { id, signature, asset: "sol" | "tusdc" }` (default `sol`); `GET /api/faucet?wallet=` adds the tUSDC claim view.
- **Keys (server-only):**
  - `SOL_FAUCET_PRIVATE_KEY` = new create-once role `sol-faucet` in `~/.config/agari/devnet/`. It is the SOL source, fee payer for both claim kinds and ATA rent payer.
  - `FAUCET_MINT_AUTHORITY_PRIVATE_KEY` = `faucet-mint-authority`, which signs `mintToChecked` only.
  - `SOL_FAUCET_RPC_URL` defaults to public devnet, keeping the ops Helius budget whole (D-030).
  - Local dev: when either key env var is unset, the server reads `~/.config/agari/devnet/<role>.json` (`AGARI_KEYS_DIR` overrides), as ops `roleSecret` does. Keys are never copied into `.env` files (D-034).
- **SOL policy (unchanged, `core/faucet/index.ts:4-14`):**
  - top-up to 0.02 SOL when below 0.005;
  - 1 SOL per 24 h globally, 2 SOL reserve, 10,000-lamport fee cap;
  - one per wallet per 24 h, 10 per IP per 24 h;
  - challenge TTL 5 min; challenge limits 6 per wallet, 20 per IP and 300 globally per hour (`faucet-service.server.ts:63`).
- **tUSDC policy (new `TUSDC_FAUCET_POLICY`):**
  - 10,000 tUSDC (`FAUCET_UNITS`, 10,000,000,000 base) per claim;
  - one per wallet per 24 h, 10 per IP per 24 h, 2,000,000 tUSDC per 24 h globally;
  - refused when the `sol-faucet` balance < reserve + 2,049,280.
  - New table `tusdc_faucet_claims`: the SOL columns with `amount_base`, keyed by challenge id.
- **Chain adapter** (`packages/markets/src/faucet/solana.ts`, behind `createFaucetChain`):
  - `prepare`: a system transfer, or `[createAssociatedTokenIdempotent, mintToChecked]`. Sign, serialize, return `{ lastValidBlockHeight, feeLamports, rawTransaction, txHash }`.
  - `inspect`: status ok + `getTransaction` shows the funder, recipient and amount → `confirmed`, else `conflict`. `err` → `reverted`. `null` past `lastValidBlockHeight` → `reverted` (never landed; quota stays used, Masayume's rule). Otherwise `prepared`.
  - `broadcast`: re-sends the stored bytes (a duplicate is not an error).
- **Fee reserve (D-012):** a funded wallet holds ≥ 0.02 SOL (≈ 4,000 orders at 5,000 lamports); orders need `FEE_RESERVE_LAMPORTS`. The server mint needs no wallet SOL.
- **Sponsor is S7 (D-023).** `/api/sponsor` stays GET `configured: false` / POST 503 (`app/api/sponsor/route.ts:18-24`).
  - **Proposed gate wording (needs a D-entry):** "wallet-paid IOC fill: fee payer = the user's wallet, SOL from the faucet top-up; sponsored fills move to S7 (D-023)."
- **UI:** `FundingStage` `minting` becomes "Adding test tUSDC…" with no wallet popup (`features/funding/gas-client.ts:4`). The copy "confirm the free tUSDC claim" changes (`features/funding/copy.ts:12-14`).

## 5. `/api/index/[...path]` (lane 4a)

One Node route (`runtime = "nodejs"`, `dynamic = "force-dynamic"`, GET only). It uses `indexReader(getDb())` (`packages/db/src/client.ts:20`), validates params with zod (`addressSchema`, integers), and clamps limits to ≤ 1,000 (`read.ts:11`).
- **Response:** `{ rows: IdxRow[] }` with u64/i64/NUMERIC values as decimal strings (as `read.ts` casts), small ints as numbers, and JSONB passed through.
- **Errors:** no DB → 503 `{ error: "indexer not configured" }` → `indexer-down`.
- **Cache:** public paths `public, s-maxage=2, stale-while-revalidate=8`; `wallet/*` `private, no-store`.

| Path | Query | `idx/read.ts` | Serves |
|---|---|---|---|
| `markets` | `state, symbol, series, expiryFrom, expiryTo, limit`; `settled=1`; `ids=a,b` | `markets` (`:55`); **new** `settled` predicate and `marketsByIds` | lanes, settled, next Window, lane next start, marketsLite |
| `markets/:market` | — | `markets({ market })` | `getMarket`, `getResolution`, closed-Window snapshot |
| `wallet/:w/fills` | `market, book, since, limit, offset` | `walletFills` (`:27`) | `listWalletFills`, history, reconcile |
| `wallet/:w/positions` | `unredeemed=1, limit` | `positions` (`:85`), **select adds** `lot_base`, `tick_base`, `last_price_ticks` | positions, claimables, holdings fallback, balance sheet |
| `wallet/:w/actions` | `limit, offset` | `walletActions` (`:46`) | history sets and redemptions, redeem reconcile |
| `wallet/:w/orders` | `market, open=1` | `orders` (`:94`) | reconcile evidence |
| `fills` | `market` or `book`, `since, limit` | `fills` (`:37`) | tape (S5 consumers) |
| `prints/:symbol` | `from, to, limit` | `printHistory` (`:76`) | `getPriceHistory` |
| `candles/:market` | `from, to` | `candles` (`:101`) | card sparks (S5) |
| `status` | — | `status(programId)` (`:122`) | `/status` probes, freshness |

Masayume row-shape mapping as in `stage-03-venue-ops.md` Findings (lane 3d). `NEXT_PUBLIC_AGARI_INDEXER_URL` must be absolute (`z.url()`, `env.ts:22`), for example `http://localhost:3000/api/index`; SSR fetches it over loopback.

## 6. Web rewiring (lane 4d)

- **Ticker picker (new):** `web/src/features/markets/lanes/TickerPicker.tsx` + `useTickerPin` (`agari.ticker`).
  - A lane now carries up to 9 tickers, so the picker filters and pages `lane.markets` by `asset`.
  - `useMarketsSelection.ts:38` falls back to the pinned ticker's soonest Window.
  - Lane pins stay keyed by `intervalSec` (`lanes/useLanes.ts:36`); `(basis, intervalSec)` comes in S6.
- **Market-session chip (new):** `web/src/features/markets/session/{useMarketSession.ts,MarketSessionChip.tsx}`.
  - Polls ops `GET /session` every 60 s. Response: `{ nowSec, calendar, lanes: { "TSLA-5m": "open #22 …" | "paused: no signed source" | "closed: no session" } }` from `SessionService` and the roller heartbeat. The stage owner adds the route at foundation.
  - Uses core `sessionStatus`/`sessionLabel` (`core/market/session.ts:53,78`).
  - Placed in `hero/HeroHeader.tsx` and the lanes header. It is not `features/session/SessionChip.tsx` (the session-key chip).
- **Closed and paused copy:**
  - `lanes/BetweenRounds.tsx:17-22` shows `sessionLabel` ("Opens Mon 09:30 ET") outside regular/early-close.
  - A ticker whose `/session` lane reads `paused:` shows "Paused: no signed price source".
  - A halted venue (`mode`) surfaces through the `market-not-trading` blocker (`ticket/ticket-guards.ts`).
- **Settling / cross-check pending:** `VERDICT_UI.settling` (`lib/copy.ts`) becomes "the closing print lands 5–17 s after expiry; a cross-checked Window can wait up to 2 min for its check print".
- **Verdict print-source label:** `verdict/print-source.ts:12` → "Pyth price at 16:00:00 ET" (`formatEtClock(expirySec)` + `:00`; open row from `tradingStartSec`; " · single source" kept). Used by `VerdictCard.tsx` and `claims/MarketProofRows.tsx`.
- **Hero source:** `lib/copy.ts:153` "Prophecy oracle median · feed EMA" and `HERO.livePrice` become "Settles on signed Pyth/RedStone prints at open and close · chart follows spot".
- **Ticket:**
  - Add a "0.25 tUSDC refundable seat deposit on your first order in a Window" note.
  - The Max chip leaves bond headroom when holdings are zero.
  - `nothingFilled` copy: "The book moved before your order landed; nothing was taken."
- **Claims:** `claims/claim-run.ts:11-28` flattens per leg; group by `marketId` so one Window = one signature. A crank-paid Window renders "Paid automatically" with the `redeem_for` signature.
- **Onboarding:** the "two sides don't add to $1" copy (S1 Findings) is restated for a YES-quoted book: Up ask + Down ask ≥ $1 by the spread.
- **Unchanged (port shapes hold):**
  - `useLanes`, `useBook(s)`, `useTopOfBook`, `useQuote`/`useStakeQuote`, `usePlaceBet`, `useVerdict`, `useClaimAll`;
  - balance/portfolio panels, word board, reels (same lanes, same spot stream), `features/surface`, `features/recovery`.

## 7. Lanes, file ownership, proofs

| Lane | Branch · worktree · ports | Owns | Proves itself |
|---|---|---|---|
| 4a reads | `slice/S4a-reads` · `../agari-wt/s4a` · web 3001 | `packages/markets/src/{runtime,provider,react}/**`, `collateral.ts`, `venue.ts`; additive queries in `packages/db/src/idx/read.ts`; `web/src/app/api/index/**` | Read-only devnet against the live soak: real lanes, maker quotes in books, prints, settled verdicts; Book-decode and quote-kernel vitests (vectors + devnet fixture). **4a.1 (§2.1) merges first** |
| 4b writes | `slice/S4b-writes` · `../agari-wt/s4b` · Surfpool 8960/8961 | `packages/markets/src/{submitter,sessions}/**`, `scripts/drive/first-call.ts` | Surfpool devnet fork (reads live devnet Windows and maker quotes; D-027): keypair-session IOC up/down, `nothingFilled`, requote, redeem, killed-send reconcile. One devnet drive at the gate. Vitest: booked order from `ops/indexer/fixtures/place-order-direct-yes-fill.json` |
| 4c faucet | `slice/S4c-faucet` · `../agari-wt/s4c` · Surfpool 8970/8971 · DB `agari_s4c` | `packages/markets/src/faucet/**`, `packages/core/src/faucet/**`, `packages/db/src/{faucet,schema-faucet}.ts` + `packages/db/scripts/test-faucet-postgres.ts`, `web/src/app/api/faucet/**`, `web/src/features/funding/**`, `web/src/features/markets/faucet/**`, FUNDING/FAUCET copy | Fork: SOL + tUSDC claims, killed-broadcast recovery, expired-blockhash `reverted`; then one devnet claim each at the gate |
| 4d surfaces | `slice/S4d-surfaces` · `../agari-wt/s4d` · web 3004 | `web/src/features/markets/**` except `faucet/`; `web/src/features/{onboarding,recovery}/**`; HERO/HERO_HEAD/MARKETS/VERDICT_UI/CLAIM/TICKET copy in `web/src/lib/copy*.ts` | Against the stub and `/dev/*` fixtures until 4a merges, then devnet; screenshots at 390/768/1440 in both themes |

- **Frozen cross-lane interfaces:**
  - §2.1 signatures (4a → 4b);
  - the port methods (`core/ports/*`);
  - `/api/index` paths (§5), the `/session` body (§6), the faucet POST body (§4).
  - Until 4a.1 merges, 4b builds sessions, sign/send/confirm and reconcile. Merges run 4a.1 → 4a → 4b → 4c → 4d.
- **Stage owner only:**
  - every `package.json`, `pnpm-lock.yaml`, package `exports`;
  - `packages/core/src/ports/**` (§3.4 D-entry), `packages/markets/src/{env,index}.ts`;
  - `web/src/providers/**`, `web/src/lib/env.ts`, `web/.env.example`, `web/.env.local` (a symlink shared by every worktree);
  - `services/ops/**` (`/session`), `scripts/invariants/**`, `docs/plan/**`, role keys.
  - A lane that needs a shared change writes the request into its report.
- **Invariants in force:**
  - `kit-import-boundary`: `@solana/*`, `@agari/clients` only in `packages/markets` (web providers exempt).
  - `write-boundary` (`rules.mjs:42-49`): no `sendTransaction(` outside markets; web routes call faucet service methods.
  - `file-length` ≤ 400; `time-suffix` (use `expirySec`; Codama args like `tradingStart:` go through shorthand locals, S3 Findings); `no-float-money`.
- **Re-pointed at foundation** (`optional: true` until the files exist; Masayume `rules.mjs:159-179` shape):
  - `order-lane-ioc`: `submitter/steps/build.ts` must match `/ORDER_TYPE\.ioc/` and not `/ORDER_TYPE\.(normal|fok|postOnly)/`.
  - `status-gate-enum`: `submitter/steps/status-gate.ts` must match `/ONCHAIN_STATUS\.Trading/`.
  - `expiry-from-headroom`: `submitter/steps/expiry.ts` must match `/orderExpirySec\(/`.

## 8. Open questions (answered at the foundation, 2026-09-14: the recommended defaults, D-032, D-034, D-035)

| Q | Question | Recommended default |
|---|---|---|
| Q-S4-1 | tUSDC mint: a server-sent mint (one free signature, no popup) or a wallet transaction co-signed by the mint authority (Masayume's popup, but a wallet that alters the transaction breaks the co-signature) | Server-sent mint (§4) |
| Q-S4-2 | Browser RPC: public devnet per user IP, a domain-allowlisted Helius key, or an `/api/rpc` proxy | Public devnet for S4; revisit at S16 deploy |
| Q-S4-3 | The settler pays every seat with `redeem_for` right after settle (venue-ops §7), so users rarely see Claim (L-33/L-34). Add a settler grace so users can claim first? | Grace of 300 s before `redeem_for` (≈ 0.9 SOL more roller float from Ledgers held open); after that, "Paid automatically" |
