# 03 — Prediction Markets & Stock Derivatives Landscape (Solana, Sept 2026)

Research date: 2026-09-13 (Stocklana submissions close 2026-09-18 16:00 ET).
Scope: Who already does prediction markets and stock derivatives on Solana, what we can reuse, what we have to build ourselves, and where the open gap is for a consumer stock Up/Down app (the Masayume port).

**Confidence legend**
- **[V]** Verified today from a primary source: official docs, an API response, a GitHub repo, or the hackathon page.
- **[S]** From secondary press or aggregators. Probably right, but not checked against a primary source.
- **[U]** UNVERIFIED. Single weak source, conflicting sources, or inferred. Re-check before putting it in the pitch.

---

## TL;DR

1. **Nobody on Solana runs short-window (1m to 1h) Up/Down markets on single stocks.** Here is what exists:
   - Jupiter Forecast: 15-minute **BTC** only [V].
   - Kalshi via DFlow: S&P 500 and Nasdaq-100 **hourly** Up/Down plus daily and weekly ranges. Indices only, US market hours, KYC required [V/S].
   - Polymarket: **daily** single-stock Up/Down, but it settles on Polygon. Solana is only a deposit route and a Jupiter frontend [V/S].
   - Limitless: **hourly stock** Up/Down, but on **Base** [V].
   - World (world.xyz, in Phantom): says equity contracts are "planned" [S].

   That leaves the gap open, though probably not for long.
2. **Kalshi through DFlow is the only deep, reusable prediction liquidity on Solana.** It works with SPL outcome tokens and a REST order API. Costs: an API key, Proof KYC on every trading wallet, and fees based on Kalshi's quadratic probability model. It has **no single-stock price markets** (Kalshi only has index price markets, plus stock KPI and corporate-event markets). It can back a "Pro / Index" tab but cannot power 24/7 TSLA 5-minute tickets.
3. **Jupiter Prediction API** (beta) aggregates Kalshi, Polymarket and its own Forecast markets. It blocks US and South Korea IPs, has no stock category, and Forecast is not open to third-party issuers.
4. **Drift BET is effectively gone.** Drift lost about $285M in an exploit on 2026-04-01, rebranded to **Velocity** on 2026-07-01, and is relaunching as a perps-only USDT exchange [S]. Do not build on it.
5. **Shorting and Boost:** the best reusable Solana venue is **Phoenix**. It has about 29 equity perps, an order book, the Rise SDK in TypeScript and Rust, and **Flight builder codes** that pay integrators a fee [S/V]. Parquet (317 synthetic equity perps, up to 200x, oracle-priced USDC pools) is a live alternative [V, but no SDK seen].
6. **Yield:** xStocks can be used as collateral on **Kamino** (about 83% of tokenized-stock lending [S]) and **Jupiter Lend** (SPYx, QQQx, NVDAx, TSLAx, AAPLx [S]). Raydium has done $4B+ in cumulative tokenized-stock volume [V, from the Solana roundup]. No live on-chain **stock options** protocol found on Solana.
7. **Stocklana:** run by the Solana Foundation, $100K prize pool, 305 registered and 26 submissions as of 2026-09-13. Projects stay hidden until submissions close [V].
   - Visible GitHub entries: terminals, baskets, dividend tools, AI risk copilots, and one covered-call "upside markets" protocol (Erodoro).
   - **No visible prediction-market or Up/Down entry.**
8. **Recommendation:** build our own thin Up/Down + LP-vault program priced by the Pyth oracle, because that is the core differentiator. **Integrate** the rest rather than rebuilding it:
   - DFlow/Kalshi (index hourly markets, read-only or KYC-gated)
   - Phoenix (short and Boost through builder codes)
   - Kamino or Jupiter Lend (borrow against xStocks, park idle vault USDC)

---

## 1. Prediction-market infrastructure on Solana (2026)

### 1.1 Comparison table

