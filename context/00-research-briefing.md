# Stocklana Research Briefing

> Written 2026-09-13 (Sunday). It summarises reports 01–05 in this folder, plus direct API checks run today. Each deeper claim, with its sources, is in the numbered report. Claims marked **UNVERIFIED** inside a report still need re-checking before the pitch.

## TL;DR

1. **Stocklana has no required stack.** There is one track, no bounties and no sponsor SDK. Judges ask whether this could be a real app people would use: a real user, a working end-to-end demo, a reason it belongs on Solana, and execution quality.
2. **"Solana" is the blockchain, not a stocks API.** Stock exposure comes from **token issuers** (xStocks, Ondo, Backpack/Sunrise). Prices come from **oracles and APIs** (Pyth, Chainlink, Switchboard, Jupiter). The prediction market is **our own program**, written in Anchor.
3. **The gap is real.** No Solana app runs short-window Up/Down markets on single stocks. Kalshi via DFlow only has hourly S&P 500 and Nasdaq-100 markets, needs KYC and runs only during market hours. Jupiter only has 15-minute BTC markets. No visible Stocklana entry is a prediction market (most entries are private until the deadline).
4. **The biggest blocker is price data.** Pyth Hermes returns **401 without an API key**, even for BTC, and US stock data sits on the paid Pro plan. We need a settlement-oracle decision today (§4).
5. **Stocks are not BTC.** Exchanges close at 16:00 ET, on weekends and on holidays, trading can halt, earnings create price gaps, and splits and dividends change the reference price. Every always-on Masayume feature needs a market-hours model (§5).
6. **Masayume is a minimum baseline:** 74 capabilities, none excluded. Its market layer was DreamDEX, so on Solana **we write the market program ourselves**. The largest pieces are the Solidity contracts to rewrite and the market program replacing DreamDEX. The UI, game engines, agent logic and ops loops mostly carry over (§8).

## 1. Hackathon facts

| Item | Value |
|---|---|
| Page | https://hackathons.solana.com/hackathons/stocklana |
| Prize / run by | $100,000, Solana Foundation |
| Deadline | **Fri 2026-09-18, 4:00pm ET** (the same minute US markets close; Sep 18 is also quad-witching). Edits are allowed until then |
| Judging | Through 2026-10-02 |
| Registered / submitted | 305 / 26 at time of research |
| Tracks | 1 main track, 0 bounties |
| Requirements | At least one of: GitHub, live demo or video. Original work; disclose open-source components; one submission per team |
| Not official | `stocklana.world` is an unrelated meme coin |
| After | Colosseum World's Fair |

Suggested categories: Trading, Investing, Credit & yield, Infrastructure, and Consumer (mobile-first, **social trading**). A stock prediction market with games and social features falls under **Trading + Consumer**.

## 2. Ecosystem map

