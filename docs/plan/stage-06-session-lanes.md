# S6 — Stock-session lanes and states (parallel with S5)

**Goal:** stock sessions become honest lanes on devnet.
1. **Monday Gap:** one Window per weekend, from the Friday 16:00:00 ET print to the Monday 09:30:00 ET print, both from one policy version.
2. **24/7 token lane:** TSLAx, NVDAx, SPYx and QQQx on Switchboard Surge quotes, observed ≤ 60 s after T.
3. **Halts, voids, earnings and corporate actions:** paused lanes, void reasons named, earnings flags, split and multiplier skips.
4. **States:** closed, early-close, halted, Gap and token states on every always-on surface, exactly in Masayume's components.
5. **Holdings-aware hedge:** a connected wallet's mainnet xStocks, read-only, with a one-tap devnet Down or Gap hedge.

- **Plan:** `00-plan.md` §2.2, §3.1, §3.3, §7.2 S6.
- **Contract:** `docs/plan/specs/session-lanes.md`.
- **Deadline reality:** submissions close **Fri 2026-09-18 20:00Z**, which is the 09-18 Gap's opening boundary. No Gap Window trades or settles before submission (spec §1.6). The Pyth trial covers TSLA/QQQ/VOO through the 09-25 close.

**Branch:** `stage/S6-session-lanes` in worktree `../agari-wt/s6`, cut from `stage/S4-first-call` @ `c5ddb60`. Lanes `slice/S6{a,b,c,d}-*` in `../agari-wt/s6{a,b,c,d}` merge into the stage branch in the order foundation → 6c → 6a → 6b → 6d (spec §6). Nothing merges to `main` before the S1/S2/S3/S4 gates.

**D-number range:** D-051…D-060.
- D-051: contract and lanes.
- D-052: spike (b) Gap feed and the 09-18 listing set.
- D-053: spike (a) Switchboard oracles and feed hashes.
- D-054: Gap versions, lead and check-bound rule.
- D-055: Switchboard print instruction and program upgrade.
- D-056: token Series, Books, caps, Jupiter fallback rule.
- D-057: halts, void-reason copy, earnings, corporate-actions shape.
- D-058: holdings hedge.
- D-059: gate restated for the deadline.
- D-060: spare.

## Steps

- [ ] **Spike (b), Gap open feed (6a, D-052; today, from data already recorded):**
  - Tabulate `TSLA`/`---EXTENDED` and the other six names at 09:29:50–09:30:30 ET from `data/archive/redstone/2026-09-14.jsonl` against Pyth's exact-T blob (spec §1.1).
  - Re-read the 09-15, 09-16 and 09-17 open rows as they land.
  - Decide the feed variant (regular id, T + 0) and which RedStone names list for 09-18 (Q-S6-1).
- [ ] **Spike (a), Surge oracle count (6b, D-053; devnet):**
  - Build the four `switchboardSurgeTask` feeds and pin their hashes.
  - `fetchQuoteIx` with n = 1…5 signatures, all four feeds in one quote; record the maximum distinct oracles.
  - Check values against Jupiter `usdPrice` (the ScaledUiAmount basis).
  - On a Surfpool fork: transaction bytes and CU (ALT needed or not), and the v0 `.so` size with the crate in.
  - Set `switchboard_min_oracles` and the token caps (Q-S6-4).
