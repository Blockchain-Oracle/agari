# S18 browser pass — closed state — 2026-09-15

Agari `stage/S18-always-on`, worktree `../agari-wt/s18`, HEAD `52a9d88` (branch tip at test time; briefed against `810b87e`), served on `:3018`. Tested during the post-session closed window: NYSE closed 2026-09-15 20:00Z, reopens Wed 2026-09-16 13:30Z (09:30 ET). 27 Windows for the Wed 09:30 ET open are prelisted by the roller.

## 1. Method

- **Browser.** The shared chrome-devtools MCP browser was locked by another session (`s18-pass-open`, running the open-state half concurrently) — every MCP tool call failed with "browser already running / use --isolated". Switched to the `chrome-devtools-mcp` CLI (`node .../chrome-devtools-mcp/build/src/bin/chrome-devtools.js`) with `start --isolated --headless`, a private daemon for this session only.
- **Viewports.** `resize_page` was used for the first page while it was the only tab (verified accurate via `window.innerWidth`/`innerHeight` each time: 390×844, 768×1024, 1440×900). Once a second page was opened for a parallel check, `resize_page` was found to resize the one shared headless window under both tabs (and to floor at ~500px regardless of the requested width) — `emulate --viewport WxHxDPR,mobile,touch` was used instead for any multi-page work, which is per-target and confirmed independent.
- **Theme.** `agari_theme` in `localStorage` (`"dark"`/`"light"`), applied via `document.documentElement.setAttribute('data-theme', …)` (`web/src/lib/theme.ts`); switched with `evaluate_script` then a reload.
- **DOM assertions.** `document.body.innerText.includes("LOADING")`, `.includes("The stock market is closed")`, and a StaleTick count via `document.querySelectorAll('span[role="status"][aria-live="polite"].text-warning').length` — this combination of attributes is unique to `components/states/StaleTick.tsx` in `web/src` (every other `role="status"` element lacks either `aria-live="polite"` or the `text-warning` class).
- **Network.** A fresh `navigate_page` to `/markets` at 1440 dark, then a 120 s background wait, then `list_network_requests` with `pageSize 500` and `get_network_request` to inspect specific request/response bodies.
- All times below are ET/UTC as shown by the app; capture wall-clock was ~2026-09-15 20:38–21:55 UTC.

## 2. `/markets` (closed state)

DOM assertions were run at all six width/theme combinations; all passed identically: `LOADING` absent, `"The stock market is closed"` absent, StaleTick count `0`. The header's aria-live status region reads `"Stock market After hours: reopens Wed 09:30 ET"` throughout.

| Width | Theme | Observation | Verdict |
|---|---|---|---|
| 390 | dark | Hero: mark (G, blue disc) + "ALPHABET · GOOGL" + $345.02 + "−$4.36 · −1.24% since last close" + real 1D chart (13:30–20:00) + "OPENS IN 16h 56m" countdown. "Last close · as of 16:00 ET" — the "as of 16:00 ET" half is hidden. Session chip hidden (mounts ≥1024 px). Marquee carries "REOPENS WED 09:30 ET". Bottom pill nav present, no overlap with hero. | Exact — the hidden "as of" clause is Masayume's own `part-16.css` rule `@media (max-width:760px) { .hero-chart-head .meta-soft { display:none } }`, unrelated to S18 |
| 390 | light | Same content and layout, light tokens correct, no contrast issues seen. | Exact |
| 768 | dark | "as of 16:00 ET" now visible (>760 px). Header chip still hidden (<1024 px); the lanes section carries its own "● AFTER HOURS · REOPENS WED 09:30 ET" status line instead. Live-windows rail shows 2-up NextWindowCards. Sensei "Want a read?" bubble bottom-right. | Exact (D-087 amendment) |
| 768 | light | Same. | Exact |
| 1440 | dark | Full hero + "Your call" schedule ticket for the selected Listed Window: "Listed · opens Wed 09:30 ET", UP/DOWN radios, price control (55¢), current cost/return/max loss dashes, "Bets are placed from your wallet…Connect to place one", and the D-088 opt-in switch "Keep it resting until the Window locks" with its full off/on explainer. Live-windows rail: tabs "5m 9 live" / "15m 9 live" / "1h 9 live" (see Defect 1), 8 NextWindowCards ("Schedule a call on this <TICKER> Window", "opens Wed 09:30 ET", POST-ONLY · YOUR PRICE), paginated "1–8 of 9". Word board "Just ask" shows its static desc line, then a 27-card "Later" rail of X-grammar yes/no questions ("Will GOOGL be above its opening print at 2:35 PM? … YES no book / NO no book") — this is the word board's next action while nothing is live, and pre-empts the plainer "Read the wire" fallback since real upcoming questions exist. Header session chip visible. | Exact/Additive (D-086, D-087, D-088) |
| 1440 | light | Same content, light tokens correct. | Exact |
| 1024 | (chip boundary) | `document.querySelector('.mks-chip')`: `display !== 'none'` at exactly 1024 px width, `display === 'none'` at 1023 px. | Exact — matches D-087's amendment to the pixel |

