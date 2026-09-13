# 02 — Equity Price Oracles, Settlement & Market Hours (Solana)

> Research date: **Sunday 2026-09-13**. Stocklana submissions close **Fri 2026-09-18 16:00 ET**, which is the NYSE close. It is also quad-witching day: Sep 18, 2026 is the third Friday of September, so expect a volatile close.
> Method: live API calls (Hermes, Pyth Pro symbols, Solana mainnet/devnet RPC, Kalshi API), official docs and GitHub source. Anything not confirmed first-hand is marked **UNVERIFIED**.
> Audience: a team that has built BTC/ETH Up/Down markets (Somnia, 60s–1h windows) and has never handled stock prices.

---

## 0. TL;DR — the five things that will bite you

1. **Pyth is no longer free.**
   - Since the **Pyth Core upgrade on 2026-08-26 16:00 UTC**, every Hermes request needs `Authorization: Bearer $PYTH_API_KEY`. We verified this: `hermes.pyth.network`, `pyth.dourolabs.app/hermes` and `hermes-beta` all return **HTTP 401** without a key.
   - The **Free plan is "view-only access through Pyth Terminal (no API permissions)"**.
   - The **Starter plan ($500/mo) covers crypto only**. That includes the xStock *token* feeds, which Pyth classifies as crypto.
   - **US equities need the Pro plan**: "starting at $2,500/mo" on the pricing page, and "U.S. Equities $5,000/mo" in the upgrade blog.
   - Only the *metadata* endpoints (`/v2/price_feeds`, Pro `/v1/symbols`) still work without a key.
2. **Pyth equity price accounts already on Solana are stale.** We derived the shard-0 price-feed PDAs and read them on mainnet and devnet:
   - AAPL last updated 2026-08-14.
   - NVDA and SPY froze at 2026-08-26 15:54 UTC, the moment of the upgrade.
   - TSLA and QQQ were last updated Fri 2026-09-11 19:59:59 ET, apparently pushed by some third party.
   - Devnet equity accounts have been frozen since 2026-07-02.
   - **You cannot rely on reading these accounts for free.**
3. **Stocks have sessions, not a 24/7 tape.**
   - Regular hours are 09:30–16:00 ET. Pre-market is 04:00–09:30, post-market 16:00–20:00, overnight (Blue Ocean ATS) 20:00–04:00 Sun–Thu.
   - Nothing trades from Fri 20:00 to Sun 20:00 ET, or on exchange holidays.
   - Pyth *Core* feeds are scheduled for **regular hours only**. Extended and overnight sessions moved to **Pyth Pro** (June 2026) and are tagged with a `marketSession` field.
4. **The tokenized stock is not the stock.** xStocks (e.g. NVDAx) trade 24/7 on Solana DEXs and float at a premium or discount when NYSE is closed; weekend moves of 3–5% have been reported. Pyth has separate 24/7 feeds for the token (`Crypto.NVDAX/USD`) and for Pyth's own proprietary 24/7 "Index" price (`Equity.Index.NVDA/USD`, Pro).
5. **Settling a price at a specific timestamp is solvable on Solana without a special API.**
   - Fetch Hermes `/v2/updates/price/{T}`, which returns the first update with `publish_time >= T`.
   - Post it with the receiver.
   - On-chain, require `prev_publish_time < T <= publish_time <= T + Δ`. This proves you hold *the* unique first update at or after T, so nobody can pick a favourable price.
   - Do **not** use `get_price_no_older_than` for settlement: it measures age against *now*, which breaks late settlement.

---

## 1. Pyth Network

### 1.1 Product map (as of Sep 2026)

| Product | What it is | Transport on Solana | Access |
|---|---|---|---|
| **Pyth Core** (old "price feeds") | Aggregated price + confidence + EMA, published on Pythnet and bridged via Wormhole | **Pull**: Hermes → post `PriceUpdateV2` via the receiver `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`. **Push/sponsored**: price-feed accounts owned by program `pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT` | API key required since 2026-08-26. Equities → Pro plan |
| **Pyth Pro** (formerly **Pyth Lazer**) | Low-latency (1ms–1s channels), per-property payloads (price, bid/ask, confidence, `marketSession`, …), all sessions | WebSocket `wss://pyth-lazer-{0,1,2}.dourolabs.app/v1/stream` → verify on-chain via `pyth-lazer-solana-contract` (program `pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt`) | Paid (Pro plan) |
| **Pyth Indices** (launched 2026-06-09/10) | Proprietary **24/7** single-name indices (NVDA, TSLA, AAPL, MSFT, GOOGL, INTC, HOOD, MSTR, CRCL, …) plus baskets | Symbols `Equity.Index.<TICKER>/USD` | Listed in Hermes and Pro symbols; not pushed on Solana (no PDA account found for `Equity.Index.NVDA`) |
| **History / Benchmarks** | OHLC candles (TradingView shim) and price-at-timestamp | `https://pyth.dourolabs.app/v1/{channel}/history`, `/{channel}/price?timestamp=` (µs), `/{channel}/price/range` (≤60s) | **401 without key** (verified). `/v1/symbols` is open |

### 1.2 Pricing and plans (verified from pyth.network/pricing and the Core-upgrade blog)

- **Free, $0**: "10 second update frequency", "View-only access to all symbols", "**View-only access through Pyth Terminal (no API permissions)**", no display or redistribution rights.
- **Starter, $500/mo**: up to 1s updates, "Access to all crypto symbols", API key, display rights. The upgrade blog says Starter covers "crypto, NAV, crypto redemption rates, and crypto indices".
  - **Implication: xStock token feeds (`Crypto.NVDAX/USD`, asset type Crypto) are likely in Starter. UNVERIFIED; confirm with Pyth.**
- **Pro, from $2,500/mo**: up to 1ms, "Access to all symbols (equities, futures, commodities, rates, crypto…)", "Over 95% accuracy vs NBBO".
  - The Core-upgrade blog (2026-05-26) lists Pro by asset class: **U.S. Equities $5,000/mo**, All Asset Classes $10,000/mo.
- No hackathon or builder tier is listed. The blog says "Testnets are available for testing prior to going live", but `hermes-beta.pyth.network` also returns 401.
  - **Action: ask Pyth (Discord / data@dourolabs.xyz) today for a hackathon key. Outcome UNVERIFIED.**
- Rate limit documented for Hermes/Benchmarks: "10 requests every 10 seconds per IP". This may now differ per plan (UNVERIFIED).

**Timeline of the paywall:**
- **2026-05-26**: Core-upgrade blog.
- **2026-06-15**: extended-hours `.PRE/.POST/.ON` feeds deprecated and moved to Pyth Pro.
- **2026-07-31**: original upgrade date.
- **2026-08-26 16:00 UTC**: upgrade executed. Hermes now requires a key; the on-chain Core contracts were upgraded in place on EVM and Solana with the same interface.

### 1.3 US equity feed coverage (verified from the live Hermes list, 2026-09-13)

- `GET /v2/price_feeds?asset_type=equity` (no key needed) returned **1,249 equity feeds**, of which **1,051 are `Equity.US.*`**. Also listed: HK (107), JP, KR, CN, TW and IN feeds.
- **Every `Equity.US.*` Core feed has schedule `America/New_York;0930-1600 x5,C,C;<holidays>`**, i.e. regular session only.
- Pro `/v1/symbols` (no key) lists **3,684 symbols (2,022 equities)**.
  - The same Pro feed ID (e.g. AAPL = 922) carries `market_sessions` for `regular`, `pre_market`, `post_market` and `over_night`.
  - Coverage across US equities: pre-market stable 446, post-market stable 408, overnight stable 225; ~154 "coming_soon".
  - Old `Equity.US.*/USD.EXT` feeds are `inactive`.
- Single stocks, ETFs (SPY, QQQ, IWM, DIA, GLD, TLT, SPYG/SPYV/SPYM, SOXL/SOXS…) and **24/7 indices** (`Equity.Index.US500`, `US100`, `US30`, plus single names) are all present.
  - There is no raw S&P 500 cash index as `Equity.US`; use SPY/QQQ, or the `Equity.Index.US500` Pyth product.

#### Feed ID table (Hermes hex IDs; verified live 2026-09-13)

Pro IDs are the `pyth_lazer_id` from `pyth.dourolabs.app/v1/symbols`.

