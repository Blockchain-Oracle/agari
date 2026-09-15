# Social and assistant spec (S13): Sensei, Room, Takes, Reels, news, alerts, marquee, A-3a, A-3c

**Authority:**
- **Plan:** §0 (Q-001…Q-003), §5, §7.2 S13.
- **Decisions:** D-004, D-012 (signed texts), D-023 (`signMessage` seam), D-031…D-036 (D-036: exact Masayume replica, performance non-negotiable).
- **Parity rows:** L-04, L-17, L-41…L-45, A-3a, A-3c. Y-08 is Excluded, but its Fear/Greed cell is owed under Q-001.
- **Other sources:** `first-call.md` §1 and §5; audit `ui-fidelity-2026-09-14.md` C-07, C-16, C-26.
- **Design authority:** Masayume `68f7a09` (`M:`), and nothing else.

Frozen at the S13 foundation commit. Changes need a D-entry in D-071…D-080. Every lane reads §1 intro, §2, §3 and §5, then its own §1 part.

## Code state (S4 head `c5ddb60`)

A brand-normalised diff against `M:` shows Sensei, Room, Takes, alerts, news, reels and `packages/brain` already ported. Only the ed25519 seam and the stock price rule differ (C-26).

- **Works:**
  - Signing: the browser signs with `signText` (`web/src/lib/wallet-session.ts:56-58`); the server verifies with `verifyWalletMessage` (`web/src/lib/auth/verify-signed-message.server.ts:13-15`) over core `verifySignedMessage` (`packages/core/src/auth/signed-message.ts:53-62`).
  - The room join and take texts carry the network line (`features/room/protocol.ts:24-36`, `features/takes/protocol.ts:30-44`).
  - The take POST verifies and stamps `backed` (`app/api/takes/route.ts:54-98`).
  - Sensei trade cards deep-link to the ticket (`features/sensei/SenseiTradeCards.tsx:74-81`).
- **Stubbed:**
  - `POST /api/room/bet` answers 503 `not-deployed` (`app/api/room/bet/route.ts:37-45`), so the bettors registry is never written.
  - The gate therefore falls back to `listOpenPositions` (`features/room/gate.server.ts:66-74`), which counts only Windows still `open` with held lots (`packages/markets/src/provider/wallet.ts:40-45`). A bettor who sold out, or whose Window settled, is locked out of their own Room.
- **Still crypto- or EVM-shaped:**
  - `/api/news` reads Cointelegraph and Decrypt RSS (`app/api/news/route.ts:13-16`).
  - Sensei's prompt knows nothing of the session, earnings or the user's positions (`features/sensei/prompt.ts:27-70`).
  - Alerts store whole-dollar floats and truncate cents (`features/alerts/store.ts:17-25`, `AlertsWatcher.tsx:12`, `PriceAlertsButton.tsx:28-30`).
  - The marquee takes its assets from live lanes only, so off-hours it shows a failure headline (`components/shell/Marquee.tsx:31-68`, audit C-07).
  - Room avatars take `author.slice(2, 4)`, a leftover of `0x` addresses (`features/room/CommentRoom.tsx:111`).
- **Absent:**
  - Cashtags, ticker rooms, profiles, the activity feed, lifecycle notifications and a sentiment cell.
  - A follow writer: `game_follows` exists with no reader or writer (`packages/db/src/schema-games.ts:52-63`).
  - The venue board: `readVenueBoard` is S5's stub (`packages/markets/src/provider/tape.ts:69-72`).
- **Env (presence only, `web/.env.local`):**
  - Set: `DATABASE_URL`, `FINNHUB_API_KEY`, `OPENAI_API_KEY`, `AI_MODEL`, `ROOM_TOKEN_SECRET`.
  - Empty: `AI_GATEWAY_API_KEY`.
  - `resolveModel` takes the direct OpenAI path when `AI_MODEL` names an openai model (`packages/brain/src/model.ts:71-96`).
  - `FINNHUB_API_KEY` is also an ops secret (`services/ops/src/runtime/env.ts:38`).

## 1. Deliverables → Masayume source → Solana data

### 1.1 Sensei (L-41 · 13a)