**Marquee "OPENS IN" vs "REOPENS":** at capture time the marquee showed "REOPENS WED 09:30 ET", never "OPENS IN". Checked against source (`web/src/components/shell/Marquee.tsx` `sessionCell()`): "OPENS IN" is used only when the next open falls on the *same* ET calendar date as now, else "REOPENS · <day> <time>". Since the next open is a different day (Tuesday evening → Wednesday), "REOPENS" is correct by design; "OPENS IN" is confirmed present elsewhere (the hero's own countdown reads "OPENS IN 16h 56m" at all widths). Not a defect.

## 3. `/markets/<id>` (Listed/next Window)

`web/src/app/markets/[id]/page.tsx` is a bare `redirect("/markets")` — a legacy path, unchanged, matching the S4 fidelity audit's "Legacy … Same redirects" note. The live deep-link mechanism is the query-param form `/markets?m=<marketId>&dir=<up|down>`, used throughout the app (e.g. every "Later" grammar card link).

Tested `/markets?m=4nSUDjz4tGzRdxPiMkKdGXJZS1rwj5kbywbJxSij916q&dir=up` (a GOOGL 5m Window, from `/markets`'s own "Later" rail). Renders the same Listed-state hero and "Your call" ticket as §2, with UP pre-selected (highlighted). The chart briefly showed only a loading icon on first paint, then rendered fully within ~2 s (the `lightweight-charts` chunk is a `next/dynamic` lazy import per the S4 fidelity audit) — not a defect.

**Window id used:** `4nSUDjz4tGzRdxPiMkKdGXJZS1rwj5kbywbJxSij916q` (GOOGL, 5m, opens Wed 09:30 ET).

## 4. `/portfolio` (disconnected)

"Connect Wallet" card: icon, heading, Connect button, and the next action "New to Solana? Test funds are free →". Not a dead end. Exact/Additive.

## 5. `/dev/hero`, `/dev/session`, `/dev/states`

- **`/dev/hero`** ("Hero market"): five labeled fixture sections, each rendering the full closed hero (mark, price, distance, chart, foot) plus two NextWindowCards and the session chip: **PRE-MARKET** (opens in 1h 30m), **AFTER HOURS** (opens in 16h 30m / reopens today's fixture Tuesday), **WEEKEND** (1d 22h), **HOLIDAY — Thanksgiving** (22h 30m), and a "later window skipped" case (a Window further out than the immediate next one). Covers every clock D-086 names.
- **`/dev/session`** ("S6 · Market session"): nine `MarketSessionChip` fixtures — **PRE** (opens in 1h30m), **REGULAR/OPEN** (closes in 3h), **EARLY CLOSE** (Black Friday, closes in 2h), **HALTED** ×3 (TSLA/Pyth-wide; AAPL/RedStone-stale, tagged `Q-S6-9`; TSLAx issuer halt at the weekend), **POST/AFTER HOURS** (reopens Wed), **WEEKEND** (reopens Mon), **HOLIDAY — Thanksgiving** (reopens Fri) — matches D-087's `SessionState` enum plus its halted sub-variants. Below that, a separate "00 · Session key" section (S7 tap-trading key fixtures: not-deployed / no-wallet / disarmed / armed) — outside S18's scope but present and coherent.
- **`/dev/states`**: the broadest fixture catalog — "01 Type stack" (font/weight scale), "02 Honest states" (loading/live/stale-last-good/empty-with-explanation/blocked-with-reason/error, on a fixed clock), **"S6 · Session lanes"** (Gap listed/trading/locked/settled; 24/7 token trading; four paused variants — no signed source, corporate action, Pyth-wide halt, RedStone-stale halt; ticket blockers; earnings warnings; three void-claim reasons), **"S18 · Pre-open calls"** (Listed Card ×2 — Regular and Gap; Schedule Ticket in five states — ready, rest-would-cross, too-many-resting, below-min-stake, over-balance; Scheduled Call receipt — live and cancelled; Portfolio resting rows — resting-for-the-open, resting, didn't-fill), then "03 Numbers", "04 Chrome", "05 Receipt", "06 Primitives". This page is also where Defect 2 (below) was resolved as a data issue rather than a component bug: its "LANE TABS — 5M · 15M · 1H · GAP · 5M · 24/7" fixture proves `LaneTabs` renders Gap and token tabs correctly when the caller passes them.

## 6. `/news`, `/activity`, `/tickers/TSLA`, `/reels`

- **`/news`** — lead story with a tone-colored left edge (BULLISH, green) and arrow; row items carry 16 px asset marks and `$TICKER` cashtags (`$NVDA $MSFT $AMZN $GOOGL`) plus a tone word (NEUTRAL) on the right. Matches the D-082 grammar.
- **`/activity`** — disconnected, shows only "Connect a wallet to see its activity" + Connect (the inbox needs no signature, just an address). No editorial rows are reachable without a wallet; this matches the known limitation already recorded in the prior fidelity audit's fix log (`36d8c37`, "`/activity` itself needs a wallet, no rows to pass"). Not re-verified with a connected wallet (out of scope for a read-only pass with no wallet).
- **`/tickers/TSLA`** — Tesla mark (48 px) + "$TSLA" cashtag headline, session line, spot price, "Calls" feed with TAKE/LOST/FILLED verdict rows carrying the tone dot and cashtag grammar.
- **`/reels`** — the closed-state card reads the session phrase via `sessionClosedLine`: *"After hours · reopens Wed 09:30 ET. Regular Windows roll from the open."* Scrolling the reel's own `.reel-page.feed-snap` container (not the document) surfaces a take card beneath it: the D-082 take-chip (Tesla mark + "UP · $TSLA vs the opening print"), a caption naming "$AAPL" inline, "the Room ↗" and "See how it closed →". See Defect 1 for a 390-width layout issue found here.

## 7. Network — `/markets`, 1440 dark, 120 s after a fresh navigate

| Check | Result | Verdict |
|---|---|---|
| SSE / event-stream connections | 1 (`GET http://localhost:8787/prices/stream`) | Matches "expect 1" |
| Requests to a path containing `/session` | 1 (`GET http://localhost:8787/session`) | Within "expect ≤ 2" |
| Any endpoint hit every ~5 s | None found | Matches "expect none" |
| `/prices/latest` | 1 request (initial mount only) | The SSE stream evidently keeps price data fresh enough that the 60 s off-hours poll never needed to fire as a fallback inside the 120 s window — matches the documented "poll only as fallback" design (P-04) |
| `/api/sentiment` | 3 requests, ~40–60 s apart | Not a 5 s poll |

**Secondary finding (does not fail the stated gate, but worth a look):** a **15-second** interval poll runs continuously, from two synchronized sources:
- `GET /api/index/markets?state=open&expiryFrom=<t>&limit=300` — 12 requests in 120 s; `expiryFrom` increments by exactly 15 each time (1789504830, …845, …860 … 995).
- `GET /api/index/markets/4nSUDjz4tGzRdxPiMkKdGXJZS1rwj5kbywbJxSij916q` (the selected Window's detail row) — 12 requests in 120 s, same cadence.
- Underneath both: **98** `POST https://api.devnet.solana.com/` calls in 120 s (~8 per 15 s cycle). One decoded response body is a `getMultipleAccounts` result for a 456-byte account — exactly the Market account size from D-006 — confirming these are raw on-chain reads of the selected Window's accounts (Market, and likely Book/Ledger/mvault/Series alongside it).
- Source: `packages/markets/src/runtime/coordinator.ts`, `POLL_MS = 15_000` — the pre-existing Book coordinator's documented fallback ("extra Books share one batched read every 15 s") for a Book not on the live websocket path. This is P-05 machinery from the S4 fidelity audit, not new to S18, and it does not distinguish a closed/Listed Window (nothing can trade) from a live one.
- This technically satisfies the literal gate ("no 5 s polling"), but it sits in tension with 18a's own stated goal of `staleTime = min(nextOpen − now, 6 h)` for closed surfaces — a closed, Listed Window's on-chain state is being re-read roughly every 15 s indefinitely, at ~8 RPC calls per cycle, for no expected change until the bell.

## 8. Screenshots

Directory: `/private/tmp/claude-501/-Users-abu-dev-hackathon-stocklana/1762a6a4-8db9-464e-9377-12e0a20db381/scratchpad/s18-pass/`

- `markets-390-dark.png`, `markets-390-light.png`, `markets-768-dark.png`, `markets-768-light.png`, `markets-1440-dark.png`, `markets-1440-light.png`, `markets-1440-dark-full.png`
- `markets-detail-1440-dark-2.png` (the `?m=…&dir=up` deep link)
- `portfolio-1440-dark.png`
- `dev-hero-1440-dark-full.png`
- `dev-session-1440-dark-full.png`
- `dev-states-1440-dark.png`
- `news-1440-dark.png`
- `activity-1440-dark.png`
- `tickers-tsla-1440-dark.png`
- `reels-1440-dark.png`, `reels-scroll-1440-dark.png`
- `reels-390-dark-overlap.png`, `reels-390-light-overlap.png`

## 9. Defects

1. **`/reels` · 390 wide · dark and light** — the "Take" FAB button overlaps the closed-state headline (`.reel-holding-title`). Rects (dark; identical in light): Take `{top 384.5, right 374, bottom 459.5, left 302.6}` vs headline `{top 377, right 349, bottom 455, left 41}` — an intersecting region roughly 46×70 px, clipping "Wed 09:30 ET" and "Windows" behind the orange pill. Surface owned by 18d. Reported live to the stage owner during the pass.
   - **Fixed in `0157529`** on `stage/S18-always-on`: below 660 px the holding card gets 88 px of right padding. Measured on a dev build (not `:3018`): at 390 wide the title's right edge is 289 against the pill's left edge at 303 (no overlap); at 320 wide, 219 against 233; at 700 wide the layout is unchanged. `:3018` still serves the pre-fix build until the `integration/w1` → `stage/S18-always-on` merge and rebuild — not re-tested there per the stage owner's instruction; the rects recorded above stand as the pre-fix baseline.
2. **`/markets` · all widths · dark and light** — the "Live windows" lane tabs show only `5m` / `15m` / `1h`; no `Gap` or token (`5m · 24/7`) tab appears. Root cause is at the data layer, not the component: `curl :8787/session` returns 27 lane keys, all `<TICKER>-5m`/`-15m`/`-60m` (Regular basis only) — no Gap or token entries at all. `LaneTabs` itself renders Gap and token tabs correctly and at zero-count when given them (confirmed on `/dev/states`'s own "LANE TABS — 5M · 15M · 1H · GAP · 5M · 24/7" fixture). This reads as an ops/session-config gap rather than a UI defect, but the checklist expected to see them live and they are absent.
3. **(Secondary, non-blocking) `/markets` · 1440 · dark** — see §7: a 15 s poll (indexer list + indexer detail + ~8 raw devnet RPC reads per cycle) runs indefinitely against the closed/Listed selected Window. Passes the literal 2-minute gate as stated but conflicts with 18a's closed-surface `staleTime` goal. Pre-existing `packages/markets/src/runtime/coordinator.ts` behavior (P-05), not introduced by S18.

## Open state (pending, Wed 09-16 during NYSE hours)
