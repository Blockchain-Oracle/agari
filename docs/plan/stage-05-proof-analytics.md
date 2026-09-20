# S5 — Proof and analytics on the indexer

**Goal:** every analytics and proof surface reads real devnet data and looks exactly like Masayume (D-036).
1. Portfolio record: history, receipt, equity, badges, CSV (Restore waits on S10d).
2. Trader Edge with ET session buckets.
3. Leaderboard for this session and per ticker; `/stats` and `/api/traction` off the same tape scan.
4. `/status`: green in session, "closed (expected)" off-hours.
5. The Pyth trial proof replay: an archived signed blob posted to the devnet receiver, with the verified `PriceUpdateV2` shown beside the print that settled that historical Window.
6. `/surface` on the Book decode; the Earned Heat card names its signed source.
7. `scripts/drive/recount.ts` proves the board and traction from chain.

- **Plan:** `00-plan.md` §5, §7.2 S5.
- **Contract:** `docs/plan/specs/proof-analytics.md`.
- **Preconditions:** S4. Its drive, browser pass and tag are still open at the S5 cut. S5 lanes build in parallel, but S5's gate waits for S4's.

**Branch:** `stage/S5-proof-analytics` in worktree `../agari-wt/s5`, cut from `stage/S4-first-call` @ `c5ddb60`. Lanes `slice/S5{a,b,c,d}-*` in `../agari-wt/s5{a,b,c,d}` merge into the stage branch in the order 5c → 5a → 5b → 5d (spec §4). Nothing merges to `main` before S1's Phantom check and the S2/S3/S4 gates.

**D-number range:** D-041…D-050.

## Steps

- [x] Foundation (stage owner, D-041…D-043): **(done: c257189 — `print_proofs` DDL, lane resolvers for `tape/*`, `status/*` and `proofs/:market`, `PROOF_PATH`, the `./proof` subpath, the three root `drive:*` scripts; `/session` fields 26a7f00, live on the soak (route check 2026-09-19: `calendar.recent` 5 rows, `sources.pythTrialLastCloseSec` set); `AGARI_OPERATOR_WALLETS` c9c4b59; role funded, `acceptance.md` 2026-09-15 06:05, 121bbb6. The spec §5 answers are all in D-041 (Q-S5-1…7); no separate D-042 or D-043 entry was written)**
  - The `proof-analytics.md` contract (D-041).
  - Ops `/session` adds `calendar.recent` and `sources.pythTrialLastCloseSec`; restart the soak off-hours.
  - `/api/index` dispatch for `tape/*`, `status/*` and `proofs/:market` to lane stub files.
  - `schema-proofs.ts` DDL registered; lane stub files exported through `@agari/db` and `provider/index.ts`.
  - The `@agari/markets/proof` subpath; `@agari/db` for `@agari/scripts`; root `drive:recount`, `drive:proof-replay` and `drive:traders`.
  - `PROOF_PATH` in `web/src/lib/routes.ts`.
  - `AGARI_OPERATOR_WALLETS` (server-only).
  - The `proof-replay` role key created and funded with 0.1 SOL from the deployer (acceptance row).
  - Spec §5 answered (D-042 proof trigger, D-043 operator wallets and the traders drive).
