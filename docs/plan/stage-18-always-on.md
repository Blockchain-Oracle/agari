# S18 — Always-on markets, pre-open calls, asset identity, editorial lift

**Goal:** Agari never looks empty and feels like a product, not a demo. Approved by the user on 2026-09-15 (plan r2, `~/.claude/plans/valiant-wibbling-kahan.md`).
1. **Always-on markets:** when NYSE is closed, `/markets` still shows every asset's last price and change, a real price chart of the last session, the session state with a countdown, what lists next per lane, and a next action. The marquee never says `LOADING` when a last price exists. Portfolio's empty state never dead-ends.
2. **Pre-open calls ("schedule a trade"):** on a Window listed before the open, a user rests a post-only call at their price; it fills within the first minute after the bell if the book comes to them, else the stake returns. Their wallet signs; nothing server-side holds keys.
3. **Asset identity:** real stock marks (inline SVG in Masayume's grammar) everywhere an asset appears, including the marquee, ticker hub, Sensei cards, portfolio rows and share cards.
4. **Editorial lift:** `/news`, the activity wire and the take card are redesigned from 2–3 generated 21st directions, one chosen and recorded, in Masayume's tokens.
5. **Cleanup:** the `21st review` errors, duplicated closed-market copy, leftover identity strings, and honest states for the deferred stages.

- **Plan:** `00-plan.md` §5, §7.2; the r2 plan above is the contract until a spec is cut.
- **Fidelity:** D-081 amends D-036: Masayume stays exact for everything it has; creativity applies to surfaces Masayume never had and the ones the user flagged, in Masayume's tokens.
- **Deferral:** D-084: S8–S12 and S14 move past the deadline; W2 = S18. Their routes render their existing "not live" states.

**Branch:** `stage/S18-always-on` in worktree `../agari-wt/s18`, cut from `integration/w1` @ `8b0bbec` (S3+S4+S5+S6+S7+S13 stages merged; served on `:3000`).
- **Lanes:** `slice/S18a-always-on` (`../agari-wt/s18a`, web 3181), `slice/S18c-marks` (`../agari-wt/s18c`, web 3183), `slice/S18f-preopen-web` (`../agari-wt/s18f`, web 3186, after 6b's program change merges), `slice/S18d-editorial` (`../agari-wt/s18d`, after `21st login`), `slice/S18e-cleanup` (`../agari-wt/s18e`, Thursday).
- **Also in flight for S18:** lane 6b carries the ≤ 15-line program change (D-088) inside its Wed `agari-events` upgrade; lane 6a carries the roller prelist and the maker order type (D-089, D-090) on the S6 stage.
- **Merge order** into the stage branch: 18a → 18c → 18f → 18d → 18e, then `integration/w1`.
- **Shared files** (append-only lines, stage-owner approval): `packages/markets/src/react/keys.ts`, `packages/core/src/copy/index.ts`, `packages/core/src/market/index.ts`, `web/src/features/markets/{hero,lanes,session,ticket}/index.ts`, `web/src/lib/copy.ts`, `web/src/styles/icons.css` (the `has-mark` list), `web/src/app/api/index/[...path]/queries.ts`, `THIRD_PARTY_NOTICES.md`.
- Nothing merges to `main` before the S1 Phantom check.

**D-number range:** D-081…D-091 (D-073…D-080 are reserved for the W1 stage owners).

## Steps

- [ ] Foundation (stage owner): integration branch on `:3000`; this file; D-081…D-091; plan §7.3 waves and `parity.md` updated; `ALPACA_KEY_ID/SECRET_KEY` in `web/.env.local` (server-only, never printed); lane worktrees.
- [x] **18a Always-on** (data + UI, one lane; S18a.1–S18a.7 on `slice/S18a-always-on`; the bars stretch is not built):
  - ops `spot-sse.ts`: `/prices/latest` and the SSE snapshot never drop a symbol (`ageSec`, `fresh`); newest `print_archive` row as the fallback when the in-memory feed is empty (`source: "archive"`).
  - db `printArchiveSeries`; index `case "archive"` with `IndexQuery.cacheSec` (`s-maxage=60`).
  - web `features/markets/history/*`: 1D from the signed archive + live tick; `useDailyCloses`; `dayChange()`; keys appended; closed-surface `staleTime = min(nextOpen − now, 6 h)`, `gcTime` 30 min; `useAssetPrice({ pollMs })` 60 s off-hours.
  - core `copy/session-words.ts` (`sessionStateWord`, `sessionPhrase`, tested); `parseLaneKey`.
  - UI: `HeroAssetChart`/`HeroAssetHead`/`HistoryRangeTabs`; `TicketPlaceholder`; `NextWindowRail`/`NextWindowCard`; `CadenceLanes` configured lanes; `BetweenRounds` countdown; word board `nextAction`; header `MarketSessionChip`; marquee phrase + last-close fallback; portfolio empty `nextAction`; chip `data-state` + phrase; `copy-session.ts`; `/dev/hero` fixtures at pre/post/weekend/holiday clocks.
  - Stretch (open): Alpaca bars route (`web/src/lib/alpaca.server.ts`, `app/api/bars/route.ts`; `data.alpaca.markets`, `feed=sip` for history) and 5D/1M/3M ranges. `HISTORY_RANGES` lists 1D only until it lands.
- [x] **18c Asset identity:** `Ticker.brand { slug, hex }`; `--brand-<slug>` in `icons.css` + the drift vitest; `components/icons/asset-marks/{paths.ts,AssetMarkSvg.tsx}` (simple-icons CC0, vendored); `asset-mark.tsx` marks, xStock badge, issuer-colour monograms for QQQ/VOO/SPY; placements: marquee + `TickerItem`, ticker hub h1, Sensei cards, `BetRow`, share-card canvas (`features/share/marks.ts`); `THIRD_PARTY_NOTICES.md` "Asset marks" (fix the Masayume header).
- [x] **B-P program** (lane 6b, merged S6 2931695 → w1 → S18; devnet upgrade tonight): `check_order` admits PostOnly on Listed; `PreOpenTakerRefused = 121`; matching unit test; LiteSVM `events_preopen.rs` (6 cases); codegen; `chain-failure.ts`/`ops/send.ts` map 6121.
- [x] **B-O roller + maker** (lane 6a a0f279f + c4d35a3, merged S6 → w1 → S18; first prelist at the 09-15 close): prelist the first Window of the next session per Regular Series (`ROLLER_PRELIST`, `ROLLER_PRELIST_CADENCES`, `PRELIST_MARGIN_SEC`; the 60m lane's first Window is 10:00); `grow()` on listed Windows; `MM_ORDER_TYPE=post-only|limit` (default post-only); `window.ts` reads `rested_lots`/`stop_reason`; vitests incl. the 60m case.
- [x] **18f Pre-open web** (after 6b merges): core `isRestable`, `orders/resting-quote.ts` (`min_lots` 1,000), `projection/orders.ts`, blockers, port fields (`entry`, `restUntil`, `"resting"` outcome); markets `status-gate` admit, `build.ts` orderType, `rest-lane.ts` (default `expireTs = tradingStartSec + 90`), `cancel-lane.ts`, `listRestingOrders` over `wallet/{addr}/orders?open=1`, `useRestingOrders`; web ticket schedule mode, `PriceControl`, `ScheduledCall`, `ListedCard`, `RestingRows`, crossing copy from `bestBid/bestAsk`, `/dev/states` fixtures; s13 activity `resting-filled`; settler crank-redeems zero-balance bonded seats. (S18f.1–7 on `slice/S18f-preopen-web`; the `ScheduleCallButton` seam in 18a's closed hero, ticket placeholder and NextWindow cards is wired once 18a is on the stage branch.)
- [x] **18d Editorial** (after `21st login`): `.21st/design.json` (hand-filled: the scanner reads no plain-CSS tokens); `21st search` ×2; `21st generate` locked on the account (AI subscription) → three hand-drafted directions in `data/18d-directions/`, screenshots 390/1440; **the user picked V1 Ledger + two tweaks (2026-09-15)**; `NewsRow` + `news-wire.css` (lead edge, marks, cashtags, the shared row for news/activity/ticker hub), `TakeReelCard` chip mark + cashtag, composer preview; `21st review` zero errors on touched paths; D-082 amended. Browser pass 390/768/1440 both themes (S18d.7).
- [x] **18e Cleanup** (done Tue 09-15, `slice/S18e-cleanup` b695304 → 92d02c0; `21st review web/src` 25 → 2 errors, the two in `components/ui` left by rule; knip-confirmed dead files removed; 18 routes walked at 1440/390): nav honesty for S8–S12/S14 routes first; `21st review` errors; `sessionClosedLine`; `useTickerNews` key; `AgariMark` comment; user-visible identity strings outside pitch/demo; knip-confirmed dead exports.
- [x] **Devnet drives** (Tue 09-15 close prelist 27/27 ✅ 52a9d88; Wed 09-16 bell: both pre-open calls filled 23 s after the open at their resting prices 550 and 200 ✅ 6d8817e; settle → crank redeem → ledger close ✅ this commit; **open** still: the expiry → sweep → credit path, since the far call filled instead of expiring): Tue 20:00Z first prelist (soak on the S6 stage, `ROLLER_PRELIST=1` if the roller holds ≥ 3 SOL); Wed 20:00Z schedule a pre-open call for Thu 13:30Z with `MM_ORDER_TYPE=limit`; Thu 13:30Z fills observed (Fri 13:30Z fallback). Acceptance rows for every signature.
- [ ] **Browser pass** at 390/768/1440 in both themes while closed and while open; `/dev/hero`, `/dev/session`, `/dev/states`; audit doc rows per surface (Exact / Additive-by-D-08x); `parity.md` L-17 → Adapted.
- [x] **Gate** (2026-09-16 13:53Z, green): `pnpm typecheck` 0 errors · `pnpm invariants` 0 errors/0 warnings · `pnpm build` compiled in 16.1 s, `:3018` restarted on `d4b19d3` (which also cleared the stale-build 500 on the deleted `/app/bet-screen.png`: now 404, `/demo/bet-screen.png` 200) · `21st review src/styles/reel-chrome.css` (the only web path S18 touched after the lane merges) 7 findings, **0 errors**, all `info design-hardcoded-color` on pre-existing lines · `cargo test` from Phase A (`w1 data/deploy/cargo-test.log`, 09-15 16:45): **72 passed, 0 failed** across 15 suites including `events_preopen` for the 6121 rule, 0 panics · closed-`/markets` DOM: no `LOADING`, no closed sentence, 0 StaleTick, and 2-min network 1 SSE / 1 `/session` / no 5 s poll (`docs/plan/audits/s18-browser-pass-2026-09-15.md`) · open-state pass at the bell in the same doc. Original gate text: `pnpm typecheck && pnpm invariants && pnpm build`; `21st review` zero errors on touched paths; `cargo test` for the program change; the DOM of a closed `/markets` contains neither "LOADING" nor "The stock market is closed" nor a `StaleTick`; network over 2 min: 1 SSE, ≤ 2 `/session`, no 5 s polling.

## Findings

- Two root causes of "empty": every `/markets` surface keys off live Windows, and `/prices/latest` drops quotes older than 60 s. Masayume (24/7 crypto) never had a closed state.
- `print_archive` already holds a signed 5-minute intraday series per ticker per session with no read path; RedStone rows are keyed by ticker.
- The only pre-open refusal is `matching/place.rs:60-62`; PostOnly can never fill (`Walk::CrossCheck`); `min_rest_slots` never blocks a user's cancel; the roller already sweeps at lock; redeem folds `locked_cash` + bond.
- The 60m lane's first Window is 10:00–11:00 with an `Intraday` open, so a prelist keyed on `openKind` would skip it.
- Prelist float ≈ 0.0665 SOL per listed Window (Market 456 B + Ledger 8,552 B + mvault 165 B), refunded at `close_ledger`/`close_market`.
- A resting call that lives until `lock_at` would be picked off by the venue's own maker mid-Window; the default expiry is `trading_start + 90 s`.
- Alpaca's free plan serves SIP bars whenever `end` is ≥ 15 min old; the keys exist in the ops env and are copied to `web/.env.local`.
- `21st search/generate` need a fresh `21st login` (401 today); `21st logo` and `21st review` work without it.

## Handoff

- Resume from the first unchecked box. The user's blocking items: `21st login`, devnet SOL (≈ 15 SOL sequenced, 21.5 all at once), the Phantom check, the news direction pick, the S16 deploy go.
- Lane reports go to the stage owner; every devnet signature goes in `acceptance.md`.
