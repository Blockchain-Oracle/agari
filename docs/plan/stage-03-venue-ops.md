# S3 — Venue operations: calendar, roller, prices, settler, indexer, seed maker

**Goal:** devnet runs unattended through a full NYSE session. Windows roll per calendar, prints post, Windows settle or void, projections fill, and books have quotes. Plan: `00-plan.md` §7.2 S3, §2.2, §4. Contract: `docs/plan/specs/venue-ops.md`.

**Branch:** `stage/S3-venue-ops` in worktree `../agari-wt/s3`, cut from `stage/S2-events-engine` plus S1's STATUS (D-028). Lanes `slice/S3{a,b,c,d}-*` in `../agari-wt/s3{a,b,c,d}` merge into the stage branch. Nothing merges to `main` before S1's Phantom check.

**D-number range:** D-028…D-039.

## Steps

- [x] Foundation: `venue-ops.md` contract; `@agari/markets/ops` (client, send + engine codes, venue reads) with lane subpaths `ops/*`; ops runtime (env, role keys, actor loop, heartbeats, `VenueDeps`); calendar service (Alpaca ∩ Pyth schedule, live-checked); `print_archive` schema; lane-owned placeholders (D-028)
- [x] Calendar service (foundation) + roller plan, versions, recycle and grow (lane 3a, merged 2026-09-14)
- [x] Policy versions and Series: `init-series` for 9 tickers × Regular 5/15/60 with rent accounting, `fund-roles` (lane 3a; the devnet run needs SOL, see Handoff)
- [x] Roller (highest covering version; "paused: no signed source" when none) (lane 3a)
- [x] Pyth trial relay (TSLA/QQQ/VOO) + close update accounts; take over the S0 blob archive (lane 3b)
- [x] RedStone relay: all 5 signer packages at T + 10–15 s with retries; archive to `print_archive`; single names + TSLA check prints (lane 3b)
- [x] Attested relay (opt-in only; off by default) (lane 3b; typechecked only, no attested primary is listed)
- [x] Spot feed + `/health` + `/prices/stream` SSE (lane 3b)
- [x] Settler (retries `CrossCheckPending` until the check bound; redeem_for, close ledger, close market) (lane 3c)
- [x] Seed maker, `MAKER_MODE=seat` (lane 3c; real `SpotFeed` hookup at the main.ts step)
- [x] Indexer + backfill + `verify-index` (lane 3d)
- [x] Register actors in `main.ts` (DRY_RUN default) + heartbeats (stage owner; smoke on a Surfpool fork with every actor live, D-029)
- [x] Register series on devnet + rent accounting (stage owner; needs SOL)
- [x] One-session soak (stage owner)

## Gate

**S3 gate not passed (evidence run 2026-09-15 22:30Z–23:30Z).** Three items fail:

1. RedStone archive within 60 s: 322 of 553 rows. Every row was archived, but 33 of 79 boundaries were backfilled late during outages.
2. Indexer lag < 10 s: max 26.5 s, with 3 of 475 samples at 10 s or more.
3. Soak coverage: 548 of 990 grid Windows were opened. A reboot and a DNS outage cut the session. An actor that fails to start does not exit ops, so the roller stayed down 18:47–20:25Z.

Everything else passes, `verify-index` included. To close the gate, re-measure items 1 and 2 over a clean 09-16 session (13:30–20:00Z). A failed actor start should exit ops so the supervisor restarts it.

Sources: S3 soak log `data/soak/ops-2026-09-14.log` (09-15 13:30–14:00:23Z), S6 soak log `../agari-wt/s6/data/soak/ops-2026-09-15.log` (15:19:03Z on), the local Postgres `print_archive`/`idx_*` tables, and read-only devnet RPC. Scripts ran from integration/w1 @ f146bcd. No transaction was sent.

