# 13. Affordable equity price sources for Agari settlement

> **Researched:** 2026-09-13, 16:50–17:25 UTC. That was a **Sunday**, so US markets were closed and every "freshness" figure reflects Friday 2026-09-11.
>
> **Scope:** the cheapest trustworthy way to put US stock prices (and xStock token prices) on Solana for Agari's Up/Down markets.
> - **Budget:** ≤ $50/mo, ideally $0.
> - **Horizons:** (i) demo now; (ii) judging through 2026-10-02, after the Pyth trial ends ~2026-09-27; (iii) production.
>
> **Method:**
> - Live Solana RPC reads (public mainnet and devnet endpoints; no keys).
> - Keyless curl probes.
> - Crossbar simulations and real devnet/mainnet Switchboard quotes.
> - `cargo check` builds.
> - Primary docs, pricing pages and PDFs.
>
> **Labels:** **UNVERIFIED** means not confirmed first-hand. No API keys were used or stored.
>
> **Builds on:** `02-equity-price-oracles-and-market-hours.md` (Pyth/Chainlink basics, sessions, settlement code) and `00-research-briefing.md` §4/§12.
>
> **Side effect to know about:** while checking Anchor versions, a sub-agent ran `anchor --version`. That made `avm` re-run the Agave 3.1.10 installer and **re-pointed `~/.local/share/solana/install/active_release`** (16:58 UTC). Run `solana --version` / `agave-install list` and re-select your intended toolchain if it changed.

---

## 0. Answers in one page

1. **There is no free, fresh on-chain Pyth price for TSLA, QQQ or VOO on Solana.**
   - The Solana sponsored push list (64 feeds) contains exactly **one** US equity, **`Equity.US.GLXY/USD`**. It is on **mainnet only**, updating every ~52 s from 04:00 to 20:00 ET.
   - The TSLA/QQQ mainnet accounts look fresh only because one unsponsored wallet (now at 0.00065 SOL) posted Friday's post-market price on Saturday. Nobody pushed TSLA during Friday's regular session.
   - VOO has been stale since 2026-07-02. Devnet equity accounts are all stale since 2026-07-02.
   - No free Pyth history endpoint remains; all return 401.
2. **Pyth cheaply.**
   - The only sub-$100 Pyth equity access found is the **Polymarket × Pyth package: 30 days free, then $99/mo**. It covers TSLA and QQQ but not VOO. Whether it allows Hermes use and on-chain posting is UNVERIFIED.
   - Otherwise it is Pro "from $2,500/mo", with the US Equities bundle at $5,000/mo.
   - There is no Solana builder or hackathon programme. Pyth's Cardano programme (free Pro for a year) shows sponsorship is possible; ask `data@dourolabs.xyz` for a trial extension to 10-02.
   - After the trial, expect **no API access at all**, including historical lookups. Signed update blobs you **archive before then stay verifiable on-chain**.
3. **Switchboard On-Demand works for $0-ish and compiles with Anchor 1.2**, with caveats.
   - **Cost:** no oracle fee, only Solana fees (20,000 lamports for a 3-signature quote ≈ **$0.002**).
   - **Price at T:** bake T into the job URL so the feed hash commits to T. This was proven with real devnet and mainnet quotes.
   - **Anchor 1.x:** the documented `anchor` feature fails. `default-features=false, features=["solana-v3"]` compiles, but needs an instruction-index workaround and your own checks: distinct oracles, pinned queue.
   - **24/7 tokens:** a `switchboardSurgeTask` for `TSLAX/USD` was signed by oracles on devnet on a Sunday.
4. **RedStone is the best new $0 find.** Its public gateway serves **signed (3-of-5), 10-second-grid** packages without a key, for **TSLA, NVDA, AAPL, AMZN, GOOGL, META, MSFT** (plus `---EXTENDED` and `---24_7` variants).
   - Historical lookups reach back about 24 hours.
   - `rust-sdk v4.0.0` targets **anchor-lang 1.0 / solana-program 3.0**.
   - It has **no SPY, QQQ or VOO**, and its licence is UNVERIFIED.
5. **Chainlink Data Streams** is now **self-serve at "starting at $150/month" per stream**, with no free tier. It is xStocks' official oracle alongside Pyth, and the credible cheap production path. Stork needs a sales key; DIA is unsigned; Supra and Band have no Solana equity data.
6. **Free market-data APIs are fine for a labelled demo, but every free or cheap tier forbids public redistribution.**
   - Real-time IEX TOPS now costs **$500/mo, rising to $1,000/mo on 2026-10-01**. Delayed IEX data and IEX HIST are free to redistribute with attribution.
   - The only affordable feed that explicitly allows external redistribution is **Databento EQUS.MINI ($199/mo)**.
   - The **16:00 minute bar is not the official close**. TSLA 2026-09-11 official close was **365.44**; Pyth's last on-chain price was 365.275 (post-market); RedStone `TSLA` 365.4827.
7. **Recommended design** (§6):
   - **(i) Now:** Pyth trial (Hermes → devnet receiver) for TSLA/QQQ/VOO, with RedStone recorded alongside as a cross-check.
   - **(ii) Judging:** RedStone signed packages for single names, plus Switchboard T-committed jobs for QQQ/SPY/VOO (or drop the ETFs). Archive Pyth trial blobs for replay.
   - **24/7 token lane:** Switchboard Surge `TSLAX/USD` or attested Jupiter, capped and labelled.
   - **(iii) Production:** Chainlink Data Streams ($150 per stream per month) and/or a Pyth sponsorship, with RedStone as a second source. Settle closes on official-close sources.

---

## 1. Pyth, cheaply

### 1(a) Sponsored push feeds on Solana: is any equity fresh?

**Where the list lives.** https://docs.pyth.network/price-feeds/core/push-feeds/solana renders `data/svm/solana-mainnet.json` (64 feeds; label "Solana mainnet and devnet"). Default update parameters: **55 s heartbeat / 0.5% deviation** (61 feeds), 30 s / 0.5% (2 feeds: CASH/USD, CASH/RD.RR), 3 min / 0.05% (1 feed: PST/USDC.RR).

**Only one US equity is sponsored: `Equity.US.GLXY/USD` (Galaxy Digital).** No TSLA, QQQ, VOO, SPY, NVDA, AAPL, and no xStock token feed (`Crypto.*X/USD`) is on the Solana sponsored list. The page's changelog mentions BULL, CLOV, KSS and RCAT "went live", but they are not in the Solana table and have no account on either Solana push program (probed 2026-09-13T17:13Z), so that changelog is probably for other chains (UNVERIFIED).

