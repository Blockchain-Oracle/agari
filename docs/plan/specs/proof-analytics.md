# Proof and analytics spec (S5): record, edge, board, stats, status, proof replay, surface, Earned Heat

**Authority:** plan §5, §7.2 S5; `first-call.md` §1–2, §5; `venue-ops.md` §6, §9; D-021, D-027, D-030…D-036; Masayume `68f7a09` (`packages/core/src/projection/*`, `packages/markets/src/provider/{history,board,traction,scan,fills}.ts`, `web/src/features/{stats,status,edge,leaderboard,surface,share}`, `features/markets/{portfolio,balance,history}`, `web/src/app/api/{leaderboard,traction,status}`) and masayume.app. Frozen at the S5 foundation commit (D-041). Changes need a D-entry. Every lane reads §1, §3, §4, then its own §2 part.

**Code state (S4 head `c5ddb60`):**
- **Already real (S4a):** wallet history over the index (`packages/markets/src/provider/history.ts:76-133`), so Portfolio §03 record, receipt, equity, reputation, badges and CSV render live data (`web/src/features/markets/history/RecordSection.tsx:21-53`, `useCsvDownload.ts:9-22`). `/surface` reads coordinator Books, the opening print and spot (`web/src/features/surface/SurfaceScreen.tsx:33-41`, `useFocalBook.ts:21-35`).
- **Ported but stubbed:** the venue board and traction (`packages/markets/src/provider/tape.ts:69-72` → not-deployed), so `/leaderboard` and `/stats` show Masayume's failed state. `/status` runs Masayume's five probe kinds (`web/src/features/status/probes.server.ts:39-120`).
- **Byte-identical to Masayume after brand normalisation:** `core/projection/**` except the fee removal (`settle.ts:15-25`) and `Signature` types; every S5 web feature except seam renames and copy.
- **Missing:** tape queries, ET edge buckets, per-ticker and session boards, session-aware probes, proof replay, the proof page, source-naming share lines, `recount.ts`.

## 1. Data sources

| Surface | Chain (browser Kit / server) | Index (`/api/index/*`) | Ops HTTP (`NEXT_PUBLIC_PRICE_FEED_URL`) | DB direct (server) |
|---|---|---|---|---|
| Portfolio record, receipt, CSV, badges | seats via `getHoldings` (unchanged) | `wallet/:w/{fills,actions,positions}`, `markets?ids=` (`history.ts:78-85`) | — | — |
| Trader Edge | — | same reading (`keys.history`) | — | — |
| Leaderboard, `/api/traction`, `/stats` | — | **new** `tape/{markets,fills,actions}` | `/session` (**new** `calendar.recent`) | — |
| `/status` | `syncClock` (RPC head), faucet `status` | — | `/health`, `/session` | `indexReader.status` (`packages/db/src/idx/read.ts:143-153`), **new** `idx/read-status.ts`, `printArchiveStats` (`print-archive.ts:81-104`), `select 1` |
| Proof page | receiver account read (server, at replay) | `markets/:id` (prints JSON, `read.ts:68-81`), **new** `proofs/:market` | — | `archivedPrint` (`print-archive.ts:70-78`), **new** `print_proofs` |
| `/surface`, Earned Heat | Books (coordinator), opening print | `markets`, `markets/:id` | spot SSE, `/session` | — |
| `recount.ts` | independent signature walk + decode (`@agari/markets/ops/indexer` `index.ts:5-7`) | `--source events` only | — | `idx_events` (`--source events`) |

**New index paths** (dispatch in `queries.ts` at foundation; bodies in lane files). Rows keep `/api/index` conventions: decimal strings for u64/NUMERIC, `{ rows }`, public cache `s-maxage=2` (`web/src/app/api/index/[...path]/route.ts:15`) unless noted.

