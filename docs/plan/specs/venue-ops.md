# Venue operations spec (S3): roller, prices, settler, indexer, seed maker

**Authority:** plan §2.2, §4, §7.2 S3; `prints.md`; `events-instructions.md` §1.7, §5; `events-engine.md` §7–8. Frozen at the S3 foundation commit (D-028). Changes need a D-entry. Every lane reads §1–4 plus its own section.

## 1. Roles, keys, payers

| Actor | Key role | Pays rent for | Rent comes back | Devnet SOL float | RPC budget |
|---|---|---|---|---|---|
| window-roller | `roller` | Market, Ledger, mvault (`roller_open_window` payer), Ledger growth | Ledger + mvault at `public_close_ledger` (`ledger.rent_payer`); Market at `public_close_market` | ≈ 4 (≈ 1,000 Markets/day × 0.003, retained 6 h) | 2 RPS |
| price-relay | `price-relay` | Pyth encoded VAA + `PriceUpdateV2` | closed at once by the relay | 0.3 | 3 RPS |
| (relay, opt-in) | `price-attestor` | nothing: signs the ed25519 message only | — | 0 | — |
| settler | `settler` | `MarketResult`; owners' ATAs for `redeem_for` | Result at `public_close_market` (`result.rent_payer`) | ≈ 2.5 | 2 RPS |
| indexer | none (read-only) | — | — | 0 | 3 RPS |
| seed maker | `maker` | its tUSDC ATA; seat bond in tUSDC | bond at redeem | 0.2 + tUSDC float | 1 RPS |

- Each actor builds one client from its own key (`createOpsClient`): that key is fee payer and signer. No actor signs with another role's key, and nothing signs with `deployer` at runtime.
- Keys come from `roleSecret(role)` (`services/ops/src/runtime/keys.ts`): the `<ROLE>_PRIVATE_KEY` env var, else `~/.config/agari/devnet/<role>.json`. A missing key means scan-and-report.
- `public_close_ledger` names the roller as `rent_payer` and `public_close_market` names roller and settler. Those are addresses, not signers, so the settler sends both.

## 2. Ops runtime (foundation, stage owner)

### 2.1 Environment (`runtime/env.ts`)
`SOLANA_CLUSTER` (`devnet` default | `localnet`), `SOLANA_RPC_URL` / `SOLANA_WS_URL` (override), `HELIUS_API_KEY` (devnet default RPC when set), `SURFPOOL_PORT` / `SURFPOOL_WS_PORT` (localnet, default 8899/8900), `DRY_RUN` (dry unless `0`/`false`), `OPS_HTTP_PORT` (8787), `DATABASE_URL`, `PYTH_API_KEY`, `ALPACA_*`. All error text goes through `errorText`/`redact` before logging.

### 2.2 Actor loop (`runtime/actor.ts`)
`runActor({ name, log, dryRun, everyMs, pass })`. A pass reads chain state, decides with a pure function (`plan.ts`/`decide.ts`, plain data plus `nowSec`), reconciles (re-reads the target account right before sending) and then either sends or logs `DRY <instruction> <target>: <why>`. It returns `{ why, detail?, nextDelayMs? }`. Failures back off exponentially up to 60 s. A pass never throws out of the loop.

### 2.3 Heartbeats and `/health`
`Heartbeat { actor, dryRun, startedMs, lastPassMs, lastOkMs, lastWhy, failures, detail }`. `detail` carries lane states and counters (JSON-safe; bigints as strings). `GET /health` → `{ ok, cluster, dryRun, nowMs, actors: Heartbeat[] }`, where `ok` is false when any actor has `failures ≥ 3` or `lastOkMs` is older than 5 minutes.

### 2.4 Clock
Decisions about chain rules (deadlines, lock, retention) use the **chain clock**: `chainNowSec`, cached for at most 5 s per actor. Fetch scheduling uses the wall clock, because sources publish on wall time. They agree on devnet. On Surfpool after time travel they don't.

### 2.5 Wiring
Actors export `start<Name>(deps: VenueDeps)`, where `VenueDeps = { env: OpsEnv; log: Log; sessions: SessionService; spot: SpotFeed | null }` (`runtime/deps.ts`). The stage owner registers them in `main.ts` behind `OPS_ACTORS` (comma list of `relay, roller, settler, maker, indexer, http`; default: all six; `all` adds the Masayume-era actors). `MAKER_MODE` is `seat` (default) or `vault`. Each lane may add a dev runner `services/ops/src/dev/<actor>.ts` that builds `VenueDeps` and starts only its actor.