**Two program generations exist on Solana** (from https://docs.pyth.network/price-feeds/core/upgrade/contracts):

| Role | Current (upgraded in place 2026-08-26) | "Upgraded" (new address) |
|---|---|---|
| Wormhole receiver | `HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ` | `HDw2E7P8X1SkCyjvoGsfBGAVUutKcj874bXjHrpVYrVL` |
| Solana receiver | `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ` | `rec2HHDDnjLfj4kE7VyEtFA1HPGQLK33259532cRyHp` |
| Push (price feed) program | `pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT` | `pyt2F414BA6dPttK6RddPZUdHfapoBN24GL5wbrPCou` |

- Both generations are deployed (executable) on mainnet **and** devnet (probe 2026-09-13T17:03Z).
- `pyth-solana-receiver-sdk 2.0.0` switches between them with a Cargo feature: default → `rec5EK…`/`pythWS…`; `pro-compatible` → `rec2HH…`/`pyt2F…` (verified in the crate's `src/lib.rs`). An Anchor `Account<PriceUpdateV2>` owner check fails if you post to one receiver and compile against the other.
- Receiver config on **both** generations and **both** clusters: `single_update_fee_in_lamports = 0`, `minimum_signatures = 3`, same data source (emitter chain 26). Guardian-set index 1 is **byte-identical** on mainnet and devnet for both Wormhole receivers (5 signer keys = the "3-of-5 routers" in https://docs.pyth.network/price-feeds/core/upgrade/how-it-works). So a signed update that verifies on mainnet also verifies on devnet.

**Freshness probe.** PDA = `find_program_address([u16_le(0), feed_id], push_program)`; decoded `PriceUpdateV2` (disc 8, write_authority 32, verification_level 1–2, then price message). Public RPC, no key. Probe time **2026-09-13T16:57:24Z (Sunday)**; the last regular session was Fri 2026-09-11 (13:30–20:00 UTC).

Legacy push program `pythWS…`, shard 0:

| Feed | Account | Mainnet `publish_time` (UTC) / price | Devnet `publish_time` |
|---|---|---|---|
| Equity.US.TSLA/USD | `E8WFH8brgP58arcuW2wwsPHiomYrSvrgWTsRLZLAEZUQ` | 2026-09-11 23:59:59 / 365.2750 (posted 09-12 16:51Z) | 2026-07-02 13:48:55 |
| Equity.US.QQQ/USD | `EwssJrQ7UVz6itHEaQQsKWikhZ3iHddyxRhmR7pTvwt5` | 2026-09-11 23:59:59 / 714.8200 (posted 09-12 16:57Z) | 2026-07-02 13:48:55 |
| Equity.US.VOO/USD | `LVreNUP8XfYuhsVQgXEm9csBUKiLTESKrxCFYdZ4HjN` | **2026-07-02 19:44:47** (stale) | 2026-04-01 |
| Equity.US.SPY/USD | `9owhtgrdLiUMAH9JKxYFt5pUY4Luy4EzzLhdcWPVuDyy` | 2026-08-26 15:54:46 (stopped at the upgrade) | 2026-07-02 |
| Equity.US.NVDA/USD | `2w1Tg1XTZbUib7srfRoStJ4v5JXVsK7roQEGMsMaGZFC` | 2026-08-26 15:54:46 | 2026-07-02 |
| Equity.US.AAPL / MSFT / GOOGL / META / COIN / MSTR / HOOD | see probe log | 2026-08-14 20:00 (stale) | 2026-07-02 or none |
| **Equity.US.GLXY/USD** (sponsored) | `EHEfCJoRUewTW91Lv2k33eLW72JkbxbVH6YsisTskg1n` | **2026-09-11 23:59:51 / 24.2875** | no account |
| Crypto.TSLAX/USD | `GpoWLTd6GoisYxYgHz7mTcZvgnfJu4SN7T6PxWjgUTFY` | 2026-09-12 12:18:54 / 365.2300 | no account |
| Crypto.NVDAX / SPYX / QQQX / AAPLX / … | see probe log | 2026-09-12 12:18 (28.6 h old on a "24/7" feed) | none (NVDAX: 2026-08-04) |
| Equity.Index.TSLA/NVDA/AAPL | — | no account | no account |
| Crypto.BTC/USD (control) | `4cSM2e6rvbGQUFiJbqytoVMi5GgghSMr8LwVrT9VPSPo` | 2026-09-13 16:57:13 (fresh) | 16:54:02 (fresh) |

Upgraded push program `pyt2F…`, shard 0 (probe 2026-09-13T17:03:10Z):

| Feed | Account | Mainnet | Devnet |
|---|---|---|---|
| Equity.US.GLXY/USD | `EVH2jJ6vTKrUz4jpkGQzXysFM78X7GN9uegUcA9oavWB` | 2026-09-11 23:59:34 / 24.2875 | no account |
| Crypto.TSLAX/USD | `G8EJV1bqPydBCFZJ2neo1hsrwp2Hwt2ZqJTLG2gotcP2` | 2026-09-12 13:15:42 / 365.3643 | no account |
| Crypto.NVDAX/USD, SPYX/USD | `VSgf6jkw…`, `27Tv3HxU…` | 2026-09-11 19:47:29 | no account |
| TSLA, QQQ, VOO, SPY, NVDA, AAPL | — | **no account** | no account |
| BTC/USD, SOL/USD (control) | `APgzQGGd…`, `7AviUf9n…` | fresh | fresh |

**Who is keeping TSLA/QQQ alive, and is it reliable? No.**
- Pre-upgrade pusher `4jHcKHTf…` wrote TSLA every ~15 min in regular hours until **2026-08-26 15:54Z** (the upgrade), then nothing for 15 days.
- A new, unsponsored payer **`95FZJmFMp8uY4HXrESUa7shZBs6KZYee7TM5kYA2sSgq`** started writing TSLA/QQQ on 2026-09-11 04:xxZ. It had **no transactions touching the TSLA account during Friday's regular session**. It posted Friday's 23:59:59 price only on Saturday 16:51Z, and was still sending no-op updates on Sunday. Its balance was **0.00065 SOL** at 2026-09-13T17:0xZ, which is days of fees at most.
- **Verdict: no free, fresh US-equity push feed exists for TSLA/QQQ/VOO on Solana mainnet or devnet.** Do not build on the TSLA/QQQ accounts.

**GLXY is the one real $0 Pyth equity on Solana (mainnet only).**
- Signature cadence on the upgraded account during Fri 2026-09-11 regular session (13:30–20:00Z): **496 transactions, median gap 52 s, p95 55 s, max 65 s**.
- Coverage runs ~08:00–00:00 UTC (04:00–20:00 ET, i.e. pre-market, regular and post-market) on weekdays.
- Caveat for the "close" lane: the `Equity.US.*` feeds now publish **extended-hours prices under the same feed ID**, even though the Hermes `schedule` string still says `0930-1600`. Proof: GLXY and TSLA last `publish_time` 23:59:xx UTC = 19:59 ET. So "last on-chain price of the day" is a **post-market** print. Select by timestamp, never by "latest".

**$0 relay idea (UNVERIFIED end-to-end, but all preconditions checked).** A keeper watches mainnet push transactions for GLXY (or any feed someone else pays to push). It re-posts the same signed Merkle root and proof to the **devnet** receiver, which has the same guardian set and a zero fee. The devnet account is then a genuinely Pyth-verified `PriceUpdateV2` at $0 data cost.
- Limits: GLXY only (plus whatever third parties push); ~52 s cadence, so boundary prices can be up to ~1 min late; and you must reconstruct the payload from mainnet transaction data (VAA-buffer write plus `update_price_feed` instruction).
- Hermes isn't needed. Whether Pyth's licence allows it is UNVERIFIED.

### 1(b) Programs, grants, discounts (current as of 2026-09-13)

| Offer | Figures | Fit for Agari | Source |
|---|---|---|---|
| **Pyth Terminal free trial** | 14 days, no card (user's key: 25 feeds) | Covers the demo to ~09-27 only | https://docs.pyth.network/price-feeds/pro/pyth-terminal ; search snippet for "14-day" |
| **Polymarket × Pyth data package** | **First 30 days free, then $99/mo**, via Stripe checkout linked from Polymarket docs. Symbols in the Polymarket RTDS equity list: AAPL, TSLA, MSFT, GOOGL, AMZN, META, NVDA, NFLX, PLTR, OPEN, RKLB, ABNB, COIN, HOOD; ETFs QQQ, SPY, EWY, VXX; FX, XAU/XAG, WTI, CC, NGD | **Could cover judging at $0** (a 30-day window from sign-up runs past 10-02). Unknown: is it a Pro API key usable with Hermes and on-chain posting, and does its licence allow on-chain publication? **UNVERIFIED** (Stripe page is JS-only). No VOO | https://docs.polymarket.com/market-data/websocket/rtds ; https://x.com/PythNetwork/status/2040370586518519987 ; https://docs.pyth.network/price-feeds/pro/pyth-terminal ("Pyth Pro x Polymarket") |
| Pyth Free plan | $0, 10 s, **view-only in Terminal, "no API permissions", "No display, non-display, or redistribution rights"** | Unusable programmatically | https://www.pyth.network/pricing |
| Starter | $500/mo, crypto/NAV/RR/crypto indices, 1 s, "Display rights, No redistribution rights" | No equities | same |
| Pro | "Starting at $2,500/mo", "Display and non-display rights, **Limited redistribution rights**" | Over budget | same |
| Pro bundles (blog) | All assets $10,000; **U.S. Equities $5,000/mo**; Futures $5,000; FX & Metals $6,500; FX $5,000; FX G10 $2,500; Crypto $2,500; Metals $2,500 | Over budget | https://www.pyth.network/blog/the-pyth-core-upgrade |
| Chain-sponsored Pro (precedent) | **Cardano: free Pyth Pro for one year** for any Cardano project (email in the announcement) | Shows Pyth does sponsored access; **no Solana equivalent found** (UNVERIFIED absence) | https://intersectmbo.org/news/pyth-pro-on-cardano-subscription-offer |
| "Pyth Pro Individual" tier | DAO forum idea (~20/100/500-feed tiers, no redistribution). A Pyth rep said a retail tier and pay-as-you-go for AI bots are "actively being designed internally". **Not launched** | Watch it | https://forum.pyth.network/t/pyth-pro-individual-tier/2534 |
| Pyth Ecosystem Grants | 50M PYTH programme (community/research/developer grants); Community Hackathon Round 1 (200,000 PYTH, report 2026-04-07). No current data-access grant found | Long shot for data access | https://www.pyth.network/blog/pyth-ecosystem-grants-program ; https://forum.pyth.network/t/community-hackathon-post-mortem/2518 |
| Pyth MCP server | `get_symbols` keyless; `get_latest_price`, `get_historical_price`, `get_candlestick_data` **require a Pro key** (older blog said history was free, but it is not now) | Metadata only | https://docs.pyth.network/price-feeds/pro/mcp |
| Contact | "Plans, chain support, custom arrangements": `data@dourolabs.xyz` (listed on the docs page) | **Ask for a trial extension to 2026-10-02** | https://docs.pyth.network/price-feeds/core/upgrade/preparing |

### 1(c) What the trial allows after it ends

- **Not documented.** No Pyth page states post-trial behaviour (UNVERIFIED).
  - The pricing page's only $0 plan is "View-only access through Pyth Terminal (no API permissions)". The upgrade FAQ says a Hermes client without a valid key "fail[s] with authentication errors".
  - **Expect every data endpoint to return 401 after ~2026-09-27**: Hermes latest, Hermes `/v2/updates/price/{publish_time}` (historical), Pro `/v1/{channel}/history` and the MCP history tools.
  - Keyless probes today (2026-09-13T17:01Z) already return **401** for Hermes latest, Benchmarks `/v1/updates/price/{t}`, and Pro history. The TradingView shim on `benchmarks.pyth.network` returns **404**.
- **What keeps working with no key:**
  - Metadata: `hermes.pyth.network/v2/price_feeds` and `pyth.dourolabs.app/hermes/v2/price_feeds` (200, with `market_hours` and `schedule`), and `history.pyth-lazer.dourolabs.app/v1/symbols` (200).
  - Reading any on-chain `PriceUpdateV2` account.
  - **Re-verifying an already-signed update blob you saved**: the receiver checks router signatures (3-of-5) and has no staleness rule of its own. This holds until the router set rotates (UNVERIFIED how often).
- **Action before the trial ends:**
  1. **Archive** signed Hermes updates (`encoding=base64`) for TSLA/QQQ/VOO at every 1-min boundary you might demo (390 × trading days × 3 feeds; batch the 3 IDs per call).
  2. Check in Terminal whether `Crypto.TSLAX/USD` is among the 25 trial feeds, and whether feeds can be swapped (UNVERIFIED).
  3. Test posting a 7-day-old blob to devnet to confirm replay works.

---

## 2. Switchboard On-Demand custom feeds on Solana

Probed 2026-09-13, 16:53–17:20 UTC, using crates.io and npm registries, Crossbar simulations, real `fetchQuoteIx` quotes on devnet and mainnet, and RPC decodes of queue accounts and quote transactions.

### 2.1 Cost per update

**Default queues (RPC decode, 16:56 UTC)**

| | Devnet `EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7` | Mainnet `A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w` |
|---|---|---|
| Owner program | `Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2` | `SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv` |
| Oracles | 9 | 12 |
| Allowed enclave measurements | 8 | 3 |
| `reward` (paid from queue escrow, not by the user) | 1,000,000 | 900,000 |
| `oracle_min_stake` | 0 | 0 |
| `max_quote_verification_age` | 604,800 s | 604,800 s |
| `require_usage_permissions` | 0 | 0 |

**Observed fees on the quote program `orac1eFjzWL5R3RbbdMV68K9H6TaCVVcL6LjvQQWAbz`**
- 1 transaction signature + 1 ed25519 signature: **10,000 lamports** (devnet and mainnet).
- 1 + 3 signatures: **20,000 lamports**.
- No lamports go to oracles or a reward vault. The quote program itself uses 610–810 compute units.
- A web snippet claiming "20k–100k lamports per update" contradicts these on-chain observations (UNVERIFIED).

**Rent**
- The "managed update" path creates a canonical quote account of 1,064 bytes. Its rent-exempt minimum is 6,055,360 lamports; one live mainnet account holds 8,296,320.
- If you create one feed per boundary, that rent repeats for every boundary, and no close instruction was found (UNVERIFIED).
- **Use `fetchQuoteIx` instead** (ed25519 instruction only): verify it in your own program, store only the settled price, and pay no rent.

**Monthly estimate**
- 3 signatures per boundary ≈ $0.002 at SOL ≈ $100.8.
- 79 five-minute boundaries per trading day × 21 days ≈ **0.033 SOL ≈ $3.35 per ticker per month**.
- One quote can carry up to 8 feeds, so batch tickers per boundary.
- Devnet costs are the same, paid in airdropped SOL.

**Rate limits and plans**
- Docs ("as of March 3, 2026"): **20 requests/s per wallet**, raised by staking svSWTCH.
- The public Crossbar `https://crossbar.switchboard.xyz` also throttles per IP (HTTP 429). Docker self-hosting is recommended.
- No paid hosted Crossbar tier was found.
- Surge plans (separate product): **Plug free** (10 s, 2 feeds, 1 connection); Pro ~$3,000/mo; Enterprise ~$7,500/mo.

### 2.2 Building a US-equity feed from free APIs

**Tasks**
- `httpTask` (url, method, headers, body; fails on HTTP ≥ 400).
- `jsonParseTask`: JSONPath filters work, e.g. `$.bars[?(@.t=='…')].c`.
- `medianTask` (`min_successful_required`, `max_range_percent`), `boundTask` (clamps, does not reject), `conditionalTask` (attempt/onFailure), `cacheTask`, `comparisonTask`, `divideTask`, `valueTask`, `unixTimeTask`, `cronParseTask`, `switchboardSurgeTask`.
- `oracleTask` with `pythAddress`, `pythPushFeedId`, `chainlinkAddress` or `switchboardAddress`.
  - After Pyth's 2026-08-26 change, `pythAddress` goes through Hermes and needs `pythConfigs.apiKey: "${PYTH_API_KEY}"`.
  - `pythPushFeedId` reads the on-chain account and needs no key, but §1(a) shows those accounts are stale for TSLA/QQQ/VOO.
- The legacy `SecretsTask` service is shut down.

**Feed-level settings**
- `minJobResponses` and `minOracleSamples` are plain counts.
- `maxJobRangePct` is scaled by 1e9: `1_000_000_000` = 1%, and passing `5` means effectively 0%.

**Variable overrides**
- Syntax is `${VAR}`, passed as `variableOverrides` to `fetchQuoteIx`, `fetchManagedUpdateIxs` or simulate.
- Docs: *"The concrete override map is execution-scoped. It is not included in the feed ID or the signed checksum."* Variables are plain string substitution.
- Use overrides **only for API keys**, and put keys in **headers**, not query strings, to avoid parameter injection (an inference, not tested).
- Never make T, the symbol or the JSON path overridable.

**Crossbar simulation (17:05 UTC)**
- Jobs: median of Yahoo close, Yahoo open, and a Finnhub job with an invalid key.
- Result: **364.98**. The failed job was tolerated and `${T_START}` was substituted.

**Example: TSLA 1-minute close at a fixed T (14:05 ET on 2026-09-11)**

Vendor URLs and response shapes are UNVERIFIED because no keys were available. Every tier used here forbids public redistribution (§4).

```json
{"name":"TSLA 1m close 2026-09-11T18:05Z","minJobResponses":2,"minOracleSamples":3,"maxJobRangePct":500000000,
 "jobs":[
  {"tasks":[{"httpTask":{"url":"https://data.alpaca.markets/v2/stocks/TSLA/bars?timeframe=1Min&start=2026-09-11T18:05:00Z&end=2026-09-11T18:05:59Z&feed=sip",
     "headers":[{"key":"APCA-API-KEY-ID","value":"${ALPACA_KEY_ID}"},{"key":"APCA-API-SECRET-KEY","value":"${ALPACA_SECRET}"}]}},
    {"jsonParseTask":{"path":"$.bars[?(@.t=='2026-09-11T18:05:00Z')].c"}}]},
  {"tasks":[{"httpTask":{"url":"https://api.twelvedata.com/time_series?symbol=TSLA&interval=1min&start_date=2026-09-11%2014:05:00&end_date=2026-09-11%2014:05:59&timezone=America/New_York",
     "headers":[{"key":"Authorization","value":"apikey ${TWELVEDATA_KEY}"}]}},
    {"jsonParseTask":{"path":"$.values[?(@.datetime=='2026-09-11 14:05:00')].close"}}]},
  {"tasks":[{"httpTask":{"url":"https://api.tiingo.com/iex/TSLA/prices?startDate=2026-09-11&endDate=2026-09-11&resampleFreq=1min",
     "headers":[{"key":"Authorization","value":"Token ${TIINGO_KEY}"}]}},
    {"jsonParseTask":{"path":"$[?(@.date=='2026-09-11T18:05:00.000Z')].close"}}]},
  {"tasks":[{"httpTask":{"url":"https://api.polygon.io/v2/aggs/ticker/TSLA/range/1/minute/1789149900000/1789149900000?adjusted=true",
     "headers":[{"key":"Authorization","value":"Bearer ${POLYGON_KEY}"}]}},
    {"jsonParseTask":{"path":"$.results[?(@.t==1789149900000)].c"}}]}]}
```

**Notes on the sources**
- **Alpaca `feed=sip` on the free Basic plan only works once the data is ≥ 15 min old** ("subscription does not permit querying recent SIP data"). Settle T+16 min for a consolidated bar, or use `feed=iex` for immediate (IEX-only) data.
- **Massive (Polygon) Basic is end-of-day only**, so it can't serve intraday T on the free tier.
- **Finnhub `/quote` has no timestamp parameter**, so use it as a live sanity job only. Its candles are premium.
- Keyless sources you could add, with licence risk:
  - xStocks `price-data`: Pyth-derived, current price only (§5).
  - RedStone gateway: signed, but verifying it directly is better (§3).
  - DIA `/v1/rwa/Equities/TSLA`: unsigned, current price only.

### 2.3 Price at or near a specific timestamp

- **There is no historical or timestamp mode on Solana.** Crossbar's OpenAPI (50 routes) only has an EVM `use_timestamp` flag.
- **Putting T in the URL works end to end.** An inline, never-stored feed (Yahoo 1-minute bar at `period1=1789149900`) returned signed quotes:
  - **Devnet**, 17:06 UTC: value **364.8900146484375**, slot 497,814,980. This equals Yahoo's 18:05Z bar close (364.89).
  - **Mainnet:** same value.
  - Latency 1.7–2.1 s.
  - Maximum successful signatures: 5 on devnet (asking for 6 returned HTTP 500), 4 on mainnet (5 returned 500).
- **What a quote proves:**
  - Solana quotes carry **no unix timestamp**, only the `slot` whose slot hash was signed.
  - The verifier requires `clock.slot − slot ≤ max_age` (default 30; examples use 50–150), and the slot must still be in SlotHashes (512 slots ≈ 3.4 min).
  - So a quote proves "oracles ran job J around slot S and got V". Only the job makes V equal "the price at T".
- **Design:**
  - Use **one feed ID per (symbol, T)** and pin the expected feed ID in the market account at creation. Alternatively, recompute it on-chain (sha256 of the length-delimited protobuf via `switchboard-protos`), as in the Kalshi prediction-market tutorial.
  - Settle only when `now ≥ T + 60 s + buffer` (or T + 16 min for Alpaca SIP).
  - First valid settlement wins.
  - Require ≥ 3 **distinct** oracle signers and a tight `maxJobRangePct`.
- **Residual risk:**
  - Vendors revise bars after the fact (late trades, corrections).
  - IEX-only sources differ from consolidated prices.
  - A settler can re-request until a favourable value within tolerance comes back. Tight tolerance and first-valid-wins limit this.

### 2.4 Oracle and queue trust model

- **Enclaves:** oracles run in **AMD SEV-SNP** TEEs attested by guardians. Each queue keeps an enclave-measurement allowlist, and signing keys are re-verified every 7 days.
- **Queue authority:** Switchboard's keys (mainnet `DREcTw…`, devnet `2Kgowx…`).
- **Staking/slashing:** docs mention SWTCH / Jito NCN, but on-chain **`oracle_min_stake` = 0**, so slashing being live is UNVERIFIED.
- **Shared oracles:** 7 of the 9 devnet signing keys are also on the mainnet queue. Only the slot-hash check prevents cross-cluster replay.
- **Single gateway:** `/gateways?network=mainnet` returned one gateway.
- **Signed contents:** slot hash + feed ID + value + `min_oracle_samples`. There is **no TLS transcript proof**, so trust rests on TEE code identity.
- **Bad API data:**
  - HTTP errors or a missing JSONPath fail the job; quorum and range checks then refuse to sign.
  - A **plausible but wrong number is signed**.
  - `boundTask` clamps instead of rejecting.
- **Anyone can request quotes** for any feed definition.
- **Verifier gaps (read from crate source, not exploited on-chain):** `QuoteVerifier::verify`
  - does **not** check the queue account address or owner (only its size, 6,280 bytes). **Pin the queue pubkey.**
  - does **not** deduplicate oracle indices (the same signature repeated could count as 3). **Enforce distinct indices.**
  - does **not** enforce `min_oracle_samples`. **Enforce the count yourself.**
- **Net:** Switchboard turns "a free API said X" into "N TEE oracles independently fetched X". The **data source is still the trust anchor**, and its licence is the risk.

### 2.5 Crate and SDK compatibility with Anchor 1.1.2 / 1.2.0

**Versions**
- `switchboard-on-demand` **0.13.0** (2026-06-09; previous 0.12.1). Dependencies: `anchor-lang >=0.31.0` (optional), `solana-program` (`>=2,<3` for v2 or `>=3` for v3), `pinocchio ^0.11.1`, `switchboard-protos >=0.2.3`.
- Features: `anchor` = anchor-lang + solana-v2; `default` = cpi + solana-v2; also `solana-v3`, `client-v3`, `pinocchio`, `devnet`.
- `anchor-lang` latest: 1.2.0 (2026-09-04), 1.1.2, 2.0.0-rc.1.

**`cargo check` results** (host rustc 1.98.1; an SBF build was not run, UNVERIFIED)

| Setup | Result |
|---|---|
| anchor-lang 1.2.0 + `features=["anchor"]` | **Fails** (20 errors: `solana_program::sysvar::{clock, slot_hashes}` unresolved, conflicting `AnchorSerialize`) |
| `default-features=false, features=["solana-v3"]` | **Compiles**, including a full `#[program]` using `QuoteVerifier` with Anchor `AccountInfo` |
| Same, unpinned | Resolves `solana-program` **5.0.0** (released 2026-09-11). Pinning `cargo update -p solana-program --precise 3.0.0` also compiles |

- Without `anchor` you lose `Account<SwitchboardQuote>`, `canonical_key` and `SwitchboardQuoteExt`. You keep `QuoteVerifier`, `OracleQuote`, `Ed25519Sysvar`, `QueueAccountData` and `DEFAULT_DEVNET_QUEUE`.
- Pubkey types differ from Anchor's; convert with `.to_bytes()`.

**Index-encoding bug (host test on real devnet quote bytes)**
- `@switchboard-xyz/on-demand` **3.10.6** writes instruction index **0xFFFF**, and `asV0Tx` rewrites any index back to it.
- Crate 0.13.0 `verify_instruction_at(0)` then **panics**: "Signature instruction index 65535 does not match current instruction index 0".
- The runtime precompile accepts 0xFFFF.
- **Workaround that compiles against Anchor 1.2:**
  1. Load the ed25519 instruction via `solana-instructions-sysvar` 3.0.1 `load_instruction_at_checked` and check its program ID.
  2. Require each record's index fields to be 0xFFFF or your own index.
  3. Call `QuoteVerifier::verify(&data)`.
  4. Check oracle indices are distinct.
  5. Read `quote.feed(&expected_feed_id)`.
  - Sample code: `scratchpad/sb/build/d_program/src/lib.rs` (`sb_verify`).

**Upstream status**
- The examples repo still pins anchor-lang 0.31.1 (+ `blake3 =1.8.2`, `constant_time_eq =0.3.1`).
- No Anchor 1.x issue has been filed. Open PRs: #187 (native feature) and #189 (client-v3) on `switchboard-xyz/solana-sdk`.

**npm**
- `@switchboard-xyz/on-demand` 3.10.6 (2026-07-30) uses `@solana/web3.js ^1.98.4` and bundles `@coral-xyz/anchor-31` (0.31.1), so it doesn't clash with `@anchor-lang/core` 1.2.0.
- `@switchboard-xyz/common` 5.8.5.

**Alternative:** the roadmap already plans a native ed25519 **attestor** verified via Instructions-sysvar introspection (`12-stage-roadmap-source.md`). That route needs no Switchboard crate at all.

---

## 3. Other oracles with US equities on Solana

Probes 2026-09-13, 16:54–17:16 UTC.

| Oracle | US equities | xStocks tokens | Solana (devnet/mainnet) | Access and cost | Trust | Price at past T | Anchor 1.x effort |
|---|---|---|---|---|---|---|---|
| **Chainlink Data Streams** | 19 tickers × 3 sessions (AAPL, ABBV, AMZN, BMNR, COIN, CRCL, GOOGL, HOOD, META, MRK, MSFT, MSTR, NVDA, ORCL, PLTR, **QQQ, SPY, TSLA**, UNH); 24/5 incl. overnight | 14 xStocks (TSLAx, NVDAx, SPYx, QQQx…), with `price` + 24/7 `tokenizedPrice` + multiplier | Verifier `Gt9S41PtjR58CbG9JhJ3J6vxesqrNAswbWYbLNTMZA3c` (both clusters); devnet access controller `2k3DsgwBoqrnvXKVvd7jX7aptNxdcRBdcd5HkYsGgbrb` | **Self-serve at app.chain.link, "starting at $150/month" per stream**; bundles discounted; **"no free account tier"**; 30-day cycles, not prorated. Testnet access: "contact us" | DON signatures + on-chain verifier CPI; allowlisted account needed | **Yes**: `GET /api/v1/reports?feedID=&timestamp=` | Medium: `chainlink_solana_data_streams` (git) + `chainlink-data-streams-report` (1.2.2); Anchor 1.x compatibility UNVERIFIED |
| **RedStone** | TSLA, NVDA, AAPL, AMZN, GOOGL, META, MSFT (+ `---EXTENDED`, `---24_7`, `---PERP`), USA500.Y, USA100.Y. **No SPY/QQQ/VOO** | No | Price adapter devnet `REDuYsnEucMweattdv4xQCYdU1i8Q2W92kdayrpY9rA`, mainnet `REDSTBDUecGjwXd6YGPzHSvEUBHQqVRfCcjUVgPiHsr` | **Public gateways, no key, $0**; licence UNVERIFIED. "RedStone Live" (WebSocket, `x-api-key`) licensing is "confirmed during integration scoping" | 3-of-5 whitelisted signers (secp256k1) | **~24 h back** via `…/data-packages/historical/redstone-primary-prod/<ms>`; 36 h, 48 h and 7 d returned empty | Medium. **`rust-sdk` v4.0.0 `solana` feature = anchor-lang 1.0.0 + solana-program 3.0.0** (checked on `main`); tag 2.0.1 pins anchor 0.30.1, so avoid it |
| **Stork** | 178 `*_24_5` feeds incl. TSLA_24_5, NVDA_24_5, **SPY_24_5, QQQ_24_5**; plain SPY, QQQ | AAPLXUSD, AMZNXUSD, METAXUSD only | Program `stork1JUZMKYgjNagHiK2KdMmb42iTnYe9bYUCDUk8n` (both clusters); no pushed feeds on Solana | Key only via sales (sales@stork.network); 5 req/s; price not published | Single Stork signer | Signed prices only for the last 10 min; history endpoint unsigned | Medium (~60-line verify you can copy; `stork-solana-sdk` 0.0.7) |
| **DIA** | Free REST: `/v1/rwa/Equities/TSLA` 365.47, `/v1/rwa/ETF/SPY` 764.29, `/ETF/QQQ` 714.88 | TSLAX → price 0 | No Solana guide | Free, no key | **Unsigned** | No | Off-chain cross-check only |
| **Switchboard Surge** | **No** ("All major cryptocurrency pairs") | **Yes, indirectly:** `switchboardSurgeTask {source:"WEIGHTED", symbol:"TSLAX/USD"}` signed by 2 oracles on devnet and mainnet (Sun 17:12 UTC, 363.12). 7,535 Surge symbols incl. TSLAX, AAPLX, NVDAX, SPYX, QQQX (Bybit, Gate.io) | Via On-Demand | Free inside On-Demand jobs; tick must be ≤ 5 s old | TEE oracles over CEX ticks | Now only | Same as §2.5 |
| **Supra** | Stocks announced | No | **Solana not in its 51 mainnet / 59 testnet networks** | — | — | — | Not usable |
| **Band** | Equities announced Jul 2026 (UNVERIFIED) | No | No current Solana program found (UNVERIFIED) | — | — | — | Not usable |
| Edge (Chaos Labs) / SEDA / API3 / eOracle / Pragma | Crypto only, EVM-only, Starknet, or no live Solana equity product | — | — | — | — | — | Not usable |

**What xStocks itself uses** (`https://api.xstocks.fi/api/v2/public/oracles`, 8 pages × 50 rows)
- 400 pull-based entries in total.
- **Pyth: 204** (Solana, Arbitrum, Polygon, Base; Solana verifier = Pyth Pro `pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt`).
- **Chainlink: 196** (14 tokens × 14 networks incl. Solana, schema v10, verifier `Gt9S41Pt…`).
- Ondo Global Markets uses Chainlink as primary; its Chainlink tokenized-stock feeds are documented for Base, not Solana.

**Chainlink details worth keeping**
- Regular-hours mainnet stream IDs: TSLA `0x000b2dbed1640ead18d37338b75e4755630a900649261baf4ed79d9a749be13d`, NVDA `0x000b6aa0…24b9`, SPY `0x000bc7e4…05ac`, QQQ `0x000bc47f…30b7`.
- `marketStatus`: 1 pre, 2 regular, 3 post, 4 overnight, 5 closed. Docs: use `marketStatus`, not timestamps.
- `lastTradedPrice` is deprecated from 2026-10-12.
- Pay-per-verification is deprecated; there is no LINK fee per verification.
- Classic Chainlink Data Feeds on Solana are crypto only (12 mainnet / 15 devnet).
- No hackathon Data Streams credentials found.
- Whether a self-serve subscription also allowlists your Solana program in the Access Controller is UNVERIFIED; confirm before paying.

**RedStone details worth keeping**
- **Latest packages, 17:16:32 UTC (Sun):** 954 feeds; each `TSLA` package has 5 signatures, one signer `0xdEB22f54738d54976C4c0fe5ce6d408E40d88499`; timestamps on a **10-second grid** (17:16:20).

| Feed | Value | Reading (inferred, UNVERIFIED) |
|---|---|---|
| `TSLA` | 365.48270296 | ≈ regular-session close |
| `TSLA---EXTENDED` | 365.27634521 | ≈ post-market last (Pyth 365.275) |
| `TSLA---24_7` | 363.5186368 | ≈ weekend/perp-derived (TSLAx DEX 363.35) |
| `NVDA` | 218.24574831 | — |
| `QQQ`, `SPY`, `VOO` | absent | — |

- The official TSLA close was 365.44 (Yahoo `regularMarketPrice` at 20:00:00Z; Cboe `close`). **RedStone `TSLA` differs from it by +1.2 bps.**
- The historical endpoint 1 h back (17:16 UTC) returned 5 TSLA packages.
- **RedStone's own Solana price adapter can't be used for past T:** it rejects data older than 3 minutes, and untrusted writers can only update once every 2 days.
- **Verify packages in your own program instead:**
  - Check 3 of 5 signers from the adapter's `config.rs`.
  - Check the feed ID.
  - Require the package timestamp to be exactly `T·1000`.
  - Supply T as the reference time rather than `Clock`, so a late post is accepted.
- **Keeper must fetch within ~24 h** (retention), so a Friday close is gone by Saturday afternoon.
- Compute cost: 3 × `secp256k1_recover` (≈ 25k CU each, UNVERIFIED), comfortably under 1.4M CU.

**Stocklana hackathon** (https://hackathons.solana.com/hackathons/stocklana)
- $100,000 prize pool from the Solana Foundation; no other sponsors, no bounty tracks, **no oracle credits**.
- Submissions close Fri 2026-09-18 16:00 ET; judging to 2026-10-02. 345 registered, 31 submissions at probe time.
- "Infrastructure: price feeds" is a listed category.

---

## 4. Free and cheap market-data APIs as oracle or attestor sources

Verified against pricing pages, terms PDFs and keyless probes (16:54–17:16 UTC).

### 4.1 Findings that change the design

1. **Real-time IEX is no longer free.** IEX fee schedule (effective 2026-09-01):
   - Real-time TOPS **$500/mo, rising to $1,000/mo on 2026-10-01**; DEEP $2,500/mo.
   - **Delayed (≥ 15 min) IEX data is free** and "may further redistribute such Delayed IEX market data".
   - **IEX HIST** (T+1 pcap) is free with the citation "Data provided for free by IEX…". The 2026-09-11 TOPS file is 10.73 GB.
2. **Delayed SIP data is not automatically free on a public chain.** A public chain counts as an "Uncontrolled Product":
   - **Nasdaq:** 15-min delayed data on uncontrolled products needs prior approval; end-of-day, midnight or 24 h delayed data does not.
   - **UTP:** external delayed redistribution costs $250/mo + $250/yr, "fees may apply" for uncontrolled products, and **end-of-day data is "Not Fee Liable"**.
   - **CTA:** no display fees for delayed last sale, but the NYSE vendor agreement and a "Prices Delayed 15 Minutes" label are required (2016 policy document).
3. **The 16:00 bar close ≠ official close.**
   - AAPL 2026-09-11: official close **332.27** (Yahoo, EODHD, Twelve Data, Nasdaq and Cboe agree).
   - EODHD 20:00Z bar close **332.40** (vol 13.19M: closing cross + after-hours); 19:59Z bar close 332.23.
   - TSLA: official close 365.44; Yahoo 19:59Z bar close 365.47.
4. **Vendors' bars differ slightly.** AAPL 15:58 ET bar volume: Yahoo and Twelve Data 363,785 vs EODHD 363,568; prices matched. Use a median with a small tolerance.
5. **Every free or cheap tier forbids public redistribution.** The only affordable product that explicitly advertises external redistribution with no exchange fees is **Databento EQUS.MINI** (Standard plan **$199/mo**).

### 4.2 Comparison

| Provider / plan | Price | Real-time or delayed | Venues | Rate limits | WebSocket | 1-min bars / corrections | Public on-chain posting |
|---|---|---|---|---|---|---|---|
| **Alpaca Basic** | $0 | RT IEX; SIP only when ≥ 15 min old | IEX (~2.5% of volume); SIP history | 200/min | 30 symbols, 1 connection | Since 2016. `updatedBars` after each half-minute if late trades arrive; corrections/cancels as separate messages; extended-hours trades update minute bars; the "M" official-close condition updates none | **No**: "personal and noncommercial"; no public display without written consent |
| Alpaca Algo Trader Plus | $99/mo | RT SIP | All US | 10,000/min | Unlimited | Same | **No** (same terms) |
| **Finnhub Free** | $0 | RT `/quote` (source UNVERIFIED, reportedly IEX) | UNVERIFIED | 60/min (+30/s cap) | 50 symbols | **No candles** (premium) | **No**: "strictly for personal use"; no redistribution without approval |
| Finnhub Market Data Basic | $49.99/mo (billed quarterly) | RT | US | 150/min | 250 | 10-year 1-min history | **No** (personal) |
| **Twelve Data Basic** | $0 | "RT" from ~**5%-of-volume** venues | Not consolidated live; history 100% | 8 credits/min, 800/day | Trial only | Yes | **No**: "testing, evaluation, or development purposes only… cannot be displayed to users" |
| Twelve Data Grow | $29 / $49 / $79 | Same | Same | 55 / 144 / 377 credits/min | Trial | Yes | **No**; Venture $149 adds external display; Enterprise $1,099 external distribution |
| **Massive (ex-Polygon) Basic** | $0 | End of day | 100% | 5/min, 2-year history | No | End-of-day aggregates | **No** (personal) |
| Massive Starter | $29/mo | 15-min delayed | 100% | Unlimited | Delayed | 5-year history, bulk files; late-trade handling UNVERIFIED | **No**; Business $2,499/mo |
| **Tiingo Free** | $0 | RT IEX (`tngoLast`; raw `last`/bid/ask need an IEX entitlement) | IEX | 50/hr, 1,000/day, 500 symbols/mo | Yes | IEX-derived 1-min, since 2017-08; end-of-day corrections until 20:00 ET | **No**; redistribution add-on **$250/mo (startup)** |
| Tiingo Power | $30/mo | Same | IEX | 10,000/hr, 100,000/day | Yes | Same | **No** |
| **EODHD Free** | $0 | End of day | — | 20/day | No | No | **No** |
| EODHD EOD+Intraday | $29.99/mo | WebSocket RT **Cboe EDGX only**; REST 15–20 min delayed | EDGX | 100,000/day, 1,000/min | 50 symbols | **Finalized ~2–3 h after 20:00 ET** | **No** (personal) |
| **Databento** | $125 credits; **Standard $199/mo** for live | Live needs a subscription | EQUS.MINI (blend); XNAS.BASIC; EQUS.SUMMARY (official close from Nasdaq NLS+) | — | Live API | `ohlcv-1m`; per-GB pricing UNVERIFIED | **EQUS.MINI: "external redistribution… without licensing restrictions"**; full terms UNVERIFIED |
| Nasdaq Basic (direct, 2025 list) | $2,080/mo external distributor + user fees | RT | Nasdaq + TRF | — | — | — | Licensed; far over budget |
| Cboe One Summary | $5,000/mo external | RT | 4 Cboe venues | — | — | — | Licensed; far over budget |
| IEX direct | TOPS $500 → $1,000/mo; delayed and HIST free | — | IEX | — | — | HIST T+1 | **Delayed / HIST: yes, with attribution** |

**Other sources**
- **Yahoo v8 chart:** keyless 200; terms personal use (UNVERIFIED).
- **Alpha Vantage:** 25/day; premium from $49.99.
- **FMP:** Basic 250/day end of day; $19 / $49 / $99 plans; display needs a licence agreement.
- **marketdata.app:** free 100 credits/day, 24 h delayed; $12–30/mo real time for non-pros; only the custom Commercial plan says "Redistribution Permitted".
- **Tradier:** real time for brokerage account holders; sandbox 15 min delayed.
- **Schwab API:** personal use.
- **api.nasdaq.com (unofficial):** keyless 200 with `isRealTime:false`; terms not retrieved.
- **Cboe CDN delayed quotes** (`cdn.cboe.com/api/global/delayed_quotes/quotes/TSLA.json`): keyless 200, returned `close` 365.44.

### 4.3 Using these as sources

- **Demo (labelled "demo / delayed"):**
  - Alpaca Basic IEX bars for the live chart.
  - For settlement, re-fetch the **SIP** 1-min bar after T+16 min (free on Basic).
  - Twelve Data `time_series 1min` as the second source; Tiingo `/iex?tickers=a,b,c` (one call for many tickers) or Finnhub `/quote` as a live sanity check.
  - Close: median of official closes (Alpaca daily bar, Twelve Data, EODHD), **not** the 16:00 bar.
- **Low licence-risk production:**
  - Databento EQUS.MINI ($199/mo; get written confirmation that on-chain publication is covered).
  - Tiingo redistribution add-on ($250/mo) as a second source.
  - Settle on post-close or next-day data, which Nasdaq/UTP treat more leniently.
  - IEX delayed/HIST as a free, redistributable cross-check.
  - One option (legal question, ask counsel): post only the outcome plus a hash of the price, and reveal the price after end of day.

---

## 5. xStock token prices 24/7

Probes at **2026-09-13T17:08Z (Sunday)**. **Pin mints, never symbols**: `tokens/v2/search?query=TSLAx` also returns a pump.fun impostor "TSLAx" (`EaxDDrLr…pump`, $3k liquidity).

| Token | Mint (verified, Token-2022) | Jupiter `usdPrice` | xStocks `stockData.price` | DEX vs reference | Liquidity (Jupiter) | 24h traders |
|---|---|---|---|---|---|---|
| TSLAx | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` | 363.35 | 365.25 | −0.52% | $1.29M | 9,111 |
| QQQx | `Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ` | 709.02 | 714.89 | −0.82% | $1.72M | 7,290 |
| SPYx | `XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W` | 761.93 | 764.29 | −0.31% | $4.40M | 15,887 |
| NVDAx | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` | 215.13 | 218.26 | −1.43% | $1.87M | 12,568 |

**Jupiter Price v3**
- Keyless `lite-api.jup.ag/price/v3` returned 200 (`cache-control: public, max-age=5`); keyless `api.jup.ag/price/v3` also 200.
- Limits (Jupiter portal docs): **keyless 0.5 RPS**; Free key 1 RPS; Developer **$25/mo** 10 RPS; Launch $100/mo 50 RPS; Pro $500/mo 150 RPS. Up to 50 ids per call.
- Method: **"last swapped price (across all transactions)"** plus outlier heuristics; tokens that fail heuristics are silently omitted. The response includes `blockId`.
- **Scaled-UI gotcha:** SPYx/QQQx/NVDAx carry `scaledUiConfig.multiplier` (e.g. SPYx 1.00391 → `newMultiplier` 1.00571). `usdPrice` is per UI token; DEX screeners show the pre-scaled pool price (SPYx pools ~765.7 vs `usdPrice` 761.9). Settle on one documented basis.
- **`stockData.price`** is xStocks' reference for the underlying and is refreshed on Sundays (`updatedAt` 17:06Z). It is the Friday extended-hours last price, not a weekend price.

**xStocks public API (keyless)**
- `GET https://api.xstocks.fi/api/v2/public/assets/TSLAx/price-data` → `{"quote":365.275}`. That is **identical to Pyth `Equity.US.TSLA` on-chain 365.2750 @ 23:59:59Z Fri**, so the "indicative price" is Pyth-derived.
- Headers: `x-ratelimit-limit: 1000` per minute.
- `…/system/status/TSLAx` → `isMarketTradingHalted:false, isAtomicTradingHalted:false`.
- `…/public/oracles` (8 pages, 400 rows): every xStocks oracle is **`managedBy: Pyth`** (Solana verifier `pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt`, i.e. Pyth Pro/Lazer, plus a `hermesId`) or **`managedBy: Chainlink`** (Data Streams `reportSchema: v10`, Solana verifier `Gt9S41PtjR58CbG9JhJ3J6vxesqrNAswbWYbLNTMZA3c`).
  - TSLAx: Pyth Lazer ID 1847 / Hermes `47a15647…a362`; Chainlink feed `0x000a80c6…3398`.
  - QQQx: 1837 / `178a6f73…054d`; Chainlink `0x000a1db2…f267`.
  - SPYx: 1843 / `2817b784…4e14`; Chainlink `0x000ac6ba…2a77`.
  - NVDAx: 1833 / `4244d078…3b7f`; Chainlink `0x000a37a5…918a`.
  - Both are paywalled or permissioned. There is **no free xStocks-run oracle**.
- Licence for reusing `price-data` on-chain: UNVERIFIED (Backed API terms not reviewed).

**On-chain DEX TWAP**
- Biggest TSLAx pool: Raydium CLMM `8aDaBQkTrS6HVMjyc6EZebgdiaXhLYGriDWKWWp1NpFF` (TSLAx/USDC, $2.11M liquidity, $1.35M 24h volume per DexScreener). Next: Raydium CLMM `HHQUnUbm…` ($475k), Orca `9p7abUFv…` ($99k), Raydium TSLAx/SOL `CKmjDiqB…` ($96k).
- SPYx: Raydium CLMM `6truu3rZ…` ($3.02M) and `4pCZCVEi…` ($325k).
- Raydium CLMM keeps an `ObservationState` PDA (seed `"observation"`) holding **100 observations** of `{block_timestamp u32, tick_cumulative i64}`, updated on swaps at most every **15 s** (`OBSERVATION_UPDATE_DURATION_DEFAULT = 15`, verified in `raydium-clmm/programs/amm/src/states/oracle.rs`). That gives an on-chain, trustless TWAP window of up to ~25 min when swaps are frequent.
  - Compute `(tickCum[t1] − tickCum[t0]) / (t1 − t0)` → `price = 1.0001^tick`, adjusted for decimals and the scaled-UI multiplier.
  - Gaps with no swaps extend the last tick.
  - Orca Whirlpool has no equivalent TWAP oracle (UNVERIFIED).

**Manipulation risk**
- A last-swap price (Jupiter) on a ~$1–2M pool can be moved by one large swap at T; a CLMM concentrates liquidity near the price, but a 1% move can still cost well under $50k (UNVERIFIED estimate).
- Weekend DEX prices drift off the reference (−0.3% to −1.4% on this Sunday).
- Mitigations:
  - Settle on a TWAP (≥ 5 min) or the median of 3 samples around T, never a single last swap.
  - Cap open interest per token lane (e.g. ≤ 1–2% of pool liquidity).
  - Void when |DEX − `stockData.price`| exceeds a band during regular hours.
  - Label the market "TSLAx token price", not "TSLA".

---

## 6. Recommendation: an affordable settlement design

### 6.1 Ranking the options

Scores run from 1 (worst) to 5 (best). "Licence risk" is the risk that publishing the price on a public chain breaches the data terms: 5 means low risk.

| # | Option | Trust | Cost | Anchor 1.x effort | Licence risk | Coverage | Verdict |
|---|---|---|---|---|---|---|---|
| A | **Pyth Hermes → devnet receiver** (trial key) | 5: 3-of-5 Pyth routers, multi-publisher | 5: $0 until ~09-27; receiver fee 0; PriceUpdateV2 rent 1,330,960 lamports, reclaimable | 5: `pyth-solana-receiver-sdk 2.0.0` (anchor ^1.0.2); choose the default or `pro-compatible` feature to match the receiver you post to | 3: trial terms UNVERIFIED; this is Pyth's intended use | TSLA, QQQ, VOO only; ends ~09-27 | **Demo primary** |
| B | **RedStone public signed packages**, verified in-program | 4: 3-of-5 RedStone signers | 5: $0 | 3: `rust-sdk v4.0.0` (anchor 1.0 / solana-program 3.0), secp256k1 recover, custom T check | 2: public-gateway terms UNVERIFIED | TSLA, NVDA, AAPL, AMZN, GOOGL, META, MSFT (+EXTENDED, 24_7); **no ETFs**; ~24 h retention | **Judging primary for single names**, demo cross-check |
| C | **Switchboard On-Demand, T-committed job** (median of free APIs) | 3: TEE oracles, but the free API is the anchor; verifier gaps you must close | 5: ~$0.002 per boundary (~$3.35/ticker/mo mainnet), devnet free SOL | 2: `solana-v3` feature + index workaround + distinct-oracle and queue checks | 1: every free tier forbids redistribution | Anything with an API (QQQ, SPY, VOO) | **Judging for ETFs**, labelled "demo data" |
| D | **Native ed25519 attestor** (keeper signs the median of the same APIs) | 2: single key (or 2-of-3 keys) | 5: $0 | 5: Instructions-sysvar introspection, already in the roadmap | 1: same as C | Anything | Fallback if C slips; transparent logs |
| E | **GLXY mainnet → devnet relay** of real Pyth updates | 5 | 5: $0 | 2: reconstruct payloads from mainnet txs | 3: UNVERIFIED | GLXY only, ~52 s cadence | Optional "real Pyth after trial" showcase |
| F | **Replay lane from archived Pyth trial blobs** | 5 (historical) | 5 | 5: same as A | 3 | Past boundaries only | Judges can re-settle genuine history on-chain |
| G | **Polymarket × Pyth package** | 5 | 4: $0 for 30 days, then $99/mo | 5: same as A | 3: UNVERIFIED scope | TSLA, QQQ, SPY + 11 names; no VOO | Worth a sign-up attempt if it yields a Hermes key |
| H | **Chainlink Data Streams** | 5 | 2: $150/stream/mo | 3: verifier CPI, crates' Anchor 1.x support UNVERIFIED | 5: paid licence | 19 equities × sessions + 14 xStocks | **Production** |
| I | **Switchboard Surge task `TSLAX/USD`** | 3: TEE oracles over CEX ticks | 5 | 2: same as C | 3 | xStock tokens 24/7 | **24/7 token lane (devnet)** |
| J | **Jupiter Price v3, attested** | 2: last swap + single attestor | 5: keyless 0.5 RPS, $25/mo for 10 RPS | 5 | 3: Jupiter terms UNVERIFIED | xStock tokens | Token lane fallback; cap stakes |
| K | **Raydium CLMM observation TWAP**, on-chain | 4: trustless, but market-manipulable | 5 | 3 | 5 | xStocks with CLMM pools; **mainnet only** | Production token lane |

### 6.2 Shared on-chain settlement rules (all lanes)

- **Pin at market creation:** `source_kind`, `feed_id` (Pyth ID, RedStone feed bytes, Switchboard feed hash that commits to T, or Chainlink stream ID), `T_open`, `T_close`, `max_settle_delay`, and void thresholds.
- **Timestamp rule** (never "latest"):
  - **Pyth:** `feed_id` matches, `VerificationLevel::Full`, and `publish_time ∈ [T, T+5s]` (fetch via Hermes `/v2/updates/price/{T}`).
  - **RedStone:** package timestamp `== T·1000` on the 10 s grid, with ≥ 3 distinct authorised signers.
  - **Switchboard:** feed hash equals the pinned hash, ≥ 3 distinct oracles, queue pubkey pinned, slot age ≤ 150.
- **First valid settle wins.** If no valid settle arrives within `max_settle_delay` (e.g. 24 h, bounded by RedStone retention), the market is **Void and refunds**.
- **Sanity voids:**
  - Pyth `conf/price > 50 bps`.
  - Dual-source disagreement above the band (e.g. |Pyth − RedStone| > 25 bps on the demo).
  - Exact tie at the Up/Down boundary → Void (the Polymarket convention is 50-50).
- **Session awareness:** the `Equity.US.*` feeds and RedStone `---EXTENDED` carry pre- and post-market prints. Regular-session boundaries must use a timestamp inside 09:30:00–16:00:00 ET, taken from the exchange calendar (Alpaca `/v2/calendar` or Pyth `schedule` metadata, both keyless).
- **UI labels:** "Pyth price at 14:05:00 ET", "RedStone TSLA at 16:00:00 ET", "TSLAx token price". Never claim "official close" unless the source is an official close.

### 6.3 Phase (i): demo now, while the trial lasts (to ~2026-09-27)

| Lane | Source | Mechanics |
|---|---|---|
| **Regular-session boundaries** (5/15/60 m open and close) | **Pyth trial:** TSLA `16dad506…32f1`, QQQ `9695e2b9…452d`, VOO `236b30dd…f179` | Keeper calls `GET https://pyth.dourolabs.app/hermes/v2/updates/price/{T}?ids[]=…&encoding=base64` at T+2 s, posts to the **devnet** receiver, then calls `settle` in the same flow. Also record the RedStone `TSLA` package at T for a "second oracle agrees within X bps" badge |
| **Session close** (16:00 ET) | Pyth update with `publish_time` in [15:59:59, 16:00:00] ET, plus the RedStone `TSLA` package at 16:00:00 | Label it "oracle price at 16:00:00". Optionally void if it differs from the official close (Cboe or Yahoo `close`, fetched after 16:05) by more than 10 bps. TSLA on 09-11 would have passed: RedStone +1.2 bps |
| **Gap** (Fri close → Mon open) | Fri 16:00:00 Pyth blob (archive it immediately) vs Mon 09:30:00 Pyth update | The Monday 09:30:00 price is the first regular-session print, not the official opening cross; label it that way |
| **24/7 token lane** | Switchboard `switchboardSurgeTask TSLAX/USD` quote, **or** attested Jupiter `usdPrice` median of 3 samples at T−10 s/T/T+10 s. Check whether `Crypto.TSLAX/USD` is in the trial's 25 feeds; if so, use Pyth | Low stake caps; void if |DEX − `stockData.price`| > 2% during regular hours |

**Also do this week:**
1. **Archive** signed Hermes blobs for TSLA/QQQ/VOO at every 1-minute boundary during the trial. Test posting a 7-day-old blob on devnet.
2. **Email `data@dourolabs.xyz`** asking for a trial extension to 2026-10-02 for a Stocklana entry, citing the Cardano precedent.
3. **Try the Polymarket package.** Stripe, 30 days free; cancel before day 30. Confirm it yields a Hermes-usable key and whether on-chain posting is allowed.

### 6.4 Phase (ii): judging after the trial (~09-27 → 10-02), $0

| Lane | Primary | Backup | Notes |
|---|---|---|---|
| **Regular-session boundaries** | **RedStone** signed `TSLA`/`NVDA`/`AAPL`/… package at exactly T, verified in-program (3-of-5) | Switchboard T-committed job: median of Alpaca SIP bar (T+16 min) + Twelve Data + Tiingo | Switch the ETF markets (QQQ/VOO) to Switchboard, or swap them for NVDA/AAPL, which RedStone covers. Keeper fetches within minutes (retention ~24 h) |
| **Session close** | RedStone `TSLA` at 16:00:00 ET | Switchboard job over **official closes** (Alpaca daily bar / Twelve Data / EODHD) | Keep the "void if > 10 bps from official close" rule |
| **Gap** | RedStone Fri 16:00:00 (fetched Fri, posted any time before Mon settle) vs Mon 09:30:00 | Switchboard | The late-post rule is essential: verify the timestamp against T, not against `Clock` |
| **24/7 token lane** | Switchboard Surge `TSLAX/USD` | Attested Jupiter / RedStone `TSLA---24_7` (label: "RedStone 24/7 TSLA", not the token) | Caps as above |
| **Showcase** | Replay markets from archived Pyth blobs; optional GLXY relay | — | Demonstrates real Pyth verification after the trial |

### 6.5 Phase (iii): a credible production path

1. **Primary: Chainlink Data Streams** at $150 per stream per month (≈ $600/mo for TSLA, NVDA, SPY, QQQ regular-hours streams; more for the extended/overnight sessions and xStock token streams).
   - It is xStocks' official oracle, gives signed reports at any timestamp, and has `marketStatus` plus 24/7 `tokenizedPrice`.
   - Confirm that a self-serve subscription includes Solana access-controller allowlisting.
2. **Secondary:** RedStone under a commercial agreement, or Pyth Pro via sponsorship or revenue share. Settle on the median of 2, and void on disagreement.
3. **Official close:** Chainlink/Pyth session-aware values, cross-checked against Databento EQUS.SUMMARY (licensed, $199/mo tier).
4. **Token lane on mainnet:** Raydium CLMM observation TWAP (≥ 5 min) on the deepest xStock/USDC pool, cross-checked against Chainlink `tokenizedPrice`. Cap open interest to a small share of pool liquidity.
5. **Budget path:** start with 1–2 Chainlink streams ($150–300/mo) for the flagship markets. Keep RedStone and Switchboard for the long tail with caps, and scale as fees allow.

### 6.6 Checklist for today

- [ ] Verify the local Solana/Agave toolchain after the avm side effect (see header).
- [ ] Decide the receiver feature (`pyth-solana-receiver-sdk` default vs `pro-compatible`) and post to the matching receiver on devnet.
- [ ] Start the Pyth blob archiver (TSLA/QQQ/VOO, 1-min boundaries).
- [ ] Spike RedStone `rust-sdk v4.0.0` + anchor-lang 1.1.2/1.2.0 SBF build; verify one TSLA package against T.
- [ ] Spike Switchboard `solana-v3` verify with the index workaround; pin the queue; distinct oracles.
- [ ] Email Pyth for an extension; try the Polymarket package; email Stork for a hackathon key (adds SPY/QQQ 24/5).

---

## 7. Probe log (UTC, 2026-09-13)

| Time | Probe | Result |
|---|---|---|
| 16:52:30 | `date -u` | Sun 2026-09-13 16:52:30 |
| 16:56:32 | `GET hermes.pyth.network/v2/price_feeds?asset_type=equity` / `crypto` / all | 200 (1,249 equity, 422 crypto, 1,896 total). TSLA schedule `America/New_York;0930-1600…`, `min_channel fixed_rate@50ms`, next_open 1789392600 |
| 16:57:24 | `getMultipleAccounts` legacy push PDAs (35 feeds) on mainnet and devnet | See §1(a). TSLA/QQQ mainnet 2026-09-11 23:59:59; VOO 2026-07-02; devnet equities 2026-07-02; BTC/SOL fresh |
| ~16:58 | `getSignaturesForAddress` TSLA/QQQ/TSLAX/GLXY + `getTransaction` samples | TSLA: pre-upgrade payer `4jHcKHTf…` until 08-26 15:5xZ; new payer `95FZJmFM…` from 09-11 04Z; posted-slot block time 09-12 16:51:37Z; GLXY ~70 tx/h 08–24Z |
| ~17:00 | Payer `95FZJmFMp8uY4HXrESUa7shZBs6KZYee7TM5kYA2sSgq` balance | 0.000650506 SOL; 1,000 txs between 09-12 22:49Z and 09-13 13:47Z |
| 17:01:00 | Keyless Benchmarks TV shim / Benchmarks updates / Hermes latest (TSLA, BTC) / Pro history / Hermes metadata / Lazer symbols | 404 / 401 / 401 / 401 / **200** / **200** |
| 17:03:10 | Upgraded push program `pyt2F…` PDAs, both clusters | GLXY 23:59:34 (mainnet); TSLAX 09-12 13:15:42; TSLA/QQQ/VOO no account; devnet only BTC/SOL |
| ~17:04 | Receiver configs `rec5EK…` / `rec2HH…` on both clusters | fee 0 lamports, min_sigs 3, identical |
| 17:04–17:06 | Polymarket RTDS `wss://ws-live-data.polymarket.com` | Keyless crypto_prices frames received; **no equity_prices frames on Sunday** (UNVERIFIED in market hours) |
| 17:07:39 | `api.xstocks.fi/api/v2/public/oracles` (8 pages) | 200; 400 rows, Pyth 204 / Chainlink 196 |
| 17:08:28 | Jupiter `tokens/v2/search` TSLAx/QQQx/SPYx/NVDAx | 200; verified mints + impostors |
| 17:08:37 | `lite-api.jup.ag/price/v3?ids=…` | 200, `max-age=5`; prices in §5; `api.jup.ag` keyless 200 |
| 17:08:54 | DexScreener token-pairs TSLAx, SPYx | Pools in §5 |
| 17:09:59 | xStocks `price-data` / `system/status` / `oracles/TSLAx` | `{"quote":365.275}`, not halted; rate limit 1000/min |
| 17:12:59 | Wormhole receivers' GuardianSet index 1, both clusters | Byte-identical mainnet vs devnet (sha256 prefix `894e8b9fa421a7aa`) |
| 17:13:23 | BULL/CLOV/KSS/RCAT PDAs (both push programs, mainnet) | No accounts |
| ~17:14 | GLXY upgraded-account signatures, Fri RTH | 496 tx, median gap 52 s, p95 55 s, max 65 s |
| 17:16:32 | RedStone `…/data-packages/latest/redstone-primary-prod` + historical T−1 h | 200; 954 feeds; values in §3 |
| 17:23:41 | Yahoo v8 TSLA 1m; Cboe CDN TSLA delayed quote | Official close 365.44 (Yahoo `regularMarketPrice` @ 20:00:00Z, Cboe `close`); 19:59Z bar close 365.47 |
| ~17:24 | `getMinimumBalanceForRentExemption(134 / 1064)` | 1,330,960 / 6,055,360 lamports |
| 16:53–17:20 (sub-agent) | Switchboard queues, fees, Crossbar simulation, real `fetchQuoteIx` quotes, `cargo check` | §2 |
| 16:54–17:16 (sub-agent) | Keyless market-data probes (Yahoo, Nasdaq, Finnhub, Twelve Data demo, Massive, Tiingo, EODHD demo, Cboe, Alpaca, AV, FMP, marketdata.app, Tradier, IEX HIST) | §4 |
| 16:54–17:11 (sub-agent) | Chainlink discovery, RedStone gateways, Stork, DIA, Supra, hackathon page | §3 |

Probe scripts and raw outputs are in the session scratchpad (`pyth_probe.py`, `sigs.py`, `classify.py`, `sponsored_solana.json`, `xs_oracles_all.json`, `rs_latest.json`, `sb/…`). They are not committed.

---

## 8. UNVERIFIED items to close

- Pyth trial: exact post-trial behaviour; whether historical `/v2/updates/price/{T}` works for timestamps before the trial start; whether feeds can be swapped; whether `Crypto.TSLAX/USD` is in the 25.
- Polymarket × Pyth $99 package: API type (Hermes?), licence, feed list.
- Replaying old signed Pyth blobs on devnet (router-set rotation).
- GLXY mainnet → devnet relay, end to end; Pyth licence for relaying.
- Public-gateway licence for RedStone; semantics of `TSLA` vs `---EXTENDED` vs `---24_7`; `rust-sdk v4.0.0` SBF build with Anchor 1.1.2/1.2.0; secp256k1 CU cost.
- Switchboard: SBF build of the `solana-v3` path; slashing live; quote-account close; vendor URL shapes in the example job.
- Chainlink: whether self-serve includes Solana allowlisting; Rust crates vs Anchor 1.x.
- Licence terms for Jupiter and xStocks API reuse on-chain.
- Raydium TWAP manipulation cost on xStock pools; Orca TWAP absence.
- Finnhub free `/quote` venue; Databento full terms and per-GB pricing; which 5% venues Twelve Data uses.
- Band equities announcement; Stork per-update lamport fee.

---

## Sources

**Pyth**
- https://docs.pyth.network/price-feeds/core/push-feeds/solana (+ `.md`)
- https://docs.pyth.network/price-feeds/core/upgrade/contracts
- https://docs.pyth.network/price-feeds/core/upgrade/how-it-works
- https://docs.pyth.network/price-feeds/core/upgrade/preparing
- https://docs.pyth.network/price-feeds/core/contract-addresses/solana
- https://docs.pyth.network/price-feeds/pro/pyth-terminal
- https://docs.pyth.network/price-feeds/pro/acquire-api-key
- https://docs.pyth.network/price-feeds/pro/mcp
- https://www.pyth.network/pricing
- https://www.pyth.network/blog/the-pyth-core-upgrade
- https://www.pyth.network/blog/extended-hours-us-equity-data-moves-to-pyth-pro
- https://www.pyth.network/blog/pyth-pro-for-ai-agents-institutional-market-data-for-autonomous-finance
- https://www.pyth.network/blog/pyth-ecosystem-grants-program
- https://forum.pyth.network/t/pyth-pro-individual-tier/2534
- https://forum.pyth.network/t/community-hackathon-post-mortem/2518
- https://intersectmbo.org/news/pyth-pro-on-cardano-subscription-offer
- https://x.com/PythNetwork/status/2040370586518519987
- https://docs.polymarket.com/market-data/websocket/rtds
- https://crates.io/crates/pyth-solana-receiver-sdk (2.0.0 `src/lib.rs`, `pro-compatible` feature)
- Live: `hermes.pyth.network/v2/price_feeds`, `pyth.dourolabs.app/hermes`, `history.pyth-lazer.dourolabs.app/v1/symbols`, `benchmarks.pyth.network`

**Switchboard**
- https://docs.switchboard.xyz/custom-feeds/advanced-feed-configuration/data-feed-variable-overrides.md
- https://docs.switchboard.xyz/custom-feeds/task-types.md
- https://docs.switchboard.xyz/custom-feeds/advanced-feed-configuration/feed-parameter-units.md
- https://docs.switchboard.xyz/custom-feeds/advanced-feed-configuration/oracle-aggregator.md
- https://docs.switchboard.xyz/tooling/crossbar.md
- https://docs.switchboard.xyz/tooling/sdk-version-matrix.md
- https://docs.switchboard.xyz/docs-by-chain/solana-svm/surge.md
- https://docs.switchboard.xyz/docs-by-chain/solana-svm/prediction-market/prediction-market-tutorial.md
- https://docs.switchboard.xyz/docs-by-chain/solana-svm/price-feeds/basic-price-feed.md
- https://docs.switchboard.xyz/how-it-works/technical-architecture/trusted-execution-environments-tees.md
- https://docs.switchboard.xyz/how-it-works/switchboard-protocol/re-staking/the-switchboard-ncn.md
- https://crates.io/api/v1/crates/switchboard-on-demand
- https://crates.io/api/v1/crates/anchor-lang
- https://registry.npmjs.org/@switchboard-xyz/on-demand
- https://registry.npmjs.org/@switchboard-xyz/common
- https://github.com/switchboard-xyz/solana-sdk (PRs #187, #189)
- https://github.com/switchboard-xyz/sb-on-demand-examples
- https://crossbar.switchboard.xyz

**Other oracles**
- https://docs.chain.link/data-streams/sign-up
- https://docs.chain.link/data-streams/billing
- https://docs.chain.link/data-streams/tutorials/solana-onchain-report-verification
- https://docs.chain.link/data-streams/reference/data-streams-api/interface-api
- https://docs.chain.link/data-streams/market-hours
- https://docs.chain.link/data-streams/rwa-streams/24-5-us-equities-user-guide
- https://docs.chain.link/data-streams/reference/report-schema-v10
- https://chain.link/blog/chainlink-24-5-us-equities-streams
- https://api.dataengine.chain.link/api/v1/discovery
- https://docs.chain.link/data-feeds/tokenized-equity-feeds/ondo
- https://docs.redstone.finance/docs/technical-reference/non-evm-chains/solana/price-adapter/
- https://github.com/redstone-finance/redstone-oracles-monorepo
- https://github.com/redstone-finance/rust-sdk (`crates/redstone/Cargo.toml` on `main`: v4.0.0; tag 2.0.1)
- https://blog.redstone.finance/2026/03/30/redstone-live-real-time-data-built-for-the-markets-that-never-sleep/
- https://blog.redstone.finance/2026/07/20/the-redstone-stack-solving-the-infrastructure-problems-a-price-feed-cant/
- https://github.com/Stork-Oracle/Documentation
- https://github.com/Stork-Oracle/stork-external
- https://www.diadata.org/docs/llms.txt
- https://docs.supra.com/oracles/data-feeds/pull-oracle/networks
- https://hackathons.solana.com/hackathons/stocklana
- Live: `oracle-gateway-2.a.redstone.finance`, `api.diadata.org`

**xStocks, Jupiter, DEX**
- https://docs.xstocks.fi/developers
- https://docs.xstocks.fi/apis/openapi.md
- https://docs.xstocks.fi/llms.txt
- https://api.xstocks.fi/api/v2/public/oracles
- `https://api.xstocks.fi/api/v2/public/assets/TSLAx/price-data`
- https://dev.jup.ag/docs/price/v3.md
- https://dev.jup.ag/docs/llms.txt (rate limits, plans)
- https://api.dexscreener.com/token-pairs/v1/solana/{mint}
- https://github.com/raydium-io/raydium-clmm/blob/master/programs/amm/src/states/oracle.rs

**Market data and licensing**
- Alpaca: https://docs.alpaca.markets/us/docs/about-market-data-api.md, https://docs.alpaca.markets/us/docs/market-data-faq.md, https://docs.alpaca.markets/us/docs/real-time-stock-pricing-data.md, https://files.alpaca.markets/disclosures/library/TermsAndConditions.pdf
- Finnhub: https://finnhub.io/pricing, https://finnhub.io/terms-of-service
- Twelve Data: https://twelvedata.com/pricing.md, https://twelvedata.com/terms, https://support.twelvedata.com/en/articles/9935903-us-equities-market-data
- Massive: https://massive.com/pricing, https://massive.com/legal/individuals-terms-of-service, https://massive.com/legal/businesses-terms-of-service, https://massive.com/blog/polygon-is-now-massive
- Tiingo: https://www.tiingo.com/about/pricing, https://www.tiingo.com/documentation/iex
- EODHD: https://eodhd.com/pricing, https://eodhd.com/commercial-pricing, https://eodhd.com/financial-apis/terms-conditions
- Databento: https://databento.com/pricing, https://databento.com/blog/databento-us-equities-mini-now-available, https://databento.com/blog/understanding-exchange-fees
- IEX: https://www.iex.io/resources/trading/fee-schedule, https://www.iex.io/legal/hist-data-terms
- Nasdaq, UTP, CTA, Cboe: https://www.nasdaqtrader.com/content/AdministrationSupport/Policy/USEquitiesandOptionsDataPolicies.pdf, https://www.nasdaqtrader.com/content/ProductsServices/PriceList/Nasdaq_US_Equities_Price_List_2025.pdf, https://www.utpplan.com/DOC/datapolicies.pdf, https://www.ctaplan.com/publicdocs/ctaplan/notifications/trader-update/Policy%20-%20Delayed%20Market%20Data.pdf, https://cdn.cboe.com/resources/membership/US_Market_Data_Product_Price_List.pdf
- Others: https://www.alphavantage.co/premium/, https://site.financialmodelingprep.com/pricing-plans, https://www.marketdata.app/pricing/, https://docs.tradier.com/docs/market-data, `query1.finance.yahoo.com/v8/finance/chart`, `cdn.cboe.com/api/global/delayed_quotes/quotes/TSLA.json`

**Solana RPC**
- https://api.mainnet-beta.solana.com
- https://api.devnet.solana.com