`M:web/src/features/sensei/*`, `M:web/src/app/api/sensei/route.ts`, `M:packages/brain/src/model.ts`. Chrome, ring, teaser, drawer, meter, tape, typewriter and chips stay pixel-identical (audit C-16).

| Item | Rule |
|---|---|
| Stable prefix `SENSEI_SYSTEM` (`prompt.ts:27-41`) | **Every sentence is kept.** Built once at module load, so the prefix stays byte-identical within a deploy.<br>**New, from the ticker registry and the calendar:**<br>- the ticker list and the 5m/15m/60m cadences;<br>- the session rule: "Windows list only in the NYSE session (09:30–16:00 ET, 13:00 on early closes). Outside it, say the market is closed and when it opens."<br>**The advice line:** "You never advise on buying, selling or holding shares, xStocks or any real-money position, and never on taxes or allocation. If asked, say in one sentence that you can't advise on that, then offer a read on a live Window with test funds."<br>THE BRAKE stays verbatim and last (`prompt.ts:40`) |
| Request (`protocol.ts:31-44`) | Additive and optional. Still no wallet address (`protocol.ts:9-13`):<br>- `session: { state, label }` from `useMarketSession()` (`features/markets/session/useMarketSession.ts:71-83`);<br>- `positions: { asset, cadence, side, stakeCents, markCents, minsToClose }[] ≤ 8` from `usePositions` (`packages/markets/src/react/useReads.ts:107`);<br>- `record: { settled, wins, losses, streak }` from `useWalletHistory` (`useReads.ts:123`).<br>Positions and record are read only while the drawer is open |
| Per-turn context (`prompt.ts:44-70`) | The server adds:<br>- one session line;<br>- the user's positions;<br>- the record ("lost the last 3" feeds the Brake);<br>- **earnings:** for tickers in the snapshot or positions (else the whole registry), the next report within 14 days from `earningsWithin()` (§3.1), e.g. "NVDA reports Wed 09-17 after close".<br>Off-hours with no Windows, the "no live data" line (`prompt.ts:51-54`) becomes "market closed, opens {label}" |
| Advice tripwire (new, route) | A regex on the last user turn: `/\b(buy|sell|hold|short)\b.*\b(shares?|stocks?|xstocks?|portfolio)\b|\b(retire|401k|ira|taxes?)\b/i`. A match adds the per-turn cue "This asks for investment advice: refuse it plainly, then offer a Window read." No second model call |
| Trade card → ticket | Unchanged: `marketDeepLink({ marketId, dir })` → `/markets?m=&dir=` selects the side in the one Ticket |
| Limits (new) | An in-memory gate, like `previewGate` (`features/strategies/preview.server.ts:26-34`):<br>- one request per IP per 3 s;<br>- 30 per IP per 10 min;<br>- 600 per hour house-wide.<br>Over the limit → 429 `SENSEI_ERRORS.rateLimited` (`prompt.ts:87`) |
| Model | Unchanged: `generateText`, `reasoning: "low"`, 4,096 output tokens, 12 turns (`app/api/sensei/route.ts:26-32, 75-86`). Streaming is Q-S13-2 |

### 1.2 Room, bettors registry, ticker rooms (L-42, A-3c · 13b)

`M:web/src/features/room/*`, `M:web/src/app/api/room/{route,join,bet,status}`, `M:packages/db/src/{comments,bettors}.ts`.

**Gate:** `holdsPosition(address, roomId)` (`gate.server.ts:66`). The checks run in order and the first yes admits.
- **Unreadable:** if a source can't be read and none said yes, the answer is 503 `gateUnreadable`, never "no position" (`app/api/room/join/route.ts:34-42`).
- **The checks:**
  1. **Bettors registry:** `hasBet` (`packages/db/src/bettors.ts:24-34`).
  2. **Index, "ever bet":** an `idx_positions` row for (market, owner) with `fills > 0 OR minted_lots > 0` (`packages/db/src/schema-index.ts:196-225`). Read straight from Postgres by the new `packages/db/src/idx/social-gate.ts`, with no HTTP hop.
  3. **Chain seat,** for a fill still inside the indexer lag (< 10 s): `marketsProvider.getOnchain(id)`, then `getHoldings(w, onchain)`, which reads the Ledger seat (`provider/onchain.ts:60-78`; ≤ 2 RPC, and Series and venue are cached). Ticker rooms skip this step.

