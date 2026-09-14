# S3 — Venue operations: calendar, roller, prices, settler, indexer, seed maker

**Goal:** devnet runs unattended through a full NYSE session. Windows roll per calendar, prints post, Windows settle or void, projections fill, and books have quotes. Plan: `00-plan.md` §7.2 S3, §2.2, §4. Contract: `docs/plan/specs/venue-ops.md`.

**Branch:** `stage/S3-venue-ops` in worktree `../agari-wt/s3`, cut from `stage/S2-events-engine` plus S1's STATUS (D-028). Lanes `slice/S3{a,b,c,d}-*` in `../agari-wt/s3{a,b,c,d}` merge into the stage branch. Nothing merges to `main` before S1's Phantom check.

**D-number range:** D-028…D-039.

## Steps

- [x] Foundation: `venue-ops.md` contract; `@agari/markets/ops` (client, send + engine codes, venue reads) with lane subpaths `ops/*`; ops runtime (env, role keys, actor loop, heartbeats, `VenueDeps`); calendar service (Alpaca ∩ Pyth schedule, live-checked); `print_archive` schema; lane-owned placeholders (D-028)
- [x] Calendar service (foundation) + roller plan, versions, recycle and grow (lane 3a, merged 2026-09-14)
- [x] Policy versions and Series: `init-series` for 9 tickers × Regular 5/15/60 with rent accounting, `fund-roles` (lane 3a; the devnet run needs SOL, see Handoff)
- [x] Roller (highest covering version; "paused: no signed source" when none) (lane 3a)
- [ ] Pyth trial relay (TSLA/QQQ/VOO) + close update accounts; take over the S0 blob archive (lane 3b)
- [ ] RedStone relay: all 5 signer packages at T + 10–15 s with retries; archive to `print_archive`; single names + TSLA check prints (lane 3b)
- [ ] Attested relay (opt-in only; off by default) (lane 3b)
- [ ] Spot feed + `/health` + `/prices/stream` SSE (lane 3b)
- [x] Settler (retries `CrossCheckPending` until the check bound; redeem_for, close ledger, close market) (lane 3c)
- [x] Seed maker, `MAKER_MODE=seat` (lane 3c; real `SpotFeed` hookup at the main.ts step)
- [x] Indexer + backfill + `verify-index` (lane 3d)
- [ ] Register actors in `main.ts` (DRY_RUN default) + heartbeats (stage owner, after the lanes merge)
- [ ] Register series on devnet + rent accounting (stage owner; needs SOL)
- [ ] One-session soak (stage owner)

## Gate

- `pnpm typecheck && pnpm invariants`
- **Soak:** N Windows with no overlaps, all resolved or voided within their windows; indexer lag < 10 s; `verify-index.ts` fill counts match chain.
- **Prints:**
  - every Window's source matches `price-sources.json`;
  - 100% of RedStone boundaries fetched and archived within 60 s;
  - TSLA cross-check agreement (bps) recorded;
  - zero leftover `PriceUpdateV2` accounts owned by the relay.
- **Post-trial dry run:** the roller with a clock after the 09-25 close shows TSLA on RedStone and QQQ/VOO paused.
- **Off-hours:** no Regular Windows listed.

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