| Path | Query | New reader (file · owner) | Rows | Serves |
|---|---|---|---|---|
| `tape/markets` | `from, to, lookback, limit, offset` | `tapeMarkets` (`idx/read-tape.ts` · 5b) | `MarketRow` (`provider/index-api.ts:24-54`). Included when `expiry_sec ≥ from` or `resolved_ts_sec ∈ [from, to)`, and `trading_start_sec ≥ lookback` (Masayume `scan.ts:40-45`); `ORDER BY expiry_sec, market` | board scope, traction windows |
| `tape/fills` | `since, until, limit, offset` | `tapeFills` (5b) | `FillRow` (`index-api.ts:93-106`); `ts_sec ∈ [since, until)`, `ORDER BY ts_sec, seq, fill_ix` (stable paging under a fixed `until`; `idx_fills_ts_idx`, `schema-index.ts:193`) | every ledger on the venue |
| `tape/actions` | `since, until, limit, offset` | `tapeActions` (5b) | `ActionRow` + `owner` for `CompleteSet` (`idx_events_name_idx`, `schema-index.ts:48`) | complete sets in ledgers |
| `status/prints` | `from` | `printMix` (`idx/read-status.ts` · 5c) | `symbol, cadence_sec, which, source, windows, max_record_lag_sec, last_source_ts_sec, missing_void` over Windows with `trading_start_sec ≥ from` | print-source mix, relay freshness |
| `status/cross-checks` | `from` | `crossChecks` (5c) | `market, symbol, cadence_sec, which` (0/1), `primary_e8, check_e8, source_ts_sec`, where both `which` and `which + 2` exist | agreement bps |
| `proofs/:market` | — | `proofRows` (`packages/db/src/proofs.ts` · 5d) | one row per print of the Window: `idx_prints` columns, archive meta (`signers, fetched_at_ms, archived_at_ms, payload_bytes, payload_sha256`; RedStone `signer_addresses`) and `print_proofs` columns; `s-maxage=60` once verified | proof page |

## 2. Deliverables

**Units (every lane).**
- Money: bigint base units.
- Stake per fill: `lots × lot_base × price_ticks × tick_base / 10^decimals` (= `lots × ticks × cash_unit` on the launch grid; Masayume `traction.ts:80`). A NO leg prices `1000 − ticks` (`schema-index.ts:163`).
- Prints: `i64 × 10⁻⁸` (`core/market/tickers.ts:20`).
- Cross-check divergence: integer centi-bps, `|p − c| × 1,000,000 / c`, shown to 2 dp.
- Floats only for display ratios (`core/projection/edge.ts:57-60`).
- Time fields end `Ms`/`Sec` (`time-suffix`).
- No hex or px literals in web components (`design-literals`, `scripts/invariants/rules.mjs:50-55`).

### 2.1 Portfolio record (5a; L-46 Partial, L-49)
- **Prove on live wallets (§4); change only what drifts:**
  - Per round, `stakeBase` = `paid_ticklots × cash_unit + set_paid_base` and `payoutBase` = the payout legs (bond excluded; `first-call.md` §2.3), checked against `idx_positions` (`schema-index.ts:196-224`).
  - A `redeemed_by_crank` round reads "Paid automatically" (`index-api.ts:74`).
  - `complete: false` past 5,000 fills uses Masayume's partial copy (`history.ts:14-15,129`; `edge/copy.ts:35`).
- **Receipt:** `HistoryReceipt` renders 5d's `VerdictCard` (`HistoryReceipt.tsx:16-29`); its oracle row links to `/proof/<market>` (§2.6). 5a edits no verdict file.
- **Badges:** `lp_provider` stays `pending: "earn"` while no maker vault exists (`core/projection/badges.ts:43`, `RecordSection.tsx:24-26`) until S8.
- **CSV:** columns unchanged (`csv.ts:7`). Market and entry tx are base58, and the file name is `agari-history-<8>.csv` (`history/copy.ts:28`).
- **Restore:** Masayume's Restore is `PrivateClaims` inside the plate's Private row (`web/src/features/private/PrivateBalancePanel.tsx:119`). It renders only once a private desk exists (`:57-63`, S10d, L-39), so S5 leaves it as is (Q-S5-5).
- **Copy on owned surfaces:** "DreamDEX" in `edge/copy.ts:3,85`.

### 2.2 Trader Edge with ET session buckets (5a; L-47)
- **Masayume** buckets by browser-local hour of the settle time (`edge.ts:46-51,62-64,92-98`; copy "browser's local time", `edge/copy.ts:62`).
- **Agari** buckets by the Window's close boundary in ET: `m = etMinutesOf(expirySec − 1)` (`core/market/et-time.ts:94`). The settle time is not used, because it lands 5–17 s after the boundary (up to 2 min with a cross-check) and would move a 16:00 close out of the session.