## 3. Chain access

- **Boundary.** `services/ops` reaches the chain only through `@agari/markets/ops` (shared: client, send, venue reads) and `@agari/markets/ops/<lane>` (`roller`, `prints`, `settle`, `maker`, `indexer`; the wildcard export `./ops/*` → `src/ops/*/index.ts`). It never imports `@solana/*` or `@agari/clients` (`kit-import-boundary`). Addresses cross as strings.
- **Reads.** `getMultipleAccounts` takes at most 100 per call (`fetchMarkets`, `fetchSeries`). `getProgramAccounts` runs only at boot and on refreshes ≥ 60 s apart (`listSeries`, `listMarketsOfSeries`).
- **Sends.** `sendOps(client, instructions, label)` throws `OpsSendError` with `code` = the engine error (`ENGINE_ERROR`) or null. Each actor lists its "already done" codes (for example `PrintAlreadyRecorded` or `MarketAlreadyTerminal`): treat them as done, re-read, and never resend blindly.
- **RPC budget.** ≤ 10 RPS in total on Helius devnet (§1 per actor). Sleep to the next boundary instead of polling tightly.

## 4. Venue discovery

- **Series.** `listSeries` at boot and every 5 minutes. S3 acts only on `symbol != null` (core registry; the drive-only Series 900 is skipped) and `basis == 0` (Regular). Gap and token are S6.
- **Markets.** Market PDA = `windowAddresses(series, index)`. Each actor keeps a per-Series `lowIndex`, the lowest index it isn't finished with. Boot seeds it from `listMarketsOfSeries` (closed Markets no longer exist). In steady state it reads `[lowIndex, series.nextIndex)` with `fetchMarkets` and advances past finished Markets.
- **Status.** `marketStatus(market, nowSec)` implements events-engine.md §7. `MARKET_FLAG` covers `bookReleased`, `ledgerClosed` and `singleSource`.

## 5. window-roller (lane 3a)

1. **Calendar.** `SessionService` (foundation). A null calendar, or an unknown or closed date, lists nothing (`closed: no session`).
2. **Plan** (pure `plan.ts`, per Series). Planned Windows are core `regularWindows(session, cadence)` for today's session and the next. The candidate is the earliest planned `W` with:
   - `W.tradingStart ≥ series.lastExpiry`;
   - `W.lockAt − now ≥ ROLLER_MIN_TRADABLE_SEC` (default 60);
   - `W.tradingStart − now ≤ ROLLER_LEAD_SEC` (default 120; must stay below the cadence so two Books suffice);
   - when a version covers `W`: `now + 45 ≤ open_deadline` and, if the version has a check, `now + 45 ≤ T + check_admission_sec`, so a late open never voids at once or loses its cross-check (D-029).

   Then:
   - **Version** (`versions.ts`): the highest covering version (`coveringVersion`, prints.md §2.3). None → lane state `paused: no signed source`, and the Window is not opened.
   - **Corporate-action skip:** `services/ops/config/corporate-actions.json` `{ "skips": [{ "symbol", "date", "why" }] }` (empty in S3) → `paused: corporate action`.
   - **Book:** `freeBooks[0]`; none → `waiting: no free book`.
   - **Kinds:** core `BoundaryKind` → u8 `0 Intraday, 1 SessionOpen, 2 SessionClose`.
