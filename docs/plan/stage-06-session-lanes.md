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

- [x] **Spike (b), Gap open feed (6a, D-052; today, from data already recorded):** **(done: D-052 carries the tabulation and the rule: the regular feed id at T + 0. The 09-15 open re-read found MSFT and AMZN at 2 signers, so 7 names were listed (`acceptance.md` 2026-09-15 20:42Z). The 09-16 and 09-17 re-reads were overtaken by that registration and are not recorded)**
  - Tabulate `TSLA`/`---EXTENDED` and the other six names at 09:29:50–09:30:30 ET from `data/archive/redstone/2026-09-14.jsonl` against Pyth's exact-T blob (spec §1.1).
  - Re-read the 09-15, 09-16 and 09-17 open rows as they land.
  - Decide the feed variant (regular id, T + 0) and which RedStone names list for 09-18 (Q-S6-1).
- [x] **Spike (a), Surge oracle count (6b, D-053; devnet):** **(done: D-053 Outcome, 6b 7ccc0cc: 4 distinct oracles at most, `switchboard_min_oracles = 3`, 13–28 bps from Jupiter, feed hashes pinned)**
  - Build the four `switchboardSurgeTask` feeds and pin their hashes.
  - `fetchQuoteIx` with n = 1…5 signatures, all four feeds in one quote; record the maximum distinct oracles.
  - Check values against Jupiter `usdPrice` (the ScaledUiAmount basis).
  - On a Surfpool fork: transaction bytes and CU (ALT needed or not), and the v0 `.so` size with the crate in.
  - Set `switchboard_min_oracles` and the token caps (Q-S6-4).