| `key` | Label · range | `m` |
|---|---|---|
| `open` | Opening hour · 09:30–10:30 ET | 570 ≤ m < 630 |
| `morning` | Late morning · 10:30–12:00 ET | 630 ≤ m < 720 |
| `midday` | Midday · 12:00–15:00 ET | 720 ≤ m < 900 |
| `close` | Power hour · 15:00–16:00 ET | 900 ≤ m < 960 |

- **Code:**
  - `EdgeWindow` becomes `{ key, fromMin, toMin, count, wins, netBase }`.
  - The signature is `computeTraderEdge(rounds, openRounds, bucketOf = etSessionBucket)`, where `bucketOf(round) → key | null`; null means outside the session, which is S6's Gap/token lanes.
  - Four rows keep `EdgeWindows.tsx:24-50` unchanged. Only its labels and the section copy change ("grouped by the ET session hour each Window closed in").
- **Tests:** targeted vitest in `edge.test.ts`: 10:30:00 close → `open`, 16:00 close → `close`, early close 13:00 → `midday`, and one EST and one EDT date.

### 2.3 Leaderboard, traction, `/stats` (5b; L-15, L-48)
- **Masayume's scan is N+1:**
  - fill pages per pool, then router pages per wallet (Masayume `scan.ts:57-80`, `board.ts:50-59`);
  - a 24 h window with 48 h lookback (`web/src/features/leaderboard/board.server.ts:14-17`), cached 180 s (`:70`).
- **`readVenueBoard` (`tape.ts`, exported shapes unchanged, `tape.ts:12-67`) does exactly three paged scans:**
  1. `tape/markets`;
  2. `tape/fills` (1,000 × ≤ 10 pages);
  3. `tape/actions`.
- **Then, in memory:**
  - `participants` = distinct `taker`/`maker`; `toLedgerFill` per wallet (the rule in `history.ts:44-55`);
  - `buildLedgers` → `settleRound({ feeBps: 0, liveHoldings: null })` → `rankTraders` (`core/projection/leaderboard.ts:57-69`);
  - traction ported from Masayume `traction.ts:62-151` onto `FillRow`: taker = `fill.taker`, side = `taker_kind`, one call per `signature:taker`.
- **Request limits:** no request per wallet, Book or Window. `complete` = no page cap hit.
- **Additive `VenueBoard.byTicker: Partial<Record<TickerSymbol, BoardSlice>>`:**
  - `BoardSlice` = `{ rankings, rankedTraders, totalWallets, closedCalls, totalVolumeBase }`;
  - computed in the same pass by filtering rounds on `asset`.
- **Periods:**
  - `24h` is Masayume's.
  - `session` is `[openSec, closeSec + 900)` of the latest session with `openSec ≤ now`, from ops `/session` `calendar.recent`. Lookback = `openSec − 3,600` (the longest cadence). Before today's open it is the previous session, labelled with its date (Q-S5-4).
- **Route:** `GET /api/leaderboard?period=24h|session&ticker=<SYM>`.
  - `readBoard(period)`: `unstable_cache(…, ["agari-venue-board-v4", cluster, venueId, indexerUrl, period], { revalidate: 180 })`, one in-flight compute per period.
  - The route slices `ticker` from the cached payload.
  - Wire meta adds `period: "24h" | "session"`, `ticker: TickerSymbol | null`, `session: { date, openSec, closeSec } | null` (`leaderboard/protocol.ts:17-35`).
  - `/api/traction` is unchanged over the 24 h board (`app/api/traction/route.ts`).
- **UI:**
  - The filter bar's static spans (`LeaderboardBoard.tsx:74-78`) become 4d's `TickerPicker` (`web/src/features/markets/lanes/TickerPicker.tsx:22-48`, the same `.asset-tabs/.asset-tab`), plus period tabs "This session" / "Last 24 hours".
  - Client key `[...LEADERBOARD_KEY, period, ticker]`.
  - Copy truthing: `leaderboard/copy.ts:5-7,31` "DreamDEX", `stats/copy.ts:8,40` "DreamDEX"/"Somnia".
- **Operator wallets:** role keys (seed maker, settler) are excluded from rankings and traction through the server-only `AGARI_OPERATOR_WALLETS` (Q-S5-2).
- **Data density:** `scripts/drive/traders.ts` (Q-S5-3) places IOC fills from test keypairs through 4b's lane, reusing `scripts/drive/first-call-kit.ts`.