| Layer | Options on Solana (Sept 2026) | Relevance to us | Report |
|---|---|---|---|
| Stock tokens | **xStocks** (Backed, now owned by Kraken; 832 assets; ~$500M AUM). **Ondo Stocks** (~440). **Backpack/Sunrise** (44; redeemable for real shares). Superstate and Securitize (allowlisted wallets only). PreStocks and Tessera (pre-IPO). Remora shut down; Robinhood runs on Arbitrum | Reference assets, "hedge my xStocks" feature, collateral ideas | 01 |
| Token standard | Token-2022 with the **ScaledUiAmount** (splits and dividends change a multiplier, not your balance), Pausable and PermanentDelegate extensions. Decimals: xStocks 8, Ondo 9, Backpack 6 | The issuer can pause tokens and move them out of any account; disclose this if a vault holds them | 01 |
| Devnet tokens | **None are usable.** xStocks' dev API lists 113 devnet mints, but 106 have zero supply and only Backed can mint | Deploy our own mock Token-2022 mints and a mock USDC on devnet | 01, 04 |
| Prices / oracles | **Pyth** (1,051 US stock and ETF feeds; paywalled, §4). **Chainlink** Data Streams (24/5; requires allowlisting). **Switchboard On-Demand** custom feeds (permissionless, devnet OK, single source). **Jupiter Price v3** (keyless, 24/7 token prices) | Settlement and live charts | 02 |
| Market calendars | Pyth feed metadata (free: `schedule` and `is_open`/`next_open`), Alpaca `/v2/calendar` and `/v2/clock` (free account), Finnhub market status, holidays and earnings | Drive every window from schedules, never hard-coded hours | 02 |
| Prediction markets | Kalshi via **DFlow** (API needs a key), **Jupiter Forecast** (BTC only; Jupiter issues all markets), World (inside Phantom; stock markets "planned"). Drift BET is gone | Competition, plus an optional "Index / Pro" tab via DFlow | 03 |
| Order books | **Manifest** (zero fee), Phoenix, OpenBook v2 | Optional secondary trading of outcome tokens | 03 |
| Stock perps | **Phoenix** (~29 stock perps, TS/Rust SDK, **builder codes**), Parquet (no SDK found). Drift is relaunching as Velocity after its exploit | "Bet against stocks" / Boost adapters | 03 |
| Lending / yield | **Kamino** (~83% of xStock lending), **Jupiter Lend**. No live stock options protocol | Earn yield on idle balances, "borrow instead of selling" | 03 |
| Programs | **Anchor 1.2.0** (TS package `@anchor-lang/core`), Codama clients, Surfpool and LiteSVM tests | Replaces Foundry/Solidity | 04 |
| Client / wallets | **`@solana/kit` 8.3.0** (the current standard), Privy 3.42 (social login, embedded wallets), Wallet Standard. Pyth, MagicBlock and Switchboard SDKs still use web3.js 1.x | Replaces wagmi/RainbowKit/viem | 04 |
| Gasless | A server co-signs as fee payer (no forwarder contract needed); Kora later | Replaces ERC2771Forwarder | 04 |
| Bounded permissions | Our own per-user grant records (session or agent key, per-trade cap, budget, expiry). MagicBlock session keys have **no amount caps** | Replaces EventVault grants | 04 |
| Randomness / realtime | MagicBlock VRF and Ephemeral Rollups, Switchboard randomness (ORAO needs Anchor 0.32, so avoid). Helius webhooks and WebSocket account subscriptions | Games and live UI | 04 |
| Social distribution | **Blinks / Solana Actions** (unfold on X only for users with a supporting wallet extension and only if registered with Dialect, so a link fallback is needed). X API has no free tier; a post with a link costs $0.20 | Trade-from-X | 04 |
| Swaps | Jupiter Swap v2 / Tokens v2 / Price v3 / **Prediction v1** (mainnet). The verified TSLAx and NVDAx carry the `xstocks` and `verified` tags; **fake lookalikes exist**, so filter on those tags | Buy-the-stock CTA, token pricing | 04 |
| Starter | `npx -y create-solana-dapp@latest -t solana-foundation/templates/kit/nextjs-anchor`; Solana Developer MCP `mcp.solana.com`; `solana.com/llms.txt` | Day-1 scaffold | 04 |

## 3. Why Solana (pitch evidence, with sources in 03 and 01)

- More than 90% of tokenized-stock supply is on Solana. Solana passed $10B cumulative tokenized-stock volume in June 2026. Its trading share dipped from 95% in June to 82% in July as Robinhood Chain grew.
- **63% of tokenized-stock trading happens while US exchanges are closed.** Solana is where stocks already trade on weekends, so weekend and gap markets are the Solana-native hook.
- Sub-cent fees make $1 bets and tap-to-trade viable. Blinks allow trading from X. Solana Mobile/Seeker supports a mobile-first build.
- Don't claim that Alpenglow (~150ms finality) is live.

## 4. Price data and settlement

**Checked directly on 2026-09-13 at about 10:10 UTC:**