**Registry write:** `POST /api/room/bet` replaces the 503.
- **`route: "wallet"`:**
  - Look in `idx_fills` JOIN `idx_txs` for a row with `signature = txHash`, `market = marketId`, the wallet as `taker` or `maker`, and `commitment IN ('confirmed','finalized')` (`schema-index.ts:22-30, 163-188`). Poll up to 4 × 2.5 s; `maxDuration` 30.
  - Found → `recordBettor` (`bettors.ts:11-21`).
  - Not found → 202 `{ recorded: false }` (gate steps 2–3 still admit a real bettor).
- **`vault | leverage | private`:** keep 503 `not-deployed` until S7/S10 add their own index proof.
- **Callers:** unchanged (`features/markets/ticket/usePlaceBet.ts:78`, `features/leverage/useLeverageWrites.ts:62`, `features/private/usePrivateOpen.ts:106`).

**Ticker rooms (new):**
- **Room ids:** a room id is a `MarketId` (base58) or `$` followed by a registry ticker (`$TSLA`). `$` is not in the base58 alphabet, so ids never collide.
- **Reused as is:** the `room_comments.market_id` column (`packages/db/src/schema.ts:23-38`), the token format (`gate.server.ts:31-49`), `roomJoinRequestSchema` (`protocol.ts:38-43`, max 120) and `CommentRoom`.
- **Join text:** for a ticker room, `Market: <id>` becomes `Room: $TSLA`.
- **Gate:** steps 1–2 over any Window of that symbol.
- **Entry points:**
  - a two-segment switch in the `MarketRoom` sheet head ("This Window · $TSLA"), in `.room-*` language;
  - an exported `TickerRoomButton({ symbol })` for the ticker hub (§1.6).
- **Fix:** avatar initials use the first two characters.

**Limits (new):** posts 1 per wallet per 3 s and 20 per 10 min; joins 10 per IP per minute. The thread poll stays at Masayume's 9 s while open (`useRoom.ts:13, 152`).

### 1.3 Takes with cashtags, Reels (L-45, L-44, A-3c · 13b)

- **Signed take (path unchanged):**
  1. The browser signs `takeMessage` with `signText` (`useTakes.ts:56-68`).
  2. The route checks the 5-minute TTL and `verifyTakeSignature` (`features/takes/verify.server.ts:10-13`).
  3. It reads the Window from the venue, never from the body (`takes/route.ts:65-72`), stamps `backed` through the §1.2 gate, and stores the signature on the row.
  - The signed text stays byte-identical: cashtags travel inside the signed `Words:` line.