| Ticker | `Equity.US.<T>/USD` (regular session, Core) | Pro ID | `Equity.Index.<T>/USD` (Pyth 24/7 index) | Pro ID | xStock token `Crypto.<T>X/USD` (24/7) |
|---|---|---|---|---|---|
| AAPL | `49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688` | 922 | `aaba35e6f33fb973bb2201d48a79ae24795affa6ba8bd50a93dcaf7da0030f36` | 3191 | `978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675` |
| TSLA | `16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1` | 1435 | `e6da44bff5b8b06897a3739dd331b440d6662595bb862e37046892c568ae3fc0` | 3185 | `47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362` |
| NVDA | `b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593` | 1314 | `a470c4ac46f44b547b2cba52338f311fb642b79375ce5f0cfd5cb5b99227b852` | 3188 | `4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f` |
| SPY | `19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5` | 1398 | — (use `Equity.Index.US500/USD` `e266cf0bf9a358bb19c4269f59b3d2e6258ecda5b0707e758f00c087f4baa3e9`) | — | `2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14` (SPYX) |
| QQQ | `9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d` | 1363 | — (use `Equity.Index.US100/USD` `09a53e8f54215c0ad456ffbef1ed893f824eb65e15168b64151e52e53389be00`) | — | `178a6f73a5aede9d0d682e86b0047c9f333ed0efe5c6537ca937565219c4054d` (QQQX) |
| MSFT | `d0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1` | 1292 | `d9144b30a3a162a2748d384dc53387571f3ec77b9edfe31739349396ed67a63a` | 3196 | `bb723a70af731ab56b9a650eb7e8ac22b7bc07ea77f8670bd1fa9a37bf6df3f5` |
| AMZN | `b5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a` | 954 | `329635cf9e705e01ed2d842fafbb6c426d7e5630e75847740d89957222fd68b8` | 3192 | `7148fbe6e493ff2580305c92a8d7f8628c9943b11b9b253aebc24863fec290e8` |
| META | `78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe` | 1272 | `2cc0c022f7f37920485a5947f3cea8633783b6cb7fff6d94ee52f48687b7783d` | 3262 | `bf3e5871be3f80ab7a4d1f1fd039145179fb58569e159aee1ccd472868ea5900` |
| GOOGL | `5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6` | 1163 | `ad519718d387de4f0d7d29ea16a3730ce42e49c59fef6fba6fc9bac477645f6f` | 3194 | `b911b0329028cd0283e4259c33809d62942bd2716a58084e5f31d64c00b5424e` |
| COIN | `fee33f2a978bf32dd6b662b65ba8083c6773b494f8401194ec1870c640860245` | 1042 | `49387483ff50427bf0ff5928082b0cf16331421067c59f4c582a07aa117db1ac` | 3190 | `641435d5dffb5311140b480517c79986d8488d5cf08a11eec53b83ad02cab33f` |
| MSTR | `e1e80251e5f5184f2195008382538e847fafc36f751896889dd3d1b1f6111f09` | 1294 | `109b49ea13e04334cb570ba3b0fb1a18d500d8eeaf32ad1987816eb4bb26d8f3` | 3187 | `53f95ba4e23ed15ea56083e2ee9a5eec48055d6f59033d4bb95f1ca2a2349c28` |
| HOOD | `306736a4035846ba15a3496eed57225b64cc19230a50d14f3ed20fd7219b7849` | — | `4a4f96283d157d08b7b8aa596363f7978587d4fa59a77dcb90f84af7d870a630` | — | `dd49a9ac6df5cbfa9d8fc6371f7ae927a74d5c6763c1c01b4220d70314c647f9` |
| CRCL | `92b8527aabe59ea2b12230f7b532769b133ffb118dfbd48ff676f14b273f1365` | — | `59751961c9aa1943ece2d3e9060070d8d665a99a28642e4b10fcae972c10b833` | — | `c13184461c0c80d98ffcd89be627c2220b94a96c7c67f0c4b16bc12fd3b17758` |
| PLTR | `11a70634863ddffb71f2b11f2cff29f73f3db8f6d0b78c49f2b5f4ad36e885f0` | — | `52c7c6b70032b7151c8d0febf684f14318e1e13315976e171267639955400bb9` | — | — |
| NFLX | `8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2` | — | — | — | `02a67e6184e6c9dd65e14745a2a80df8b2b3d2ca91b4b191404936003d9929ae` |
| AMD | `3622e381dbca2efd1859253763b1adc63f7f9abb8e76da1aa8e638a57ccde93e` | — | — | — | — |
| GOOG | `e65ff435be42630439c96396653a342829e877e2aafaeaf1a10d0ee5fd2cf3f2` | — | — | — | — |
| IWM | `eff690a187797aa225723345d4612abec0bf0cec1ae62347c0e7b1905d730879` | — | — | — | — |
| DIA | `57cff3a9a4d4c87b595a2d1bd1bac0240400a84677366d632ab838bbbe56f763` | — | — | — | — |
| GLD | `e190f467043db04548200354889dfe0d9d314c08b8d4e62fabf4d5a3140fecca` | — | — | — | `e7d1138d0083368634087268c64b7bea0b4101a6365f83915cba9e76a8364b96` (GLDX) |
| TLT | `9f383d612ac09c7e6ffda24deca1502fce72e0ba58ff473fea411d9727401cc1` | — | — | — | — |

Other related feeds:
- **Redemption-rate feeds** `Crypto.<T>X/<T>.RR`, e.g. NVDAX/NVDA.RR `b675c4e9f46d94afa9174a7df09966b77a2950970bb50a77ec8ad4fcfd8266f4`, SPYX/SPY.RR `9e916cc00d292da2367646ffd6537d6b8d0c3f15e2d5891ac44aed31291811a9`. These most likely encode the xStock share multiplier (**UNVERIFIED interpretation**).
- **Ondo tokenized stocks**: `Crypto.AAPLON/USD` `e6734de88a83d9d2fb33072adab319004700aefd069653aba30ba9e3cac056f2`, `Crypto.NVDAON/USD` `207ddea2a443d30b7e13a7c88a9e3f106765deb97049afc65a18cede50fffc82`, `Crypto.TSLAON/USD` `c09ef687ed07091c047da444f1499f2da52cdc1c085104643ec565a9eb1af514`.
- **Look up any ID yourself (no key needed):** `curl "https://hermes.pyth.network/v2/price_feeds?query=NVDA&asset_type=equity"`.

#### Solana price-feed accounts (shard 0 PDAs; read live 2026-09-13)

- PDA = `findProgramAddress([u16_le(shard), feed_id_bytes], pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT)`.
- All accounts are owned by the receiver `rec5EK…`, `VerificationLevel::Full`, 134 bytes.

| Feed | Account | Mainnet last `publish_time` (UTC) | Devnet last `publish_time` |
|---|---|---|---|
| Equity.US.AAPL | `DJ2FyTgUAkEtXW3U5P9PF19meFTRtW4ZWKKFgACfVbUy` | 2026-08-14 20:00:19 (price 305.92) | 2026-07-02 13:48:55 |
| Equity.US.NVDA | `2w1Tg1XTZbUib7srfRoStJ4v5JXVsK7roQEGMsMaGZFC` | 2026-08-26 15:54:46 (211.02) | 2026-07-02 |
| Equity.US.SPY | `9owhtgrdLiUMAH9JKxYFt5pUY4Luy4EzzLhdcWPVuDyy` | 2026-08-26 15:54:46 (765.48) | 2026-07-02 |
| Equity.US.TSLA | `E8WFH8brgP58arcuW2wwsPHiomYrSvrgWTsRLZLAEZUQ` | 2026-09-11 23:59:59 (=19:59:59 ET, post-market) | 2026-07-02 |
| Equity.US.QQQ | `EwssJrQ7UVz6itHEaQQsKWikhZ3iHddyxRhmR7pTvwt5` | 2026-09-11 23:59:59 | 2026-07-02 |
| Crypto.NVDAX/USD | `6TPsjFigUaMFanRCsxQ4WbmG215xhRBXsb5y5Cn5L6eE` | **2026-09-12 12:18:54 (a Saturday: the token trades 24/7)** | 2026-08-04 |
| Equity.Index.NVDA | `HKN7Vmi1goKo6fboWRjUkaSgL51wzySEW9kRW6WRvsMN` | no account | no account |