| Endpoint | Result |
|---|---|
| `hermes.pyth.network/v2/updates/price/latest` (BTC and AAPL, no key) | **HTTP 401 unauthorized** |
| `benchmarks.pyth.network/v1/updates/price/{ts}` (AAPL, no key) | **HTTP 401** |
| `hermes.pyth.network/v2/price_feeds?query=AAPL&asset_type=equity` | 200. Returns feed IDs, `market_hours` and the trading `schedule` string with holidays (e.g. `Equity.US.AAPL/USD` → `49f6b65c…5688`, schedule `America/New_York;0930-1600…`) |
| `lite-api.jup.ag/price/v3?ids=<TSLAx mint>` (no key) | **200 on a Sunday.** TSLAx DEX `usdPrice` 364.91, plus `stockData.price` 365.25 (xStocks reference) updated 2026-09-13T10:09Z |
| `api.xstocks.fi/api/v2/public/oracles` | 200. xStocks' official feeds are **Pyth-managed** (hermesId, pythLazerId), so they fall under the same paywall for live updates |

Further findings from report 02:
- Pyth required API keys for Hermes from 2026-08-26. The Free plan has no API access; the Starter plan ($500) is crypto only; US stocks are on the **Pro** plan ("from $2,500/mo"). The free tier covers regular hours only.
- **Correction (key research, §12):** Pyth Terminal offers a **free Pyth Pro trial key** with no card and no sales call. US equities are in the catalog. A search result says the trial lasts 14 days, but the docs page doesn't state it (UNVERIFIED), and it's also unverified whether the trial key covers Hermes Core as well as Pro. `scripts/probe-keys.mjs` tests both once `PYTH_API_KEY` is set.
- Pyth stock price accounts already on Solana are **stale** (AAPL since Aug 14, NVDA and SPY since Aug 26; devnet since Jul 2).
- **Settlement at a specific time works with Pyth.** Fetch the first update at or after T and post it on-chain. The program checks `prev_publish_time < T <= publish_time <= T+10s`. That makes the settlement price unique, so it can't be cherry-picked. Don't use `get_price_no_older_than` for settlement. Anchor + TS code is in 02.
- Chainlink is allowlisted, Switchboard Surge is crypto only, and Switchboard On-Demand custom feeds over Alpaca, Finnhub or Massive are the realistic **$0 devnet path**, though single-source.

**Settlement options** (decision for the user; can be combined behind one `SettlementSource` interface with identical void and refund rules):

| Option | Cost | Trust | 24/7? | Notes |
|---|---|---|---|---|
| A. Pyth Pro key (request a hackathon key today) | Paid unless sponsored | Strongest (multi-publisher, verified on-chain) | Pyth-native 24/7 and xStock-token feeds exist on Pro | Best pitch; uncertain approval |
| B. Switchboard On-Demand custom feed (Alpaca IEX or Finnhub quote) | ~$0 plus small SOL fees | Single API source | Market hours only for real stock prints | Works on devnet this week |
| C. Switchboard or keeper using the **Jupiter Price v3** token price | $0 | DEX token price, not the exchange print | **Yes** | Label clearly as "TSLAx token price"; enables weekend markets |
| D. Surfpool / local validator with cloned mainnet Pyth accounts | $0 | Test-only | n/a | Lets us build the Pyth path before a key arrives |

## 5. How stock markets change the market design (from 02 and 05)