- **Cashtags (new):**
  - `parseCashtags(caption, asset)`: matches of `/\$([A-Z]{1,5})\b/g` that pass `isTickerSymbol`, plus the Window's own asset, at most 4.
  - Written to `take_tags` in the same transaction as the take.
  - `GET /api/takes?symbol=TSLA` filters on them; `?authors=a,b` (≤ 50) serves 13d.
  - A tag renders as a link to `/tickers/TSLA` (class `take-cashtag`, CSS in the lane's own file).
- **Links:**
  - The author name on the take card and in the Room links to `/u/<address>` (`TakeReelCard.tsx:57`).
  - "verify ↗" keeps the explorer link (`:87`).
- **Reels:** the weave and its 20 s poll are unchanged (`takes/weave.ts:12-22`, `useTakes.ts:11-33`).
  - Off-hours with takes: the first slot is `ReelHolding` with the session label. Today it shows only when the reel is empty (`ReelsScreen.tsx:72-73`).
  - Posting still needs a live Window (`takes/route.ts:72`); the composer already says so (`takes/copy.ts:41`).
  - Range takes stay disabled (S10b).

### 1.4 News (L-17 · 13c)

- **Wire:** the shape (`news/protocol.ts:6-17`) and the labelled keyword sentiment (`news/route.ts:18-29`) are kept.
- **Sources:** Finnhub `news?category=general`, merged with `company-news` for the registry tickers over 48 h. Deduped by title, newest 8 (`route.ts:21-22`).
  - `source` is Finnhub's publisher.
  - Additive `Article.symbols?: string[]`.
- **Filter:** `?symbol=TSLA` narrows to that ticker.
- **Timing:** revalidate stays 300 s; the client polls every 60 s (`useNews.ts:8`).
- **Page:** layout unchanged (lead story, numbered wire). The intro line credits "Headlines via Finnhub".
- **No key:** `{ articles: [], error: "news provider not configured" }` and the existing quiet state.

### 1.5 Alerts, marquee, sentiment cell (L-43, L-04 · 13c)

- **Alerts (basis-aware):**
  - **Rule shape:** rules gain `basis: "regular" | "token"` and an integer `targetCents`. Legacy `targetPrice` rules convert on load; the key `agari.priceAlerts` stays (`store.ts:13`).
  - **Money display:** the display and the default target use `usdLine` (`features/markets/hero/units.ts:30-33`).
  - **Regular basis:** evaluates only while `useMarketSession().open` and on a tick whose `publishTimeSec` is ≤ 60 s old. Otherwise the rule waits and the popover foot says "Waiting for the open (Opens …)".
  - **Token basis:** shown disabled ("arrives with the 24/7 token lane") until S6 publishes a token spot symbol.
  - **Evaluator:** stays in the tab (`AppProviders.tsx:32`).
  - **Frozen exports for 13d:** `sendNotification`, `notificationState`, `requestNotificationPermission` (`store.ts:125-150`).
- **Marquee** (cells, markup and loop unchanged, `Marquee.tsx:70-86`):
  - **Assets:** from the ticker registry (live-lane tickers first), 4 slots (`components/chrome/useTickerPrices.ts:13`), so off-hours shows the last prices.
  - **Countdown cell:** `NEXT CLOSE` in session; off-hours `OPENS` with `sessionLabel` (`packages/core/src/market/session.ts:78-90`).
  - Plus the sentiment cell below.
- **Sentiment cell (new, Q-S13-1):**
  - **Endpoint:** `GET /api/sentiment` returns `CROWD` = the Up share of taker lots over the last 60 min, in integer bps, from `idx_fills`.
  - **Which kinds count:** Up = `taker_kind` buyYes or sellNo; Down = buyNo or sellYes (`packages/markets/src/submitter/order-codes.ts:2`).
  - **Thin data:** fewer than 20 fills → `upBps: null`, and the cell reads `SENTIMENT —`.
  - **Render:** one `.marquee-cell`, e.g. `CROWD 62% UP`, using the existing `up`/`down` classes.

### 1.6 A-3a profiles, follows, social boards · A-3c activity feed, lifecycle notifications (13d)

These surfaces are additive, built only from Masayume components and tokens: SectionHeader, Banzuke/Podium/YouBar rows, EdgeMetrics, NewsFeed wire rows, `.reel-card` and toasts.

- **Profile `/u/[address]`:**
  - **Identity:** the short address plus the `addressHue` avatar (`web/src/lib/address-hue.ts:6`), and the X handle only from a live `x_links` row (`packages/db/src/schema-x.ts:10-19`, S11).
  - **Record:** from `useWalletHistory(address)` (public index data): W/L, PnL, streak, `computeBadges` (`packages/core/src/projection/badges.ts:38`), and an EdgeMetrics excerpt linking to Trader Edge on your own profile.
  - **Also shown:** open calls, recent takes (`/api/takes?authors=`), a Follow button, and follower and following counts.
- **Follows:** the new `packages/db/src/follows.ts` (`follow`, `unfollow`, `followees`, `followers`, `counts`) writes the existing `game_follows`. It is the one directional graph, and S12a friends reads it (`M:docs/architecture/yosuku-source-led-migration/06-game-architecture.md:128,142`).
  - **Session:** writes need a social token. The user signs `socialSessionMessage` once (Agari, wallet, network line, issued time, "lets Agari record who you follow; it moves no funds").
  - **Token:** `mintToken(address, "social", now)` (`gate.server.ts:31`), valid 60 min.
- **Friends board:** `FriendsBoard` filters the leaderboard payload already cached under `LEADERBOARD_KEY` (`features/leaderboard/useLeaderboard.ts:9`) down to your followees and yourself. It adds no scan.
  - `/leaderboard` belongs to S5 (5b adds the session and per-ticker tabs). 13d only exports the component (Q-S13-8).
- **Ticker hub `/tickers/[symbol]`:**
  - a header with spot, the session chip and the next earnings date;
  - `TickerRoomButton`;
  - an activity feed of calls, verdicts and takes tagged `$SYM`;
  - news filtered by `?symbol=`;
  - S5's per-ticker board once it exists, otherwise an honest "arrives with S5".
- **Activity `/activity`:** the signed-in inbox plus a following feed, from `packages/db/src/idx/social-activity.ts` (new). An "Activity" item is added to the Explore section (`components/shell/header/nav-items.ts:254`). Items:
  - the wallet's fills (as taker or maker);
  - settlements from `idx_positions` × `idx_markets` (`state`, `winner`, `void_reason`, `resolved_ts_sec`);
  - `redeemed_by_crank` shown as "Paid automatically";
  - takes by followees;
  - `copied` rows once S9/S14 write them (the kind exists, empty until then).
- **Lifecycle notifications (Q-001; Masayume left them pending):**
  - `LifecycleWatcher`, mounted by the stage owner next to `AlertsWatcher`, polls the inbox every 15 s while the tab is visible and a wallet is connected.
  - A `agari.activity.seenThrough` cursor starts at mount, so there is no backlog burst.
  - **It fires `notify` + `sendNotification` for:**
    - a fill not sent from this tab (not in `localFillSignatures()`);
    - settled win, loss or void;
    - claimable;
    - paid automatically;
    - copied.
  - In-tab only, like alerts (`features/alerts/copy.ts:19-22`); Web Push is Q-S13-5.

## 2. Database (`packages/db`: idempotent `CREATE … IF NOT EXISTS` only)

| Object | Owner | Change |
|---|---|---|
| `take_tags` (new, in `schema-social.ts`) | 13b | `take_id BIGINT NOT NULL REFERENCES takes(id) ON DELETE CASCADE, symbol TEXT NOT NULL, PRIMARY KEY (symbol, take_id)`; index `take_tags_take_idx (take_id)` |
| `takes`, `room_comments`, `bettors` | 13b | Unchanged (`schema.ts:23-38, 53-78, 90-102`). Ticker rooms use `market_id = '$TSLA'`; `bettors` is written only by the verified `POST /api/room/bet` |
| `game_follows` | 13d writes; S12a reads | Unchanged (`schema-games.ts:54-63`) |
| `idx_*` | Read-only for S13 | No writes and no new indexes. A feed query above 50 ms p95 on the soak DB becomes a request to the indexer owner |

- **Foundation (stage owner):**
  - `schema-social.ts` with an empty SQL string, appended to `SCHEMA_SQL` (`schema.ts:104`);
  - export stubs for `follows`, `take-tags`, `idx/social-gate` and `idx/social-activity` in `packages/db/src/{index,index-store}.ts`.
- **No new tables for:** profiles (identity is the address), notifications and alert rules (device-local, as Masayume, `store.ts:1-12`) or Sensei memory (Y-09 Excluded).

## 3. Server routes (`runtime = "nodejs"`, zod on every input, limits in memory per instance)

| Route | Auth | Limit | Cache | Lane |
|---|---|---|---|---|
| `POST /api/sensei` | none; carries no wallet | 1 per IP per 3 s; 30 per IP per 10 min; 600/h house | no-store | 13a |
| `GET /api/room/status`, `GET /api/room/bet` | none (booleans) | — | no-store | 13b |
| `POST /api/room/join` | ed25519 join text, TTL 5 min (`room/protocol.ts:8`), then the §1.2 gate | 10 per IP per min | no-store | 13b |
| `GET/POST /api/room` | room token; the author comes from the token (`app/api/room/route.ts:56-59`) | posts 1 per 3 s and 20 per 10 min per wallet | no-store | 13b |
| `POST /api/room/bet` | index proof (§1.2) | 6 per IP per min | no-store | 13b |
| `GET /api/takes?limit&symbol&authors` | none | — | `public, s-maxage=5, stale-while-revalidate=15` | 13b |
| `POST /api/takes` | ed25519 take text, TTL 5 min | 3 per min and 30 per day per wallet | no-store | 13b |
| `GET /api/news?symbol` · `GET /api/earnings?symbol` | none | — | revalidate 300 s · 21,600 s | 13c |
| `GET /api/sentiment` | none | — | `public, s-maxage=30` | 13c |
| `POST /api/social/session` | ed25519 social text, TTL 5 min | 10 per IP per min | no-store | 13d |
| `GET /api/social/follows?wallet` · `POST` | GET public; POST needs the social token | POST 30 per wallet per min | GET `s-maxage=10` | 13d |
| `GET /api/activity?wallet&sinceSec` · `/following?wallet` | none (index data is public) | — | `private, no-store` | 13d |
| `GET /api/activity/ticker/:symbol` | none | — | `public, s-maxage=5, stale-while-revalidate=15` | 13d |

### 3.1 Finnhub client (frozen; 13c's first merge)

`web/src/lib/finnhub.server.ts` is server-only and never logs or returns the key:

```ts
export interface EarningsEvent { symbol: TickerSymbol; dateEt: string; hour: "bmo" | "amc" | "dmh" | null }
export interface FinnhubArticle { title: string; source: string; url: string; publishedAtSec: number; symbols: string[] }
export function finnhubConfigured(): boolean;
export function earningsWithin(symbols: readonly TickerSymbol[], days: number): Promise<EarningsEvent[] | null>; // one /calendar/earnings call per 6 h
export function marketNews(): Promise<FinnhubArticle[] | null>;                                                  // cached 300 s
export function companyNews(symbol: TickerSymbol): Promise<FinnhubArticle[] | null>;                             // cached 900 s
```

- **Budget:** a token bucket caps the web at ≤ 10 calls/min, because the free key's 60/min is shared with ops.
- **`null`:** the key is unset or the upstream is down.
- **Coverage:** the plan verified quote, market status and earnings (plan §1); news and company-news coverage is checked at 13c.1.
- **S6 overlap:** S6 6c's `core/market/events-calendar.ts` stays the ops-side cap-flag source (Q-S13-9).

## 4. Performance

- **Query client:** unchanged (`web/src/providers/query-client.ts:3-13`): staleTime 5 s, no background refetch, retry 1.
- **Persisted cache:** nothing social; its allowlist stays boot and bookParams only (`providers/persist.ts:47-51`).
- **Keys and polling:**

| Surface | Query key | Poll / staleTime |
|---|---|---|
| Takes | `["masayume","takes", symbol?]` (Masayume's, `useTakes.ts:12`) | 20 s / 20 s |
| News | `["masayume","news", symbol?]` (`useNews.ts:9`) | 60 s client; 300 s server |
| Friends board | `LEADERBOARD_KEY` (shared) | 120 s; no extra scan |
| Room thread | `setInterval` (parity) | 9 s while the sheet is open |
| Sensei snapshot | derived from the page's lanes | membership 30 s, figures 60 s (`useSenseiSnapshot.ts:17-18`) |
| Sensei positions / record | `keys.positions` / `keys.history` (`packages/markets/src/react/keys.ts:23,28`) | 15 s / 300 s, only while the drawer is open |
| Sentiment | `["agari","social","sentiment"]` | 60 s |
| Activity inbox | `["agari","social","activity", wallet]` | 15 s, visible and signed in |
| Ticker feed | `["agari","social","ticker", symbol]` | 15 s, visible |
| Follows | `["agari","social","follows", wallet]` | staleTime 60 s; invalidated on write |
| Earnings | `["agari","social","earnings", symbol]` | staleTime 6 h |

- **Browser RPC:** none added.
  - Alerts and the marquee share the one spot `EventSource` (`packages/markets/src/runtime/spot-stream.ts:113`).
  - Sensei's four `useTopOfBook` calls already exist.
  - The `first-call.md` §1 per-tab budget (≤ 1 RPS + one websocket) holds.
  - The only server RPC is gate step 3 (≤ 2 calls per join).
- **SSE:** none added; Masayume polls its social surfaces.
- **LLM:** non-streaming. Low-effort reasoning dominates the latency of a 2–4 sentence read, so streaming the text saves little and would split the in-thread failure path (`useSenseiChat.ts:59-69`).
  - Latency budget: p50 ≤ 4 s and p95 ≤ 9 s, measured at the gate.
  - The per-turn context stays ≤ 2 KB. Earnings come from the 6 h cache, never a live call per turn.
- **Bundles:**
  - `/u`, `/tickers` and `/activity` are route-split; there are no new dependencies.
  - `LifecycleWatcher` renders null and imports no chart or UI kit.

## 5. Lanes

| Lane | Branch · worktree · web port | Owns | Proves itself |
|---|---|---|---|
| **13a Sensei** | `slice/S13a-sensei` · `../agari-wt/s13a` · 3131 | `web/src/features/sensei/**`, `web/src/app/api/sensei/**` | Browser on devnet in session:<br>- the reply cites the live line and cents;<br>- a trade card opens the ticket with the side chosen;<br>- "should I sell my TSLA shares before earnings?" is refused with a Window offer;<br>- a fast "one more / win it back" run triggers the Brake;<br>- off-hours → "closed, opens …";<br>- the earnings line is present;<br>- no-credential 503 and 429 paths;<br>- p50/p95 latency measured |
| **13b Room · Takes · Reels** | `slice/S13b-room-takes` · `../agari-wt/s13b` · 3132 | `web/src/features/{room,takes}/**`, `web/src/features/markets/reels/**`, `web/src/app/api/{room,takes}/**`, `packages/db/src/{comments,bettors,takes,take-tags,schema-social}.ts`, `packages/db/src/idx/social-gate.ts`; the `REELS` key in `web/src/lib/copy.ts` (the only lane editing that file) | **Takes:** a signed take posts (200); a one-byte-tampered caption → 401; stale → 400; a `$NVDA` tag filters.<br>**Room:**<br>- a wallet with no position → 403;<br>- after a real devnet IOC fill (an acceptance row), join → 200, logging the step that admitted it;<br>- another wallet's `txHash` records nothing;<br>- `$TSLA` room gated the same way.<br>**Reels:** off-hours reel with takes |
| **13c News · alerts · marquee** | `slice/S13c-wire` · `../agari-wt/s13c` · 3133 | `web/src/features/{news,alerts}/**`, `web/src/app/api/{news,earnings,sentiment}/**`, `web/src/lib/finnhub.server.ts`, `web/src/components/shell/Marquee.tsx`, `web/src/components/chrome/useTickerPrices.ts` | - `/news` shows Finnhub headlines with publishers, and `?symbol=` narrows them;<br>- the marquee is correct in and out of session;<br>- the sentiment cell shows a real value or `—`;<br>- a cents alert fires once in session (toast + system notification) and never on a closed or stale tick |
| **13d Social** | `slice/S13d-social` · `../agari-wt/s13d` · 3134 | `web/src/app/{u,tickers,activity}/**`, `web/src/app/api/{social,activity}/**`, `web/src/features/{profile,social,activity,ticker-hub}/**`, `packages/db/src/follows.ts`, `packages/db/src/idx/social-activity.ts`, `web/src/components/shell/header/nav-items.ts` | - a profile shows real index history;<br>- follow and unfollow with one session signature;<br>- the friends filter works;<br>- a devnet Window the test wallet traded settles → toast + system notification in an open tab, plus an inbox row;<br>- "Paid automatically" appears after the settler's `redeem_for`;<br>- the ticker hub feed renders |

**Frozen cross-lane interfaces.** 13c.1 and 13b.1 merge first.
- **13c:** §3.1 in full. From the alerts store: `sendNotification`, `notificationState`, `requestNotificationPermission`.
- **13b:**
  - `listTakes({ limit, symbol?, authors? })` and `parseCashtags(caption, asset)`;
  - `insertTake` writes its tags;
  - the room id grammar `MarketId | "$" + TickerSymbol`;
  - `holdsPosition(address, roomId)`, `mintToken` and `readToken` with a `scope` (a room id or `"social"`);
  - `TickerRoomButton({ symbol })`;
  - `localFillSignatures(): ReadonlySet<string>`, fed by `recordBet` (`features/room/record-bet.ts:8`).
- **Hrefs:** `/u/<address>`, `/tickers/<SYMBOL>`, `/activity`.
- **§3:** the route paths and bodies.
- **Types:**

```ts
type ActivityKind = "fill" | "settled-win" | "settled-loss" | "voided" | "claimable" | "paid-automatically" | "take" | "copied";
interface ActivityItem { id: string; kind: ActivityKind; wallet: Address; marketId: MarketId | null; asset: TickerSymbol | null;
  intervalSec: number | null; side: Side | null; lots: string | null; amountBase: string | null; signature: string | null; takeId: string | null; atSec: number }
interface SentimentReading { upBps: number | null; fills: number; windowSec: number; asOfSec: number }
```

**Stage owner only:**
- every `package.json` and `pnpm-lock.yaml`;
- `packages/core/src/ports/**`, `packages/markets/src/{env,index}.ts`, `packages/db/src/{index,index-store,schema}.ts`;
- `web/src/providers/**` (it mounts `LifecycleWatcher`), `web/src/lib/env.ts`, `web/.env.example` and the env files;
- `services/ops/**`, `scripts/invariants/**`, `docs/plan/**`.

**No lane edits:**
- `web/src/styles/**` (additive CSS sits next to the lane's features);
- `features/leaderboard/**` (S5);
- `features/markets/**` outside reels;
- `packages/brain/**` (shared with S9).

A lane that needs a shared change writes the request into its report.

- **Invariants in force:** `kit-import-boundary` (web routes reach the chain only through `@agari/markets`), `write-boundary`, `file-length` ≤ 400, `no-float-money` (alert targets are integer cents; Finnhub fields are display text).
- **Merge order:** 13c.1 → 13b.1 → 13a → 13c → 13b → 13d.

## 6. Open questions (the recommended defaults apply until answered)

| Q | Question | Recommended default |
|---|---|---|
| Q-S13-1 | **User.** Sentiment cell source: CNN Fear & Greed (unofficial endpoint, licence unknown), a paid equity sentiment API, venue crowd flow, or an honest unavailable state | Venue crowd flow `CROWD 62% UP` from the index (real, labelled as the crowd, not Fear & Greed), `SENTIMENT —` below 20 fills. CNN only with the user's licence OK |
| Q-S13-2 | Stream Sensei (`streamText`) or keep Masayume's `generateText` + Typewriter | Keep `generateText`; stream only if the gate p50 exceeds 4 s |
| Q-S13-3 | Ticker-room gate lookback | Ever traded that ticker (no expiry) |
| Q-S13-4 | Room and take moderation (pump, spam, REG) | Rate limits only; no delete UI in S13; the stage owner can hide a row in SQL; revisit at S15 |
| Q-S13-5 | **User.** Notifications with no tab open (Web Push: service worker, VAPID keys, a `push_subscriptions` table) | In-tab only (Masayume alerts parity); `/activity` is the durable record |
| Q-S13-6 | **User.** The Finnhub free tier is personal/non-commercial (`context/13-affordable-equity-price-sources.md` §4.2) | Use it for the devnet demo, credited "Headlines via Finnhub" and disclosed in the README (S15) |
| Q-S13-7 | Free-text profile handles | No: address + hue + verified X handle only (no impersonation or moderation surface) |
| Q-S13-8 | Who mounts the Friends tab on S5's `/leaderboard` (and links Banzuke names to `/u`) | The second of S5/S13 to merge, in one small commit with a D-entry |
| Q-S13-9 | Earnings overlap with S6 6c | Web reads Finnhub for display and prompt; ops keeps the cap flags; one `EarningsEvent` type reconciled at the second merge |
| Q-S13-10 | Lane databases: the shared soak DB or one per lane | The shared `agari` DB (the gates need the real index); social tables only; clear test rows before the gate browser pass |