3. **Recycle** (each pass, before opening). Every Book of the Series bound to a Market (`book.market != default`) whose status is locked or terminal gets `public_sweep_expired(max 32)` until `order_count == 0`, then `public_release_book`. `BookMarketMismatch` means already released.
4. **Grow** (PD-8). A trading Market whose Ledger has `seats_used ≥ capacity − 8` gets `public_grow_ledger(96)`.
5. **Races.** Re-read the Series right before `roller_open_window`. `BadWindowIndex`/`WindowOverlap` mean it was already opened: re-read and continue.
6. **Heartbeat detail.** `lanes: { "TSLA-5m": "open #12 13:35–13:40Z v1" | "paused: no signed source" | "closed: no session" | "waiting: no free book" }`.
7. **`scripts/deploy/init-series.ts`** (`pnpm deploy:init-series [--cluster devnet|localnet] [--dry-run] [--cadences 300,900,3600] [--symbols TSLA,…]`):
   - Registers the 9 launch tickers (TSLA NVDA AAPL MSFT META AMZN GOOGL QQQ VOO) × Regular 5m/15m/60m through `ensureSeries`/`ensureBooks` (D-026). Book capacity is 512 for 5m/15m and 256 for 60m, 2 Books each.
   - Record keys are `"<SYM>-5m" | "-15m" | "-60m"`.
   - `--dry-run` prints what is missing, its rent (5,080 lamports/B including the 128 B header; Book `8 + 32,384 + 48·cap`) and the payer balance. A real run refuses to start below `total + 0.5 SOL`.
8. **`scripts/deploy/fund-roles.ts`** (`pnpm deploy:fund-roles [--cluster] [--dry-run]`): ensure-style SOL top-ups from `deployer` to the §1 floats, plus tUSDC minted to the maker by `faucet-mint-authority` (`MM_TUSDC_FLOAT`, default 2,000 tUSDC).
9. **`scripts/drive/roller-plan.ts --at <ISO>`**: prints every Series' plan at that clock (reads only). Gate: `--at 2026-09-28T14:00:00Z` shows TSLA on v2 (RedStone) and QQQ/VOO `paused: no signed source`.

## 6. price-relay (lane 3b)

1. **Unit of work: `(source, T)`.** It covers every due slot of every Market with that boundary. A slot is due when:
   - the Market isn't terminal and the slot is empty;
   - the version's policy for the slot has this source (`open`/`close` → primary; `checkOpen`/`checkClose` → check, only when the version has one);
   - `T + min_delay_sec ≤ now ≤ deadline(slot)` (prints.md §3).
2. **Schedule** (wall clock) for each 5-minute boundary T:
   - **RedStone at T + 10 s.** One historical request returns every feed. Retry every 3 s until all 5 configured signers are present. The engine requires all 5 while `now < T + strict_sec` (prints.md §4.2), so `threshold` (3) suffices only after that: T + 60 for check slots (strict 60), T + 300 for primaries (strict 300). Packages from unknown signers are dropped before posting. Check slots (deadline T + 120) go first, then primaries. (Amended at the 3b merge, D-029.)
   - **Pyth at T + 2 s.** One `/v2/updates/price/{T}` request covers every due Pyth feed; retry every 2 s. `postPythUpdates` runs once, the print is recorded into every due slot, then `closePythUpdates` runs on every account of that T, whether or not the records landed.
   - **Late slots.** A slot still admissible after a restart is fetched from history (RedStone keeps ≈ 24 h, Hermes by timestamp).
   - **Missed slots.** A slot past its deadline is logged `missed <slot> <market>: <reason>`; the settler voids.
3. **Leftovers.** At boot and hourly, find `PriceUpdateV2` accounts whose write authority is the relay (receiver `rec5EK…`, memcmp at offset 8) and close them. Gate: zero leftovers.
4. **Archive** (takes over the S0 archivers). For every 5-minute boundary T in `[open, close]` of each session:
   - write the RedStone packages of every RedStone ticker and the Pyth updates of every trial feed into `print_archive` (`packages/db/src/schema-prints.ts`), idempotent on `(source, feed, boundary_sec)`, whether or not a Window used them;
   - on boot, backfill today's past boundaries;
   - gate: 100% of RedStone boundaries archived within 60 s.
   - The S0 JSONL archivers stop once the soak proves this.
5. **Spot and HTTP** (`prices/spot-feed.ts` implements `SpotFeed`; `http/{server,health,spot-sse}.ts`):
   - **Pyth:** the Hermes SSE `/v2/updates/price/stream?ids[]=…&parsed=true` for the trial feeds (Bearer key).
   - **RedStone:** `/data-packages/latest/redstone-primary-prod` every 5 s, taking the median of the signers.
   - **Server** on `OPS_HTTP_PORT`: `GET /health` (§2.3); `GET /prices/latest` → `{ [symbol]: { priceE8: string, publishTimeSec, source } }`; `GET /prices/stream` (SSE `event: spot`, same shape). CORS `*` on GET.