**What this tells you:**
- Pyth's docs page for Solana sponsored feeds did not list AAPL, NVDA or SPY as sponsored.
- Whoever keeps pushing TSLA and QQQ is not a guarantee. The 19:59:59 ET timestamp suggests their pusher uses extended-hours data.
- **Useful testing trick:** these are *real, fully verified* `PriceUpdateV2` accounts. Clone them into a local validator (`solana-test-validator --clone <addr> --url mainnet-beta`) to unit-test your Pyth decoding and settlement code without an API key.

**Confidence intervals seen on-chain:**

| Feed | Price | Conf | Conf as bps of price |
|---|---|---|---|
| AAPL | 305.92 | 0.02 | ≈0.7 bps |
| NVDA | 211.02 | 0.11 | ≈5 bps |
| TSLA | 365.28 | 0.20 | ≈5.5 bps |
| NVDAX token (weekend) | 219.52 | 0.023 | ≈1 bp |

Regular-session equity confidence is tiny. Use conf mainly as a *halt/garbage detector*, e.g. void the market if conf > 50 bps.

### 1.4 Market sessions and closed-market behaviour

**Pyth docs (Market Hours page), US equities:**
- Regular: weekdays 09:30–16:00 ET
- Pre-market: 04:00–09:30
- Post-market: 16:00–20:00
- Overnight: Sun–Thu 20:00–04:00 (next day)
- Closed on weekends and NYSE holidays

**Schedule strings.** Every feed exposes a machine-readable `schedule` in Hermes `/v2/price_feeds` and Pro `/v1/symbols`.
- Format: `TZ;Mon,Tue,Wed,Thu,Fri,Sat,Sun;MMDD/override,...`
  - `C` means closed, `O` means open 24h, `HHMM-HHMM&HHMM-HHMM` gives multiple ranges.
  - The holiday list is a rolling ~12 months.
- Hermes also returns `market_hours: { is_open, next_open, next_close }` (unix seconds). This works without a key, which makes it good for your UI and keeper.
- Live example, `Equity.US.AAPL/USD` regular:
  `America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;0907/C,1126/C,1127/0930-1300,1224/0930-1300,1225/C,0101/C,0118/C,0215/C,0326/C,0531/C,0618/C,0705/C`
- Pro sessions for AAPL:
  - `pre_market` 0400-0930 on weekdays.
  - `post_market` 1600-2000 on weekdays, and **1300-1700 on early-close days**.
  - `over_night` Mon–Thu `0000-0400&2000-2400`, Fri `0000-0400`, Sat `C`, Sun `2000-2400`.
- `Equity.Index.*` (24/7) extends its `post_market` session through weekends and holidays: Fri `1600-2400`, Sat `0000-2400`, Sun `0000-2000`. **That is how Pyth's "24/7" index is scheduled.**

**What a Core feed does when the market is closed:**
- Best-practices doc: "Pyth price feeds follow the traditional market hours for each asset class… Sometimes, Pyth will not be able to provide a current price… due to market hours". **The feed simply stops publishing.**
- `publish_time` stays at the last update and the price is the last value.
- **There is no "closed" status flag in `PriceUpdateV2`.** You detect closure via staleness (`publish_time`) plus the schedule.
- Pyth Pro adds **`marketSession`**. From the EVM `PythLazerStructs.sol` source, the enum is `Regular, PreMarket, PostMarket, OverNight, Closed`.

**Halts (LULD / regulatory):** we found no Pyth documentation on halt representation. Assume publishing stops, or conf widens, during a halt (**UNVERIFIED**). Your settlement should void when no update exists in `[T, T+Δ]`.

**Extended hours moved to Pro.** From the Pyth blog "Extended-Hours US Equity Data Moves to Pyth Pro":
- Deprecation started 2026-06-15.
- `.PRE`, `.POST` and `.ON` feeds for ~50 tickers (AAPL, TSLA, NVDA, COIN, MSTR, META, SPY, QQQ…) moved to Pro.
- Blue Ocean ATS is Pyth's exclusive overnight source: Sun 20:00 ET "Sunday Night Opening".

### 1.5 Consuming Pyth Core on Solana (pull oracle)

**Crate / package versions (verified 2026-09-13):**
- `pyth-solana-receiver-sdk` **2.0.0** (2026-06-15) depends on **`anchor-lang ^1.0.2`** and `pythnet-sdk ^3.0.0`. If you are on **Anchor 0.32.x, pin `pyth-solana-receiver-sdk = "1.2.0"`** (`anchor-lang ^0.32.1`). Version 2.0.0 also has a `pro-compatible` feature flag.
- npm: `@pythnetwork/pyth-solana-receiver` **0.16.0** (depends on `@coral-xyz/anchor ^0.29.0`, `@solana/web3.js ^1.90`); `@pythnetwork/hermes-client` **3.1.0**; `@pythnetwork/pyth-lazer-sdk` **7.0.0**.
- Pro crates: `pyth-lazer-solana-contract` 0.8.0, `pyth-lazer-protocol` 0.46.0.

**Program IDs (docs):**
- Receiver: `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`
- Price Feed (push) program: `pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT`
- Both are on mainnet and devnet.

**Hermes endpoints (from the live OpenAPI at `https://pyth.dourolabs.app/docs/hermes/openapi.json`):**

| Route | Semantics |
|---|---|
| `GET /v2/price_feeds?query=&asset_type=equity` | Feed list + `market_hours` + `schedule`. **Works without key** |
| `GET /v2/updates/price/latest?ids[]=` | Latest update (binary + parsed) |
| `GET /v2/updates/price/stream?ids[]=` | SSE stream (auto-closes after 24h) |
| `GET /v2/updates/price/{publish_time}?ids[]=` | "**retrieve the first Pyth price update whose publish_time is >= the provided value**" |
| `GET /v2/updates/price/{publish_time}/{interval}?ids[]=&unique=true` | Every update in `[t, t+interval]`, interval ≤ 60s, ≤100 ids; `unique` keeps the first update per publish second |

- Base URLs: `https://pyth.dourolabs.app/hermes` (recommended) or `https://hermes.pyth.network`, both with `Authorization: Bearer <key>`.
- TS client: `new HermesClient(url, { accessToken })`. `getPriceUpdatesAtTimestamp(publishTime, ids, { encoding, parsed })` maps to the `{publish_time}` route (verified in source).

**`PriceUpdateV2` layout (verified in source):**
- Fields: `write_authority: Pubkey`, `verification_level: VerificationLevel {Partial{num_signatures}, Full}`, `price_message: PriceFeedMessage`, `posted_slot: u64`.
- `PriceFeedMessage` = `{ feed_id, price: i64, conf: u64, exponent: i32, publish_time: i64, prev_publish_time: i64, ema_price: i64, ema_conf: u64 }`.
- SDK methods:
  - `get_price_unchecked(feed_id)`
  - `get_price_no_older_than(clock, max_age, feed_id)`: Full verification, and `publish_time + max_age >= now`
  - `get_price_no_older_than_with_custom_verification_level(...)`
- A `TwapUpdate` account type also exists. We could not reach a Hermes TWAP route (404), so treat TWAP on Solana as **UNVERIFIED**.
- The SDK warns: use `Account<'info, PriceUpdateV2>` (which does the owner check), and check `verification_level`.

#### (a) Anchor program: capture window open/close with a *unique, timestamp-bound* price