| Masayume assumption | Stock reality | Proposed rule |
|---|---|---|
| Windows roll 24/7 | NYSE/Nasdaq regular session 09:30–16:00 ET; pre-market, after-hours and overnight data are paid; weekends and holidays are closed; early closes (e.g. 11/27, 12/24 at 13:00) | Schedule-driven lanes. During market hours: 5/15/60-minute Up/Down and Range, with no window *starting* 15:55–16:00. Closed: a lane shows "Opens Mon 09:30" (honest state), not an empty feed |
| Oracle price is always fresh | Halts and LULD pauses freeze prints | Stale beyond N seconds at settlement means **void, refund both sides** (mirrors DreamDEX voids) |
| Continuous price path | Earnings and overnight gaps | "Earnings night" and **"Monday Gap"** markets (lock Sunday 19:59 ET) as products; lower Boost and Range caps on earnings days (Finnhub earnings calendar) |
| Asset units never change | Splits and dividends change the multiplier | Store the split ratio per market; void or adjust by rule; read the *scheduled* ScaledUiAmount multiplier, not only the current one |
| Price = the asset | xStock token trades 24/7 at a premium or discount to the exchange price | Two price labels: "NVDA (exchange)" for market hours and "NVDAx (token, 24/7)" for weekend or overnight lanes |
| 2 assets (BTC, ETH) | Many tickers, correlated with each other | Start with ~6–10 liquid tickers (NVDA, TSLA, AAPL, MSFT, META, AMZN, SPY, QQQ, COIN, MSTR); parlay correlation surcharge per sector |
| Always demoable | Live stock markets only during market hours | **Record the demo Mon–Thu, 09:30–16:00 ET.** Friday's 4pm deadline equals the market close |

Existing precedent: Polymarket's international daily stock Up/Down markets settle on the **Pyth 1-minute candle close at 16:00 ET**, fall back to the exchange close, and refund 50/50 on ties or no trading. Kalshi and Robinhood offer only index and company-metric contracts in the US.

## 6. Competitive landscape (03)

| Product | Chain | Stock format | Gap |
|---|---|---|---|
| Kalshi via DFlow | Solana (tokenized) | Hourly S&P 500 / Nasdaq-100 Up/Down, market hours, KYC | No single stocks, no 24/7, no games or social |
| Jupiter Forecast | Solana | BTC 15-minute only | No stocks; Jupiter issues all markets |
| World (in Phantom) | Solana | Stocks "planned" | **Fast follower risk**; 1M users since Sep 9 |
| Polymarket | Polygon | Daily TSLA/NVDA/AAPL Up/Down (thin volume, ~$112K top) | Not Solana; daily only |
| Limitless | Base | Hourly stock Up/Down | Not Solana |
| Visible Stocklana entries | Solana | Terminals, baskets, dividend tools, AI copilots; Erodoro (covered-call "upside markets"), MITIGATOR (AI copilot and copy trading) | No prediction market or games app visible |

**Gaps we can own:** 24/7 and weekend single-stock markets, one-tap "hedge my xStocks", earnings-night windows, $1 bets with games, social and agent trading, a Pro/Index tab via DFlow, mobile-first.

## 7. Regulatory (01, 03)

- A binary contract on a single stock's price is very likely a **security-based swap** (SEC). The SEC and CFTC opened a joint comment request on 2026-06-18. Every major issuer excludes US persons, and some also exclude Canada, the UK and Australia.
- **Geofence US users and add disclaimers from day one.** Build on devnet with test collateral for the hackathon, and say so in the README's honest-limitations section.

## 8. Masayume baseline and port shape (05, 04)

- **Pinned references:** Masayume `68f7a09` (github.com/Blockchain-Oracle/masayume, matches local) comes first. Local Yosuku `3c56ef5` (2026-08-28) comes second. `Blockchain-Oracle/yosuku` `9f0af31` (2026-06-29) has **diverged** from local (merge base `0f2928a`; local +591, GitHub +121) and counts as secondary evidence. Its routes are a subset of local's (`/feed` = `/reels`). Three pieces exist only there: the `TheBell` floating countdown, a global OG image and the removed `/agent` showcase.
- **Inventory:** 59 page routes (37 product, 22 `/dev` fixture pages), 39 API routes, 8 ops actors, 8 Solidity contract families. The parity ledger has 74 baseline rows (64 Adapted, 8 Exact, 1 Blocked for the native app with no source, 1 covered by the docs site), 18 open-question rows for Yosuku-only features and 10 add-on rows. **No exclusions.**
- **Chain-coupled pieces:**
  1. DreamDEX supplied the windows, order book, oracle, outcome tokens, redemption and faucet. On Solana this becomes **our own market program plus a window-keeper service**, the largest and riskiest item.
  2. `packages/markets` (10.7k lines; viem and the Somnia SDK) becomes a Solana adapter behind the same interfaces.
  3. 5.5k lines of Solidity (with 6.8k lines of tests usable as a spec) become Anchor programs.
  4. The EVM wallet and signing layer is a rewrite (only 32 of 783 web files import chain libraries).