- [x] Record + Edge (5a): live-wallet proof of rounds against `idx_positions`, crank-paid copy, CSV and badges; ET session buckets in `core/projection/edge.ts` + targeted vitest; Edge copy. **(done: ET buckets and the vitest a7eb42d; crank-paid copy b8389c6; unread claims and Edge copy c1d8ab8, whose message records the proof on the live index for five devnet wallets: rounds, stake, proceeds, payout and pnl equal the `idx_positions` sums, ET buckets, CSV = rows)**
- [x] Board + stats (5b): `tape/*` queries; `readVenueBoard` with 3 paged scans, `byTicker` and traction; `/api/leaderboard?period&ticker` with the TickerPicker and period tabs; stats/leaderboard copy truthing. **(done: paged tape readers d50ca6a; `readVenueBoard` over three scans with `byTicker` and traction be213c0, 4a41d0c; `/api/leaderboard?period&ticker`, tabs, picker and copy 973681d; route check 2026-09-19 on `:3000`: 5 ranked wallets, `complete: true`)**
- [x] `scripts/drive/recount.ts` (chain and events sources) and `scripts/drive/traders.ts` (5b). **(done: b66837e, 1c4c8a6)**
- [x] Status (5c): the probe table in spec §2.5, `expected` rows, `status/prints` and `status/cross-checks`. **(done: 187a8e0 with the targeted vitest, fixtures 3135a06; route check 2026-09-19 `GET /api/status`: session rows carry `expected`)**
- [x] Proof replay (5d): `replayPythProof` + the `PriceUpdateV2` decoder vitest against the D-021 fixture; `print_proofs` writes; `proof-replay.ts` (post, verify, 24 h close); `POST /api/proof/pyth` with idempotency and quotas; the `/proof/[market]` page; receipt and verdict oracle rows link to it. **(done: dfb45a8, 3d3e651, 5d61b37 (page checked at 1440 dark and 390 light, route on a Surfpool fork), fe53678, 0118c31; receipt links 37b0ed7. The devnet replays are their own box below)**
- [ ] Surface + Earned Heat (5d): live `/surface` proof in session and the closed-session label; `TradeCard` print source, single source and void reason; `/dev/share` fixtures. (open: the live in-session `/surface` proof is not recorded. Done in 37b0ed7: the closed-session label, `TradeCard` print source, single source and void reason, and `/dev/share` with 9 trade PNGs checked in the browser)
- [ ] Traders drive during the 09-16 session (Q-S5-3 default): acceptance rows for every wallet and signature. (open: `scripts/drive/traders.ts` exists 1c4c8a6 and its wiring was checked off-hours with `--check`; it has not been run in a session, and `acceptance.md` has no wallet or signature rows for it)
- [ ] Devnet proof replays: at least one TSLA and one QQQ or VOO historical close, verified Full with an exact integer match; post and close rows in `acceptance.md`. (open: no post, verify or close rows in `acceptance.md`; the replay ran on a Surfpool fork only 5d61b37)
- [ ] `recount.ts` in session and after close (`24h` and `session`, all and each ticker): exact match. (open: an after-close match is recorded in b66837e for the 09-14 session: events source for session and 24h, chain source for the session, 3,610 transactions, every ticker. No in-session run is recorded)
- [ ] `/status` checked in session (green) and off-hours (every session row "closed (expected)", none red). (open: no in-session check is recorded. Off-hours route check 2026-09-19 19:39Z: relay, mix, RedStone and cross-check rows read `expected`, but the six ops rows were red because ops `/health` answered 503 at that moment)
- [ ] Browser pass against masayume.app at 390/768/1440 in both themes: `/portfolio`, `/portfolio/edge`, `/leaderboard` (both periods, one ticker), `/stats`, `/status`, `/surface`, `/proof/<market>`, share cards. Update `docs/plan/audits/ui-fidelity-2026-09-14.md` rows `/surface`, `/status`, `/leaderboard`, `/stats`. (open: no S5 pass exists under `docs/plan/audits/`; rows `/surface`, `/status`, `/leaderboard` and `/stats` in `ui-fidelity-2026-09-14.md` still name S5 as the fixing stage)
- [ ] Parity rows advanced at the gate; STATUS. (open: the 2026-09-19 reconciliation advanced them — L-15, L-16, L-22, L-40, L-47, L-48 Done; L-46, L-49 Partial — but the S5 gate itself has not passed: the six boxes above are open)

## Gate

- **Full gate:** `pnpm typecheck && pnpm invariants`, `pnpm build`, `NO_DNA=1 anchor build --arch v0` (programs unchanged).
- **Recount:** `recount.ts` matches `/stats` (traction) and the leaderboard for the 24 h window, with exact integers and `complete: true`, run at least once in session and once after close.
- **Status:** `/status` green in session (13:30–20:00Z) and "closed (expected)" off-hours.
- **Proof replay:** at least 2 devnet replays verified (acceptance rows: post signatures, `PriceUpdateV2` address, close).
- **Browser pass:** as the step above, drift fixed and not waived (D-036).

**Rows:** L-15, L-16, L-22, L-40, L-47, L-48, L-49; Partial L-46 (Restore → S10d, owner S7).

## Findings

## Handoff