| Protocol | Status (Sept 2026) | Markets | Stock / index markets? | Third-party API / SDK | Program IDs (known) | Builder economics | Can we build ON it? |
|---|---|---|---|---|---|---|---|
| **DFlow Prediction Markets API (tokenized Kalshi)** | Live since Dec 2025 [V] | "All Kalshi markets" as SPL YES/NO mints, claimed 100% coverage [S] | Kalshi has **S&P 500 and Nasdaq-100 hourly Up/Down** (`KXINXHUD`, `KXNDQHUD`), daily Up/Down (`KXNASDAQDUD`), daily and weekly ranges (`KXINX`, `KXINXW`, `NASDAQ100W`), yearly ranges and min/max. **No single-stock price markets.** Only Tesla deliveries/production, CEO change, company KPIs, M&A and IPO events [V, from the Kalshi public API] | Yes. Metadata API `https://prediction-markets-api.dflow.net/api/v1/*` (events, markets, series, orderbook, trades, candlesticks, outcome_mints, search, live data). Trade API `/order` and `/order-status`. Dev hosts `dev-prediction-markets-api.dflow.net` and `dev-quote-api.dflow.net` [V, docs and QuickNode guide]. The dev host returned **DNS NXDOMAIN when tested today**, and prod returns 403 without `x-api-key` [V]. MCP server and Helius "DFlow skill" exist [S] | Market ledger plus yes/no mints per market, returned by the API (`accounts.marketLedger`, `yesMint`, `noMint`) [V] | Fees follow Kalshi's quadratic formula: `roundup(0.07·c·p·(1−p)) + 0.01·c·p·(1−p)`, tiered by 30-day volume. **Rebate program for builders above $100k per 30 days** [S, DFlow docs via search snippet]. Kalshi has a $2M builder grant program [S] | **Partly.** Good for a "Pro markets: S&P and Nasdaq hourly" tab. Hard requirement: the **receiving wallet must pass DFlow Proof KYC** [S, DFlow KYC doc]. Async fills for some orders. Not usable for 24/7 single-stock tickets |
| **Jupiter Predict / Prediction Market API** | Live. Kalshi integrated Oct 2025, Polymarket Feb 2026, **Forecast** (native) launched 2026-06-04 [S] | Sports, crypto, politics, e-sports, culture, economics, tech [V, docs] | **No stock category** [V]. Forecast is **15-minute BTC Up/Down only**, settled by Chainlink BTC/USD, USDC orders of 5–250 [V, docs] | Yes, in **BETA**: events, search, markets, create order, positions, close, claim, history, leaderboards, profile [V]. **US and South Korea IPs blocked** [V] | Forecast issuer program `2sVcg2dBSUzXkmdZ8M5cp1LbnzDrWJmr6hktkHwB8nY3`, config PDA `8LczfBkVZJhGnTYH8nQke2YC3b83GFZ8qZtfuMRe6AN6`. Outcomes are Token-2022 mints `BISON-<marketPda>-UP/DOWN` [V] | Probability-weighted trading fee, no claim fee [V]. Integrator fee share not documented [U] | Can aggregate Polymarket stock daily markets and Kalshi events. **Cannot issue our own stock markets** on Forecast, since the issuer is Jupiter and only Prop AMM market makers quote [S] |
| **Jupiter Forecast (Prop AMM model)** | Live, 2026-06-04 [S] | 15m BTC [V] | No [V] | Through the Jupiter Prediction API [V] | See above | Market makers compete on quotes [S] | UX reference only: multi-market-maker RFQ for binaries, 15-minute rounds |
| **Drift BET** | **Effectively dead.** Launched Aug 2024 [S]. Drift exploited for about $285M on 2026-04-01 [S, TRM Labs and Drift updates]. Rebranded to **Velocity** 2026-07-01, relaunching **perps-only**, USDT-settled, private beta [S] | Was binary YES/NO on events [S] | No [S] | Drift SDK (historical) | — | — | **No** |
| **Polymarket** | Global CLOB on **Polygon**. Solana deposits since 2025 [S]. Its markets appear on Solana through **Jupiter Predict** [S] | Stocks: **daily Up/Down** (TSLA, NVDA, META, SPY, SPX), "Opens Up/Down", weekly close ranges (NFLX, TSLA, MSFT, AAPL, GOOGL, AMZN, META, NVDA, MU, PLTR, SPCX, OPEN), monthly "what price will X hit" [V, polymarket.com pages]. Hourly and 15-minute markets are **crypto only** [V] | Yes, daily only | Polymarket CLOB API (not Solana-native) | Not Solana | Builder program exists (not researched here) [U] | Not natively. Only through the Jupiter API, geo-restricted |
| **World (world.xyz)** | Launched inside **Phantom** July 2026. Standalone site opened to 1M waitlisted users on **2026-09-09** [S, crypto.news] | Sports, US midterms, Fed decisions, crypto. **Equities, commodities and weather "planned"** [S] | Planned | None seen [U] | — | CASH (Phantom's stablecoin) settlement. Routes to on-chain LPs. Chainlink Data Streams resolution [S] | No. **Closest emerging consumer competitor** because of Phantom distribution and planned equity contracts |
| **Hedgehog Markets** | V1 on Solana/Eclipse. About $3M volume since Jan 2026, pooled AMM, 2% fee [S/U, review sites] | Permissionless events | No evidence of stocks [U] | No public SDK found [U] | — | — | No (thin liquidity) |
| **PNP Exchange** | Live. Permissionless "pump.fun for prediction markets", bonding-curve pools, LLM oracle (Perplexity + Grok), creators earn 50% of fees [S] | Anything user-created | Could be user-created; no curated stock markets [U] | Yes: `pnp-protocol/solana-skill` on GitHub and SDK [S] | Not captured | Creator fee share 50% [S] | Possible but risky: AI-resolved oracle, meme positioning |
| **Triad Markets** | Solana 1:1 USDC binary markets [S]. **No 2026 activity found** [U] | — | — | — | — | — | Treat as inactive [U] |
| **Trepa** | Solana, numeric slider forecasts on macro and crypto, accuracy-weighted payouts [S] | Macro, markets | Numeric, not stock Up/Down [S] | No | — | — | UX reference for Range tickets |
| **Myriad** | **Not on Solana.** Runs on Abstract, Linea and BNB [S] | Crypto and events | — | — | — | — | No |
| **Limitless** | **Base** CLOB, $1B+ traded, Pyth oracles [V/S]. "BETA Solana support" claimed by pm.wiki [U] | **Hourly and daily crypto and stock Up/Down**, e.g. "NVIDIA (NVDA) Up or Down – Hourly" [V] | Yes (Base) | REST + WebSocket API, `@limitless-exchange/sdk` [V/S] | Base | — | Not on Solana. **Best format reference** for our core product |
| **Hyperliquid HIP-4** | Outcome markets live **2026-05-02**. First market was daily BTC, then a CPI market. $50M on one market in 14 days [S] | Binary 0/1 USDC, shared order book | Not yet stock-specific [U] | HL API | Not Solana | Builder-deployed | Competitor chain, not a dependency |

### 1.2 DFlow in practice (what an integration looks like)

- **Hierarchy:** Series → Events → Markets. Each market has `yesMint`, `noMint`, `marketLedger` and `redemptionStatus` [V].
- **Discover markets:**
  - `GET /api/v1/series?category=Financials`
  - `GET /api/v1/events?seriesTickers=KXINXHUD&status=active&withNestedMarkets=true`
  - `GET /api/v1/market/by-mint/{mint}` [V]
- **Buy YES or NO:** `GET /order?inputMint=USDC&outputMint=<yesMint>&amount=<base units>&userPublicKey=...` returns a base64 transaction. Sign and send, then poll `/order-status` for async fills [V, QuickNode guide].
- **Redeem:** after the market is `determined`, call `/order` with the winning mint in and USDC out. Pays $1 per token [V].
- **KYC:** "all participants in Kalshi's prediction markets must be identity-verified." The **destination wallet** must be Proof-verified. Spot swaps do not need Proof [S].
- **Kalshi index hourly Up/Down** (`KXINXHUD`): the reference level is the index value at the start of the hour. Resolves YES if the index finishes higher. Settlement source is the S&P index value, quadratic fee [V, Kalshi API]. These only run while the underlying index trades.
- **Existing OSS to borrow from:** `Some1Uknow/dflow-cli` (terminal), `0xSardius/kelly` (autonomous DFlow trading agent), `yashhsm/Dflow-Kalshi-Solana-Dashboard` [V].

### 1.3 On-chain CLOBs usable for binary outcome tokens

| CLOB | Status | Program ID | Notes for outcome tokens |
|---|---|---|---|
| **Manifest** (Bonasa-Tech / CKS Systems) | Live. 5–8% of Solana spot DEX volume in 2026 [S] | Core `MNFSTqtC93rEfYHB6hF82sKdZpUDFWkViLByLd1k1Ms`, wrapper `wMNFSTkir3HgyZTsB7uqu3i7FA73grFCptPXgrZjksL`, UI wrapper `UMnFStVeG1ecZFc2gc5K3vFy3sMpotq8C91mXBQDGwh` [V, GitHub] | **Best fit.** Zero trading fees, permissionless markets, **global orders** (one balance backs quotes on many markets, useful for makers quoting dozens of short windows), Token-2022 supported. Already used by the Stocklana entry *Erodoro* for P/N claim tokens [V] |
| **OpenBook v2** | Live, v1.7 [V] | `opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb` (mainnet, devnet, testnet) [V] | Works, but has market-creation rent and cranks. Less maker-friendly than Manifest |
| **Phoenix v1 spot** (Ellipsis) | Legacy spot. Team focus is now Phoenix **perps** [S] | `PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY` (appears in Topledger program registry) [V] | Permissioned market creation historically [U] |

**Practical note:** for 1–15 minute windows, a CLOB per window fragments liquidity. Short-window binary apps (Jupiter Forecast, PRDT, Masayume-style) use **RFQ from market makers or a house LP vault as counterparty**, not an order book. A CLOB (Manifest) only makes sense for **early exit / secondary trading** of longer Range or daily tickets.

---

## 2. Stock derivatives on Solana

### 2.1 Equity perps (for "bet against stocks" and Boost)

| Venue | Status | Equity markets | Leverage | Integration surface | Notes |
|---|---|---|---|---|---|
| **Phoenix (Phoenix Trade, Ellipsis Labs)** | Live. Mobile web since June 2026. Promoted by Anatoly [S] | About **29 equity perps** by late Aug 2026: AMD, INTC, MSFT, META, AMZN, SNDK, CRWV, CBRS, TSM, QCOM, ARM, ASML… [S] | 10x on equities [S] | **Rise SDK** (`@ellipsis-labs/rise`, Rust `phoenix-rise`), public REST/WS `https://perp-api.phoenix.trade` [V]. **Flight builder codes**: register a builder authority on-chain, set your fee, fees accrue to a withdrawable builder account [S] | **Top pick for Short/Boost.** Solflare Perps is built on it (65+ markets, $15M in week one, up to 0.085% fee) [S] |
| **Parquet** | Live mainnet [V] | **367 markets: 317 equities**, 8 ETFs (SPY, QQQ…), crypto, commodities, FX [V] | Up to **200x** on small positions [V] | No SDK/API found [U] | Synthetic, oracle-priced, per-market USDC pools, 24/7, upgrade authority can change parameters [V]. Its **LP pools are a model for our Earn vault** |
| **Backpack Exchange** | MU, SNDK, SPY, QQQ perps launched 2026-09-01. Real shares (Backpack Securities) usable as margin [S] | 4 equity perps | — | CEX API | Custodial exchange with Solana-issued shares, not a Solana program |
| **Adrena** | Relaunching as a "Traditional Markets" perps DEX with the **Autonom** oracle: equities, commodities, FX, 29 pre-IPO feeds [S] | Unclear if live [U] | Up to 100x [S] | Open-source Anchor program historically [U] | Watch it, don't depend on it |
| **Drift → Velocity** | Private beta, perps-only, USDT [S] | Unknown | — | — | Not a dependency |
| **Flash Trade** | **Winding down** unless acquired [S] | — | — | — | Avoid |
| **Jupiter Perps** | Largest Solana perp DEX (about 80% share [S]) | **No equity perps found** [U] | — | Program-based | Crypto only as far as we can tell |
| **JTX (Jito)** | Launched spot-only; equities, perps and prediction markets "later" [S] | — | — | — | Future competitor |
| **Ondo Perps** | Launched July 2026, 24/7 equities, ETFs, commodities [S] | — | — | — | **Chain not confirmed** [U] |
| **Hyperliquid HIP-3 (not Solana)** | trade.xyz holds >90% of builder open interest. HIP-3 about 50% of HL perp volume (July 2026), $62B/month in May [S] | NVDA, TSLA, AAPL, MSFT, GOOGL, AMZN, XYZ100, S&P 500 [S] | — | — | The main cross-chain rival for "leveraged stocks 24/7" |
| **Kalshi single-stock perps (US, not Solana)** | **Filed** with CFTC and SEC, Sept 2026. About 60 contracts on stocks and ETFs over $100B market cap [S] | — | — | — | Validates demand. Not live |

### 2.2 xStock lending and borrowing (for Earn and "bet without selling")

| Protocol | xStocks support | Scale | Notes |
|---|---|---|---|
| **Kamino Lend** | First major lender to accept xStocks as collateral (Jul 2025). Borrow USDC, **Multiply** for leveraged long [S] | $31M of $53M tokenized-stock collateral on Solana, **82.6% share** (late July 2026) [S, KuCoin/CryptoBriefing] | Kamino SDK (klend-sdk). Idle USDC in our vault could earn Kamino supply APY |
| **Jupiter Lend** | SPYx, QQQx, NVDAx, TSLAx, AAPLx as collateral [S] | AAPLx pool passed **$20M** (July 2026) [S] | Part of the Jupiter superapp. Jupiter Lend SDK [U] |
| MarginFi / Save (Solend) | **No 2026 evidence of xStocks markets found** [U] | — | Don't cite |

### 2.3 xStock liquidity, LP and yield

- Raydium: over **$4B cumulative tokenized-stock volume** [V, Solana Aug 2026 roundup].
- xStocks: **190k+ holders**, **$500M+ AUM**, **700+** stocks and ETFs [V, same roundup].
- Solana tokenized-equity supply hit a weekly record of **$465M**. Outstanding value reached an all-time high of **$535M** on 2026-07-16 [V/S].
- Solana holds about **95%** of decentralized tokenized-equity spot volume [S].
- **Sunrise** (Wormhole Labs-initiated) with **Backpack Securities**:
  - 40 listed assets including Nike (2026-09-08) and SpaceX `SPCX` (June 2026), with **$1.5B cumulative volume** [S].
  - Tokenized Micron did **$530M** within 6 weeks [V, roundup].
  - Sunrise tweeted just "Stocklana" on 2026-09-09 [V]. A sponsorship or partner link is **not confirmed** [U].
- Meteora dynamic vaults route idle liquidity into lenders [S]. No stock-specific Kamino or Meteora LP vault product found [U].
- **Options and structured products on stocks:** **none live found on Solana** [U].
  - Ondo lists tokenized covered-call income ETFs [S].
  - The Stocklana entry **Erodoro** builds covered-call style P/N claim splitting on Manifest with MagicBlock [V].

### 2.4 Oracles for stock resolution

- **Pyth Pro:** 24/5 US equity prices for **50+ equities** (pre-market, regular and overnight via Blue Ocean ATS) [V, Pyth blog].
- **Pyth Indices** (2026-06-10): **24/7** single-asset indices for **NVDA, TSLA, AAPL, MSFT**, plus WTI, Brent, gold and silver. Adopted by Coinbase, Kraken and dYdX [V/S]. This matters because weekend and overnight windows need a 24/7 reference.
- Chainlink Data Streams: used by Jupiter Forecast (BTC) and World [V/S].
- Autonom: RWA oracle with corporate-action normalization, used by Adrena [S].
- Pyth Pro and Indices pricing tier or licensing for a hackathon app is **not verified** [U]. The classic free Pyth equity feeds (market hours) are the safe fallback.

---

## 3. Existing stock-price prediction products (any chain) — formats and UX lessons

| Product | Chain / venue | Stock formats | Popularity signal | UX lessons |
|---|---|---|---|---|
| **Kalshi** | US DCM, tokenized on Solana via DFlow | **Hourly Up/Down** S&P 500 and Nasdaq-100. Daily Up/Down Nasdaq. Daily and weekly **ranges** for S&P and Nasdaq. Monthly and yearly max/min. Company KPI and deliveries markets. No single-stock price markets [V] | Kalshi about $16.8B monthly volume (May 2026), $4B annualized revenue (July 2026) [S]. CNBC covers its Nasdaq year-end odds [S] | "Price range at 4pm" bucket ladders are Kalshi's signature (our **Range tickets**). The hourly reference is the start-of-hour value, which is simple to explain |
| **Polymarket** | Polygon | **Daily Up/Down** (close vs previous close, ties resolve 50/50), **Opens Up/Down**, **weekly close ranges**, monthly price-hit. Hourly and 15m are **crypto only** [V] | Stock markets are thin: the biggest daily SPX Up/Down was about $112K, and the whole "stock prices" page showed about $241K [V]. Benzinga runs daily "Will S&P open up or down" articles on the odds [S] | Stocks under-perform crypto on Polymarket, likely because they only run **daily and market hours**, with no 24/7 or short windows |
| **Limitless** | Base | **Hourly and daily Up/Down** for stocks (e.g. NVDA hourly: "Up if price strictly higher than previous hour") plus crypto. 30 and 60 minute windows [V/S] | $1B+ total traded [V] | The closest analogue to our core loop. CLOB on each side. Pyth resolution |
| **Robinhood Prediction Markets** | Robinhood Derivatives LLC (FCM), JV with Susquehanna [S] | S&P: year-end close ranges, annual up/down, intra-year highs/lows, specific-date prices. **No single names** [V, robinhood.com] | 4B+ contracts traded all-time, 2B in one quarter [S] | Mainstream retail proof of demand. Long-dated only for stocks |
| **Jupiter Forecast** | Solana | 15m BTC only [V] | Jup Predict about $17M cumulative pre-Forecast, $5.3M in April 2026 [S] | Rounds scheduled by the issuer. Clients poll `/events`. $5 minimum order |
| **Hyperliquid HIP-4** | HyperCore | Daily BTC, CPI. No stocks yet [S] | $50M on one market in 14 days [S] | Outcome markets inside a perps account, sharing margin with perps |
| **PRDT Finance** | Multi-chain | 5m pooled rounds and 1–30m fixed 1.9x payouts, crypto [S] | — | The "Classic pool vs Pro fixed payout" split maps directly to our parimutuel vs fixed-odds modes |
| **Kalshi (upcoming)** | US | 60 single-stock perps filed [S] | — | Regulators treat single-stock derivatives as securities, so compliance risk is real (see §6) |

**Is there already a Solana app with short-window stock Up/Down markets?** **Not that we could find (as of 2026-09-13).** Searched Solana Compass's prediction-market category, the Colosseum Frontier winners, GitHub, and press. Closest items:

- Kalshi index hourly markets through DFlow-powered frontends (Phantom, Jupiter), limited to indices and market hours.
- World (equities planned).
- Limitless (Base; Solana beta claim unverified).
- Hackathon repos: none doing Up/Down.

**Risk:** Phantom/World, Jupiter Forecast (which already has the 15-minute Up/Down template) or JTX could add stocks quickly. Move fast and lean on Solana-specific angles (xStocks and 24/7 pricing).

---

## 4. Stocklana hackathon intel

### 4.1 Organizer and format [V, hackathons.solana.com]

- **Organizer and sponsor:** Solana Foundation (administers the $100K prize pool). **0 bounty tracks.** No partner sponsors listed.
- **Dates:** runs Sept 11–18 ("opening bell to closing bell"). Submissions close **Fri 2026-09-18 4:00 PM ET**. Judging runs through **2026-10-02**.
- **Stats as of 2026-09-13:** 305 registered, 26 submissions. "Projects become visible after the submission period ends."
- **Judging criteria:**
  - Real user and problem
  - Working end-to-end demo
  - **Why Solana**
  - Execution quality
  - Headline question: "could this be a real app that people will actually use?"
- **Suggested areas:** 24/7 venues and swaps, investing tools (recurring buys, robo portfolios), **credit and yield**, infrastructure (price feeds, analytics), **consumer (mobile, social trading)**.
- **Requirements:** GitHub link, live demo or video (at least one); disclose open-source components; one submission per team; edits allowed until the deadline.
- **Follow-on:** Colosseum World's Fair (colosseum.com/worldsfair).
- **Named judges, AMAs, office hours:** **none found publicly** [U]. Check the hackathon page and Discord when logged in.
- **Announcement stats used by Solana:** "Over 90% of tokenized equities are on Solana". "63% of tokenized-equity volume on Solana happened while U.S. exchanges were closed; 17% on weekends" (Allium data) [S].
- **Sunrise** (@sunrise) tweeted "Stocklana" on 2026-09-09 (263 likes) [V]. Its role in the event is unknown [U].

### 4.2 Visible competing projects (GitHub, 2026-09-13)

**Explicitly Stocklana-tagged:**

| Project | One-liner | Overlap with us |
|---|---|---|
| **TAPE** (`criptocbas/tape-stocklana`) | Issuer-aware terminal: xStocks vs Backpack/Sunrise claims, premium vs issuer mark, 10 USDC swap via Jupiter Ultra. Live on Vercel | Low (terminal) |
| **ShareLens** (`bellabaelfire/stocklana-sharelens`) | Read-only xStocks multiplier and decimal inspector | None |
| **Stocklana Baskets** (`MallorcaBCDays/stocklana-baskets`) | Weighted xStock basket tokens (ETF-like) | None |
| **Erodoro** (`PoulavBhowmick03/Erodoro_Stocklana`) | **Tokenized-equity upside markets**: lock an xStock, pick strike and expiry, split into P (capped) and N (upside call) claims, sell N on the **Manifest** order book. Handles scaledUiAmount splits. Uses MagicBlock | **Medium.** Derivatives on stocks, but option-like and pro-oriented, not consumer Up/Down |
| **MITIGATOR** (`Pabby01/MITIGATOR`) | AI pre-trade risk intelligence and execution. PRD also lists AI copilot, paper trading, **copy trading/strategies**, social timelines, alerts | **Medium** on our AI assistant, copy-trading, alerts and Practice features |
| **Divvyr** (`Nebulaz7/Divvyr`) | Harvest xStock dividends (Scaled UI multiplier deltas) into any token, plus giftable dividend-rights NFTs | Low (yield angle) |
| Stocklana-Meme (`Kelsay849`) | Memecoin site ("Stocklana" token on PumpSwap) | Not a real entry |

**Created after Sept 1 and xStocks-related, probably Stocklana entries [U]:**
- FolioX (strategy baskets)
- xstocks-portfolio-autopilot
- xStocks-Terminal
- exdate (invisible-dividend brokerage statement)
- lotline (DCA contribution planner PWA)
- RWA-price-check (Jupiter quotes vs US prices)
- **nocturne** (24/7 AI agent paper-trading tokenized equities; overlaps our agents)
- zxpad (Zcash runes paying xStocks)
- corporate-action-guard (X Layer)
- tracking-error-notes

**Verdict:** no visible prediction-market, Up/Down, games or Reels-style consumer entry. The field leans toward terminals, analytics, baskets and dividends. Consumer plus prediction plus social is **uncontested among visible entries**. The 26 submissions include private ones, so this is not proof.

### 4.3 Adjacent recent winners (Colosseum Solana Frontier, June 2026) [V]

Judges will have seen these:
- **Bench** (opportunity markets)
- **Senthos** (structured products from prediction-market flow)
- **Mentioned** (word-mention betting)
- **Memetic Machines** (news turned into YES/NO markets)
- **Cesto** (thematic baskets with RWAs, prediction markets and perps)
- **Alpha Group Trading** (social mobile group trading)
- **Peaks** (agent-managed idea portfolios)

---

## 5. "Why Solana" for this product (with evidence)

| Argument | Evidence | Strength |
|---|---|---|
| **The stocks are already here** | 90%+ of tokenized equities and about 95% of tokenized-stock DEX volume are on Solana. xStocks has 190k holders and $500M AUM. Sunrise/Backpack list new names such as Nike and SpaceX [V/S] | Strong. Up/Down tickets can **reference the same xStock the user already holds** and offer "hedge my TSLAx" |
| **Markets that never close** | 63% of Solana tokenized-equity volume happens while US exchanges are closed, 17% on weekends (Allium via Solana) [S]. Pyth 24/7 single-stock indices for NVDA, TSLA, AAPL, MSFT [V] | **Strongest story:** weekend TSLA Up/Down is impossible on Kalshi, Robinhood or Polymarket, which follow market hours or run daily only |
| **Micro-bets need near-zero fees** | Median Solana tx fee about $0.0038 [S]. Base fee 5,000 lamports [V, Solana docs]. $1 tickets work, versus Jupiter Forecast's $5 minimum and Kalshi's quadratic fees [V] | Strong |
| **Speed for 1–5 minute windows** | About 400ms slots today. **Alpenglow** targets ~100–150ms finality, with mainnet activation expected late Q3 or early Q4 2026. Parts (SIMD-0387, 0357) already activated July 2026 [S]. **Do not claim Alpenglow is live** | Medium-strong |
| **Composable liquidity to reuse** | Kalshi SPL outcome tokens (DFlow), Phoenix equity perps with builder codes, Kamino and Jupiter Lend xStock collateral, zero-fee Manifest CLOB, Pyth native [V/S] | Strong. "We compose, not rebuild" |
| **Wallet-native distribution** | Phantom (20M users) already ships Kalshi prediction markets. Solflare ships Phoenix perps in-wallet [S]. Seeker: 150k+ pre-orders, SKR token Jan 2026 [S] | Medium. Also shows incumbents can copy us |
| **Trade-from-X via Blinks** | Actions/Blinks spec [V]. **Caveat:** X unfurls only for **Dialect-registry-verified** actions and needs a wallet extension. Blockworks reported discoverability problems [S] | Medium-weak. Pitch it as an **X bot reply with a Blink** that falls back to `dial.to` or our PWA. Register the action early |
| **Solana Foundation priorities** | Stocklana itself, the Frontier Traders program (tokenized equities), SpaceX tokenized-equity campaign [S] | Medium |

---

## 6. Compliance note (judges will ask)

- Kalshi through DFlow requires KYC (Proof) [S]. Jupiter's Prediction API geo-blocks the US and South Korea [V]. xStocks are "not available to US persons" (industry standard, as the TAPE README notes) [V].
- Binary options on single stocks count as securities or swaps in the US. Kalshi needs joint CFTC and SEC approval even for single-stock perps [S].
- **Hackathon stance:**
  - Geofence the US.
  - Label it "non-US users; not investment advice".
  - Use oracle-settled synthetic Up/Down tickets (no claim on shares).
  - For Kalshi index markets, route through DFlow with Proof.

---

## 7. Build-on vs build-own recommendation

| Feature | Recommendation | Why |
|---|---|---|
| **Core 1m/5m/15m/1h single-stock Up/Down (24/7)** | **BUILD OWN** thin Anchor program. Per-round PDA with open/close price from **Pyth** (Pyth 24/7 indices for off-hours where available, market-hours feeds otherwise). Positions as PDAs. Keep Token-2022 outcome mints optional | No reusable Solana venue offers single-stock short windows (DFlow/Kalshi = indices, market hours, KYC. Jupiter Forecast = BTC, closed issuer. Drift BET gone). This is the differentiator judges reward |
| **Pricing / counterparty** | **Earn vault as house counterparty** (Masayume/DreamDEX-style): LPs deposit USDC, tickets priced with an oracle-driven fixed-odds model plus spread and exposure caps. Optional parimutuel "Classic" mode (PRDT-style) | Avoids fragmented order books per window. Parquet (per-market USDC pools) and Jupiter Forecast (MM quotes) show both models work in production |
| **Range tickets** | Build own (same program, bucket ladders). **Mirror Kalshi's `KXINX`/`KXINXW` range design** for S&P/Nasdaq and optionally **route those to DFlow** for KYC'd users | Kalshi format is proven |
| **"Pro / Index" markets tab** | **Integrate DFlow** metadata API (read-only odds for `KXINXHUD` and `KXNDQHUD`) with trading gated by Proof KYC. Apply for the Kalshi $2M grants | Real regulated liquidity, and shows composability. Get a prod API key now (hello@dflow.net). The dev host did not resolve today |
| **Early exit / secondary for daily and Range tickets** | Optional: list outcome mints on **Manifest** (`MNFSTqtC…`) | Zero fees, global orders. Stretch goal only |
| **Bet against stocks (short) and Boost (leverage)** | **Integrate Phoenix** via Rise SDK plus **Flight builder code** (we earn a fee). Offer "Down tickets" (own program) as the simple consumer short, and Phoenix perps as "Pro short/boost". Boost on tickets = payout multiplier priced by the vault, capped | Phoenix has about 29 equity perps and builder fees. Parquet has more names but no SDK seen |
| **Earn / yield** | (1) Own **LP vault** (earns ticket edge and fees). (2) Park idle vault USDC in **Kamino** or Jupiter Lend. (3) "**Bet without selling**": borrow USDC against xStocks on Kamino or Jupiter Lend and fund tickets. (4) Stretch: "**Covered Up tickets**" where xStock holders sell Up exposure for premium, a consumer version of Erodoro | Uses existing stock-lending liquidity. Yield is a named judging area ("credit and yield") |
| **Oracle** | **Pyth** (Hermes pull, market-hours feeds). Evaluate Pyth Pro 24/5 and Pyth Indices 24/7 access. Fallback for weekends: xStock on-chain DEX TWAP with a wide-spread guardrail | Weekend markets are the story, and the oracle choice must be defensible |
| **Polymarket stock daily markets** | Skip, or read-only via the Jupiter Prediction API (beta, geo-blocked) | Thin volume, not Solana-native |
| **Trade-from-X** | Own bounded agent plus an X bot that replies with a **registered Blink** (Dialect registry) and deep link to the PWA | Unfurl limits mean the fallback link is required |
| **Copy-trading, AI Sensei, games, Reels, rooms** | Own (off-chain plus our program events) | Nobody on Solana has this for stocks. MITIGATOR and nocturne overlap only on AI and agents |

**Net:** own the round, ticket and vault program (small, auditable), and compose DFlow (index markets), Phoenix (short and Boost), Kamino or Jupiter Lend (yield and collateral), and Pyth (resolution). That hits "real app" plus "why Solana" without rebuilding liquidity.

---

## 8. Differentiation gaps we can own

1. **24/7 single-stock short-window Up/Down on Solana.** Kalshi covers indices only in market hours. Polymarket stocks are daily only and off-chain relative to Solana. Limitless is on Base. Jupiter Forecast is BTC only.
2. **Weekend and after-hours stock markets,** tied to the Solana-specific stat that 63% of tokenized-equity volume trades while US exchanges are closed. "TSLA Up or Down by Sunday 8pm?" is a hook no US venue can offer.
3. **Hedge-my-xStocks one-tap.** Read wallet xStock holdings (xStocks, Sunrise/Backpack names) and offer Down tickets sized to the position. Uses Solana's tokenized-stock base directly.
4. **Bet without selling.** Borrow against xStocks (Kamino or Jupiter Lend) to fund tickets, so stock holdings become a live collateral base.
5. **Earnings, CPI and FOMC windows on single stocks.** Kalshi has KPI markets but no price-move-around-earnings markets. Polymarket has weekly close ranges. A dedicated "NVDA earnings night Up/Down (after-hours, Pyth 24/5)" format is open.
6. **Micro-stakes ($1) plus games** (Duel, Line Rider, Candle Hop, Practice). No Solana stock product has a gamified consumer layer. World/Phantom are generic event markets. The judges' "people will actually use it" question favors this.
7. **Social and agent layer for stocks:** Reels feed of live rounds, copy-trading strategy marketplace, Trade-from-X. The visible hackathon field has terminals and dashboards, not social consumer apps.
8. **Composed Pro tier:** S&P and Nasdaq hourly via DFlow/Kalshi (regulated liquidity) plus short and Boost via Phoenix builder codes, inside a consumer shell. Incumbent wallets offer one or the other, not both for stocks.
9. **Mobile-first on Seeker / Solana dApp Store** (150k+ Seeker pre-orders, SKR ecosystem) and PWA.

---

## Sources

### Hackathon and ecosystem
- Stocklana hackathon page — https://hackathons.solana.com/hackathons/stocklana
- Stocklana projects page ("no public projects yet") — https://hackathons.solana.com/hackathons/stocklana/projects
- Sunrise "Stocklana" tweet (via fxtwitter API) — https://x.com/sunrise/status/2097795487541968983
- Solana Ecosystem Roundup, August 2026 — https://solana.com/news/solana-ecosystem-roundup-august-2026
- 63% off-hours / 17% weekend stat (Allium via Solana, secondary) — https://www.bitget.com/news/detail/12560605475291 · https://x.com/solana
- Colosseum Frontier winners — https://blog.colosseum.com/announcing-the-winners-of-the-solana-frontier-hackathon/
- GitHub repos:
  - https://github.com/criptocbas/tape-stocklana
  - https://github.com/bellabaelfire/stocklana-sharelens
  - https://github.com/MallorcaBCDays/stocklana-baskets
  - https://github.com/PoulavBhowmick03/Erodoro_Stocklana
  - https://github.com/Pabby01/MITIGATOR
  - https://github.com/Nebulaz7/Divvyr
  - https://github.com/umutyesildal/foliox
  - https://github.com/Sketchify-Dev/nocturne
  - https://github.com/AlperJ/exdate
  - https://github.com/operatoruplift/lotline
  - https://github.com/blakehendo/RWA-price-check

### DFlow / Kalshi
- DFlow Prediction Markets API announcement — https://solana.com/news/dflow-prediction-markets-api · https://dflow.net/blog/prediction-markets-api
- DFlow fees and rebates (search snippet; page 404'd on direct fetch) — https://pond.dflow.net/build/prediction-markets/prediction-market-fees
- DFlow metadata API reference (via Context7) — https://pond.dflow.net/prediction-market-metadata-api-reference/introduction
- DFlow KYC for Kalshi — https://dflow.mintlify.app/prediction-markets/kyc
- QuickNode: trade Kalshi on Solana with DFlow — https://www.quicknode.com/guides/solana-development/3rd-party-integrations/kalshi-prediction-markets-with-dflow
- Kalshi public API (series, Financials) — https://api.elections.kalshi.com/trade-api/v2/series?category=Financials · https://api.elections.kalshi.com/trade-api/v2/series/KXINXHUD
- Kalshi S&P 500 hourly Up/Down — https://kalshi.com/markets/kxinxhud/inxhud/kxinxhud-26jun261500
- Kalshi Nasdaq-100 hourly Up/Down — https://kalshi.com/markets/kxndqhud/ndqhud/kxndqhud-26sep041500
- Kalshi Nasdaq daily Up/Down — https://kalshi.com/markets/kxnasdaqdud/nasdaqdud/kxnasdaqdud-26jun24h1600
- Kalshi single-stock perps filing — https://www.coindesk.com/markets/2026/09/11/kalshi-wants-24-7-tesla-and-nvidia-perps-as-wall-street-fights-over-who-regulates-them
- Kalshi revenue and volume (secondary) — https://sacra.com/c/kalshi/
- Phantom × Kalshi — https://www.theblock.co/post/382340/phantom-integrates-kalshi-prediction-markets-web3-wallet
- OSS:
  - https://github.com/Some1Uknow/dflow-cli
  - https://github.com/0xSardius/kelly
  - https://github.com/yashhsm/Dflow-Kalshi-Solana-Dashboard

### Jupiter
- Jupiter Prediction docs — https://developers.jup.ag/docs/prediction · https://developers.jup.ag/docs/prediction/forecast.md · https://developers.jup.ag/docs/llms.txt
- Forecast launch — https://solanacompass.com/news/jupiter-launches-forecast-solanas-first-native-prediction-market-with-multi-market-maker-quoting · https://x.com/JupiterExchange/status/2062527793053974908
- Jupiter Lend xStocks — https://solanacompass.com/news/solana-tokenized-equity-value-hits-535m-all-time-high-as-jupiter-lend-crosses-20m-in-xstocks-deposits · https://www.kucoin.com/news/flash/jupiter-adds-spyx-qqqx-nvdax-and-tslax-as-collateral

### Other prediction markets
- Drift BET review — https://predictionmarketsindex.com/platforms/drift-bet/
- Drift exploit — https://www.trmlabs.com/resources/blog/north-korean-hackers-attack-drift-protocol-in-285-million-heist · https://www.drift.trade/updates/incident-recovery-update-april-16-2026-now
- Drift → Velocity — https://www.cryptotimes.io/2026/07/02/drift-rebrands-to-velocity-ahead-of-private-beta-launch/ · https://x.com/VelocityDEX/status/2072334490949574677
- Polymarket finance, daily and stock prices — https://polymarket.com/finance/daily · https://polymarket.com/predictions/stock-prices · https://polymarket.com/event/tsla-up-or-down-on-july-29-2026
- Polymarket SOL deposits — https://www.theblock.co/post/347866/polymarket-launches-on-solana-to-enable-sol-deposits-expanding-beyond-usdc
- World prediction market — https://crypto.news/world-opens-solana-prediction-market-to-1m-users/
- Hedgehog (secondary) — https://predictionmarketsreviews.com/reviews/hedgehog-markets · https://www.hedgehog.markets/
- PNP Exchange — https://x.com/predictandpump · https://github.com/pnp-protocol/solana-skill
- Trepa (secondary) — https://medium.com/@sonisuchit144/trepas-revolutionary-precision-forecasting-model-7c6d86fa6d22
- Myriad — https://decrypt.co/resources/getting-started-with-myriad
- Limitless — https://docs.limitless.exchange/ · https://limitless.exchange/markets/nvidia-nvda-up-or-down-hourly-1782313208124 · https://pm.wiki/projects/limitless-exchange (Solana beta claim [U])
- Hyperliquid HIP-3 and HIP-4 — https://www.theblock.co/news/defi/2026-07-13-hyperliquid-hip-3-markets-surge-50-perp-volume-onchain-stock-trading-grows-408064 · https://www.coindesk.com/markets/2026/02/02/hyperliquid-s-hype-higher-by-10-on-plans-to-add-prediction-markets-and-options · https://www.quicknode.com/guides/hyperliquid/trade-hip-4-prediction-markets-on-hyperliquid
- Robinhood — https://robinhood.com/us/en/prediction-markets/financial/sp/ · https://robinhood.com/us/en/newsroom/robinhood-prediction-markets-joint-venture/
- PRDT (secondary) — https://sailgp.com/prediction-markets/crypto/solana/5-minute

### CLOBs
- Manifest — https://github.com/Bonasa-Tech/manifest · https://pineanalytics.substack.com/p/understanding-manifest
- OpenBook v2 — https://github.com/openbook-dex/openbook-v2
- Phoenix v1 program ID reference — https://github.com/Topledger/solana-programs

### Stock derivatives, lending and oracles
- Phoenix equity perps — https://solanacompass.com/news/phoenix-trade-lists-cerebras-systems-tsmc-qualcomm-arm-holdings-and-asml-as-equity-perps-during-big-tech-earnings-week · https://solanacompass.com/projects/Phoenix
- Phoenix Rise SDK — https://docs.phoenix.trade/sdk/rise · https://github.com/Ellipsis-Labs/rise-public
- Phoenix Flight builder codes (secondary) — https://www.quicknode.com/builders-guide/tools/phoenix-trade-by-phoenix
- Solflare Perps — https://solanacompass.com/news/solflare-perps-hits-15m-in-six-days-as-phoenix-trades-wallet-channel-gains-traction
- Parquet — https://parquet.exchange/ · https://parquet.exchange/risk-disclosure
- Backpack equity perps — https://solanacompass.com/news/backpack-exchange-launches-four-equity-perpetuals-and-real-us-shares-as-cross-asset-collateral
- Adrena × Autonom — https://medium.com/@r_15629/what-are-rwa-perps-e4c65f84211c · https://solanacompass.com/projects/adrena
- Flash Trade wind-down — https://thedefiant.io/news/defi/solana-perp-dex-flash-trade-to-wind-down-unless-it-finds-a-buyer
- JTX — https://jtx.com/blog/what-is-jtx
- Frontier Traders — https://thedefiant.io/news/blockchains/solana-foundation-frontier-traders-institutional-program-500m-volume
- Ondo Perps (chain unverified) — https://www.hokanews.com/2026/07/ondo-perps-launches-247-markets-for.html
- Kamino xStocks — https://www.kucoin.com/news/flash/kamino-lend-controls-82-6-of-tokenized-stock-lending-on-solana · https://www.theblock.co/post/362284/solana-based-decentralized-lending-protocol-kamino-integrates-tokenized-xstocks-as-collateral-option · https://xstocks.fi/us/news/how-kamino-turned-xstocks-into-a-lending-market
- Sunrise and Backpack Securities — https://cryptobriefing.com/sunrise-tokenized-stocks-solana-backpack/ · https://egamers.io/nike-stock-arrives-on-chain-tokenized-shares-debut-on-solana-through-sunrise/
- xStocks case study — https://solana.com/news/case-study-xstocks
- Pyth — https://www.pyth.network/blog/extended-hours-us-equity-data-moves-to-pyth-pro · https://www.businesswire.com/news/home/20260610193791/en/Pyth-Network-Launches-Proprietary-247-Index-Products-Across-Metals-Oil-and-U.S.-Equities-Partners-With-Marketvector-on-Equity-Index-Futures

### Solana platform
- Alpenglow — https://solana.com/upgrades/alpenglow · https://nownodes.io/blog/what-is-alpenglow-solana-complete-guide/
- Fees — https://solanacompass.com/statistics/fees · https://solana.com/learn/understanding-solana-transaction-fees
- Actions and Blinks — https://solana.com/docs/tools/actions · https://docs.dialect.to/blinks/blinks-provider/blink-registry · https://blockworks.com/news/lightspeed-newsletter-solana-blinks-twitter
- Seeker — https://www.theblock.co/post/365600/solana-mobile-seeker-crypto-smartphone

### Known unverified items (re-check before the pitch)
- DFlow tokenization of Kalshi **financial** series specifically. The 100% coverage is DFlow's own claim, and we could not hit the API without a key.
- Exact DFlow fee tiers and builder rebate terms.
- Jupiter Prediction API integrator fees.
- Limitless Solana beta.
- Hedgehog volume figures.
- Triad activity.
- Adrena equity perps being live.
- Ondo Perps chain.
- Pyth Pro / Indices access terms.
- Phoenix Flight fee caps.
- Whether Jupiter Perps has any equity markets.
- Stocklana judges, AMAs and office hours.