```rust
// Cargo.toml
// anchor-lang = "1.0.2"                      // or "0.32.1"
// pyth-solana-receiver-sdk = "2.0.0"         // or "1.2.0" for Anchor 0.32.x
use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};

pub const MAX_SETTLE_DELAY_SECS: i64 = 10; // first update must land within 10s of the edge, else VOID
pub const MAX_CONF_BPS: u128 = 50;         // void on garbage / halted prints

#[account]
pub struct Market {
    pub feed_id: [u8; 32],
    pub start_ts: i64,         // window open (unix s), aligned to a Pyth publish second
    pub end_ts: i64,           // window close
    pub open_price: i64,       // 0 = not captured
    pub close_price: i64,
    pub expo: i32,
    pub status: u8,            // 0 Open/Betting, 1 Locked, 2 Settled, 3 Void
    pub outcome: u8,           // 0 none, 1 Up, 2 Down, 3 Push (refund)
}

#[derive(Accounts)]
pub struct CaptureEdge<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    /// Anchor's Account<> enforces owner == Pyth receiver (rec5EK...)
    pub price_update: Account<'info, PriceUpdateV2>,
    pub cranker: Signer<'info>, // permissionless; pay them a small tip
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum Edge { Open, Close }

pub fn capture_edge(ctx: Context<CaptureEdge>, edge: Edge) -> Result<()> {
    let m = &mut ctx.accounts.market;
    let upd = &ctx.accounts.price_update;
    require!(upd.verification_level == VerificationLevel::Full, StockErr::NotFullyVerified);

    let msg = &upd.price_message;
    require!(msg.feed_id == m.feed_id, StockErr::WrongFeed);

    let t = if edge == Edge::Open { m.start_ts } else { m.end_ts };
    // Uniqueness proof: this is THE first update with publish_time >= t.
    // (Same idea as Pyth EVM `parsePriceFeedUpdatesUnique`; not re-verified this session.)
    require!(msg.publish_time >= t, StockErr::UpdateBeforeEdge);
    require!(msg.prev_publish_time < t, StockErr::NotFirstUpdateAtOrAfterEdge);

    // Market closed / halted / oracle outage around the edge => refund everyone.
    if msg.publish_time - t > MAX_SETTLE_DELAY_SECS || msg.price <= 0
        || (msg.conf as u128) * 10_000 > MAX_CONF_BPS * (msg.price as u128)
    {
        m.status = 3; // Void
        return Ok(());
    }

    match edge {
        Edge::Open => {
            require!(m.open_price == 0, StockErr::AlreadyCaptured);
            m.open_price = msg.price;
            m.expo = msg.exponent;
        }
        Edge::Close => {
            require!(m.open_price != 0, StockErr::OpenNotCaptured);
            require!(msg.exponent == m.expo, StockErr::ExponentChanged);
            m.close_price = msg.price;
            m.outcome = if msg.price > m.open_price { 1 } else if msg.price < m.open_price { 2 } else { 3 };
            m.status = 2;
        }
    }
    Ok(())
}

#[error_code]
pub enum StockErr {
    NotFullyVerified, WrongFeed, UpdateBeforeEdge, NotFirstUpdateAtOrAfterEdge,
    AlreadyCaptured, OpenNotCaptured, ExponentChanged,
}
```

Notes:
- **Don't** call `get_price_no_older_than` in settlement. It compares against the *current* clock, so a keeper that settles 2 minutes late would fail. Use the explicit `[T, T+Δ]` logic above.
- For *live* quoting (e.g. pricing a boost/leverage ticket at bet time), `get_price_no_older_than(&Clock::get()?, 5, &feed_id)` is right.
- Normalise exponents per feed. Equities use `expo = -5`; xStock tokens use `-8`.
- Close the price update account after use to reclaim rent. By standard rent math, a 134-byte account is ≈0.0018 SOL (computed, not measured). The SDK notes encoded-VAA buffer accounts cost 0.008 SOL and are refundable.

#### (b) TS keeper: fetch the update at T from Hermes, post it, and call your program in the same flow

```ts
import { HermesClient } from "@pythnetwork/hermes-client";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";

const NVDA = "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593";
const hermes = new HermesClient("https://pyth.dourolabs.app/hermes", {
  accessToken: process.env.PYTH_API_KEY!, // required since 2026-08-26
});
const receiver = new PythSolanaReceiver({ connection, wallet }); // anchor Wallet

export async function captureEdge(market: PublicKey, edgeTs: number, edge: "open" | "close") {
  // First update with publish_time >= edgeTs
  const upd = await hermes.getPriceUpdatesAtTimestamp(edgeTs, [NVDA], { encoding: "base64", parsed: true });
  const p = upd.parsed![0].price; // { price, conf, expo, publish_time }
  if (p.publish_time - edgeTs > 10) console.warn("no print within 10s: program will VOID");

  const txb = receiver.newTransactionBuilder({ closeUpdateAccounts: true });
  await txb.addPostPriceUpdates(upd.binary.data);
  await txb.addPriceConsumerInstructions(async (getPriceUpdateAccount) => [{
    instruction: await program.methods
      .captureEdge(edge === "open" ? { open: {} } : { close: {} })
      .accounts({ market, priceUpdate: getPriceUpdateAccount(NVDA), cranker: wallet.publicKey })
      .instruction(),
    signers: [],
  }]);
  await receiver.provider.sendAll(
    await txb.buildVersionedTransactions({ computeUnitPriceMicroLamports: 50_000 }),
    { skipPreflight: true },
  );
}
```

- Fully verified posting spans several transactions: Wormhole VAA verification, then the update. `addPostPartiallyVerifiedPriceUpdates` fits one transaction but produces `Partial` verification, which the program above rejects.
- The key passed to `getPriceUpdateAccount` must match the feed-id string format the builder uses. The docs use `0x`-prefixed IDs.

#### (c) No-key metadata (calendar / "is market open") for the frontend and keeper

```ts
const feeds = await fetch("https://hermes.pyth.network/v2/price_feeds?query=NVDA&asset_type=equity").then(r => r.json());
// feeds[i].market_hours = { is_open, next_open, next_close }; feeds[i].attributes.schedule = "America/New_York;0930-1600,...;1127/0930-1300,..."
const pro = await fetch("https://pyth.dourolabs.app/v1/symbols").then(r => r.json());
// pro.find(s => s.symbol === "Equity.US.NVDA/USD").market_sessions -> { regular, pre_market, post_market, over_night } schedules
```

### 1.6 Pyth Pro (Lazer) on Solana: session-aware, low latency

**Subscription:**
- Endpoint: `wss://pyth-lazer-{0,1,2}.dourolabs.app/v1/stream`.
- Message fields: `{ subscriptionId, priceFeedIds:[1314], properties:["price","confidence","bestBidPrice","bestAskPrice","marketSession","feedUpdateTimestamp"], formats:["solana"], channel:"fixed_rate@200ms" }`.
- Channels: `real_time` (1–50ms), `fixed_rate@1ms|50ms|200ms|1000ms`.
- The equities in the feed-ID table have `min_channel = fixed_rate@50ms`; MSTR is `@200ms`.

**On-chain verification.** From `pyth-examples/lazer/solana-anchor`, with `pyth-lazer-solana-contract` and `features = ["no-entrypoint","cpi"]`:

```rust
use pyth_lazer_solana_contract::protocol::{message::LeEcdsaMessage, payload::{PayloadData, PayloadPropertyValue}, router::channel_ids::FIXED_RATE_200};

pub fn update_ecdsa(ctx: Context<UpdateEcdsa>, pyth_message: Vec<u8>) -> Result<()> {
    let cpi_accounts = pyth_lazer_solana_contract::cpi::accounts::VerifyEcdsaMessage {
        payer: ctx.accounts.payer.to_account_info(),
        storage: ctx.accounts.pyth_storage.to_account_info(),   // address = pyth_lazer_solana_contract::STORAGE_ID
        treasury: ctx.accounts.pyth_treasury.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };
    pyth_lazer_solana_contract::cpi::verify_ecdsa_message(
        CpiContext::new(ctx.accounts.pyth_program.clone(), cpi_accounts), pyth_message.clone())?;
    let msg = LeEcdsaMessage::deserialize_slice(&pyth_message).map_err(|_| ErrorCode::InvalidMessage)?;
    let data = PayloadData::deserialize_slice_le(&msg.payload).map_err(|_| ErrorCode::InvalidPayload)?;
    require!(data.channel_id == FIXED_RATE_200, ErrorCode::InvalidChannel);
    // data.timestamp_us, data.feeds[0].feed_id.0 (u32), data.feeds[0].properties[i]
    if let PayloadPropertyValue::Price(Some(price)) = data.feeds[0].properties[0] { /* price.into_inner() */ }
    Ok(())
}
```

- Program `pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt`, storage `3rdJbqfnagQ4yx9HXJViD4zc4xpiSqmFsKpPuSCQVyQL`.
- The docs list treasury `Gx4MBPb1…`, but the JS example uses `opsLibxVY7Vz5eYMmSfX8cLFCFVYTtH6fr6MiifMpA7`. **Read it from the Storage account and don't hard-code it.**
- An ed25519 variant (`verify_message` plus an ed25519 program instruction) also exists; see `pyth-examples/lazer/js/src/solana/post_solana.ts`.
- **UNVERIFIED:**
  - The exact `PayloadPropertyValue` variant name for `marketSession` in Rust.
  - Whether fixed-rate payload timestamps are exactly aligned to channel multiples. If they are, you can require `timestamp_us == T·1e6` to get a unique settlement print.