- **Portable nearly as-is:** `packages/core` (9k lines, game engines, pricing math), `packages/brain`, `packages/db`, 17.5k lines of CSS, and most ops actor loops.
- **Masayume's own unfinished items that Stocklana would inherit:** `/` only redirects (no landing page); no cash-out for plain Up/Down; no OG cards; paid Memory Market and Reversion preset unfinished; game profile, achievements and friends unfinished.
- **Report 04's port map proposed cutting** MarketMakerVault, LeverageReserve, PrivateDesk and the on-chain Duel for the 5-day window. **This is not adopted.** The user set the reference as a minimum baseline; any exclusion or later sequencing is the user's call.

## 9. User add-ons (Additive rows in 05)

| Add-on | Candidate mechanisms |
|---|---|
| Bet against stocks | Down already exists as a binary side. Deeper short exposure: Boost/LeverageReserve on the Down side, **Phoenix stock perps via builder codes**, "hedge my xStocks" (detect holdings, offer a Down ticket sized to them) |
| Yield | Earn vault as the house/LP reserve (baseline). Idle balances into Kamino or Jupiter Lend (**mainnet only**, so devnet needs an honest simulated or unavailable state). "Bet without selling" = borrow against xStocks on Kamino |
| Deeper social trading | Leaderboards, copy-trading agents, trade-from-X (Blinks plus a link fallback), Reels, rooms; share cards with market-hours context |

## 10. Conflicts between reports, resolved

| Conflict | Resolution |
|---|---|
| 03 says "Pyth has 24/7 NVDA/TSLA/AAPL/MSFT"; 02 says it's paywalled; 04 says the feeds update only 09:30–16:00 | **All three are partly right.** 24/7 Pyth-native and xStock-token feeds exist, but the exchange `Equity.US.*` feeds follow the regular-session schedule, and **all Hermes access needs a key** (401 confirmed today, even for BTC) |
| Pyth Solana receiver SDK version | 2.0.0 for Anchor 1.x, 1.2.0 for Anchor 0.32 (02 and 04 agree) |
| 04's cut list vs the fidelity baseline | Not adopted; pending a user decision (§8) |

## 11. Decisions needed from the user

1. **Settlement source:** request a Pyth key now, and/or Switchboard + Alpaca/Finnhub, and/or a Jupiter token price for 24/7 lanes (§4).
2. **Market formats:** which lanes to launch (market-hours Up/Down and Range, daily close, Monday Gap, earnings night, 24/7 token lanes) and the starting ticker list.
3. **Build sequencing for full parity in 5 days:** which slices land first for the demo; later slices stay in scope.
4. **Masayume carry-overs:** do the routes, `/fund` and card on-ramp removed on 2026-09-04 stay out? Does Stocklana owe Masayume's unfinished items (landing page, cash-out, OG cards, game profile and achievements)?
5. **Yosuku-only extras** (`TheBell`, OG image, `/agent` showcase, plus 18 open-question rows): include or not?
6. **License and provenance** for Yosuku-derived code in a public submission repo.
7. **Collateral and network:** devnet with mock USDC and mock xStock mints (recommended) vs any mainnet read-only integrations (Jupiter prices, DFlow Index tab, Phoenix).
8. **"Bet against stocks" and yield semantics** (§9).
9. **Brand and name,** and the geofence and disclaimer copy.

## 12. API keys to get (researched 2026-09-13)

Put keys in `stocklana/.env.local` (gitignored), then run `node --env-file-if-exists=.env.local scripts/probe-keys.mjs`. The script tests each provider and never prints secrets.