6. **Attested** (opt-in, `RELAY_ATTESTED=1`, off by default). The relay records attested slots (source 4) signed by `price-attestor`, using RedStone's median at T as the demo value, only where the version's primary is attested (no listed Series in S3). The Jupiter fallback is S6.

## 7. settler (lane 3c)

`decide.ts` (pure) takes, per Market: the Market, Ledger seats, the Book's order count, `config.result_retention_sec` and `now`, and returns one next action:
1. **Not terminal:**
   - Both primaries present, a check configured, both checks not present, and `now ≤ expiry + check_admission_sec` → wait until that + 1.
   - Otherwise both primaries present → `settle`.
   - A primary missing past its deadline → `void`.
   - Otherwise → wait until the earliest deadline.
2. **Terminal**, in order:
   - Book bound with `order_count > 0` → `sweep`.
   - Any non-PROGRAM seat with an owner → `redeemFor`: up to 4 seats per transaction, each preceded by an idempotent ATA create (payer settler). `public_redeem_for` also takes `series` (as the cancel family does, D-020).
   - Book not released → `releaseBook`. This happens before any wait on PROGRAM seats, so a product's seat never holds a Book the next Window needs (amended at the 3c merge).
   - A PROGRAM seat not drained → wait (products, S7+).
   - Ledger not closed and every seat drained → `closeLedger`.
   - Released, closed, `dependents == 0` and `now ≥ resolved_ts + retention` → `closeMarket`. The account being gone means done.
3. **Codes:**
   - `CrossCheckPending` → wait until `expiry + check_admission_sec + 1`.
   - `SettlementWindowOpen`, `MarketNotTerminal`, `OpenOrdersRemain` → re-read.
   - `MarketAlreadyTerminal`, `BookMarketMismatch` (already released) → done.
4. **Seats.** `readSeats` (hand decoder); PROGRAM seats are the flagged ones (`Seat.flags` bit0).

## 8. Seed maker (lane 3c, `MAKER_MODE=seat`)

Purpose: the books carry quotes during the soak and the demo. Vault mode (S8) stays the existing actor, selected by `MAKER_MODE=vault`.
1. **Fair value** (pure `seat/fair.ts`, the `ec-oracle-follow` shape from `reference/dreamdex-bot-kit/strategies/ec-oracle-follow`):
   - `P(up) = Φ(ln(spot/open) / (σ·√(t_left / year)))`, with the tie (`close == open` → Up) folded in as a small upward bias.
   - σ is per ticker from `MM_SIGMA_BPS` (default single names 4,500, ETFs 2,000 annualized).
   - Floats are allowed only inside this probability function; its output is integer YES ticks, clamped to `[MM_MIN_TICK, 1000 − MM_MIN_TICK]` (default 20).
2. **Quotes** (`seat/quote.ts`):
   - PostOnly BUY_YES at `price_ticks = fair − half` (bid) and BUY_NO at `price_ticks = fair + half` (ask). The book is YES-quoted, so a BUY_NO rests on the ask side at that YES price and escrows `1000 − (fair + half)` per lot. A crossing BUY_YES fills it through the mint-pair path, so no inventory is needed. `half` = `MM_HALF_SPREAD_TICKS` (default 30). (Amended at the 3c merge; the first wording put the escrow amount in the price field.)
   - Size: `MM_QUOTE_LOTS` (default 5,000).
   - `expire_ts = min(now + MM_QUOTE_TTL_SEC (120), lock_at − 30)`.
   - Requote when fair moves ≥ `MM_REQUOTE_TICKS` (10) or the quote is within 20 s of expiry: `user_cancel_all` first, then place.
3. **When:** only in a regular or early-close session, only on trading Markets whose open print is recorded, and only while spot is fresh (≤ 30 s).
   - Stop quoting at `lock_at − 60`.
   - Merge complete sets whenever both YES and NO are free, before `lock_at − 60`.
   - Cancel everything on a halt, a stale spot, or `closesAtSec − 120`.
4. **Budget:** `MM_MAX_CASH_PER_WINDOW` (default 50 tUSDC) and `MM_SYMBOLS` (default all launch tickers with a covering version). Settled seats are redeemed by the settler (maker seats are non-PROGRAM).

## 9. Indexer (lane 3d)