- Pro History API: `GET https://pyth.dourolabs.app/v1/{channel}/price?ids=922&timestamp=<µs>` and `/price/range` (≤60s window), with an `access_token`. Whether these responses are *signed* payloads you can post on-chain is **UNVERIFIED**.

### 1.7 Devnet

- The receiver and push programs are deployed on devnet, and the feed IDs are identical to mainnet.
- Devnet equity push accounts are **stale since 2026-07-02**, so on devnet you still need Hermes (a key) to post fresh updates.
- Hermes updates are chain-agnostic Wormhole VAAs; the same payload posts to devnet or mainnet.

---

## 2. Chainlink on Solana

- **xStocks' pricing: confirmed.** Chainlink announced (X, June 2025) it is "the official oracle infrastructure powering the pricing of all of xStocks' tokenized equities and ETFs", including corporate-action data (dividends, splits) via bespoke xStocks Data Streams.
- **Data Streams for US equities/ETFs** launched in 2025 (SPY, QQQ, NVDA, AAPL, MSFT, CRCL…).
- **24/5 US Equities Streams** launched **2026-01-20** and cover pre-market, regular, post-market and overnight sessions.
- **Report schemas (docs):**
  - **v8 (RWA Standard)**: `midPrice`, `lastUpdateTimestamp` (ns, *not monotonic*), `marketStatus` (0 Unknown / 1 Closed / 2 Open).
  - **v11 (RWA Advanced), "strongly recommended" for US equities**: `mid`, `bid`, `ask`, `bidVolume`, `askVolume`, `lastTradedPrice`, `lastSeenTimestampNs`, and a `marketStatus` enum:
    - 0 Unknown
    - **1 Pre-market (04:00–09:30)**
    - **2 Regular (09:30–16:00)**
    - **3 Post-market (16:00–20:00)**
    - **4 Overnight (20:00–04:00 Sun–Fri)**
    - **5 Closed (weekends, holidays)**
  - Docs: "Always use `marketStatus` to determine market state, not timestamp fields."
- **Solana:** reports are verified in your program via **CPI to the Verifier program** (crates `chainlink_solana_data_streams`, `chainlink_data_streams_report`).
  - Devnet verifier program `Gt9S41PtjR58CbG9JhJ3J6vxesqrNAswbWYbLNTMZA3c`, access controller `2k3DsgwBoqrnvXKVvd7jX7aptNxdcRBdcd5HkYsGgbrb`.
  - The tutorial decodes v3; for equities you'd decode v8/v11.
- **Access is permissioned.** You need an "allowlisted account in the Data Streams Access Controller (contact us to get started)" plus API credentials to fetch reports. **Not realistic to obtain in 5 days** unless Chainlink sponsors you. Mainnet verifier IDs and pricing: UNVERIFIED.
- Classic push **Data Feeds** for equities on Solana: none found (UNVERIFIED absence).

## 3. Switchboard, Stork, RedStone and others

| Oracle | Equities on Solana? | Access | Notes |
|---|---|---|---|
| **Switchboard Surge** | **No.** Docs: crypto pairs only; custom feeds are not Surge-compatible | Free "Plug" tier (2 feeds, 10s); Pro ~$3k/mo; Enterprise ~$7.5k (paid in SWTCH) | Sub-100ms WebSocket |
| **Switchboard On-Demand (custom feeds)** | **Yes, DIY.** Build an `OracleJob` with `httpTask` → `jsonParseTask` against a stock API. Docs ship a Polygon/Massive AAPL example with `variableOverrides` for the API key | Permissionless, devnet supported (examples use devnet). Per-update cost: small SOL fee (amount UNVERIFIED) | Single-source trust (whatever the API says); API licensing is your problem. **Best $0 path for a hackathon demo** (code below) |
| **Stork** | Yes: TSLA, NVDA, CRCL, MSTR etc. 24/7 methodology (TradFi sources while open; "Perpetual Swap Oracle Price Feed" from Binance/Bitget/Hyperliquid/Lighter/OKX perps on nights, weekends and holidays). Supports Solana among 70+ chains | Via sales/API key (details UNVERIFIED) | Powers Ostium's RWA oracle (market-hours logic) |
| **RedStone** | Solana via Wormhole Queries; RWA focus (BUIDL, ACRED); SECZ tokenized equity **EOD push** feed (Jul 2026) | Contact | Not intraday-equity oriented |
| **Chainlink** | See §2 | Allowlist | Official xStocks oracle |

**Switchboard On-Demand demo path (from Switchboard docs).**

TS client:

```ts
import { OracleJob, CrossbarClient } from "@switchboard-xyz/common";
import * as sb from "@switchboard-xyz/on-demand";
const job = OracleJob.fromObject({ tasks: [
  { httpTask: { url: "https://finnhub.io/api/v1/quote?symbol=NVDA&token=${FINNHUB_KEY}" } }, // swap for Alpaca/Massive
  { jsonParseTask: { path: "$.c" } },
]});
// store job -> feedHash via crossbar, then each settle:
const updateIxs = await queue.fetchManagedUpdateIxs(crossbar, [FEED_ID], {
  variableOverrides: { FINNHUB_KEY: process.env.FINNHUB_KEY! }, instructionIdx: 0, payer: keypair.publicKey });
const tx = await sb.asV0Tx({ connection, ixs: [...updateIxs, yourSettleIx], signers: [keypair] });
```

Anchor side:

```rust
use switchboard_on_demand::{default_queue, SwitchboardQuote, SwitchboardQuoteExt};
#[account(address = quote_account.canonical_key(&default_queue()))]
pub quote_account: Box<Account<'info, SwitchboardQuote>>,
// staleness: Clock::get()?.slot - quote_account.slot <= 25 ; value: quote_account.feeds[0].value()
```

Caveats:
- This proves "the oracle saw API value X at slot S", **not** "the first print at or after T". Your program must require `Clock::unix_timestamp ∈ [T, T+Δ]` at settle time, and the quote slot must be fresh.
- The Finnhub free tier is personal/non-commercial. Alpaca's free tier is IEX-only (a single venue, not consolidated NBBO).

## 4. Stock-market mechanics a crypto builder must handle

### 4.1 Sessions (US, Eastern Time)

| Session | Hours (ET) | Liquidity / notes |
|---|---|---|
| Overnight | Sun–Thu 20:00 → 04:00 | Blue Ocean ATS (BOATS) dominant (~$1B nightly volume per Pyth); Pyth Pro / Chainlink 24/5 only |
| Pre-market | Mon–Fri 04:00–09:30 | Limit orders, thin until ~08:00 (macro data 08:30) |
| **Opening auction** | **09:30** | NYSE open / Nasdaq Opening Cross; big discontinuity vs pre-market |
| **Regular (RTH)** | **09:30–16:00** | Deepest liquidity; LULD bands active |
| **Closing auction** | **16:00** | Official close = auction print, which can differ from the last continuous trade; imbalance data from ~15:50 |
| Post-market | Mon–Fri 16:00–20:00 | Earnings releases; wide spreads |
| Weekend gap | Fri 20:00 → Sun 20:00 | No venue prices the stock; only tokens and perps trade |

**Coming change:**
- The SEC approved Nasdaq's 23-hour/5-day session (Apr 10, 2026).
- Launch is reported for **Dec 6, 2026**: Sun 21:00 → Fri 20:00 ET, with a daily 20:00–21:00 break. It is subject to SIP readiness (**reported by news and law-firm advisories; exact date UNVERIFIED with Nasdaq**).
- Similar approvals were reported for NYSE and 24X.
- **Drive everything from schedules (Pyth `schedule` / Alpaca `/v2/calendar`), never hard-coded hours.**

### 4.2 Holidays and early closes (NYSE/Nasdaq), Sep 2026 – Dec 2027

Sources: NYSE Group press release (ICE) plus the live Pyth feed schedules. Early closes are **13:00 ET**; post-market then runs 13:00–17:00.