### 2.4 `scripts/drive/recount.ts` (5b)
`pnpm drive:recount --web <base> [--period 24h|session] [--source chain|events] [--rps 3]`:
1. **Payloads:** GET `/api/leaderboard` for `all` and each ticker, and `/api/traction`. The window comes from their `meta`, so both sides count the same `[windowStartMs, windowEndMs)`.
2. **Chain source (default):** `walkSignatures(program, { stopBelowSlot })` from the slot at `lookbackSec`, then `decodeTransactionEvents` (the pattern in `services/ops/src/actors/indexer/verify.ts:28-40`). Series grids come from one `getMultipleAccounts`.
   - At 3 RPS over ≈ 4k txs/session this takes ≈ 25 min on the shared Helius budget (D-030).
   - `--source events` replays `idx_events` instead (fast, but not independent of ingestion).
3. **Replay:** independent of `provider/**`. It shares only core's settlement rule (`buildLedgers`, `settleRound`, `rankTraders`), with its own row mapping and attribution.
4. **Compare, exact integers:**
   - traction `wallets, calls, cashOuts, stakedBase, windows, settledWindows`;
   - every ranking's `owner, pnlBase, volumeBase, tradeCount, settledTrades, winRatePct, bestStreak, roiBps`;
   - `complete` must be true;
   - it prints the diff and exits 1 on any mismatch.

### 2.5 `/status` probes (5c; L-16)
- **Structure (Masayume, unchanged):** banner, pipeline table, 30 s poll, request-time probes, no cache (`app/api/status/route.ts:6-15`, `StatusRows.tsx`, `useStatus.ts:8-21`). Healthy = every required row ok and max lag < 120 s (`protocol.ts:39`).
- **Additive:** `StatusPipeline.expected: boolean`.
  - When ops `/session` `status.state` ∉ {`regular`, `early-close`}, session-bound rows answer `ok: true, lagSec: null, expected: true`: tone `off` and chip "closed (expected) · Opens 09:30 ET".
  - `overallOf` skips expected rows (`route.ts:17-22`).
- **One run:** ops `/health` and `/session` are fetched once per run and shared by rows; DB queries run in parallel; the route stays ≤ 30 s (`route.ts:15`).

| Row (`id`) | Source | Good / warn / bad (in session) | Off-hours |
|---|---|---|---|
| `rpc` Solana RPC · chain head | `syncClock` (`probes.server.ts:39-55`) | lag < 60 / < 300 / else (`protocol.ts:41-42`) | same |
| `slot-lag` Indexer · slots behind head | RPC slot − `status().last_slot` | ≤ 50 / ≤ 300 / else | expected |
| `indexer` Indexer · live lag | `/health` indexer `lastLagSec, subscription, gapsOpen, failures` (`actors/indexer/index.ts:70-89`) | < 10 s (S3 gate) / < 60 s / ≥ 60 s, `gapsOpen > 0`, `failures ≥ 3` | subscription not live → expected; walk failures stay bad |
| `relay:pyth`, `relay:redstone` Price relay · freshness | `status/prints` (last boundary ≤ now − 330 fully recorded, `max_record_lag_sec`) + `/health` price-relay `missed, failed` (`services/ops/src/actors/price-relay/relay-pass.ts:161`) | record lag ≤ 30 s / ≤ 120 s / a missed slot or missing-print void since open | expected |
| `mix:5m`, `mix:15m`, `mix:60m` Print sources | `status/prints` | detail "Pyth 3 · RedStone 6"; bad on a `missing_void` | last session's mix, expected |
| `pyth-trial` Pyth trial · sessions left | `/session` `sources.pythTrialLastCloseSec` (from `price-sources.json:27-29`) + `calendar.upcoming` | > 3 / 1–3 / — ; after 09-25 20:00Z: ok "ended: TSLA on RedStone, QQQ/VOO paused" | same |
| `redstone` RedStone gateway · latency, signers | `printArchiveStats(openSec)` `maxFetchLagMs, minSigners, lateCount` + `/health` spot-feed `failures, lastWhy` (`services/ops/src/prices/spot-feed.ts:83-102`) | ≤ 20 s and 5 signers / ≤ 60 s or ≥ 3 / `lateCount > 0` or < 3 | archive expected; spot failures shown |
| `switchboard` Switchboard · quote success | — | optional, `configured: false` "arrives with the token lane (S6)" | same |
| `cross-check` TSLA cross-check agreement | `status/cross-checks` | max ≤ 10 bps / ≤ 25 bps (`price-sources.json:12`) / > 25 or a divergence void; none → "single source" | expected |
| `paused` Lanes · paused | `/session` `lanes` prefixed `paused:` / `waiting:` | `paused: no signed source` is ok (honest); `waiting:` warn | `closed: no session` expected |
| `faucet` Faucet budget · SOL and tUSDC | `createFaucetService(chain).status(null)` (`app/api/faucet/route.ts:22-24`) | both ready / below reserve + one day's budget / not ready | same |
| `sponsor` Sponsor budget | `/api/sponsor` (`configured: false`) | optional, "arrives in S7" | same |
| `store` Database | `probeStore` (`probes.server.ts:97-108`), **required** (the index lives there) | answered / — / down | same |
| `ops:<actor>` × 6 (roller, relay, settler, seed-maker, indexer, price-archive) | `/health` heartbeat (`services/ops/src/http/health.ts:8-12`) | `failures < 3` and `lastOkMs ≤ max(5 min, 3 × everyMs)`; lag = now − `lastOkMs` | seed-maker "session closed" expected; others must beat |
| `price:<asset>` (≤ 4) | `probePrice` (`probes.server.ts:81-95`) | < 60 / < 300 / else | expected |
| `sensei` | `probeSensei` (`:111-120`) | optional | same |