The ingestion contract is plan §4 (1)–(9). Specifics:
- **Discovery:** Kit `logsNotifications({ mentions: [program] }, { commitment: "confirmed" })`, plus `getSignaturesForAddress(program, { before, until, limit: 1000 })` backfill from the cursor. The deploy slot comes from `addresses.<cluster>.json`.
- **Decode** (`@agari/markets/ops/indexer`):
  - Take inner instructions invoked on agari-events whose data starts with `EVENT_IX_TAG` (bytes `e4 45 a5 2e 51 cb 9a 1d`), then the 8-byte event discriminator, then Borsh; decode with the Codama event decoders.
  - Output `{ signature, slot, blockTimeSec, innerIndex, name, data }`, with bigints kept as bigint and strings in rows.
  - Admin events use `emit!` (logs) and are not indexed.
- **Idempotency:** rows are keyed `(signature, inner_ix_index)`. A `(market, seq)` gap triggers `getSignaturesForAddress(market)` backfill.
- **Commitment:** rows land `confirmed`. A finality sweep (`getSignatureStatuses`) promotes them to `finalized` and deletes rows of dropped transactions. The per-program cursor (last finalized slot + signature) advances in the same DB transaction as the projection writes.
- **Tables** (`schema-index.ts`, prefix `idx_`): `idx_cursor`, `idx_events` (raw JSON), `idx_markets`, `idx_orders`, `idx_fills` (one row per `FillRecord`), `idx_prints`, `idx_positions` (market × owner), `idx_candles` (1-minute, from fills).
  - Column choice follows what S4's `/api/index/*` needs to serve Masayume row shapes (read `reference/masayume/packages/markets/src/provider/**`, record the mapping in the stage Findings).
  - Integers are stored as `NUMERIC`/`BIGINT`, never floats.
- **`scripts/drive/verify-index.ts`:** counts fills, opened Windows and resolved Windows on chain with an independent signature walk and decode, compares them with `idx_*`, and prints indexer lag (now − last indexed block time). Gate: counts match and lag < 10 s.
- **Dev database:** each lane uses its own database (`createdb agari_s3d`), because `CREATE TABLE IF NOT EXISTS` never alters an existing table.

## 10. Lanes and file ownership

| Lane | Branch · worktree · Surfpool ports | Owns |
|---|---|---|
| 3a roller | `slice/S3a-roller` · `../agari-wt/s3a` · 8910/8911 | `services/ops/src/actors/window-roller/**`, `packages/markets/src/ops/roller/**`, `scripts/deploy/{init-series,fund-roles}.ts`, `scripts/drive/roller-plan.ts`, `services/ops/config/corporate-actions.json`, `services/ops/src/dev/window-roller.ts` |
| 3b prices | `slice/S3b-prices` · `../agari-wt/s3b` · 8920/8921 | `services/ops/src/actors/price-relay/**`, `services/ops/src/http/**`, `services/ops/src/prices/spot-feed.ts`, `packages/markets/src/ops/prints/**`, `packages/db/src/{schema-prints,print-archive}.ts`, `services/ops/src/dev/price-relay.ts` |
| 3c settler + maker | `slice/S3c-settler-maker` · `../agari-wt/s3c` · 8930/8931 | `services/ops/src/actors/settler/**`, `services/ops/src/actors/market-maker/seat/**`, `packages/markets/src/ops/{settle,maker}/**`, `services/ops/src/dev/{settler,seed-maker}.ts` |
| 3d indexer | `slice/S3d-indexer` · `../agari-wt/s3d` · 8940/8941 | `services/ops/src/actors/indexer/**`, `packages/markets/src/ops/indexer/**`, `packages/db/src/{schema-index,index-store}.ts`, `scripts/drive/verify-index.ts`, `services/ops/src/dev/indexer.ts` |

- **Stage owner only:** `services/ops/src/main.ts`, `runtime/**`, `calendar/**`, `prices/spot.ts`, `packages/markets/src/ops/*.ts` (root files), `package.json` files, `pnpm-lock.yaml`, `docs/plan/**`. A lane that needs a shared change or a new dependency writes the request into its report instead of editing.
- **Existing code** outside a lane's paths (`deploy/**`, `prices/**`) is read-only for lanes: wrap it or copy the small part needed into the lane's own folder.
- **Tests:** targeted only (plan §8; CLAUDE.md), where money or settlement correctness is in doubt: the roller plan, settler decide and maker quote math.