| Date | Status |
|---|---|
| Mon 2026-09-07 Labor Day | Closed (already past) |
| Thu 2026-11-26 Thanksgiving | Closed |
| **Fri 2026-11-27** | **Early close 13:00** |
| **Thu 2026-12-24** | **Early close 13:00** |
| Fri 2026-12-25 Christmas | Closed |
| Fri 2027-01-01 New Year's Day | Closed |
| Mon 2027-01-18 MLK Day | Closed |
| Mon 2027-02-15 Washington's Birthday | Closed |
| Fri 2027-03-26 Good Friday | Closed |
| Mon 2027-05-31 Memorial Day | Closed |
| Fri 2027-06-18 Juneteenth (observed) | Closed |
| Mon 2027-07-05 Independence Day (observed) | Closed |
| Mon 2027-09-06 Labor Day | Closed |
| Thu 2027-11-25 Thanksgiving | Closed |
| **Fri 2027-11-26** | **Early close 13:00** |
| Fri 2027-12-24 Christmas (observed) | Closed. NYSE lists no Dec 23, 2027 early close per secondary sources (UNVERIFIED) |

- 2026 dates already past: Jan 1, Jan 19, Feb 16, Apr 3 (Good Friday), May 25, Jun 19, **Jul 3 (full close; no Jul 2 early close)**, Sep 7.
- New Year's Day 2028 falls on a Saturday. Under the NYSE rule it is not observed on Fri Dec 31, 2027 (rule-based, UNVERIFIED for 2028 calendar).
- The bond market (SIFMA) has different early closes. This is irrelevant to stock prices but relevant if you ever use rates.

### 4.3 Halts and circuit breakers

- **LULD (single stock):**
  - Price bands around the 5-minute average price. Tier 1 (S&P 500, Russell 1000, select ETPs) >$3 uses **5%**; Tier 2 >$3 uses **10%**.
  - Bands are doubled near the open and close: 09:30–09:45 and 15:35–16:00 (**UNVERIFIED detail, from general LULD plan knowledge**).
  - If a stock sits at the band for 15 seconds, a **5-minute trading pause** follows, then a reopening auction.
- **Market-wide circuit breakers (S&P 500 drop vs prior close):**
  - Level 1 (−7%) and Level 2 (−13%) before 15:25 ET halt all trading for **15 minutes**.
  - Level 3 (−20%) at any time halts trading for the rest of the day.
- **Regulatory / news halts (e.g. "news pending")** can last hours, and a stock can stay halted into the close. Polymarket's rule then uses the last valid regular-session trade.
- **Design:** treat "no oracle print within Δ of an edge" as **void/refund**. Also void windows that overlap a detected gap (> N seconds without prints during RTH).

### 4.4 Earnings

- Releases come either before the open (~07:00–08:30 ET) or **after the close (16:00–16:30 ET)**. Overnight gaps of 5–15% are routine for single names.
- 15-min windows during RTH are mostly unaffected. Any market spanning the close→open boundary on an earnings day is a coin flip with fat tails and invites insider/MNPI concerns (Kalshi explicitly bars MNPI holders).
- Use an earnings calendar (Finnhub `/calendar/earnings` has a free tier) to flag those markets. On earnings days, reduce boost and leverage caps, or offer them as a separate "earnings gap" product.

### 4.5 Splits and dividends

- **Intraday Up/Down (open and close in the same session):** unaffected.
- **Close→open or multi-day markets:**
  - **Splits.** On the effective date the price drops by the split ratio at the open (e.g. 10:1 → −90%). Store a per-market `adj_factor` and compare against the split-adjusted prior close. Polymarket's rules say they use "split-adjusted prices as displayed on Pyth".
  - **Cash dividends.** On the ex-date the stock opens roughly lower by the dividend amount. That is small for mega caps (<0.5%) but biases "gap up/down" markets. Either adjust, or don't list gap markets across ex-dates.
- **xStocks:**
  - Dividends are **reinvested**, and splits and dividends are applied via a **multiplier** stored in the Token-2022 **Scaled UI Amount** extension. The on-chain raw balance is unchanged; UI balance = raw × multiplier.
  - When you compare an xStock DEX price to the stock price: **price per raw token ≈ share price × multiplier**. Otherwise you will see a fake "premium" after dividends and splits.
  - Pyth's `Crypto.<T>X/<T>.RR` redemption-rate feeds probably publish this (**UNVERIFIED**).
- Data sources:
  - Massive's (ex-Polygon) free plan includes corporate-actions reference data.
  - Finnhub has split/dividend endpoints (free-tier coverage UNVERIFIED).
  - Chainlink xStocks streams carry corporate actions.

### 4.6 Underlying stock vs tokenized stock (xStocks)

- xStocks trade **24/7** on Solana DEXs (Raydium, Orca, Meteora, via Jupiter) and CEXs. Solana settles >95% of tokenized-stock volume (2026 reports).
- **During RTH** arbitrage keeps the token near share × multiplier.
- **Nights, weekends and holidays** the token floats on crypto supply and demand, and premiums/discounts open.
  - Weekend earnings or news moves of 3–5% before the underlying reopens have been reported.
  - Liquidity is concentrated in TSLAx, NVDAx and CRCLx; recommended slippage there is ~0.1–0.5%. Thin names are much wider.
- Pyth prices the token separately (`Crypto.NVDAX/USD`), and it updated on **Saturday 2026-09-12** on Solana mainnet (verified).
- **A "stock price" market must say which price it uses.** "NVDA (Nasdaq)" and "NVDAx (token)" are different underlyings.
- DEX-TWAP settlement is manipulable in thin pools; use it only for low-stakes, capped games. Raydium CLMM observation accounts exist, but TWAP details are UNVERIFIED.

### 4.7 How existing products handle this