- [ ] **Foundation (stage owner, D-051, D-054):**
  - Freeze the spec.
  - Core types: blocker kinds, `HaltReason`, `EarningsEvent`, Ondo mints in `tickers.ts`.
  - Basis dispatch with `paused: lane not built` stubs in the roller, relay tracker and pass, settler and maker; lane keys `<SYM>-gap` and `<xStock>-<min>m`.
  - `policyVersions(symbol, sources, basis)` with the Gap open admission.
  - `/session` gains `halts`, `earnings`, `skips` (reconciled with S5's `calendar.recent` / `sources`); `VenueDeps` gains `halts` and `events`; `halt-watch` registered.
  - Add `@switchboard-xyz/on-demand@3.10.6` and `@switchboard-xyz/common@5.8.5` (Context7 first).
  - `price-sources.json`: `gap` block and `tokenLane.*.feedHash` placeholders.
  - Create the lane worktrees and ports.
- [ ] **6c core (merges first):**
  - `packages/core/src/market/{halts,void-reason,events-calendar,corporate}.ts` with vitests (`skipApplies` on Gap spans, `voidDetail`, `earningsFlag`).
  - `corporate-actions.json` gains `lanes` and `multipliers`.
- [ ] **6a Gap:**
  - `plan-gap.ts` (48 h lead, check-bound exception, two-date corporate skip) and vitests at `--at` clocks.
  - Relay `gap-slots.ts` (RedStone open from `print_archive` until `lock_at`); maker `gap-fair.ts`.
  - `init-gap-series.ts` dry run on Surfpool.
  - LiteSVM `events_gap.rs`: real 09-11 → 09-14 weekend (Pyth fixtures, D-021 method) and the PD-6 race at `lock_at` / `lock_at + 1`.
  - Surfpool forward time-travel drive `gap-cycle.ts` on drive-only Series 901.
- [ ] **Stage owner, Gap Series on devnet (Wed 09-16):**
  - Register 9 Series (or the Q-S6-1 subset): 2.117 SOL, one 256-node Book each, acceptance rows.
  - Restart ops; `pnpm drive:roller-plan --at 2026-09-17T20:00:00Z` shows every Gap lane `open`.
  - Record the listed 09-18 Windows.
- [ ] **Overnight devnet Gap drive (6a, Q-S6-3):** Series 902, TSLA Pyth, Thu 09-17 20:00Z → Fri 09-18 13:30Z. Open print, lock, close print, settle, redeem (acceptance rows).
- [ ] **6b program:**
  - `agari-common::print::switchboard` (`check_quote_ix`, `quote_print`, pre-normalized to expo −8) with pure tests on a captured devnet quote.
  - `record_print_switchboard.rs` plus dispatch; error map onto 6214–6218.
  - LiteSVM `events_switchboard.rs`: wrong queue, duplicate oracle, too few oracles, stale slot, wrong feed, bad index, before T + 10, after T + 60.
  - `anchor build --arch v0` green; codegen.
- [ ] **6b off-chain:**
  - `switchboard-quote.ts` (legacy lane) and `ops/prints/switchboard.ts`.
  - Relay `switchboard-pass.ts`: one quote per T; opens via `public_copy_open_from_prev`.
  - Roller `plan-token.ts`; maker `token-fair.ts`; `xstock-spot.ts` (Jupiter chart spot).
  - `jupiter-attest.ts` fallback, proven on Surfpool only.
  - `init-token-series.ts` dry run.
- [ ] **Stage owner, program upgrade and token Series (D-055, D-056):**
  - Surfpool fork: new `.so` at `cDcHZ…`, 6b proofs, `pnpm drive:events` regression.
  - Devnet `solana program deploy --program-id … --buffer …` (auto-extend); sha256 compare.
  - Codegen and IDL republish.
  - `admin_set_authorities` with the full set, the queue and min oracles.
  - Register 12 token Series (5.554 SOL); fund the relay to 1 SOL. Acceptance rows for each.
- [ ] **6c ops:**
  - `halt-watch` actor (Pyth confidence and staleness, RedStone staleness, xStocks issuer halt, quote failures) over one full live session.
  - `calendar/earnings.ts` (Finnhub, 6 h).
  - `scripts/drive/corporate-check.ts` (proposes, never writes).
  - LiteSVM `events_halt_void.rs`: wide-confidence Pyth account → ConfidenceTooWide → void at T + 901, both orders.
- [ ] **6d states and hedge:**
  - Every spec §5 row: basis-aware lane tabs and `laneState`; Gap card (listed, trading, locked); token labels; halted chip; new ticket blockers; claim-card void copy (Q-S6-7).
  - Fixtures in `/dev/states`, `/dev/session`, `/dev/hedge`.
  - Hedge: `@agari/markets/holdings` reader (Helius mainnet, verified mints, ScaledUiAmount in bigint), `GET /api/holdings`, and a `SeasonBanner`-anatomy card with devnet copy.
- [ ] **Devnet token-lane settlement on a weekday:** ≥ 1 settled Window per xStock. A devnet Down hedge IOC in session. Acceptance rows.
- [ ] **Browser pass** at 390/768/1440 in both themes against the Masayume source for every §5 state; audit doc updated (D-036).
- [ ] **Pre-deadline gate (D-059)**, STATUS, commit. Then post-deadline evidence rows:
  - 09-19/20 token weekend;
  - 09-18 Gap open prints (Fri 20:00Z) and 09-21 13:30Z settlements;
  - 09-25: TSLA Gap on v2 RedStone, QQQ/VOO "Paused: no signed price source".

## Gate

Restated for the deadline (D-059). The plan's "RedStone Gap Window recorded on a real weekend" and "real-weekend token settlement" can only happen after Fri 09-18 20:00Z; they become post-deadline evidence rows, never submission claims.

- **Full gate:** `pnpm typecheck && pnpm invariants`, `pnpm build`, `NO_DNA=1 anchor build --arch v0`, codegen diff clean.
- **Gap (pre-deadline):**
  - LiteSVM replay of the real 09-11 → 09-14 weekend settles Down on archived Pyth prints, and the lock race passes in both orders.
  - The Surfpool time-travel drive lists, prints, locks, settles and redeems a Gap Window.
  - Gap Series registered on devnet and the 09-18 Windows listed (acceptance rows).
  - The overnight devnet drive settled, if Q-S6-3 is taken.
- **Halt / void:** a confidence-cap breach and a missing print each void 0.5/0.5 (LiteSVM), and the verdict names the reason via the core copy.
- **Switchboard:** a print is refused before `T + min_delay_sec`, with a stale slot, a duplicate oracle, or the wrong queue (LiteSVM, then Surfpool with the upgraded `.so`).
- **Token lane:** the program upgraded on devnet, and ≥ 1 settled token Window per xStock on a weekday.
- **States:** every §5 row fixture-proven and browser-checked; the hedge reads a real mainnet holder and places one devnet hedge.
- **Post-deadline evidence (recorded, not claimed):** weekend token settlements, 09-21 Gap settlements, 09-25 lane switch.

**Rows:** HRS/BASIS/HALT/CORP/EVT across L-04 (inputs; S13c renders the marquee), L-09, L-29, L-32, L-33 (claim card; S5d the verdict), L-44 (S13b), L-61 and L-62 (S12; closed copy noted), L-72. Resolves `C:05` §6 Q2.

## Findings

## Handoff

- **Lanes** (spec §6):
  - **6a Gap:** Surfpool 9061/9062.
  - **6b Token:** Surfpool 9063/9064.
  - **6c Halts · voids:** Surfpool 9065/9066.
  - **6d States · hedge:** web 3064.
  - Lanes report back; only the stage owner edits manifests, the lockfile, `packages/core/src/{ports,types}/**`, `tickers.ts`, `packages/markets/src/{env,index}.ts`, `deploy/{policies,venue-spec}.ts`, `services/ops/src/{main.ts,runtime/**,http/**,calendar/session-service.ts}`, the basis-dispatch lines, `scripts/invariants/**`, `docs/plan/**`, `Anchor.toml`, `addresses.devnet.json`, and every devnet deploy, registration and funding.
- **Cross-stage files S6 never edits:**
  - S5d: `VerdictCard`, `print-source`, `MarketProofRows`, `features/share/**`.
  - S5a: `features/markets/{portfolio,balance,history}/**`.
  - S13c: `Marquee.tsx`, `/api/earnings`, `finnhub.server.ts`.
  - S13b: `features/markets/reels/**`.
- **Archive data:** `/Users/abu/dev/hackathon/stocklana/data/archive/{pyth,redstone}/*.jsonl` (main checkout only, gitignored). The archivers run as pids in `data/archive/{pyth,redstone}.pid` (`scripts/archive/*.mjs --follow`). Don't stop them before 09-18.
- **Surfpool:** `NO_DNA=1 surfpool start --network devnet --no-deploy --no-tui -p <port> -w <ws>` from a directory without `Anchor.toml`. Time travel moves forward only (D-027): real prints replay in LiteSVM, not Surfpool.
- **Devnet SOL** (last STATUS, 09-14 16:50Z): deployer 3.32 · roller 4 · settler 2.5 · price-relay 0.3 · maker 0.2.
  - **S6 needs:** Gap ≈ 2.1, token ≈ 5.6, float ≈ 3.5, upgrade peak ≈ 5.5 (≈ 1 kept).
  - Ask the user for ≈ 15 SOL to inbox `5zjywmmJ…` before Wed 09-16 (Q-S6-6). Re-read balances before any deploy.
- **Keys and env (presence only):** `PYTH_API_KEY`, `FINNHUB_API_KEY`, `HELIUS_API_KEY` set and server-only. `JUPITER_API_KEY` optional (keyless 0.5 RPS suffices). Never print them.
- **Open questions needing the user:** Q-S6-1 (RedStone Gaps for 09-18), Q-S6-3 (overnight drive), Q-S6-4 (2-oracle token lane), Q-S6-6 (SOL), Q-S6-7 (void claim card).