### 2.6 Pyth trial proof replay (5d; additive)
- **Scope:** prints with `source = 1` (Pyth): TSLA/QQQ/VOO v1 through 2026-09-25 20:00Z (`price-sources.json:27-29`). No Market is opened or touched on a past T.
- **Flow** (`replayPythProof({ market, which })` in the new server-only `@agari/markets/proof`, not re-exported from the root; bundle rule `first-call.md` §1):
  1. **Print:** the `idx_prints` row (`market, which, source, price, source_ts_sec = T, signature`; `schema-index.ts:114-126`).
  2. **Blob:** `archivedPrint("pyth", feedHex, T)`, where `feedHex` = `TICKERS[symbol].pythFeedId` without `0x` (`core/market/tickers.ts:41`). The payload is Hermes' exact JSON; `binary.data[0]` is the accumulator update for all three trial feeds (`schema-prints.ts:15-16`). Before any send, check the parsed `publish_time == T` and `price × 10^(8+expo) == print`. A mismatch refuses with nothing sent.
  3. **Post:** `postPythUpdates({ rpcUrl, payerSecret, updatesBase64: [data] })` (`prices/legacy/pyth-post.ts:103-118`): encoded VAA verify, `post_update` per feed to `rec5EK…` (`:131`), VAA closed in the same flow (`:108-112`).
  4. **Read back:** `getAccountInfo` → new `decodePriceUpdateV2`: disc 8 · `write_authority` 32 · `verification_level` (0 Partial + u8 / 1 Full) · `feed_id` 32 · price i64 · conf u64 · exponent i32 · `publish_time` i64 · `prev_publish_time` i64 · ema price i64 · ema conf u64 · `posted_slot` u64. A vitest checks it against `anchor/tests/vectors/prints/pyth-tsla-1789156800.account.b64` + `.json`.
  5. **Verify (integers):**
     - owner `rec5EK…`, level Full, `feed_id` matches, `publish_time == T`;
     - `price × 10^(8 + exponent) ==` the recorded print (TSLA expo −5 → × 1,000; D-021: 36,547,600 → 36,547,600,000).
  6. **Persist and close:** write a `print_proofs` row per feed (§4 DDL). Keep the accounts open 24 h, then `closePythUpdates` (`pyth-post.ts:121-128`) through `proof-replay.ts --close-older-than 86400` (Q-S5-7). After the close, the page still shows the stored decode and the post signatures.
