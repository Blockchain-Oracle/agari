# S3 — Venue operations: calendar, roller, prices, settler, indexer, seed maker

**Goal:** devnet runs unattended through a full NYSE session. Windows roll per calendar, prints post, Windows settle or void, projections fill, and books have quotes. Plan: `00-plan.md` §7.2 S3, §2.2, §4. Contract: `docs/plan/specs/venue-ops.md`.

**Branch:** `stage/S3-venue-ops` in worktree `../agari-wt/s3`, cut from `stage/S2-events-engine` plus S1's STATUS (D-028). Lanes `slice/S3{a,b,c,d}-*` in `../agari-wt/s3{a,b,c,d}` merge into the stage branch. Nothing merges to `main` before S1's Phantom check.

**D-number range:** D-028…D-039.

## Steps

- [x] Foundation: `venue-ops.md` contract; `@agari/markets/ops` (client, send + engine codes, venue reads) with lane subpaths `ops/*`; ops runtime (env, role keys, actor loop, heartbeats, `VenueDeps`); calendar service (Alpaca ∩ Pyth schedule, live-checked); `print_archive` schema; lane-owned placeholders (D-028)
- [ ] Calendar service (foundation) + roller plan, versions, recycle and grow (lane 3a)
- [ ] Policy versions and Series: `init-series` for 9 tickers × Regular 5/15/60 with rent accounting, `fund-roles` (lane 3a; the devnet run needs SOL, see Handoff)
- [ ] Roller (highest covering version; "paused: no signed source" when none) (lane 3a)
- [ ] Pyth trial relay (TSLA/QQQ/VOO) + close update accounts; take over the S0 blob archive (lane 3b)
- [ ] RedStone relay: all 5 signer packages at T + 10–15 s with retries; archive to `print_archive`; single names + TSLA check prints (lane 3b)
- [ ] Attested relay (opt-in only; off by default) (lane 3b)
- [ ] Spot feed + `/health` + `/prices/stream` SSE (lane 3b)
- [ ] Settler (retries `CrossCheckPending` until the check bound; redeem_for, close ledger, close market) (lane 3c)
- [ ] Seed maker, `MAKER_MODE=seat` (lane 3c)
- [ ] Indexer + backfill + `verify-index` (lane 3d)
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