- **Lanes** (spec §4):
  - **5a record + edge:** web on port 3051.
  - **5b board + stats:** web on port 3052.
  - **5c status:** web on port 3053.
  - **5d surface + share + proof:** web on port 3054; Surfpool 8980/8981.
  - Lanes report back. Only the stage owner edits the files in spec §4 "Stage owner only".
- **Web dev against devnet:**
  - Run `pnpm --filter web exec next dev -p <lane port>` in the lane worktree.
  - `web/.env.local` is a symlink to `/Users/abu/dev/hackathon/stocklana/web/.env.local`, shared by every worktree. Presence only; never print values.
  - `NEXT_PUBLIC_AGARI_INDEXER_URL=/api/index` is same-origin (`fefedf6`), so any port works. On the server it resolves over loopback through `PORT` (`packages/markets/src/provider/indexer-base.ts:6-15`).
  - `NEXT_PUBLIC_*` values are baked at `next build`.
  - Browser chain reads go to public devnet (D-035). `/api/index/*` reads the soak's Postgres. Spot and session come from ops `:8787`.
  - `reference/` (Masayume) exists only in the main checkout: `/Users/abu/dev/hackathon/stocklana/reference/masayume`.
- **Live soak (from `../agari-wt/s3`):**
  - `curl -s localhost:8787/health` returns the actors: `spot-feed`, `price-archive`, `price-relay`, `pyth-leftovers`, `settler`, `seed-maker`, `indexer`, `window-roller`, each with its `detail`.
  - `curl -s localhost:8787/session`; `localhost:8787/prices/{latest,stream}`.
  - Index DB: `psql postgres://abu@localhost:5432/agari` (`idx_*`, `print_archive`). Lanes read it and never write it.
  - Stop: `pkill -f data/soak/run.sh; pkill -f src/main.ts`.
  - Regular Windows exist only 13:30–20:00Z on session days. The next sessions are 09-15, 09-16, 09-17, 09-18 and 09-21.
- **Data on hand (05:20Z 09-15):**
  - **Windows:** `idx_markets` has 337 opened and 337 resolved (27 voided: 26 missing print, 1 cross-check divergence), expiries 09-14 14:45–20:00Z.
  - **Fills:** `idx_fills` has only 4, all from 1 taker (the S2 drive). S4's drive and the S5 traders drive add the rest.
  - **Prints:** `idx_prints` by source: Pyth 209, RedStone 493, attested 2.
  - **Archive:** `print_archive` holds 79 boundaries on 09-14 (14:30–20:00Z) for 7 RedStone names and 3 Pyth trial feeds. Each Pyth row is the whole three-feed Hermes update.
  - **Pyth JSONL archives:** `/Users/abu/dev/hackathon/stocklana/data/archive/pyth/{2026-09-11,2026-09-14}.jsonl` (plus `redstone/`), gitignored, main checkout only.
  - **Ops at that time:** indexer subscription `reconnecting` off-hours; spot-feed `lastWhy` "RedStone latest failed", useful for 5c's red-row check.
- **Fixtures:**
  - `anchor/tests/vectors/prints/` holds the Pyth TSLA update, its `PriceUpdateV2` account bytes and parsed JSON, and the RedStone TSLA packages (D-021).
  - `packages/markets/src/ops/indexer/fixtures/place-order-direct-yes-fill.json`.
  - Web `/dev/{history,share,surface,verdict,claims,wallet,states}`.
- **Wallets with history:** the S2 drive wallets and the S4 faucet/first-call wallets (`acceptance.md` rows). The traders-drive keypairs live in the lane's scratch directory and are never committed.
  - For a browser wallet, inject 4e's Wallet Standard test wallet (WebCrypto Ed25519) through DevTools, seeded from a drive keypair.
- **Surfpool:** from a directory without `Anchor.toml`: `NO_DNA=1 surfpool start --network devnet --no-deploy --no-tui -p 8980 -w 8981 -k ~/.config/agari/devnet/proof-replay.json`. A fork proxies the devnet receiver `rec5EK…` and Wormhole `HDwcJB…`, where D-021 posted an archived update.
- **SOL (devnet, 2026-09-15):**
  - `sol-faucet` holds 4.98 SOL.
  - Rent: `PriceUpdateV2` 1,330,960 lamports; a 1.2 KB account 6,746,240.
  - Role floats and addresses: STATUS and `scripts/deploy/addresses.devnet.json`.