- **Payer:** the new create-once role `proof-replay`, never `price-relay`. The relay's hourly sweep closes every `PriceUpdateV2` whose write authority is its key (`ops/prints/leftovers.ts:12-24`, `actors/price-relay/index.ts:64-71`). Key from `PROOF_REPLAY_PRIVATE_KEY`, else `~/.config/agari/devnet/proof-replay.json` (D-034 pattern).
- **Server:**
  - **Script:** `scripts/drive/proof-replay.ts [--market <id> --which 1 | --symbol TSLA --at <ISO> | --session <date>]`, for batches and gate evidence.
  - **Route:** `POST /api/proof/pyth { market, which }` (`runtime = "nodejs"`, lazy `await import("@agari/markets/proof")` so web3.js 1 loads only there; Q-S5-1).
  - **Idempotent:** `INSERT … ON CONFLICT (feed, boundary_sec) DO NOTHING` claims `state = 'posting'`, and later callers poll that row; one post serves all three feeds at T.
  - **Quotas:** only a T that recorded a print; ≤ 20 posts/h globally and ≤ 3/h per IP; refused below 0.02 SOL payer balance.
  - If `pnpm build` breaks on the legacy SDK, the stage owner adds `serverExternalPackages` in `web/next.config.ts`. Failing that, the route answers 503 and replays are script-only.
- **Client:** `/proof/[market]` (`web/src/app/proof/[market]/page.tsx`, `web/src/features/proof/**`), built only from Masayume parts: `components/receipt` `Receipt`/`ReceiptRow` (as `MarketProofRows.tsx:8,33-39`), `SectionHeader`, and the status table's row styles. Per print:
  - **Every print:** source · `usdLine` price · ET boundary · record tx.
  - **Archive:** fetch lag, bytes, sha256.
  - **Pyth:** "Re-verify on devnet" (POST, then poll `proofs/:market` every 3 s), the `PriceUpdateV2` address link, Full, `price × 10^expo`, conf, `publish_time`, post signatures, and "matches the settled print exactly" or the integer diff.
  - **RedStone:** the archived signer addresses and timestamp (verified in-program at record, `prints.md` §4.2; no replay).
  - **Attested:** "demo data".
  - **Cross-check:** bps or "single source".
  - **Entry points:** the receipt's oracle row (`MarketProofRows.tsx:36` `href={null}`) and the verdict card.
- **SOL (devnet, `getMinimumBalanceForRentExemption`, 2026-09-15):**

  | Item | Lamports | Comes back |
  |---|---|---|
  | `PriceUpdateV2` 134 B | 1,330,960 each; 3,992,880 for the three feeds at one T | at close |
  | Encoded VAA ≈ 1.2 KB | ≈ 6,746,240 | in the same flow |
  | Fees: verify + post txs, one close tx (`acceptance.md:39-40,66`) at 5,000 per signature | ≤ 50,000 per T | no |

  `proof-replay` float: 0.1 SOL (≈ 20 T open at once plus ≈ 400 T of fees).
- **Risk:** a Wormhole guardian-set rotation makes VAAs signed by the old set fail once that set expires.

### 2.7 `/surface` on the Book decode (5d; L-40)
- **Already wired** to S4's decode (`first-call.md` §2.1). S5 proves it in session: TSLA-5m and a RedStone name.
  - **Tiles, depth, slippage, term:** checked against the maker's `fair ± 30` quotes (`venue-ops.md` §8.2).
  - **Crossed book:** the honest state.
  - **Chips:** the 9 asset chips (`SurfaceChips.tsx:28-34`) and ≤ 3 cadence chips per asset.
- **Closed session:** the empty boundary (`SurfaceScreen.tsx:59`) keeps the page chrome and says the session label ("Opens 09:30 ET") from `useMarketSession` (`web/src/features/markets/session/useMarketSession.ts:71`).
- **Copy:** "DreamDEX" in `surface/copy.ts:5` and the intro.
- **Units:** `bps = ticks × 10`; sizes are `lots × lot_base`; prices go through `oraclePriceText`/`usdLine`.

### 2.8 Earned Heat (5d; L-22)
- **Card:** ported as is (`web/src/features/share/trade-card.ts:9-24`).
- **`TradeCard` adds `printSource`, `singleSource`, `voidReason`,** filled by `toTradeCard` (`web/src/features/markets/verdict/VerdictCard.tsx:39-57`) from `Resolution`.
- **Kind lines** (`trade-card.ts:79-84`, `share/copy.ts:62-63`):
  - settled: "PYTH PRINT $358.98 AT 16:00:00 ET", "REDSTONE PRINT … · 5 SIGNERS", plus " · SINGLE SOURCE";
  - void: "VOID · MISSING PRINT" / "VOID · CROSS-CHECK DIVERGENCE".