- [x] **Foundation (stage owner, D-051, D-054; D-051…D-059 recorded):**
  - Freeze the spec.
  - Core types: blocker kinds, `HaltReason`, `EarningsEvent`, Ondo mints in `tickers.ts`.
  - Basis dispatch with `paused: lane not built` stubs in the roller, relay tracker and pass, settler and maker; lane keys `<SYM>-gap` and `<xStock>-<min>m`.
  - `policyVersions(symbol, sources, basis)` with the Gap open admission.
  - `/session` gains `halts`, `earnings`, `skips` (reconciled with S5's `calendar.recent` / `sources`); `VenueDeps` gains `halts` and `events`; `halt-watch` registered.
  - Add `@switchboard-xyz/on-demand@3.10.6` and `@switchboard-xyz/common@5.8.5` (Context7 first).
  - `price-sources.json`: `gap` block and `tokenLane.*.feedHash` placeholders.
  - Create the lane worktrees and ports.
- [x] **6c core (merges first):**
  - `packages/core/src/market/{halts,void-reason,events-calendar,corporate}.ts` with vitests (`skipApplies` on Gap spans, `voidDetail`, `earningsFlag`).
  - `corporate-actions.json` gains `lanes` and `multipliers`.
  - Merged 5968db4 (core) and 8b85afb (ops, scripts, LiteSVM 3/3). The roller's Regular plan reads `clock.halts` (`haltPausedState`) and `corporateActionFor`; `PlanClock` also carries `multipliers` for the token lane.
- [x] **6a Gap:**
  - `plan-gap.ts` (48 h lead, check-bound exception, two-date corporate skip) and vitests at `--at` clocks.
  - Relay `gap-slots.ts` (RedStone open from `print_archive` until `lock_at`); maker `gap-fair.ts`.
  - `init-gap-series.ts` dry run on Surfpool.
  - LiteSVM `events_gap.rs`: real 09-11 → 09-14 weekend (Pyth fixtures, D-021 method) and the PD-6 race at `lock_at` / `lock_at + 1`.
  - Surfpool forward time-travel drive `gap-cycle.ts` on drive-only Series 901.
  - Merged 73d9f80: plan-gap on core `haltPausedState`/`corporateActionFor`; LiteSVM the real 09-11 → 09-14 weekend settles Down on archived Pyth (TSLA 365.47600 → 359.81147, QQQ 714.90 → 703.325, VOO 702.49748 → 697.68105), PD-6 race both orders; Surfpool drive 14 txs (list from the planner, 6100 at lock, settle, redeem to base unit, Book release). `SpotFeed.latest` takes xStocks, `LaneQuote.halfSpreadTicks?` (blind quote 350/650), `gapSpanOf` in roller logs. Dry run: 9 Gap Series 2.117153880 SOL (0.235239320 each); float per listed Window 0.048127920 (the mvault is 82 B, not the spec's 165 B). `roller-plan --at 2026-09-17T20:00:00Z` on devnet: all 9 Gap lanes "would list #0 09-18 20:00Z–09-21 13:30Z v1". Follow-ups: Series 902 real-print overnight mode (Q-S6-3), Q-S6-1 open re-reads 09-15/16/17.
  - Merged 3242cbb (S18 work carried by 6a): roller prelist of the next session's first Window per Regular Series (`ROLLER_PRELIST`, `ROLLER_PRELIST_CADENCES`, margin 3,600 s; the 60m lane prelists 10:00; `grow()` on listed Windows; roller SOL in the state line) and `MM_ORDER_TYPE=post-only|limit` (default post-only; limit quotes are Normal orders that take resting user calls at their price, resting read from the placement's return data). Decision numbers: D-089 = maker order type, D-090 = roller prelist (6a's commit subjects have them reversed). Roller balance 6.28 SOL covers the ≈ 1.8 SOL prelist float. `gap-live.ts` (Series 902 drive) is committed but unproven until the 13:35Z live run.
- [x] **Stage owner, Gap Series on devnet (Wed 09-16):** **(done: 7 Series + 7 Books for 1.646675240 SOL, `acceptance.md` 2026-09-15 20:41–20:42Z, 9adaf66; MSFT and AMZN left out per D-052. The `drive:roller-plan --at` check is not recorded; the roller's own listing replaced it: all 7 Gap Windows #0 for 09-18 20:00Z → 09-21 13:30Z, rows 2026-09-16 20:04Z, 2931695)**
  - Register 9 Series (or the Q-S6-1 subset): 2.117 SOL, one 256-node Book each, acceptance rows.
  - Restart ops; `pnpm drive:roller-plan --at 2026-09-17T20:00:00Z` shows every Gap lane `open`.
  - Record the listed 09-18 Windows.
- [ ] **Overnight devnet Gap drive (6a, Q-S6-3):** Series 902, TSLA Pyth, Thu 09-17 20:00Z → Fri 09-18 13:30Z. Open print, lock, close print, settle, redeem (acceptance rows). (open: no Series 902 run is recorded. The live Gap lane lists, and took its first fill on 2026-09-19, 2,000 lots at 65.0¢, after the `ExpiryAfterLock` fix; its first settlements are due Mon 09-21 13:30Z)
- [x] **6b program:**
  - `agari-common::print::switchboard` (`check_quote_ix`, `quote_print`, pre-normalized to expo −8) with pure tests on a captured devnet quote.
  - `record_print_switchboard.rs` plus dispatch; error map onto 6214–6218.
  - LiteSVM `events_switchboard.rs`: wrong queue, duplicate oracle, too few oracles, stale slot, wrong feed, bad index, before T + 10, after T + 60.
  - `anchor build --arch v0` green; codegen.
- [x] **6b off-chain:**
  - `switchboard-quote.ts` (legacy lane) and `ops/prints/switchboard.ts`.
  - Relay `switchboard-pass.ts`: one quote per T; opens via `public_copy_open_from_prev`.
  - Roller `plan-token.ts`; maker `token-fair.ts`; `xstock-spot.ts` (Jupiter chart spot).
  - `jupiter-attest.ts` fallback, proven on Surfpool only.
  - `init-token-series.ts` dry run.
  - Merged e78cfd0 (5d3470c): `.so` 813,328 B sha256 2e4bf8cc…, LiteSVM 49/49, vitests 1,277. Security review fixes (D-073): the recorder signs and must be an attestor until T+40 (6209), a direct Open with an adjacent recorded Close is refused (6228; `prev_market` required for index > 0), `idx < oracle_keys_len`, queue owner + discriminator + 1..=30 oracles checked in the print handler and `admin_set_authorities` (optional `queue` account), `min_oracles` 1..=8. D-088 pre-open rule: PostOnly admitted on Listed, 6121 for takers; `events_preopen.rs`. Relay prints sign with price-attestor from T+10 (public fallback at T+40 when the key is missing); xstock-spot reports "keyless" without `JUPITER_API_KEY`. The token-plan test fixtures gained 6a's `maxLeadSec`/`prelist` fields at merge. price-attestor now pays ≈ 0.04–0.07 SOL/day (in the funding ask).
- [x] **Stage owner, program upgrade and token Series (D-055, D-056):** **(done: Phase A fork regression in w1 (STATUS: LiteSVM 63/63, token-cycle pass); devnet upgrade with extend and sha256 compare 2026-09-15 20:32–20:35Z; `admin_set_authorities` with the queue and min oracles 3 at 20:40Z; IDL republished 20:47Z; 12 token Series: TSLAx at 20:44Z, the other nine by 22:26Z; relay topped up to 1 SOL at 20:49Z. All in `acceptance.md`, 9adaf66 and f146bcd)**
  - Surfpool fork: new `.so` at `cDcHZ…`, 6b proofs, `pnpm drive:events` regression.
  - Devnet `solana program deploy --program-id … --buffer …` (auto-extend); sha256 compare.
  - Codegen and IDL republish.
  - `admin_set_authorities` with the full set, the queue and min oracles.
  - Register 12 token Series (5.554 SOL); fund the relay to 1 SOL. Acceptance rows for each.
- [ ] **6c ops:** (all built and merged at 8b85afb; open only for the full-session run) (open: only the nested `halt-watch` box below)
  - [ ] `halt-watch` actor (Pyth confidence and staleness, RedStone staleness, xStocks issuer halt, quote failures) over one full live session. Fixture run passed 06:50Z 09-15 (NVDAx issuer-halt, QQQx quote-unavailable, TSLA pyth-wide, NVDA redstone-stale after the 20 s boot grace); live run 09-15 13:30–20:00Z pending. (open: it has run in the soak since 09-15 and its halts reach `/status` — route check 2026-09-19: issuer-halt on QQQx-5m, `quote-unavailable` on the other xStocks; D-099 — but no written observation of one full 13:30–20:00Z session exists)
  - [x] `calendar/earnings.ts` (Finnhub, 6 h): 7 per-symbol calls every 6 h, 3 s apart (the unfiltered calendar caps at 1,500 rows). Unknown-hour and `dmh` rows raise no `earnings-gap` flag (spec §3.3 as written).
  - [x] `scripts/drive/corporate-check.ts` (proposes, never writes). Finnhub `/stock/split` is 403 on the free key, so split skips come only from xStocks multiplier reasons and a person's review (answers C:02 §B "unverified").
  - [x] LiteSVM `events_halt_void.rs`: wide-confidence Pyth account → ConfidenceTooWide → void at T + 901, both orders (3/3; conf 182,739 refused, 182,738 prints).
- [x] **6d states and hedge:**
  - Every spec §5 row: basis-aware lane tabs and `laneState`; Gap card (listed, trading, locked); token labels; halted chip; new ticket blockers; claim-card void copy (Q-S6-7).
  - Fixtures in `/dev/states`, `/dev/session`, `/dev/hedge`.
  - Hedge: `@agari/markets/holdings` reader (Helius mainnet, verified mints, ScaledUiAmount in bigint), `GET /api/holdings`, and a `SeasonBanner`-anatomy card with devnet copy.
  - Merged ce40a0c + f1a4f8a: every §5 state from fixtures at 390/768/1440 both themes; void/halt/earnings copy from 6c core; `/api/holdings` reads real mainnet holders (ScaledUiAmount multipliers applied; 30/min → 429; bad owner → 400); `SHARE_TOKENS` gains AAPLx, MSFTx, METAx, AMZNx, GOOGLx, AAPLon, GOOGLon as hedge-only shares, each verified on mainnet against the TSLAx/TSLAon anchors (Token-2022, decimals, DAS symbol/name, scaledUiAmountConfig, authorities); exposure priced from the token's own Jupiter quote, else the underlying's signed spot (`pricedAs`/`priceSource`). Open: a live cross-check divergence names no check source (Resolution carries no check prints); the hedge tap → ticket preset is unproven end to end; live Gap/token cards wait on Series registration.
- [ ] **Devnet token-lane settlement on a weekday:** ≥ 1 settled Window per xStock. A devnet Down hedge IOC in session. Acceptance rows. (open: no settled xStock Window and no in-session Down hedge row in `acceptance.md`. Switchboard's quote gateway has answered 500 since 09-16, so the token lanes sit paused on `quote-unavailable`. The one DOWN cover fill on record is on `OPENAI-60m`, 2026-09-19 11:31Z, a Saturday)
- [ ] **Browser pass** at 390/768/1440 in both themes against the Masayume source for every §5 state; audit doc updated (D-036). (open: fixtures only: lane 6d walked every §5 state from `/dev/states`, `/dev/session` and `/dev/hedge` at 390/768/1440 in both themes, ce40a0c and f1a4f8a. No pass against live lanes, and the audit doc was not updated for S6)
- [ ] **Pre-deadline gate (D-059)**, STATUS, commit. Then post-deadline evidence rows: (open: no S6 gate result is recorded in STATUS, and none of the post-deadline evidence rows exist yet; the 09-21 Gap settlements are the next)
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

- **Foundation (2026-09-15; code `c9476c3`):**
  - Merged `stage/S3-venue-ops` @ `26a7f00` first (`session.ts` add/add conflict → S3's superset: `calendar.recent`, `sources.pythTrialLastCloseSec`).
  - Spike (b) numbers in spec §1.1 re-read from the archive and confirmed (D-052): at 09:30:00 ET MSFT/META/AMZN/GOOGL had 3 signers, all seven had 5 by 09:30:10. The 09-15 open row doesn't exist yet (archiver writes `2026-09-15.jsonl` at the session).
  - Ondo TSLAon/NVDAon/SPYon/QQQon checked on mainnet (Token-2022, 9 dp, metadata symbols match, `scaledUiAmountConfig` present; D-058).
  - `pnpm drive:roller-plan --at 2026-09-17T20:00:00Z` now prints 27 Regular, 9 Gap and 12 token rows: Gap "paused: lane not built", token "TSLA token versions: lane not built (6b …)". `policyVersions(…, "gap")` matches spec §1.2 (TSLA v1 Pyth open 4,294,967,295 / close 900, check 120/120; v2 RedStone; QQQ/VOO/NVDA v1).
  - Ops booted with `OPS_ACTORS=http,halts,earnings`: `/session` carries `halts {}`, `earnings null`, `skips []`; both new actors report "paused: lane not built (6c)".
  - `@switchboard-xyz/on-demand` 3.10.6 + `common` 5.8.5 add no override; both import in Node ESM (a harmless "bigint: Failed to load bindings" line, since `bigint-buffer` builds are off). The crossbar client is `CrossbarClient` from `@switchboard-xyz/common`.
  - Roller, tickers, maker and settler vitests 37/37. Gate: `pnpm typecheck && pnpm invariants` and `pnpm build` green.

## Handoff

- **Lanes** (spec §6, D-051), each cut from the foundation commit; merge order foundation → 6c → 6a → 6b → 6d:
  - **6a Gap:** `slice/S6a-gap` · `../agari-wt/s6a` · Surfpool 9061/9062.
  - **6b Token:** `slice/S6b-token` · `../agari-wt/s6b` · Surfpool 9063/9064.
  - **6c Halts · voids:** `slice/S6c-halts-voids` · `../agari-wt/s6c` · Surfpool 9065/9066.
  - **6d States · hedge:** `slice/S6d-states-hedge` · `../agari-wt/s6d` · web 3064.
- **Stubs each lane replaces (keep the exported signature; the dispatcher already calls it):**
  - **6a:** `window-roller/plan-gap.ts` `planGapSeries(series, clock): SeriesPlan` (`clock.gapLeadSec`, `clock.skips` with `lanes`); `price-relay/gap-slots.ts` `gapArchivePass(ctx, due, chainNow)` → `{ line, nextSec, taken }` (taken slot keys skip the Regular passes); `market-maker/seat/gap-fair.ts` `gapQuote(input): LaneQuote` (`phase`, `fairTicks`, `maxCashPerWindow` = `env.gapMaxCash`, `why`); `packages/markets/src/deploy/series-gap.ts` and `packages/db/src/print-archive-read.ts` (already re-exported with `export *`).
  - **6b:** `window-roller/plan-token.ts` `planTokenSeries`; `price-relay/switchboard-pass.ts` `switchboardPass(ctx, slots, chainNow)` (every unexpired Switchboard slot, due or not) and `price-relay/jupiter-attest.ts` `jupiterAttestPass` (attested slots of token Series) → `LanePassResult`; `seat/token-fair.ts` `tokenQuote` (`env.tokenMaxCashPerWindow`); `deploy/policies-token.ts` `tokenPolicyVersions(symbol, sources)` + `tokenPolicyFor(source, ticker, sources, check)`; `deploy/series-token.ts`, `ops/prints/switchboard.ts`, `prices/jupiter.ts` (re-exported by `ops/prints`), `prices/legacy/switchboard-quote.ts` (re-exported by `prices/legacy`). `tokenLane.<xStock>.feedHash` is `null` until spike (a).
  - **6c:** `actors/halt-watch/index.ts` `startHaltWatch(deps)` writes only `deps.halts.set/clear(asset, reason, nowSec)`; `calendar/earnings.ts` `startEarnings(deps)` writes only `deps.events.setEarnings(events)`. Core `market/{halts,void-reason,events-calendar,corporate}.ts` are new files: 6c adds their lines to `packages/core/src/market/index.ts`. The types they implement are frozen in `packages/core/src/types/session-lanes.ts` (`HaltBoard`, `EarningsEvent`, `CorporateSkip`, `MultiplierChange`, `VoidDetail`). `corporate-actions.json` is read by `runtime/session-events.ts` (re-read on change; malformed entries are dropped and listed by `events.problems()`), so the new `lanes`/`multipliers` shape needs no ops edit.
  - **6d:** `packages/markets/src/holdings/index.ts` behind the new `@agari/markets/holdings` export (server-only). The five blocker kinds exist with the spec §5 strings (`BlockerContext.opensText`); 6d owns refining them. Lane keys for `laneState`: core `laneKey(symbol, basis, cadenceSec)`. `/session` now adds `halts` (asset → `{ reason, sinceSec }`), `earnings` (`EarningsEvent[] | null`) and `skips`.
- **Dispatch already done (no lane edits):** roller `plan-basis.ts`; relay tracker and pass; settler (all known bases, no stub, since rules are unchanged); maker listing and `WindowCtx.lane`; lane keys through `seriesLaneKey` (settler/relay log labels now read `TSLA-60m`, not `TSLA-1h`); `PrintSlot.basis`; `policyVersions(symbol, sources, basis)`.
- **Env knobs added (defaults):** `ROLLER_GAP_LEAD_SEC` 172800; `MM_GAP_MAX_CASH` 25; `MM_TOKEN_MAX_CASH_PER_WINDOW` 10; `OPS_ACTORS` default adds `halts,earnings`.
- **Not typechecked by `pnpm typecheck`:** `scripts/**` (no tsconfig). `scripts/drive/roller-plan.ts` was checked ad hoc; lanes adding scripts check theirs the same way or run them.
- **Multiplier precision (6d):** Ondo multipliers carry up to 16 decimals (NVDAon `1.0017152487959897`); flooring to `multiplierE12` loses < 10⁻¹² relative. Disclose, never use floats.
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