- `pnpm typecheck && pnpm invariants` ✅ on stage/S3-venue-ops @ 26a7f00 (10 rules, 0 errors).
- **Soak:** N Windows with no overlaps, all resolved or voided within their windows; indexer lag < 10 s; `verify-index.ts` fill counts match chain.
  - **No overlaps ✅.** The roller logged 548 session Windows with starts from 13:30 to before 20:00Z across 27 Series: 364 × 5m, 148 × 15m, 36 × 60m. It showed 0 overlapping spans and #N strictly increasing per Series. The chain (`idx_markets`, basis 0) holds 551. The extra 3 are TSLA-15m #17, TSLA-5m #52 and VOO-5m #46, which logged `open … failed` but landed.
  - **Grid coverage ❌ (goal, not a gate line).** 442 grid slots were never opened: 338 × 5m, 86 × 15m, 18 × 60m. The gaps are:
    - the reboot, 5m 14:05–15:15Z;
    - connect timeouts at 16:20Z and 16:45–16:50Z;
    - the stuck pass before the 17:17Z restart, 17:05–17:10Z;
    - the DNS outage and the roller not running, 18:30Z and 18:40–19:55Z.
  - **All resolved or voided ✅ (with late resolutions).** All 551 chain Windows are terminal: 481 resolved (12 single-source) and 70 voided. All 70 voids are MissingPrint (log: 30 no open print, 40 no close print), and none is CrossCheckDivergence. The Ledger is closed on 551/551 and none is still open.
    - The settler logged 476 settle and 70 void lines.
    - NVDA-5m #45 and QQQ-5m #44 logged only a failed settle send (WebSocket). The chain shows both resolved at 16:28/16:29Z.
    - Resolution after expiry: p50 110 s, p90 1,350 s, max 4,995 s (Windows that expired during the reboot gap). 16 settles landed after the 900 s close deadline, all during the outages.
  - **Indexer lag < 10 s ❌.** The indexer's own `lag X s` over 13:30–20:00Z (both logs, 475 samples): p50 1.5 s, p95 3.5 s, max 26.5 s. Samples of 10 s or more: 10.4 s and 13.4 s at 15:27Z (after the 15:19Z boot) and 26.5 s at 17:28:38Z (during WebSocket connect failures).
  - **`verify-index` fill counts match chain ✅.** `pnpm drive:verify-index --cluster devnet` (w1, Helius, 3 RPS, from deploy slot 498252588):
    - `verify-index: OK — counts match`, 0 mismatches, `marketsWithGaps 0`, `duplicateEvents 0`.
    - `txs 10607 / 10607`, `windowsOpened 942 / 942`, `windowsResolved 912 / 912`, `event:PrintRecorded 1846 / 1846`, `event:OrderExecuted 2731 / 2731`, `event:Redeemed 271 / 271`, `fills 4 / 4`, `failedTxs 16 / 16`, `unavailableTxs 0`.
    - `head slot 498983216; index behind chain head by 0 slot(s)`. The walk took ≈ 70 min for 10,607 signatures at 3 RPS while the soak's indexer kept writing.
- **Prints:**
  - **Every Window's source matches `price-sources.json` ✅.** Roller open lines, per ticker, over all 548: TSLA `v1 pyth+redstone`; QQQ, VOO `v1 pyth`; NVDA, AAPL, MSFT, META, AMZN, GOOGL `v1 redstone`. That is config v1 for every ticker on 09-15. Chain `idx_prints` agrees: TSLA open/close are Pyth with RedStone checks, QQQ/VOO are Pyth, and the six single names are RedStone.
  - **100% of RedStone boundaries fetched and archived within 60 s ❌.** `print_archive`, source redstone, boundaries 13:30–20:00Z: 79 boundaries × 7 feeds = 553 expected, 553 archived, 0 missing.
    - On time (archive minus boundary ≤ 60 s): 322 rows (46 boundaries), p50 13.9 s.
    - Late: 33 boundaries, 87–4,451 s, backfilled after outages. Late boundaries were 14:05–15:15, 16:20–16:25, 16:40–16:50, 17:05–17:15 and 18:30–19:15Z. `fetched_at_ms` equals `archived_at_ms` there.
    - At 13:30Z the gateway returned AMZN and MSFT with 2 signers and GOOGL and META with 4. Every other row has 5.
  - **TSLA cross-check agreement recorded ✅.** Neither the relay nor the settler logs the bps, so it was computed in integers from the recorded prints.
    - On chain, `idx_prints` Pyth vs RedStone check per TSLA Window: 90 pairs (50 open, 40 close), p50 0.72, p95 1.36, max 3.03 bps. None is over the 25 bps limit.
    - Archive, 79 boundaries: p50 0.79, p95 1.63, max 3.09 bps.
    - Outcomes: 37 TSLA Windows settled with both checks, 12 single-source (check past its bound), 4 voided (missing close), 0 CrossCheckDivergence.
  - **Zero leftover `PriceUpdateV2` accounts ✅.** `getProgramAccounts` on `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ` (devnet, read-only) with memcmp offset 8 = relay `EaPNxuuZ1Tnnuqe6ZyLCsS2nGDWzTnwyLDaKSpGe2AwZ` returned 0 accounts at slot 498,983,741. The write authority sits right after the 8-byte discriminator (`packages/markets/src/ops/prints/leftovers.ts`).