- **Honesty rules and the one-spark rule** stay.
- **Fixtures:** one `/dev/share` fixture per outcome × source.

## 3. Performance (Masayume's caching, D-036)

| Read | Client (TanStack) | Server |
|---|---|---|
| Leaderboard | `[...LEADERBOARD_KEY, period, ticker]`; `staleTime` = poll 120 s, 10 s until the first data, no background refetch (`useLeaderboard.ts:8-21`) | `unstable_cache` 180 s per period, single in-flight, 3 paged index scans |
| Traction / `/stats` | `TRACTION_KEY`, 30 s (`useTraction.ts:8-20`) | the same cached 24 h board (Masayume `traction/route.ts:6-9`) |
| History, Edge, badges, CSV | `keys.history(wallet)`, 300 s (`packages/markets/src/react/keys.ts:28`, `core/constants/timing.ts:19`), deferred tier (`PortfolioScreen.tsx:57-60`); Edge/badges in `useMemo` | `wallet/*` `private, no-store`; ids chunked 200 (`history.ts:69-74`) |
| Status | `STATUS_KEY`, 30 s, hidden tab idle | no cache (Masayume); concurrent requests share one run |
| Proof | `["agari","markets","proof",market]`; `staleTime: Infinity` once verified; 3 s poll while `posting` | `proofs/:market` `s-maxage=60`; the replay route never caches |
| Surface, share | coordinator Book sockets and the shared spot SSE; no new polls | — |

**Rules:**
- No server scan issues a request per wallet, Book or Window.
- Every new SQL predicate is index-backed (`idx_fills_ts_idx`, `idx_markets_expiry_idx` `schema-index.ts:110`, `idx_events_name_idx`, `print_archive_boundary_idx` `schema-prints.ts:27`).
- Bigints cross the wire as strings (`leaderboard/protocol.ts:5`).
- Masayume's query client, persisted cache and single lazy chart stay byte-identical.

## 4. Lanes

| Lane | Branch · worktree · port | Owns (disjoint) | Proves itself on live devnet data |
|---|---|---|---|
| **5a** record + edge | `slice/S5a-record-edge` · `../agari-wt/s5a` · web 3051 | `packages/core/src/projection/{edge,edge.test}.ts`; `web/src/features/edge/**`; `web/src/features/markets/{portfolio,balance,history}/**`; `web/src/app/portfolio/**`; `web/src/app/dev/history/**`; `packages/markets/src/provider/history.ts` (fixes only) | Node run of `listWalletHistory` for the S2/S4 drive wallets and the traders-drive keypairs: rounds equal the `idx_positions` sums, ET buckets, CSV = rows. Browser `/portfolio` + `/portfolio/edge` with 4e's injected Wallet Standard test wallet seeded from a drive keypair (DevTools only, never committed) |
| **5b** board + stats | `slice/S5b-board-stats` · `../agari-wt/s5b` · web 3052 | `packages/markets/src/provider/tape*.ts`; `packages/db/src/idx/read-tape.ts`; `web/src/app/api/index/[...path]/queries-tape.ts`; `web/src/features/{leaderboard,stats}/**`; `web/src/app/{leaderboard,stats}/**`; `web/src/app/api/{leaderboard,traction}/**`; `web/src/app/dev/{leaderboard,stats}/**`; `scripts/drive/{recount,traders}.ts`, `scripts/drive/recount/**` | Off-hours: the 09-14 session (337 Windows, 4 fills) through `tape/*` with `--source events` recount. In session: the traders drive, then `recount --source chain` for `24h` and `session` |
| **5c** status | `slice/S5c-status` · `../agari-wt/s5c` · web 3053 | `web/src/features/status/**`; `web/src/app/{status,api/status}/**`; `packages/db/src/idx/read-status.ts`; `web/src/app/api/index/[...path]/queries-status.ts`; `web/src/app/dev/status/**` | `/api/status` JSON + page off-hours now (every session row expected, none red), then at 13:30Z (green), and with one actor stopped on a local ops copy to see a red row |
| **5d** surface + share + proof | `slice/S5d-surface-proof` · `../agari-wt/s5d` · web 3054 · Surfpool 8980/8981 | `web/src/features/{surface,share,proof}/**`; `web/src/app/{surface,proof}/**`; `web/src/app/api/proof/**`; `web/src/app/dev/{surface,share,proof}/**`; `web/src/features/markets/verdict/{VerdictCard,print-source}.ts(x)`; `web/src/features/markets/claims/MarketProofRows.tsx`; `packages/markets/src/proof/**`, `packages/markets/src/provider/proof.ts`; `packages/db/src/proofs.ts`; `web/src/app/api/index/[...path]/queries-proof.ts`; `scripts/drive/proof-replay.ts` | Surfpool devnet fork replay of an archived 09-14 TSLA close (D-021 pattern), then one devnet replay each for TSLA and QQQ or VOO. `/surface` in session against the maker quotes; share PNGs per outcome |