| Product | Instrument | Settlement source and rule | Closed-market handling |
|---|---|---|---|
| **Polymarket (Pyth-resolved, since 2026-04-02)** | Daily "Up or Down" (close vs prior trading day's close), "Opens Up or Down", "closes above ___"; SPY, AAPL, AMZN, GOOGL, META, HOOD, EWY, gold, WTI… | **Pyth "Close" of the 1-minute candle for the final minute of regular hours**, at `pythdata.app/explore/Equity.US.SPY%2FUSD`. Fallbacks: last valid Pyth RTH price → primary-exchange official close | Prior trading day skips holidays; no trading all session → **50-50**; exact tie → **50-50**; split-adjusted |
| Polymarket (older Nasdaq-resolved NVDA markets) | Daily Up/Down | Nasdaq official close from nasdaq.com historical | Shortened day still uses its official close; halt into close → last valid regular-session trade |
| **Kalshi** `KXNASDAQDUD` (verified via Kalshi API) | "Will the NASDAQ-100 be above 29368.44 on Sep 14, 2026 at 4pm EDT?" (target = prior week's close) | "end-of-day price"; source "For example, Google Finance"; close 20:00 UTC, expiration up to a week later | Expires at the first release or within a week; MNPI and source-agency employees barred |
| **Robinhood prediction markets** | "S&P 500 futures price on <date>" | **E-mini S&P 500 daily settlement price** (a futures settlement, not the cash index); via KalshiEX / ForecastEx / Rothera | Futures trade ~23/5, sidestepping some cash-session issues |
| **Hyperliquid HIP-3: trade.xyz** | Equity perps (40+ tickers) | External price from "venues and institutional data providers" across pre / regular / post / **overnight via BOATS** = 24/5 (Sun 20:00 → Fri 20:00) | **Internal pricing** Fri 20:00 → Sun 20:00 ET, on holidays, or on any >30s external gap: continuous-time EMA of order-book impact prices from the last external price. Docs say τ = 30 min; an older update said 8h → 1h (conflicting, check docs). Mark price is bounded within 1/max_leverage of the last external price ("discovery bounds") |
| **Flash Trade (Solana)** | Equity perps (AMZN, AMD, NVDA, AAPL, PLTR, TSLA), up to 20x | Pyth, with backup oracles | Advertised **24x5** (from X post; details UNVERIFIED) |
| **Ostium (Arbitrum)** | RWA perps incl. stocks | Custom Stork oracle with market-hours and holiday logic | Stocks trade **only Mon–Fri 09:30–16:00**. **2026-07-15 exploit (~$18–24M)** via compromised off-chain oracle credentials and *future-dated* reports; trading resumed Jul 23. **Lesson:** verify signatures on-chain and reject future or out-of-window timestamps |
| **Stork** | Oracle | TradFi while open; perps-market prices nights and weekends | 24/7 "price discovery" feed |

---

## 5. Market-data APIs for the frontend (charts, calendars)

| Provider | Free tier (verified where noted) | Real-time? | WebSocket (free) | Calendar / status endpoints | Hackathon verdict |
|---|---|---|---|---|---|
| **Alpaca** (Basic) | Free with an account (paper OK); **200 req/min**; historical since 2016 | **IEX only** real-time (single venue); SIP delayed 15 min | **30 symbols** | `/v2/calendar` (1970–2029, incl. early closes), `/v2/clock`; overnight via `feed=boats` (plan-dependent) | **Best free choice**: live ticks plus an exchange calendar |
| **Finnhub** | **60 calls/min**; personal/non-commercial | Real-time US `/quote` (last price) | **50 symbols** (trades) | `/stock/market-status`, `/stock/market-holiday`; `/calendar/earnings` (free status UNVERIFIED); candles likely premium (UNVERIFIED) | Good for quotes and earnings calendar |
| **Massive** (ex-Polygon.io) | **5 calls/min**, **EOD only**, 2 years of history, no WebSocket; includes reference data and corporate actions | Starter $29/mo: 15-min delayed + WS; Advanced $199/mo: real-time | Paid only | `/v1/marketstatus/now`, `/v1/marketstatus/upcoming` | Free tier is too limited for live charts; useful for splits/dividends |
| **Twelve Data** | **8 credits/min, 800/day**; 8 trial WS credits | "Real-time US equities" listed on Basic (UNVERIFIED depth) | Trial only | market-state endpoint on Basic: UNVERIFIED | OK backup |
| **Alpha Vantage** | **25 req/day**, 5/min | Real-time is premium ($49.99+) | No | — | Too tight |
| **Databento** | **$125 sign-up credit** (usage-based) | Historical + live (paid) | Live API (credits) | — | Great for backfilling tick-accurate history |
| **Yahoo Finance** (unofficial) | No key; rate-limited; ToS risk | ~Real-time | No (unofficial) | — | Prototype only |
| **Pyth metadata** (no key) | `hermes.pyth.network/v2/price_feeds`, `pyth.dourolabs.app/v1/symbols` | — | — | `market_hours.is_open/next_open/next_close` + full session schedules | **Use for on-chain-aligned session logic** |
| Pyth history/candles | `pyth.dourolabs.app/v1/{channel}/history` (TradingView format) | — | — | — | **401 without key** (verified) |

Rendering: TradingView `lightweight-charts` accepts OHLC arrays directly.

---

## 6. Recommended settlement design for stock Up/Down markets

Opinionated. It is written so the demo works this week, and the production path is a config flip.

### 6.1 Oracle strategy

1. **Today:** ask Pyth for a hackathon/testnet API key that covers `Equity.US.*` (the Pro/US Equities plan). If granted, Pyth Core `PriceUpdateV2` with the uniqueness check in §1.5 is **the** settlement source. It matches Polymarket's resolution provider and is what judges will recognise.
2. **Build an `OracleAdapter` from day one** with the same settlement semantics behind two back-ends:
   - `PythCore { feed_id }`: first update with `prev_publish_time < T <= publish_time <= T+10s`, Full verification, conf ≤ 50 bps; otherwise **Void**.
   - `SwitchboardQuote { feed_hash }`: fallback for the $0 demo. A custom On-Demand job against Alpaca (IEX) or Finnhub `/quote`. Settle tx must land at `Clock ∈ [T, T+10s]`, quote staleness ≤ ~25 slots; otherwise Void. Label it in the UI: "Demo oracle: single-source".
   - Test the Pyth path locally by cloning real mainnet `PriceUpdateV2` accounts (§1.3), so it is proven even without a key.
3. **Never** settle on the stale on-chain Pyth push accounts. **Never** settle stock markets on xStock DEX prices while pretending it is the stock.
4. **Production:** Pyth Pro (US Equities) for all four sessions, with an on-chain `marketSession == Regular` check for RTH markets. Optionally cross-check Chainlink v11 `marketStatus` as a circuit breaker.

### 6.2 Market menu by session (driven by Pyth `schedule`, never hard-coded)

| When (ET) | Markets to list | Settlement reference |
|---|---|---|
| **RTH 09:35–15:55 starts** | Rolling **5 / 15 / 60-min Up/Down**; **Range (inside/outside)** on 15/60-min; **duels** and **candle-hop** on 5-min candles | Open = first Pyth print ≥ `start_ts`; Close = first print ≥ `end_ts` (uniqueness-checked) |
| **Opening Bell special** 09:30→09:45 | One market/day per ticker; boost cap halved | Open ref = first print ≥ **09:30:00** (auction-driven, volatile) |
| **Closing Bell / Daily** | "NVDA closes up vs today's open" and "closes above ___" (Polymarket-style) | Close ref = first print ≥ **15:59:59** and ≤ 16:00:09. **Early-close days: 12:59:59** (read from schedule) |
| **No new windows** starting 15:55–16:00 | — | Avoid the closing-auction imbalance window |
| **Post / pre / overnight** | Only once you have Pyth Pro sessions: **60-min windows only**, boost/leverage ≤ 50% of RTH, conf threshold tighter relative to spread | `marketSession` must equal the session the market was created for |
| **Weekend and holiday: stock product** | **"Monday Gap"**: "Will NVDA's first RTH print Monday be above Friday's 15:59:59 print?" (pari-mutuel pool) | Friday close ref and Monday open ref from Pyth RTH. **Lock betting Sun 19:59 ET** (before overnight trading and pre-market leak the answer). Void on split/ex-div days unless adjusted |
| **Weekend and holiday: token product** | **24/7 "NVDAx token" Up/Down and games** (1–15-min), clearly labelled *token price* | Pyth `Crypto.NVDAX/USD` (Starter plan) with the same uniqueness rule. Or Switchboard job on a DEX/Jupiter price, with **low stake caps** |

### 6.3 Hard rules in the program

- **Lock before edge:** betting closes ≥ 5s before `start_ts`. Bets are priced off a `get_price_no_older_than(clock, 5s)` live print, never off a keeper-supplied number.
- **Uniqueness:** `prev_publish_time < T <= publish_time`. Settlement is permissionless and the cranker gets a tip. This removes pull-oracle "choose your price" attacks.
- **Void and refund** in these cases:
  - No print within 10s of an edge (halt, closed, outage).
  - conf > 50 bps.
  - Exponent change between open and close.
  - Window overlaps a detected RTH print gap > 30s (likely a LULD pause).
- **Tie handling:** close == open → Push (refund). This is Polymarket's 50-50.
- **Timestamps:** reject any update with `publish_time > Clock::unix_timestamp + 2`. This is the Ostium lesson on future-dated reports.
- **Corporate actions:**
  - A per-market `adj_factor` must be set before listing any market that crosses a session boundary.
  - The keeper refuses to list gap markets on split-effective and ex-dividend dates, and on **earnings days** (use the Finnhub calendar) unless listed as an explicit "Earnings Gap" market with reduced caps.
- **Parlays:** SPY / QQQ / NVDA / MSFT legs in the same window are highly correlated. Either restrict parlays to different tickers *and* different windows, or price with a correlation haircut.
- **Leverage / boost caps by session:** RTH 100%; first and last 15 minutes of RTH 50%; extended/overnight 50%; weekend token markets 25%.
- **Calendar source of truth:** the keeper reads Pyth `schedule` (Hermes or Pro symbols) and cross-checks Alpaca `/v2/calendar`. On disagreement, don't list. The contract itself only trusts timestamps plus prints, so a wrongly scheduled window simply voids.

### 6.4 Demo logistics for this hackathon

- Record demos **Mon Sep 14 – Thu Sep 17 during RTH (09:30–16:00 ET)**; there are no stock prints at weekends.
- Friday Sep 18 is quad witching with a 16:00 deadline, so don't plan a live demo on it.
- Show one "market closed" path (weekend → Monday Gap market; after-hours → token market) to prove you understand stocks ≠ crypto. This speaks directly to the judging criteria ("real user", "why Solana").

---

## Sources

**Pyth**
- Market hours: https://docs.pyth.network/price-feeds/market-hours
- Solana pull integration: https://docs.pyth.network/price-feeds/core/use-real-time-data/pull-integration/solana
- Contract addresses (Solana): https://docs.pyth.network/price-feeds/core/contract-addresses/solana
- Push / sponsored feeds on Solana: https://docs.pyth.network/price-feeds/core/push-feeds/solana
- Best practices (market hours, staleness, confidence): https://docs.pyth.network/price-feeds/core/best-practices
- Historical data / Benchmarks: https://docs.pyth.network/price-feeds/core/use-historical-price-data
- Fetch price updates: https://docs.pyth.network/price-feeds/core/fetch-price-updates
- Preparing for the Core upgrade: https://docs.pyth.network/price-feeds/core/upgrade/preparing
- Core upgrade blog (plans, prices): https://www.pyth.network/blog/the-pyth-core-upgrade
- Pricing page: https://www.pyth.network/pricing
- Extended hours move to Pro: https://www.pyth.network/blog/extended-hours-us-equity-data-moves-to-pyth-pro
- Pyth Indices (24/7): https://www.pyth.network/blog/24-7-finance-needs-24-7-price-infrastructure-introducing-pyth-indices
- How US equities trade: https://www.pyth.network/blog/how-us-equities-actually-trade-sessions-gaps-and-what-most-data-providers-miss
- Blue Ocean ATS: https://www.pyth.network/blog/blue-ocean-ats-joins-pyth-network-institutional-overnight-hours-us-equity-data
- Pyth Pro overview, SVM consumer, subscribe, API: https://docs.pyth.network/price-feeds/pro, https://docs.pyth.network/price-feeds/pro/integrate-as-consumer/svm, https://docs.pyth.network/price-feeds/pro/subscribe-to-prices, https://docs.pyth.network/price-feeds/pro/api
- Live APIs queried: https://hermes.pyth.network/v2/price_feeds?asset_type=equity, https://pyth.dourolabs.app/docs/hermes/openapi.json, https://pyth.dourolabs.app/docs/v1/openapi.json, https://pyth.dourolabs.app/v1/symbols
- Source code:
  - https://github.com/pyth-network/pyth-crosschain/tree/main/target_chains/solana/pyth_solana_receiver_sdk (README, `src/price_update.rs`, Cargo.toml v2.0.0)
  - https://github.com/pyth-network/pyth-crosschain/blob/main/apps/hermes/client/js/src/hermes-client.ts
  - https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/solana/sdk/js/pyth_solana_receiver/src/PythSolanaReceiver.ts
  - https://github.com/pyth-network/pyth-crosschain/blob/main/lazer/contracts/evm/src/PythLazerStructs.sol (MarketSession enum)
  - https://github.com/pyth-network/pyth-examples/tree/main/lazer/solana-anchor
  - https://github.com/pyth-network/pyth-examples/blob/main/lazer/js/src/solana/post_solana.ts
- Registries: https://crates.io/crates/pyth-solana-receiver-sdk, https://www.npmjs.com/package/@pythnetwork/pyth-solana-receiver
- Solana mainnet/devnet RPC reads of the price-feed PDAs (performed 2026-09-13)
- News: Polymarket × Pyth, https://www.theblock.co/post/396200/polymarket-taps-pyth-network-to-resolve-new-us-equity-and-commodity-markets ; Pyth Pro ARR report, https://solanacompass.com/news/pyth-pro-reaches-749m-arr-in-july-with-22-monthly-growth-and-3501-market-feeds

**Chainlink**
- 24/5 US equities streams: https://chain.link/blog/chainlink-24-5-us-equities-streams
- Data Streams for US equities and ETFs: https://chain.link/blog/chainlink-data-streams-us-equities-etfs
- Report schema v8: https://docs.chain.link/data-streams/reference/report-schema-v8
- Report schema v11: https://docs.chain.link/data-streams/reference/report-schema-v11
- Solana on-chain verification: https://docs.chain.link/data-streams/tutorials/solana-onchain-report-verification
- Solana repo: https://github.com/smartcontractkit/chainlink-data-streams-solana
- xStocks alliance: https://x.com/chainlink/status/1939763692301922621
- CoinDesk coverage: https://www.coindesk.com/business/2026/01/20/chainlink-expands-data-streams-to-cover-multitrillion-dollar-u-s-stock-market

**Switchboard, Stork, RedStone**
- Switchboard Surge: https://docs.switchboard.xyz/docs-by-chain/solana-svm/surge
- Switchboard variable overrides: https://docs.switchboard.xyz/custom-feeds/advanced-feed-configuration/data-feed-variable-overrides
- Switchboard basic price feed (Solana): https://docs.switchboard.xyz/docs-by-chain/solana-svm/price-feeds/basic-price-feed
- Stork 24/7 feeds: https://www.theblock.co/post/401053/stork-24-7-price-discovery ; https://docs.stork.network/
- RedStone on Solana: https://blog.redstone.finance/2025/05/28/redstone-rwa-oracle-brings-tokenized-assets-to-solana-ecosystem/ ; https://wormhole.com/blog/redstone-price-feeds-are-now-live-on-solana-powered-by-wormhole-queries

**Market structure**
- NYSE 2025–2027 holiday calendar: https://ir.theice.com/press/news-details/2024/NYSE-Group-Announces-2025-2026-and-2027-Holiday-and-Early-Closings-Calendar/default.aspx ; https://www.fidelity.com/learning-center/smart-money/stock-market-holidays
- Circuit breakers: https://www.investor.gov/introduction-investing/investing-basics/glossary/stock-market-circuit-breakers
- LULD: https://www.luldplan.com/ ; https://databento.com/microstructure/luld
- Nasdaq 23/5: https://www.arnoldporter.com/en/perspectives/advisories/2026/04/sec-approves-nasdaq-proposal-to-expand-trading-hours ; https://news.bitcoin.com/finance/nasdaq-23-hour-trading-december-2026-launch/ (launch date UNVERIFIED with Nasdaq)

**xStocks**
- Dividends and splits: https://docs.xstocks.fi/docs/dividends-and-stock-splits ; https://docs.xstocks.fi/developers/multipliers (403 when fetched; content via search summary)
- Solana case study: https://solana.com/news/case-study-xstocks
- Weekend premium: https://www.pionex.com/blog/tokenized-stock-trading-hours-weekend-closure-pionex/ ; https://coinmarketcap.com/events/tokenized-stocks-cex-vs-onchain/

**Existing products**
- Polymarket SPY rules: https://polymarket.com/event/spy-up-or-down-on-september-14-2026 ; https://polymarket.com/predictions/equity-daily-pyth ; https://polymarket.com/event/nvda-up-or-down-on-february-26-2026
- Kalshi (API `GET https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=KXNASDAQDUD`, `/series/KXNASDAQDUD`; contract terms https://assets.kalshi.com/contract_terms/NASDAQ100.pdf)
- Robinhood: https://robinhood.com/us/en/prediction-markets/financial/events/sp-500-futures-price-on-september-10-2026-sep-10-2026/
- trade.xyz: https://docs.trade.xyz/perp-mechanics/oracle-price ; https://docs.trade.xyz/perpetuals/mechanics/oracle-price.md (GitBook ask) ; https://docs.trade.xyz/perp-mechanics/discovery-bounds
- Flash Trade: https://x.com/FlashTrade/status/2036082647454363739 (UNVERIFIED details)
- Ostium: https://ostium-labs.gitbook.io/ostium-docs/supporting-infrastructure/price-oracle ; https://thedefiant.io/news/hacks/ostium-halts-trading-after-oracle-exploit-drains-up-to-usd18m-from-vault ; https://en.cryptonomist.ch/2026/07/15/ostium-oracle-exploit/

**Data APIs**
- Alpaca: https://docs.alpaca.markets/docs/about-market-data-api ; https://docs.alpaca.markets/us/docs/245-trading
- Massive: https://massive.com/pricing ; https://massive.com/docs/rest/stocks/market-operations/market-holidays
- Finnhub: https://finnhub.io/pricing (limits from secondary sources)
- Twelve Data: https://twelvedata.com/pricing
- Alpha Vantage: https://www.alphavantage.co/premium/
- Databento: https://databento.com/pricing

**Hackathon**
- https://hackathons.solana.com/hackathons/stocklana

**Explicitly UNVERIFIED items (recap)**
- Whether Pyth grants hackathon or testnet keys.
- Whether Starter includes xStock feeds.
- How Pyth represents halts.
- Pro fixed-rate timestamp alignment and the Rust `marketSession` variant.
- Pro history responses being postable on-chain.
- Hermes TWAP route.
- Switchboard per-update cost.
- Chainlink mainnet IDs and pricing.
- Stork access terms.
- Flash Trade session details.
- trade.xyz EMA τ (30 min vs 1 h).
- LULD doubled-band times.
- Nasdaq 23/5 launch date.
- 2027 Dec 23 early close (believed none).
- Finnhub free candles and earnings coverage.
- Meaning of the `.RR` redemption-rate feeds.