- **Post-trial dry run ✅.** `pnpm drive:roller-plan --at 2026-09-26T14:00:00Z --cluster devnet` (w1, exit 0). Saturday is `session closed`, so the plan is the 09-28 prelist:
  - `TSLA-5m registered would prelist #65 13:30–13:35Z v2 redstone` (TSLA-15m #22 and TSLA-60m #7 also `v2 redstone`)
  - `QQQ-5m registered paused: no signed source (13:30–13:35Z)`, likewise QQQ-15m/60m
  - `VOO-5m registered paused: no signed source (13:30–13:35Z)`, likewise VOO-15m/60m
  - The Gap lanes agree: `TSLA-gap … v2 redstone`, and QQQ-gap/VOO-gap `paused: no signed source`.
- **Off-hours:** no Regular Windows listed. ✅ 09-14 20:00Z
- **Stage-owner boxes (ticked 2026-09-15):**
  - **Register series on devnet + rent accounting.** acceptance.md 2026-09-14 16:34–16:42:
    - `pnpm deploy:init-series --cluster devnet` registered 25 Series + 50 Books, which with the S2 TSLA/NVDA 5m pair makes 27 Regular Series and 54 Books.
    - It spent 13.569386280 SOL exactly as planned: Book rent 0.290047680 SOL at 512 nodes and 0.227624640 SOL at 256; deployer 23.891461686 → 10.322075406 SOL.
    - The last re-run verified all 27 Series and spent 0. `fund-roles` 16:50 moved 7 SOL (roller 4, settler 2.5, relay 0.3, maker 0.2) and 2,000 tUSDC.
  - **One-session soak.** Two runs:
    - 09-14 19:19–20:12Z: 81 opened, 230 prints, 0 missed, 115 settled, 117 Ledgers closed, no restarts (Findings).
    - 09-15 session 13:30–20:00Z: the S3 soak ran 13:30–14:00:23Z. The machine rebooted ≈ 14:27Z (s18 STATUS), and the S6 soak (`../agari-wt/s6/data/soak/run.sh`, same actors) ran from 15:19:03Z. Totals: 548 opened (551 on chain), 476 settle + 70 void lines, 115 relay `missed` lines (66 close, 30 open, 14 checkClose, 5 checkOpen).
    - The misses cluster on the reboot (T 14:00–15:00Z, logged at the 15:19Z boot), the connect timeouts (16:15–17:15Z) and the DNS outage (T 18:30–19:00Z).
    - Watchdog exits (`pass stuck over 10 min`) at 17:16:59Z (settler), 18:36:09Z (seed-maker, settler) and 19:04:15Z (settler); the supervisor restarted each.
    - `window-roller failed to start: fetch failed ← getaddrinfo ENOTFOUND devnet.helius-rpc.com` at 18:47:17Z and 19:09:12Z, while the ops process stayed up. Ops restarted 20:25:22Z, the roller started 20:25:26Z, and the 09-16 prelist followed at 20:26:41Z (acceptance.md S18 row).

## Findings

- **Foundation (2026-09-14):**
  - Hermes `/v2/price_feeds` metadata (including `schedule`) is public; only price updates need the trial key. Alpaca `ALPACA_ENDPOINT` already ends in `/v2`.
  - The first live refresh agreed on 2026-09-07..09-28 with no disputed dates (11 sessions ahead).
  - Role keys `roller`, `price-relay`, `settler`, `maker`, `price-attestor` and `faucet-mint-authority` exist in `~/.config/agari/devnet/` and hold 0 SOL. The deployer holds 4.48 SOL.
- **Lane 3a (roller, merged from `slice/S3a-roller` @ 1fb8514), proven on a Surfpool devnet fork during the 09-14 session:**
  - **Rolling:** TSLA-5m #1–#5 ran back-to-back 15:55→16:20Z, alternating two Books. Each Book was released 1–4 s after its lock, including an order swept at lock. TSLA-15m #0–#2 and AAPL-5m #0–#4 rolled the same way.
  - **Restarts and dry runs:** a restart resumed from chain state without duplicate opens, and DRY_RUN signed nothing.
  - **CU:** open 35,922 · sweep 6,915 · release 5,501. `public_grow_ledger` took a Ledger from 96 to 192 seats (builder called directly; the live 8-seat trigger needs about 88 users).
  - **init-series** planned 2.415640440 SOL on the fork for 3 Series + 6 Books and spent exactly that; a re-run was a no-op with drift checks.
  - **Devnet dry runs:** 25 Series + 50 Books = **13.569386280 SOL**; `fund-roles` = **7 SOL**.
  - **Post-trial plan** (`pnpm drive:roller-plan --at 2026-09-28T14:00:00Z`): TSLA on v2 RedStone, QQQ/VOO `paused: no signed source`, Saturday `closed: no session`.
  - **Surfpool rent:** Surfpool charges mainnet rent (512-node Book 0.397 SOL against 0.290 on devnet), so fork spend overstates devnet.
  - **Codama names vs `time-suffix`:** Codama argument names like `tradingStart:` trip the rule; pass them as shorthand locals.
  - **Late opens:** with the 60 s minimum tradable time, a restarted roller opens a Window already under way (TSLA-15m 15:45–16:00Z at 15:55). This is spec-conformant, but revisit if it wastes rent after downtime.
  - **Self-match:** a user's BUY_NO @ 300 against their own resting BUY_YES @ 400 reverts `SelfMatchCancelTaker` (DreamDEX semantics, D-008). S4's ticket must not rely on crossing one's own order.
- **Lane 3c (settler + seed maker, merged from `slice/S3c-settler-maker` @ 153da7e), proven on a Surfpool devnet fork with real RedStone and Pyth prints:**
  - **Happy path** (NVDA-5m W1 16:05–16:10Z):
    - The maker quoted fair 453 → 423/483 × 5,000 and requoted on fair moves (22 PostOnly posts, 11 `cancel_all`, pulled at lock − 60). A taker IOC BUY_YES @ 483 filled against the maker's BUY_NO via the mint pair.
    - The settler ran settle (Down) → `redeem_for` both seats with ATA creation → release Book → close Ledger. Payouts equalled the seat-derived amounts: maker 1,250,000, taker 250,000. The roller got back exactly the Ledger + mvault rent.
  - **Cross-check wait:** TSLA-5m W3 (Pyth open/close, only the RedStone check open) settled at T1 + 124, never before the T1 + 120 bound, with the single-source flag set.
  - **Void path:** a Window with no prints and a resting bid → time travel past the open deadline → void → sweep → redeem 750,000 (500,000 escrow + bond) → release → close Ledger.
  - **Closure:** after the retention time travel, six Markets + Results closed, including the three S2 devnet-drive Windows it drained at boot.
  - **CU / bytes:**
    - settle 14,893/386 · void 12,978/386
    - `redeem_for` 2 seats + 2 ATA creates 49,016/724 (4 seats ≈ 98k/≈ 920 B)
    - release 5,497/352 · close Ledger 12,297/517 · close Market 9,298/386
    - PostOnly 16,410/586 · `cancel_all` 15,838/556
  - **Tests:** 26 vitests (settler decide 14, maker quote 12).
  - **Spec amendments at merge:**
    - §8.2 BUY_NO carries `price_ticks = fair + half` (YES-quoted book).
    - §7 releases the Book before waiting on PROGRAM seats.
    - `public_redeem_for` also takes `series`.
  - **Series 900:** `SETTLER_ALL_SERIES=1` lets the settler also close the drive-only Series 900 Windows; on devnet this reclaims the S2 drive rent.
  - **Surfpool gPA:** Surfpool's `getProgramAccounts` still lists Markets closed on the fork. Steady-state reads are by address, so actors are unaffected.
  - **Maker RPC budget:** at 10 s passes, near-expiry fair moves requote often (≈ 11 per 5m Window). For devnet, raise `MM_REQUOTE_TICKS` or narrow `MM_SYMBOLS`/`MM_CADENCES` to stay within ≈ 1 RPS.
- **Lane 3d (indexer, merged from `slice/S3d-indexer` @ 57d52d0):**
  - **Devnet backfill** (read-only, Helius, 3 RPS, from deploy slot 498252588):
    - 42 txs in 24.5 s, all finalized: WindowOpened 3, WindowResolved 3, PrintRecorded 8, OrderExecuted 8 (4 fills), OrdersCancelled 2, Redeemed 5.
    - `pnpm drive:verify-index --cluster devnet` matched chain and index on every metric (0 gaps, 0 duplicates). Projections reproduce the S2 drive's figures (TSLA A redeemed 7,370,000, D 1,550,000).
    - A re-walk, a cursor reset and `--rebuild` all left every table byte-identical (md5).
  - **Surfpool live:**
    - Program transactions were indexed 15–45 ms after confirmation.
    - A deleted mint-pair transaction was detected as a `(market, seq)` hole and refetched by a per-Market signature walk (6/6 seqs in 18 s).
    - Rows were promoted to finalized within one walk (5–10 s).
    - Incremental projections were identical to a replay from `idx_events`.
  - **Decoder test:** one vitest over real devnet tx `5eyinbbR…` (OrderExecuted seq 7, DIRECT_YES 1,000 @ 700).
  - **Tables:** `idx_cursor`, `idx_txs`, `idx_events` (key `(signature, outer_ix, inner_ix)`), `idx_series` (read from the Series account; `SeriesRegistered` is an `emit!` log), `idx_markets`, `idx_prints`, `idx_orders`, `idx_fills`, `idx_positions`, `idx_candles`.
  - **Cash units:** two are stored. `*_ticklots` (lots × ticks; × Series `cash_unit` = base units) and `*_base` (collateral base units, as CompleteSet and Redeemed carry them).
  - **Masayume row shapes → `idx/read.ts`:**
    - `getUserFills`/`getFills` → `walletFills`/`fills` (pool = book, fillPrice = YES ticks, txHash = signature)
    - `getRouterActions` → `walletActions`
    - `getBinaryMarket`/`listLive/PastBinaryMarkets` → `markets`
    - `getOpeningPrices` → `openingPrints`
    - `fetchPriceHistory` → `printHistory`
    - `getPortfolio`/`getOpenPositionsWithPnL` → `positions`
    - also `orders`, `candles`, `status`, `countsThrough`. S4 serves these at `/api/index/*`.
  - **Surfpool block times:** Surfpool reports block times ≈ 1.79e6, so live lag falls back to notification → commit time, and verify-index also reports slots behind head. A fork indexer first re-indexes the devnet program history the fork proxies.
  - **Where gaps surface:** a hole is noticed when a later event of the same Market is written.
  - **`idx_orders.filled_lots`** is the placement's own fill; maker-side fills show in `remaining_lots`/`status`.
  - **Wiring:** `startIndexer(deps)` needs `DATABASE_URL`; tuning `INDEXER_RPS` (3), `INDEXER_WALK_MS` (20,000), `INDEXER_START_SLOT`. `verify-index.ts` imports the comparison from `services/ops/src/actors/indexer/verify.ts` by relative path (resolves `@agari/db` through services/ops).
- **Lane 3b (prices, merged from `slice/S3b-prices` @ c48b54a)**, proven on a Surfpool devnet fork during the 09-14 session:
  - **Prints:** TSLA-5m and NVDA-5m #1–#4 back-to-back (16:00→16:20Z) had every slot filled. TSLA open/close were Pyth; TSLA checks and NVDA open/close were RedStone with 5 signers.
    - Pyth was posted once per T at T + 5–7 s. That one post covers #n close and #n+1 open, and the account was closed right after.
    - RedStone landed at T + 12–17 s, checks first.
  - **Restart recovery:** a relay killed at 16:14:52 and restarted at 16:16:01 recorded all six 16:15 slots from history by 16:16:12, both checks inside T + 120.
  - **Leftovers / DRY_RUN:** 0 leftover `PriceUpdateV2` accounts; DRY_RUN signed nothing.
  - **Archive:** 35 boundaries × 7 RedStone + 3 Pyth feeds, including the boot backfill; a re-run inserted 0. Live T→stored was 13.6–20.1 s after fixes. Outliers came from Hermes 429s (a shared key with the S0 archiver) and an idle-delay bug fixed in S3b.3.
  - **HTTP:** `/health` ok; `/prices/latest` serves 9 symbols (TSLA/QQQ/VOO Pyth, others RedStone); `/prices/stream` sends a snapshot plus ≈ 1 s Pyth ticks; the Pyth key is in no log.
  - **TSLA cross-check** (Pyth vs RedStone median): 0.79, 1.54, 0.83, 0.67, 0.66 bps at 16:00–16:20Z (limit 25).
  - **RedStone responses** are ≈ 1.9 MB with 954 feeds, and no filter parameter works. The relay fetches once per boundary and slices each feed's exact JSON array from the text; that substring is the archive payload.
  - **Hermes limits:** 429s at ≈ 4 req/s. One shared gate spaces requests 1 s apart with 5→60 s backoff; recording goes before archiving.
  - **Primary strict window:** primary RedStone slots need all 5 signers until T + 300 (strict 300). Spec §6.2 was amended (D-029). Unknown signers are filtered out, because one would refuse the whole print (D-007).
  - **Kit signers:** Kit refuses two signer instances for one address; pass `client.payer` when the payer also signs.
  - **Schema migration:** `schema-prints.ts` adds `archived_at_ms` with an idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.
- **Integration smoke (stage owner, 16:34Z+, one Surfpool fork on 8950, `pnpm ops:start` with every venue actor live, `MM_SYMBOLS=TSLA,NVDA`):**
  - **Rolling and prints:** the calendar agreed and the roller released the S2 drive Books, then opened TSLA-5m/NVDA-5m #1 16:35–16:40Z. The relay recorded Pyth and RedStone slots at T + 12–17 s and closed the Pyth accounts.
  - **Maker:** it quoted TSLA-5m, TSLA-15m and NVDA-5m, requoted on fair moves, and pulled at lock − 60.
  - **Settler / indexer:** the settler closed the S2 drive Ledgers; the indexer lag was 0–0.7 s.
  - **Bug found:** the fork proxies the devnet 60m Series that `init-series` had just registered. The roller opened TSLA-1h and NVDA-1h 16:00–17:00Z at 16:35, past their open deadline (16:15), so both voided at once (then drained and closed cleanly). TSLA-15m opened at T + 300 missed its check window. Fixed in `f237bfd`: a late Window must still admit its opening prints (spec §5.2, D-029).
- **Devnet soak, 09-14 (first session, from 16:46Z), incidents and fixes:**
  - **16:46–18:10Z, failed:**
    - Helius 429s at every 5-minute boundary burst (27 Series × open, prints, settle, close).
    - Half-closed keep-alive sockets (`fetch failed`).
    - A roller pass hung ≈ 50 min on a confirmation that never resolved (no send timeout), so the roller opened nothing after 16:54Z. The relay missed 39 slots, and those Windows voided honestly.
    - **Fix** (`b9de845`): a send timeout of 120 s, a stuck-pass watchdog (exit 70, `data/soak/run.sh` supervisor restarts) and root-cause error text.
  - **18:10–18:23Z** after that fix: 27 opened, 64 prints, 0 missed, 31 settled, 34 Ledgers closed.
    - **Retry bug:** a `UND_ERR_REQ_CONTENT_LENGTH_MISMATCH` showed undici's retry interceptor cannot replay a `fetch` POST body (reproduced locally), so no 429 had ever been retried.
    - **Fix** (`683da7b`): retries moved into a Kit `RpcTransport` (`deploy/rpc-transport.ts`), with the client composed from kit-plugin-rpc's `solanaRpc` plugins (local check: 429 → 503 → result). `/health` staleness is now per actor interval.
  - **18:26–18:38Z:** 27 opened, 60 prints, 0 missed, 0 429 / fetch / pass failures, `/health` ok.
    - **Remaining:** `WebSocket failed to connect` (one Kit subscriptions instance per role client plus a web3.js Connection per Pyth post) and `Computational budget exceeded` on the receiver `post_update` under the SDK's tight budget.
    - **Fix** (`50d0635`): one subscriptions instance per URL; one Connection per URL; Pyth posts use the non-tight default (200k CU per instruction).
  - **18:39–18:52Z:** 24 opened, 71 prints, 0 missed. A few sends still exhausted retries at the 18:45Z burst.
    - **Fix** (`56b1951`): process-wide pacing, `RPC_MAX_RPS` 8 and `RPC_SEND_TPS` 3 (a 32-call burst flows at 8/s). Confirmations moved to the public devnet websocket (`SOLANA_WS_URL=wss://api.devnet.solana.com`) while HTTP stays on Helius. Restarted 18:54:52Z.
  - **SOL float** (roller 4 → 2.26, settler 2.5 → 2.21 by 18:52Z): live Ledger + mvault ≈ 0.046 each (≈ 50 live and closing), plus Market ≈ 0.003 × ≈ 150 Windows/h retained 6 h. The roller's steady peak in a full session is ≈ 5 SOL, so top it up before the 09-15 open.
- **Soak 09-14 after the priority lane (19:19–20:12Z):** 81 opened, 230 prints recorded, **0 missed**, 115 settled, 117 Ledgers closed, no restarts, `/health` ok (28 exhausted-retry 429 lines, all recovered next pass). **Off-hours gate item ✅:** 0 Windows start at or after 20:00Z; all 27 Windows expiring 20:00Z resolved; every lane reads `closed: no session`.
- **Overnight 09-14→09-15 (off-hours):** a DNS outage (119 × `getaddrinfo ENOTFOUND devnet.helius-rpc.com`) left passes stuck; the watchdog exited ops 10 times (`exiting: pass stuck over 10 min …`, exit 70) and the supervisor restarted it each time; after DNS returned the settler closed retained Markets (`closeMarket … retention elapsed`) and the indexer backfilled from its cursor. Crash-only recovery (D-030) held; no manual action.
- **SOL for the devnet run** (5,080 lamports/B incl. header):
  - 25 missing Series × 0.0076 ≈ 0.2 SOL.
  - Books: 16 new 5m/15m Series × 2 × 0.2900 ≈ 9.3 SOL, plus 9 new 60m Series × 2 × 0.2276 ≈ 4.1 SOL, so ≈ 13.4 SOL of Books.
  - Role floats (spec §1) ≈ 7 SOL.
  - **Total ≈ 21 SOL** against 4.48 held. Cheapest useful first step: every 5m Series (7 new × 0.5876 ≈ 4.1 SOL) plus ≈ 3 SOL of role floats.

## Handoff

- **Lanes** (spec §10): 3a roller, 3b prices, 3c settler + seed maker, 3d indexer, each on its own branch, worktree and Surfpool ports. Lanes report back; the stage owner merges each into `stage/S3-venue-ops`, then wires `main.ts`.
- **Local env:** each worktree symlinks `.env.local` → `/Users/abu/dev/hackathon/stocklana/.env.local` (gitignored). Lanes use their own Postgres database (`createdb agari_s3<x>`). `reference/` is only in the main checkout: `/Users/abu/dev/hackathon/stocklana/reference/`.
- **Surfpool:** `surfpool start --network devnet --no-deploy --no-tui -p <port> -w <ws>` from a directory without `Anchor.toml`, funding keys with `-k ~/.config/agari/devnet/<role>.json`. Set `SOLANA_CLUSTER=localnet SURFPOOL_PORT=<port> SURFPOOL_WS_PORT=<ws>` for actors. A fork reads the real devnet config, Series and Books (D-027).
- **Devnet needs SOL** before `init-series` and the soak: ≈ 20 devnet SOL to the deployer `AD8cgL3c39WxgqohfpuHzkBsr1su4eU6a6sQqzHC3V5F` (Findings).