**Frozen at foundation (cross-lane):**
1. The §1 index paths, their queries and row shapes.
2. The ops `/session` additions:
   - `calendar.recent: TradingSession[]`: the last 5 sessions with `openSec ≤ now`;
   - `sources: { pythTrialLastCloseSec: number | null }`.
3. The `print_proofs` DDL:
   - key `(feed, boundary_sec)`;
   - columns `symbol, source, state ('posting'|'verified'|'failed'|'closed')`, `receiver, price_update, verification, price NUMERIC, conf NUMERIC, expo INT, publish_time_sec, prev_publish_time_sec, posted_slot BIGINT, post_signatures TEXT[], close_signature, payer, error, posted_at_ms, closed_at_ms`.
4. The route path `/proof/<market>` (`PROOF_PATH` in `web/src/lib/routes.ts`).
5. `VenueBoard.byTicker` and the leaderboard wire `meta` (§2.3).

5a reaches the proof page only through 5d's `VerdictCard`. Merge order: 5c → 5a → 5b → 5d.

**Stage owner only:**
- **Manifests and exports:** every `package.json` (subpath `./proof`, `@agari/db` for `@agari/scripts`, root `drive:recount`/`drive:proof-replay`/`drive:traders`) and `pnpm-lock.yaml`.
- **Shared code:**
  - `packages/core/src/ports/**` and core barrels;
  - `packages/markets/src/{env,index}.ts`, `packages/markets/src/provider/index.ts`;
  - `packages/db/src/{index,index-store,schema,migrate}.ts`, `schema-proofs.ts`, `idx/read.ts`;
  - `web/src/app/api/index/[...path]/{route,queries}.ts`.
- **Web shell and config:** `web/src/providers/**`, `web/src/lib/{env,routes,copy}.ts`, `web/next.config.ts`, `web/src/app/dev/page.tsx`.
- **Other:** env files, `services/ops/**`, `scripts/invariants/**`, `scripts/deploy/**`, `docs/plan/**`, role keys.

Lanes request shared changes in their report. Other `core/projection` files are read-only for every lane.

## 5. Open questions (recommended defaults)

| Q | Question | Recommended default |
|---|---|---|
| Q-S5-1 | Proof replay trigger: a one-click browser button (the server signs as `proof-replay`, ≤ 50,000 lamports fees per T plus refundable rent) or script-only? | Both, with §2.6 idempotency and quotas. The route ships only if `pnpm build` stays green |
| Q-S5-2 | Venue operator wallets (seed maker, settler crank) on the leaderboard and in traction? | Excluded via server-only `AGARI_OPERATOR_WALLETS`; drive and test wallets count (their fills are real and signed); `recount.ts` applies the same list |
| Q-S5-3 | Populate the board with a traders drive (3 test keypairs, one IOC per wallet per TSLA/NVDA 5m Window for ≈ 1 session hour; ≈ 0.01 SOL fees, faucet tUSDC)? | Yes, on 09-16 13:30Z; wallets and signatures go into `acceptance.md` |
| Q-S5-4 | "This session" before today's open? | The previous session, labelled with its ET date; `[open, close + 15 min)` |
| Q-S5-5 | Restore (Masayume's private-claims backup) needs the S10d desk | Unchanged in S5; L-46 stays Partial (owner S7) |
| Q-S5-6 | Trader Edge ET buckets and labels | The four buckets in §2.2 |
| Q-S5-7 | Close replayed `PriceUpdateV2` accounts at once, or keep them viewable? | Keep 24 h, then close (snapshot + signatures stay on the page) |