| Priority | Provider | How to get it | Cost / limits | What it unlocks for us |
|---|---|---|---|---|
| 1 | **Pyth** | Sign up at [Pyth Terminal](https://pythdata.app), then "View your API key" | **Free Pro trial, no card.** A search result says 14 days, but the docs page doesn't state it (UNVERIFIED). After the trial: Starter $500/mo (crypto only) or Pro from $2,500/mo | Hermes (settle at a timestamp), Pyth Pro WebSocket and history, US stocks plus xStock token feeds. **A trial from today ends around 09-27, before judging ends 10-02**, so ask Pyth for an extension through 10-02 and keep a fallback settlement source |
| 2 | **Alpaca** | [Free paper account](https://app.alpaca.markets/signup) | Free: IEX real-time (single venue), 200 req/min, 30 WebSocket symbols | Market clock and calendar (early closes), 1-min bars for the Switchboard fallback, live chart ticks |
| 3 | **Finnhub** | [Register](https://finnhub.io/register) | Free: 60 calls/min, personal / non-commercial | Quotes, market status, holidays, **earnings calendar** (earnings-night markets) |
| 4 | **Helius** | [Dashboard](https://dashboard.helius.dev) | Free: 1M credits/mo, 10 RPS, standard WebSockets | Reliable devnet/mainnet RPC, webhooks for the indexer and keeper |
| 5 | **Privy** | [Dashboard](https://dashboard.privy.io) | Free core tier (0–499 MAU), gas sponsorship feature | No-seed-phrase embedded Solana wallets (Yosuku/Masayume UX) |
| 6 | **DFlow** | [Request form](https://forms.gle/eX3cghbMF8VBB9qa9), 2–5 day turnaround. Dev endpoints are keyless but rate-limited | Free dev; prod pricing not stated | Optional Kalshi "Index / Pro" tab |
| 7 | Jupiter | [Portal](https://portal.jup.ag) (optional; keyless `lite-api.jup.ag` works) | Free / paid tiers | Higher limits for Price v3, Tokens v2, Swap v2, Prediction v1 |
| — | Chainlink Data Streams | Contact Chainlink sales (testnet access is also by request) | Not self-serve | 24/5 stocks; unlikely before the deadline |
| — | Stork | sales@stork.network or DM [@storkoracle](https://x.com/storkoracle) | Not self-serve; 5 RPS REST | `AAPL_24_5`-style 24/5 stock feeds, `stork-solana-sdk` |
| — | Switchboard On-Demand | No key needed | Small SOL fee per update | $0 fallback oracle wrapping Alpaca, Finnhub or Jupiter |
| — | X API | Pay-per-use, no free tier | Post $0.015; post with a URL $0.20 | Trade-from-X relay replies |

**Also today:**
- Get about **10 devnet SOL** for program deploys (rent is 5,080 lamports per byte; a 300–800 KB program costs about 1.56–4.16 SOL, and deploys need about double).
- Plan demo recording for **Mon 09-14 to Thu 09-17, 09:30–16:00 ET**.

## Report index

| # | File | Topic |
|---|---|---|
| 01 | `01-solana-tokenized-stock-issuers.md` | Issuers, mints, Token-2022 mechanics, devnet reality, regulation, competitor repos |
| 02 | `02-equity-price-oracles-and-market-hours.md` | Pyth, Chainlink and Switchboard; settlement code; sessions, holidays, halts, splits; free data APIs; settlement design |
| 03 | `03-prediction-markets-and-stock-derivatives-landscape.md` | DFlow/Kalshi, Jupiter, Manifest/Phoenix, perps, lending, competition, why Solana, build-on vs build-own |
| 04 | `04-solana-dev-stack-and-port-map.md` | Anchor 1.2, kit, wallets, gasless, grants, VRF, Blinks, Jupiter APIs, agents, starter, Masayume → Solana port map |
| 05 | `05-masayume-baseline-parity-inventory.md` | Authority record, 59-route inventory, 74-row parity ledger, add-ons, open questions |
