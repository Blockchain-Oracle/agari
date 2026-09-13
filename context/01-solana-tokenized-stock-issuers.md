# 01 — Tokenized-Stock Issuers & Tokens on Solana (as of 2026-09-13)

> Research brief for the Stocklana hackathon (Solana Foundation, $100k, submissions close **Fri 2026-09-18 4:00pm ET**, judging through Oct 2). Team is building a **stock-price prediction market** and is new to tokenized stocks.
>
> Method: everything below was checked against live sources on 2026-09-13. Items marked **[on-chain verified]** were read directly from Solana mainnet/devnet RPC or the issuer's public API. Items marked **UNVERIFIED** could not be confirmed from a primary source.

---

## 0. TL;DR

- **Three issuers matter for trading on Solana right now:** **xStocks** (Backed, now owned by Kraken; 832 assets), **Ondo Stocks** (formerly Ondo Global Markets; ~440 assets), and **Backpack Securities via Sunrise** (~44 stocks, including SpaceX `SPCX`). Smaller or special cases:
  - **Superstate Opening Bell** (GLXY, FWDI, EXOD, HSDT) and **Securitize** (SECZ): real SEC-registered shares, but allowlisted wallets only.
  - **PreStocks** and **Tessera**: pre-IPO tokens.
  - **Remora Markets**: shut down Feb 2026.
  - **Robinhood** is **not on Solana**. Its tokens live on its own Arbitrum L2, Robinhood Chain, which is now Solana's main competitor.
  - **Dinari** has not launched on Solana yet ("coming soon").
- **All the major Solana stock tokens are Token-2022 mints** with `ScaledUiAmount` (dividends and splits), `Pausable`, `PermanentDelegate`, `MetadataPointer`/`TokenMetadata`, and a `TransferHook` whose program is **not set** (unset hook). Decimals differ by issuer: xStocks 8, Ondo 9, Backpack 6.
- **The multiplier is a trap.** The raw on-chain balance never changes. Display value = raw × multiplier. The multiplier can be scheduled ahead (`newMultiplier` + timestamp), so the `multiplier` field alone can be stale (SPYx example in §2).
- **Tokens trade 24/7 on Solana DEXs, but the underlying market does not.** xStocks primary mint/redeem runs 24/5 (issuance limit is $0 when the market is closed). Ondo added 24/7 mint/redeem for 6 tickers on 2026-06-25. On a weekend, the price-data endpoint of the xStocks API returned `{"quote":null}` (observed 2026-09-13, a Sunday).
- **Scale:**
  - Solana cumulative tokenized-stock volume passed **$10B in June 2026** (confirmed), with a daily record of $683M.
  - Solana tokenized-stock value was ~**$1.85B** (July 20), and total Solana RWA value is **$4.26B** (Sept 13, rwa.xyz).
  - Globally, tokenized stocks are $2.85B distributed value, with $13.5B monthly transfer volume.
  - Solana's share is falling since Robinhood Chain launched on July 1: 95% in June → 82% in July.
- **Devnet:** there is **no public faucet or devnet token list** from any issuer. However, xStocks' *undocumented-for-public* dev API (`api.dev.backed.fi`) lists **113 Token-2022 xStocks mints that really exist on devnet**, plus a devnet "bUSDC". Almost all have **zero supply** and Backed holds the mint authority, so you can't get balances. Realistic plan: **read mainnet prices and metadata, and deploy your own mock Token-2022 mints on devnet** that copy the real extension set.
- **Regulation:** xStocks, Ondo and Backpack all exclude US persons (and several other countries). A binary contract on a *single stock's price* is very likely a **security-based swap (SEC)**, not a CFTC event contract. Polymarket (international) runs daily TSLA/NVDA/AAPL Up/Down markets and geoblocks the US. Kalshi and Robinhood stick to **indices** (S&P) and company KPIs, and Kalshi is now asking **both SEC and CFTC** for single-stock perps.

---

## 1. Issuers / platforms with tokenized equities on Solana

### 1.1 Summary table

| Issuer / platform | Ticker style (Solana) | # assets | Structure | Who can hold / buy | Primary mint/redeem | Main Solana liquidity | Size |
|---|---|---|---|---|---|---|---|
| **xStocks** (Backed Assets (JE) Ltd; Backed acquired by **Kraken**, announced 2025-12-02) | `TSLAx`, `NVDAx`, `SPYx` … mint addresses start with `Xs…` | **832** in public API, all deployed on Solana **[API verified]**; "700+" in Kraken Wallet | 1:1-backed tracker certificate (Swiss ISINs, e.g. TSLAx = CH1436219252). Price exposure only, **no voting or ownership rights** | Non-US. **Excluded: US, Canada, UK, Australia**, sanctioned countries. Available in 110+ countries | Onboarded clients only (API key): **Market flow** (send USDC/USDG/USDT to a sweeping address), **xChange atomic RFQ** (partially signed Solana tx), **xPort in-kind** via Alpaca. Min order $1,000 in API limits | Raydium (main AMM), Jupiter, Kamino (collateral). CEX: Kraken, Bybit, Gate. Kraken Wallet | $38B total tx volume (as of 2026-08-29); ~$500M AUM and 190k+ holders (Aug 2026); $416M on Solana (rwa.xyz, 2026-09-13) |
| **Ondo Stocks** (renamed from Ondo Global Markets, July 2026; issuer Ondo Global Markets (BVI) Ltd) | `NVDAon`, `TSLAon`, `SPYon` … mint addresses end with `…ondo` | 438+ total; **442 on Solana** (rwa.xyz) | "Total-return tracker": economic exposure incl. dividends (less withholding). **"Not themselves stocks"**, no right to underlying | Non-US (Reg S) plus many restricted countries; professional-investor-only in EEA, UK, CH, SG, HK and others | Ondo app/API (onboarding required). USDC in / out with a **signed attestation (secp256k1) and Pyth price sanity check**. 24/5 normally; **24/7 for SPYon, QQQon, CRCLon, NVDAon, TSLAon, GOOGLon since 2026-06-25** | **Jupiter RFQ** (just-in-time mint/redeem). AMM pool liquidity on Solana is tiny (Jupiter shows $0–$10k for top Ondo mints) | $1B+ TVL across chains; $20B+ cumulative volume (Jul 2026); $299M on Solana (rwa.xyz, 2026-09-13) |
| **Backpack Securities via Sunrise** (Sunrise = Wormhole Labs listing and liquidity protocol) | **Plain tickers**, no suffix: `SPCX`, `MU`, `MSTR`, `HOOD`… (vanity mint prefixes such as `SPCX…`, `MU…`) | **44 stock/ETF tokens** in Sunrise API (issuer `backpack_securities`) **[API verified]** | **UCC Article 8 security entitlements** (NY law) held through a US broker-dealer, 1:1, **redeemable for the real share** (ACATS). Cash dividends and corporate actions supported | **Reg S, non-US only**. Backpack unavailable in US, UK, UAE, Japan, EU region | Backpack account (KYC). Deposit tokens to redeem | Sunrise distribution to DEXs and wallets; Jupiter | SPCX: $108M volume on IPO day (2026-06-12), $350M+ cumulative. Tokenized MU $530M+ cumulative in 6 weeks |
| **Superstate Opening Bell** | `GLXY`, `FWDI`, `EXOD`, `HSDT` on Solana (SBET is on Ethereum) | 4 on Solana | **Actual SEC-registered shares**; Superstate is the registered transfer agent. On-chain proxy voting for GLXY | Supported jurisdictions, no accreditation needed, **but the wallet must be allowlisted** (mint default account state = `frozen`) **[on-chain verified]** | Via Superstate; DRS transfer from a brokerage | Kamino (collateral); select DeFi | $47.4M (rwa.xyz global) |
| **Securitize (SECZ)** | `SECZ` | 1 equity (own stock) | Issuer-sponsored tokenized common stock (same class as NYSE listing, 2026-07-02) | **Eligible US investors** via Securitize (KYC); allowlist (`defaultAccountState: frozen`) **[on-chain verified]** | Securitize platform | Limited / permissioned | SECZ is the largest single tokenized stock at $214M (rwa.xyz) |
| **PreStocks** | `SPACEX`, `OPENAI`, `ANTHROPIC` … (mint addresses start `Pre…`) | ~50 pre-IPO names (UNVERIFIED count) | SPV holds private shares; token tracks valuation. **In May 2026 OpenAI and Anthropic said SPV transfers are invalid**; tokens fell ~35–40% | No KYC for P2P DEX trading; KYC to mint/redeem | PreStocks | Jupiter (Stocks tab) | $414.7M volume since Sept 2025 launch |
| **Tessera** | `tSpaceX` | 1 (UNVERIFIED if more) | Tokenized SpaceX exposure launched Feb 2026; 0.2% fee via Token-2022 transfer fee; custom Chainlink feed | UNVERIFIED | UNVERIFIED | Jupiter | ~$665k mcap on Jupiter (2026-09-13) |
| **Remora Markets** (rStocks) | `…r` | — | Was 1:1 backed | — | **Shut down Feb 2026** after the Step Finance hack; redemption process for holders | — | — |
| **Robinhood Stock Tokens** | — | 189 assets (rwa.xyz, global) | ERC-20 (18 dec) debt securities by Robinhood Assets (Jersey) | Non-US | — | **NOT on Solana.** Lives on **Robinhood Chain** (Arbitrum Orbit L2, mainnet 2026-07-01) | $4.3B 30-day stock volume on Robinhood Chain (early Sept 2026) |
| **Dinari** (dShares) | — | 724 (full S&P 500) | 1:1 broker-dealer backed; **US investors eligible** | US-eligible | — | **Not live on Solana** ("Solana and Sei coming soon", 2026-08-04) | ~$10M |
| **Binance bStocks** | `CRCLB`, `TSLAB`… | 74 | 1:1 (BTech Holdings) | Binance eligible users | — | BNB Chain (not Solana, per launch PR) | $626M (rwa.xyz) |
| **Bitget Reality** (rTokens) | `rAAPL`, `rTSLA`… | 1,695 (rwa.xyz) | 1:1 via FINRA broker-dealer | — | — | **Chain(s) UNVERIFIED**; no Solana evidence found | $153M |
| **Others mentioned on Solana in 2026 roundups** | Bullish `BLSH` (regulated secondary trading, Aug 2026), Figure `FGRS` ($201M in the July Solana breakdown), Kazakhstan SOLZ, Exodus Markets | — | — | — | — | — | — |
| **R3** | — | — | **Not an equity issuer.** Corda Protocol = RWA yield vaults on Solana (credit, treasuries) | — | — | — | — |

### 1.2 Market statistics (latest available)

| Metric | Value | Date / source |
|---|---|---|
| Solana cumulative tokenized-stock volume | **> $10B** (up ~180% in one month) | June 2026, crossed by ~June 23 — Solana June roundup, COINOTAG |
| Solana daily tokenized-stock volume ATH | **$683M** | June 2026 — Solana June roundup |
| Solana weekly volume / share | $1.29B, **~95%** of all on-chain tokenized-equity trading | mid-June 2026 |
| Solana tokenized-stock trading volume H1 2026 | $4.9B (6× H2 2025's $775M) | CryptoBriefing/KuCoin |
| Solana tokenized stocks, distributed value | **$1.85B**, $8.28B monthly transfer volume, 538,740 holders; Ondo 46.6%, xStocks 26.4%, Securitize 12.2%, Figure 10.9% | 2026-07-20 — rwa.xyz via Solana Compass |
| Solana total RWA value | **$4.26B**, 563k holders, $4.49B monthly transfer volume | 2026-09-13 — rwa.xyz |
| Solana share of global tokenized-equity market | **82%** (down from 95% after Robinhood Chain launch) | July 2026 — Solana Compass/Kraken |
| Global tokenized stocks | $2.85B distributed, $13.5B monthly transfer volume, 3.31M holders, 5,880 assets | 2026-09-13 — rwa.xyz/stocks |
| Global ranking by value | Ondo $832M · bStocks $626M · xStocks $608M · Securitize $279M · Reality $153M · Robinhood $146M · Figure $86M · Superstate $47M | 2026-09-13 — rwa.xyz |
| Raydium cumulative tokenized-stock volume | $4B | Aug 2026 roundup |
| Robinhood Chain vs Solana DEX | Robinhood Chain $29.7M/day avg stock DEX volume vs xStocks $11.1M + Sunrise $13.4M | early Sept 2026 — CryptoBriefing |

---

## 2. Token mechanics that matter to developers

### 2.1 Extensions (read from mainnet RPC on 2026-09-13) **[on-chain verified]**

All are owned by the Token-2022 program `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`.

| Extension | TSLAx / SPYx (xStocks) | MU (Backpack) | NVDAon (Ondo) | GLXY (Superstate) | SECZ (Securitize) |
|---|---|---|---|---|---|
| decimals | **8** | **6** | **9** | 6 | 6 |
| `ScaledUiAmountConfig` | ✅ (TSLAx mult 1; SPYx 1.0039 → **new 1.0057 effective 2026-06-18**) | ✅ (1.000107) | ✅ (1.001715) | ✅ (1) | ✅ (1) |
| `PausableConfig` | ✅ | ✅ | ✅ | — | ✅ |
| `PermanentDelegate` | ✅ | ✅ | — | ✅ | ✅ |
| `DefaultAccountState` | `initialized` (permissionless) | `initialized` | `initialized` | **`frozen` (allowlist)** | **`frozen` (allowlist)** |
| `TransferHook` | authority set, **programId = null** (inactive) | same | same | — | — |
| `ConfidentialTransferMint` | initialized, not auto-approved | same | same | — | — |
| `MetadataPointer` + `TokenMetadata` | ✅ uri `xstocks-metadata.backed.fi/...` | ✅ | ✅ uri `app.ondo.finance/api/v2/assets/.../sol_metadata.json` | ✅ uri `api.superstate.com/...` | ✅ |
| freeze authority | set | set | set | set | set |

What this means for you:
- **Composability.** xStocks, Ondo and Backpack tokens can be held by any wallet or PDA today: no allowlist, and the transfer hook is not active. Your program can custody them in a vault. Superstate and Securitize tokens **cannot** be held unless the issuer thaws or allowlists the account.
- **Admin powers.** Every issuer can **pause** transfers, and most can **move tokens out of any account** (permanent delegate). A vault holding stock tokens carries that issuer risk, and an issuer "pause" would freeze your settlement. Plan for it (e.g. cash-settle in USDC instead of delivering tokens).
- **Hook can be switched on later.** Because the hook authority exists, an issuer could later attach a hook such as a blocklist. Your transfer CPI should use Token-2022 `transfer_checked` with extra-account resolution so it keeps working.
- **Token-2022 is required.** Your Anchor/Rust code must use `token_interface`, not the legacy `token` program.

### 2.2 Dividends and splits: `ScaledUiAmount`

- **Raw balance never changes.** UI amount = raw amount × multiplier. Dividends are **reinvested** (multiplier goes up), splits raise the multiplier, reverse splits lower it (xStocks docs).
- **Pending updates.** The issuer can schedule `newMultiplier` with `newMultiplierEffectiveTimestamp`. At or after that timestamp the new value applies even if the `multiplier` field hasn't been rewritten. Always compute with both fields, or call `AmountToUiAmount` / `UiAmountToAmount` (Solana docs). The math is floating point and **not guaranteed to round-trip**.
- **Can't combine with interest-bearing.** A mint cannot have both `ScaledUiAmount` and `InterestBearingConfig`.
- **Price feeds already include it.** Pyth and xStocks price feeds quote **per share of the underlying**. The token's value per *raw* unit is `price × multiplier`. If you compare DEX price to the stock price, or settle "TSLA closes above $X", decide which one you mean and be explicit.
- **Where to read the multiplier.** xStocks exposes current and historical multipliers: `GET https://api.xstocks.fi/api/v2/public/assets/{symbol}/multiplier?network=Solana` and `/multiplier/history` (AAPLx = 1.00327 on 2026-09-13).
- **Other issuers.** Ondo tokens are total-return trackers (dividends less withholding) and also move the multiplier. Backpack says cash dividends and corporate actions are "reflected in tokenized form" (MU's multiplier is > 1, so it also uses the multiplier). Superstate and Securitize are real shares; their dividend mechanics on Solana are UNVERIFIED.

### 2.3 Trading hours and weekend gaps

- **DEXs never close.** Solana DEXs (Raydium, Jupiter) trade all stock tokens **24/7**.
- **xStocks trading modes** (API field `trading.tradingHoursMode`): 732 assets `TwentyFourFive`, 87 `Regular`, 10 `MarketHours`, 1 `Always`.
  - `limitsPerPeriod.closed.maxOrderFiatValue = 0`: **no primary issuance or redemption while the market is closed**.
  - Overnight session is supported (Blue Ocean ATS pricing).
  - On Kraken (CEX), only 10 xStocks trade 24/7 (TSLAx, QQQx, SPYx, NVDAx, CRCLx, AAPLx, HOODx, MSTRx, GLDx, GOOGLx); the rest are 24/5.
- **Weekends.** Market makers price using ATS venues, index futures and internal models, with wider spreads. Kraken claims the gap at Monday open is "historically under 1%". This is a Kraken claim, not independently verified.
- **Ondo** added **24/7 mint/redeem** (2026-06-25) for SPYon, QQQon, CRCLon, NVDAon, TSLAon and GOOGLon, which keeps weekend arbitrage possible for those six. Pricing source on weekends: UNVERIFIED.
- **Backpack Securities** markets "real US stocks 24/7 including weekends."
- **Observed:** `GET /public/assets/TSLAx/price-data` returned `{"quote":null}` on Sunday 2026-09-13. The official price feed goes empty when the market is closed.
- **Weekend volume is real.** Tokenized stocks traded >$1B across chains over Labor Day weekend 2026.

### 2.4 Oracles relevant to stocks on Solana

- **Pyth and Chainlink feeds.** The xStocks API (`GET https://api.xstocks.fi/api/v2/public/oracles`, paginated) lists **400 feeds**. On Solana there are **52 Pyth pull feeds** (with Pyth Lazer IDs and Hermes IDs, e.g. GLDx) and **14 Chainlink feeds** covering the big names (AAPLx, NVDAx, TSLAx, SPYx, QQQx, METAx, MSFTx, SPCXx…).
- **Chainlink hours.** Chainlink runs 24/5 US-equity feeds that include pre-market and after-hours.
- **Polymarket uses Pyth for resolution.** Its stock Up/Down markets resolve on **Pyth `Equity.US.<TICKER>/USD`**, using the 1-minute candle close at the last minute of regular hours.

---

## 3. Mint addresses (mainnet) and devnet situation

### 3.1 Canonical mainnet mints **[verified via xStocks API / Sunrise API / Jupiter verified tag]**

Scammers clone names and tickers (Jupiter search for "TSLAx" returns several pump.fun fakes). **Always key by mint address, never by ticker.**

**xStocks** (Token-2022, 8 decimals). Source: `api.xstocks.fi/api/v2/public/assets`

| Symbol | Mint | Jupiter liquidity (2026-09-13) |
|---|---|---|
| TSLAx | `XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB` | ~$1.35M |
| NVDAx | `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` | ~$1.82M |
| AAPLx | `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` | ~$0.90M |
| SPYx | `XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W` | ~$4.16M |
| QQQx | `Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ` | ~$1.74M |
| SPCXx (SpaceX) | `Xs3oZwbHvqis4NYcf4YKWmEia2eC84wSiVrcYcTqpH8` | ~$1.00M |
| GOOGLx | `XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN` | |
| METAx | `Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu` | |
| AMZNx | `Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg` | |
| MSFTx | `XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX` | |
| MSTRx | `XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ` | |
| CRCLx | `XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1` | |
| HOODx | `XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg` | |
| COINx | `Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu` | |
| AMDx | `XsXcJ6GZ9kVnjqGsjBnktRcuwMBmvKWh8S93RefZ1rF` | |
| PLTRx | `XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4` | |
| GLDx | `Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re` | |
| MUx | `XsQLZycSZ7QnBBdBXQaTbQdiUcbRqjNJgyBGAMzhHav` | |
| STRCx | `Xs78JED6PFZxWc2wCEPspZW9kL3Se5J7L5TChKgsidH` | |

**Ondo Stocks** (Token-2022, 9 decimals). Source: Jupiter verified + `ondo` tag. Note the thin AMM liquidity: trades route through RFQ.

| Symbol | Mint |
|---|---|
| NVDAon | `gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo` |
| TSLAon | `KeGv7bsfR4MheC1CkmnAVceoApjrkvBhHYjWb67ondo` |
| SPYon | `k18WJUULWheRkSpSquYGdNNmtuE2Vbw1hpuUi92ondo` |
| QQQon | `HrYNm6jTQ71LoFphjVKBTdAE4uja7WsmLG8VxB8ondo` |
| AAPLon | `123mYEnRLM2LLYsJW3K6oyYh8uP1fngj732iG638ondo` |
| CRCLon | `6xHEyem9hmkGtVq6XGCiQUGpPsHBaoYuYdFNZa5ondo` |
| GOOGLon | `bbahNA5vT9WJeYft8tALrH1LXWffjwqVoUbqYa1ondo` |
| MUon | `Fz9edBpaURPPzpKVRR1A8PENYDEgHqwx5D5th28ondo` |
| SPCXon | `wzAyQTorWyoVXuJKj2x8EqKEGJpS13z6EWE9z5Aondo` |

**Backpack Securities / Sunrise** (Token-2022, 6 decimals). Source: `api.sunrise.xyz/v1/tokens?limit=200`

| Symbol | Mint |
|---|---|
| SPCX (SpaceX) | `SPCXxcqXj6e5dJDVNovHN8744zkbhM2bYudU45BimGb` (Jupiter liquidity ~$0.70M) |
| MU | `MUxEsUKSMACyw5fZf68wxf5FLnZVhtU9CwH8uNNGay1` (~$2.26M) |
| MSTR | `MSTRdWXMeZxdE8osAQy3fA4rvTY5rgummDSMEx6U7Nz` |
| HOOD | `HooDYv5RewLRiMLnEVq3VJqdqxhuE6c5eYvqejMC3e9A` |
| SNDK | `SNDKbwMUQvZhnLnxLduradgLHG5KrPuKwpnrkkGRhfH` |
| INTC | `iNTCy1qTsUEZQe3DSocLz1ZXXai34Gdw8THQh5rxFaF` |
| LLY | `LLYuwZ33keFihgwoxXsBawy31AiRFLFSva32TYq5TvD` |
| MRNA | `MRNAzXzhNcaEXJPibHEn8cd4vyekCDiivTyEwswLUCT` |

**Other**

| Token | Mint |
|---|---|
| Superstate GLXY | `2HehXG149TXuVptQhbiWAWDjbbuCsXSAtLTB5wc2aajK` |
| Securitize SECZ | `5VzwKkvynPJzcgwhBe7ESEyNgqMbo15yBu7Sehssd9ED` |
| PreStocks SPACEX | `PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh` |
| PreStocks OPENAI | `PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF` |
| PreStocks ANTHROPIC | `Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw` |
| Tessera tSpaceX | `TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v` |

> **Same underlying, different tokens.** SpaceX exists as `SPCXx` (xStocks), `SPCX` (Backpack), `SPCXon` (Ondo), `SPACEX` (PreStocks, pre-IPO) and `tSpaceX` (Tessera). Micron exists as `MUx`, `MU` and `MUon`. Each has different legal claims, decimals and prices.

### 3.2 Devnet / test tokens

- **No issuer publishes a devnet token list or faucet.** Nothing found in xStocks, Ondo, Backpack/Sunrise, Superstate or Solana Foundation docs; the Solana faucets only give SOL.
- **Found: xStocks has a dev environment on devnet.** The xStocks OpenAPI page lists servers `api.dev.backed.fi` and `api.stage.backed.fi`. `https://api.dev.backed.fi/api/v2/public/assets` returns 119 assets with **113 Solana deployments, and all 113 mints exist on Solana devnet** **[devnet RPC verified]**. They use the same Token-2022 extension set and 8 decimals as mainnet.
  - Example: devnet SPYx `XsZrvgojvnVmSqbWfzP4zFkEYKhwmuk7SPZk75MP2PT`.
  - Devnet "bUSDC" (Token-2022): `9kf33T7pxFnPS2aFM3mi5e6ah6G7yCYnonbeLkgXRiVt`.
  - **But 106 of 113 have zero supply** (SPYx included). Only test assets such as `TCENTx`, `bAAPL`, `TBLLx`, `TT_1_00` have supply, and the mint authority belongs to Backed. **You cannot get these tokens without a Backed client account.** This environment is not advertised publicly and may change without notice.
  - The dev API's `/multiplier` endpoint returns values (e.g. dev SPYx 1.0602), which is handy for testing multiplier handling.
- **Ondo:** its program repo builds with a `--features devnet` flag, but **no live devnet addresses** are published. API access requires emailing onboarding@ondo.finance.
- **What hackathon teams actually do** (confirmed by public Stocklana repos: TAPE, ShareLens, ExDate and Baskets use mainnet reads; Erodoro and xStocks-Portfolio-Autopilot use devnet mocks):
  1. **Read mainnet for real data:** the xStocks public API (assets, multiplier, price-data, oracles), Pyth `Equity.US.*` feeds, Jupiter price/quote APIs, and RPC reads of mainnet mints.
  2. **Deploy mock Token-2022 mints on devnet** that copy the real config (8 decimals, `ScaledUiAmount`, `Pausable`, `PermanentDelegate`, metadata), so vault and settlement code faces the same edge cases. Run your own "multiplier update" instruction to simulate a dividend.
  3. **Settle in USDC or a mock USDC.** Use real stock tokens only for optional mainnet demos with tiny sizes (TAPE's demo does a 10 USDC mainnet swap via Jupiter).
  4. **Oracles:** Pyth price feeds are available on devnet (general Pyth availability; stock-feed coverage on devnet is UNVERIFIED). Many teams pull Hermes or Pyth Lazer prices off-chain and post-verify on-chain.

---

## 4. Official developer resources

| Resource | URL | Notes |
|---|---|---|
| xStocks developer docs | https://docs.xstocks.fi/developers | Token standards, issuance flows, multipliers, price feeds, bridge (Chainlink CCIP). WebFetch returns 403; use a browser user agent |
| xStocks API quickstart | https://docs.xstocks.fi/developers/quickstart | Public endpoints need no auth. Base URL is `https://api.xstocks.fi/api/v2` (docs examples show `api.backed.fi`) |
| xStocks multiplier guide | https://docs.xstocks.fi/developers/multipliers | Dividends (DVCA), splits (SPLF), reverse splits (SPLR) |
| xStocks xChange (atomic RFQ) | https://docs.xstocks.fi/developers/xchange-atomic-rfq | Solana flow: partially signed VersionedTransaction plus a memo. API key required |
| xStocks API reference / changelog | https://docs.xstocks.fi/apis/openapi · https://docs.xstocks.fi/changelog | v2.0.0 (2026-03-05) added oracles, price-data, multiplier history, proof of reserves |
| Useful public endpoints | `GET /public/assets` (paginated, 832) · `/public/assets/{sym}` · `/public/assets/{sym}/multiplier?network=Solana` · `/multiplier/history` · `/public/assets/{sym}/price-data` · `/public/oracles` · `/public/proof-of-reserves/{sym}` | Verified live 2026-09-13 |
| xStocks DeFi dashboard / bridge | https://defi.xstocks.fi | |
| Ondo Stocks API | https://docs.ondo.finance/api-reference/overview | REST + gRPC streaming; prices, OHLC, mint/redeem attestations; **access by request** |
| Ondo Solana program (BUSL-1.1) | https://github.com/ondoprotocol/global-markets-solana | Anchor; Token-2022; USDC mint/redeem with attestation; Pyth checks; rate limits; whitelist roles |
| Ondo eligibility | https://docs.ondo.finance/ondo-global-markets/eligibility | |
| Sunrise token list (Backpack stocks) | `https://api.sunrise.xyz/v1/tokens?limit=200` | Undocumented but public; includes `issuer` and `assetClass` fields |
| Sunrise / Backpack explainers | https://learn.backpack.exchange/articles/what-is-sunrise · https://learn.backpack.exchange/articles/what-is-backpack-securities | |
| Superstate tokenized equities | https://docs.superstate.com/investors/tokenized-equities.md · https://superstate.com/assets | Allowlist required |
| Solana ScaledUiAmount docs | https://solana.com/docs/tokens/extensions/scaled-ui-amount | Plus QuickNode guide: https://www.quicknode.com/guides/solana-development/spl-tokens/token-2022/scaled-ui-amount |
| Solana xStocks case study | https://solana.com/news/case-study-xstocks | Extensions, venues |
| Solana tokenization hub | https://solana.com/solutions/tokenization | (`solana.com/rwa` returns 404) |
| Solana monthly roundups (stats) | https://solana.com/news/solana-ecosystem-roundup-june-2026 · https://solana.com/news/solana-ecosystem-roundup-august-2026 | |
| rwa.xyz dashboards | https://app.rwa.xyz/stocks · https://app.rwa.xyz/networks/solana · https://app.rwa.xyz/platforms/backed-finance-xstocks | |
| Jupiter token / price / swap APIs | `https://lite-api.jup.ag/tokens/v2/search?query=…` (tags `xstocks`, `ondo`, `backpack`, `prestocks`) · `/price/v3` · Ultra `/ultra/v1/order` | Used by several Stocklana repos |
| Pyth equity feeds | https://docs.pyth.network/price-feeds/core/push-feeds/solana · https://pythdata.app/explore/Equity.US.NVDA%2FUSD | |
| Chainlink market hours | https://docs.chain.link/data-streams/market-hours | |
| **Stocklana page** | https://hackathons.solana.com/hackathons/stocklana | Lists categories and judging criteria; **no issuer, API or dev-resource links** on the page. No Stocklana-specific developer guide found |

---

## 5. Regulatory and geographic constraints

### 5.1 Token-level
- **xStocks:** not for US, Canada, UK or Australia residents, nor sanctioned countries.
- **Ondo Stocks:** prohibited for US persons (Reg S Rule 902), Canada and a sanctions list; professional or qualified investors only in EEA, UK, Switzerland, Singapore, Hong Kong, Malaysia and Brazil.
- **Backpack Securities:** Reg S non-US; not in US, UK, UAE, Japan or Backpack EU.
- **Superstate and Securitize:** real registered shares, open to US investors but only through KYC'd, allowlisted wallets. Not freely composable.
- **Dinari:** the only US-eligible broad offering, but **not on Solana**.
- **DEX loophole, not a license.** Holding and trading on DEXs is technically permissionless for xStocks, Ondo and Backpack mints, but issuer terms restrict who may acquire them. A US-facing app that routes users into these tokens is a legal risk. Existing Stocklana repos put "Not available to US persons" in their UI.

### 5.2 Binary markets on stock prices
- **SEC vs CFTC.** Under Dodd-Frank the CFTC regulates swaps, while the **SEC regulates security-based swaps**: contracts tied to a single security (and, by statute, narrow-based security indices; that index detail comes from the statutory definition, not re-verified in a 2026 source). An event contract on the price of one public company's stock looks like a security-based swap (CNBC, 2026-07-16; Norton Rose Fulbright).
- **2026 agency actions:**
  - CFTC Staff Advisory 26-08 (2026-03-12).
  - CFTC event-contract NPRM (published 2026-06-10, comments due 2026-07-27).
  - **SEC–CFTC joint request for comment** on swap / security-based swap definitions "including event-based products" (2026-06-18). SEC Chair Atkins called prediction markets a "huge issue" (Feb 2026).
- **How the big players handle it:**
  - **Polymarket (international, polymarket.com):** daily **TSLA, AAPL, GOOGL, MSFT, NFLX, SPCX Up/Down** and "closes above $X" markets, plus SPX/SPY. Resolves on Pyth regular-hours close. **Blocks US users** (they're sent to polymarket.us).
  - **Kalshi (CFTC DCM):** S&P 500 index range and max markets plus company-KPI markets (Tesla deliveries, etc.), not single-stock price binaries. In Sept 2026 it announced plans to seek **joint CFTC + SEC approval for ~60 single-stock and ETF perpetual futures** (as "security futures"). Citadel Securities is lobbying for SEC-only oversight, and CME is suing the CFTC over perps approval.
  - **Robinhood:** S&P "closing price" event contracts via Robinhood Derivatives LLC (index, not single stock). Its stock tokens are offshore and non-US.
- **Practical takeaway.** A permissionless, US-accessible single-stock Up/Down market is in unsettled SEC territory. For a hackathon: geofence the US, add ToS and disclaimers, and optionally offer index products (SPY/QQQ) as "broad-based". Say this plainly in the pitch, since the judges' question is "could this be a real app?"

---

## 6. Other Stocklana projects already public (as of 2026-09-13)

The hackathon page shows **305 registered, 26 submissions**. GitHub searches ("stocklana", "xStocks", "tokenized stocks" created ≥ Sept 2026) found:

| Project | One-liner |
|---|---|
| **TAPE** (criptocbas/tape-stocklana) | Issuer-aware terminal keyed by mint: xStocks vs Backpack premium to issuer mark, Jupiter swap. Live at tape-stocklana.vercel.app |
| **ShareLens** (bellabaelfire) | Read-only xStocks raw-vs-scaled unit inspector using the xStocks multiplier API |
| **Stocklana Baskets** (MallorcaBCDays) | Weighted xStocks index basket token; deposit USDC, redeem underlying |
| **Erodoro** (PoulavBhowmick03) | Lock tokenized equity, split into capped `P` / upside `N` claims at a strike and expiry (covered-call style); Manifest order book, MagicBlock. **Closest to a derivatives / prediction product** |
| **Divvyr** (Nebulaz7) | Harvest xStock dividend multiplier deltas into any token; tradeable dividend-rights NFTs |
| **MITIGATOR** (Pabby01) | AI tokenized-stock intelligence, risk engine, paper trading, social timeline, 3D UI |
| **ExDate** (AlperJ) | "Brokerage statement" showing invisible xStock dividends from multiplier changes |
| **FolioX** (umutyesildal) | Onchain strategy baskets powered by xStocks |
| **lotline** (operatoruplift) | Read-only xStocks recurring-contribution planner (PWA) |
| **Nocturne** (Sketchify-Dev) | 24/7 AI (Qwen) paper-trading agent for tokenized equities |
| **xStocks Portfolio Autopilot** (0xagentlabs) | Pinocchio devnet program + dashboard for non-custodial strategy config |
| **xStocks-Terminal** (DOCKPORT) | List of all xStocks with holdings and supply |
| **RWA-price-check** (blakehendo) | Jupiter xStock quotes vs timestamped US equity prices |
| **corporate-action-guard** (gnanam1990) | Fail-closed preflight for stale corporate-action state (X Layer) |
| Stocklana-Meme (Kelsay849) | Memecoin site. There is also a "Stocklana" pump.fun token, unrelated |
| "Crack a Crate" (X) | Listed as a Stocklana entrant on X; product UNVERIFIED |

**No public stock prediction market / Up-Down / parlay project was found** in GitHub searches. Most entries are terminals, dividend tools, baskets and AI agents. Many private submissions exist (26 total), so absence here is not proof.

---

## 7. Implications for a stock prediction market

1. **Cash-settle in USDC off an oracle; don't settle in stock tokens.** Your markets don't need to hold TSLAx at all. Resolve on **Pyth `Equity.US.TSLA/USD`** (same source as Polymarket), using regular-hours close or a specified-minute candle. Stock tokens then become an *optional* add-on (collateral, "earn" vault, payout-in-stock) rather than a dependency on issuer pause and permanent-delegate powers.
2. **Design for market hours.**
   - Official feeds stop when markets close (`price-data` was null on Sunday). Short-window markets (5-min, 1-hour) should run **only in the regular or extended session**, or use a clearly labeled source outside it.
   - The on-chain DEX price (Raydium/Jupiter TSLAx) or Pyth overnight data are options, but they are thin and manipulable.
   - A distinctive, defensible product is **"weekend gap" markets**: will TSLA open above Friday's close? Solana is where 24/7 stock-token trading already happens.
3. **Handle corporate actions.**
   - If you ever quote or settle using token prices, use `price × multiplier` and honor `newMultiplierEffectiveTimestamp`.
   - For oracle-settled markets, define split handling in the rules (Polymarket uses split-adjusted Pyth prices). A 4-for-1 split mid-market will break naive "above $X" strikes.
4. **Key everything by mint address and issuer, not ticker.** SpaceX alone has five Solana tokens. Show "xStocks / Ondo / Backpack" badges if you let users trade or deposit the tokens (the TAPE repo shows judges already see this nuance).
5. **Realistic devnet stack:**
   - Mainnet read-only: xStocks API, Pyth, Jupiter.
   - Devnet: your own program, a mock USDC, and optional mock Token-2022 "TSLAx" mints that copy the real extension set.
   - Don't count on xStocks' dev environment. The mints exist but have zero supply and the mint authority is Backed's.
   - Hackathon judging rewards a working end-to-end demo, so make the demo *resolve* a real market using a real Pyth stock price.
6. **Geofence and disclaim from day one.** Single-stock binaries are likely security-based swaps in the US. Block US IPs (and the xStocks/Ondo excluded countries if you touch their tokens), and put "not available to US persons" in the UI and ToS. Mention the SEC–CFTC joint comment request (June 2026) and Kalshi's perps filing to show you understand the path to legitimacy.
7. **The "earn/yield" vault should use permissionless issuers.** Only xStocks, Ondo and Backpack mints (`defaultAccountState: initialized`) can sit in a program vault today; Superstate and Securitize are frozen by default. A vault could:
   - write covered Up/Down liquidity against deposited xStocks, or
   - lend USDC to market makers.
   Disclose issuer pause and permanent-delegate risk.
8. **Leverage and parlays have a clear gap to fill.** Kalshi is only *seeking* stock perps, Polymarket has plain daily Up/Down, and no public Stocklana entry does stock prediction markets. Pitch the gap as "Polymarket-style stock markets, but 24/7-aware, multi-leg and composable with the stock tokens you already hold on Solana."
9. **Liquidity reality check.** Top xStocks pools on Jupiter hold only ~$1–4M liquidity each, and Ondo trades via RFQ. Don't design hedging that requires swapping large size into stock tokens. Hedge in USDC or perps (Frontier Traders, JTX, and Kalshi later), or keep the house book balanced.
10. **Solana's narrative is contested.** Robinhood Chain overtook Solana in daily stock DEX volume within two months. Solana-specific pitch hooks: sub-second settlement for short windows, the multi-issuer token universe (xStocks + Ondo + Backpack), Pyth-native feeds, and 24/7 DEX price discovery.

---

## Sources

**Hackathon**
- Stocklana page: https://hackathons.solana.com/hackathons/stocklana
- Stocklana X mention (Sept 11–18, one week): https://x.com/solana (via search; specific post URL UNVERIFIED)

**Issuers & stats**
- Kraken acquires Backed (2025-12-02): https://blog.kraken.com/news/backed-acquisition
- xStocks $25B volume, ~$225M AUM (2026-02-19): https://blog.kraken.com/product/xstocks/25-billion-in-total-transaction-volume
- xStocks in Kraken Wallet, 700+, $38B, 82% share (2026-08-29): https://solanacompass.com/news/xstocks-arrives-in-kraken-wallet-with-700-tokenized-stocks-and-etfs-for-247-on-chain-trading
- Kraken xStocks FAQ (eligibility, 24/7 list, weekend pricing): https://support.kraken.com/articles/xstocks-faq
- Solana xStocks case study (extensions, venues): https://solana.com/news/case-study-xstocks
- xStocks developer docs: https://docs.xstocks.fi/developers · https://docs.xstocks.fi/developers/multipliers · https://docs.xstocks.fi/developers/quickstart · https://docs.xstocks.fi/developers/xchange-atomic-rfq · https://docs.xstocks.fi/changelog
- xStocks public API (live): https://api.xstocks.fi/api/v2/public/assets · https://api.xstocks.fi/api/v2/public/oracles · https://api.xstocks.fi/api/v2/public/assets/AAPLx/multiplier?network=Solana
- xStocks dev API (devnet mints): https://api.dev.backed.fi/api/v2/public/assets
- Ondo on Solana (2026-01-21): https://solana.com/news/ondo-global-markets-tokenized-stocks-etfs-solana · https://www.coindesk.com/business/2026/01/21/ondo-finance-brings-200-tokenized-u-s-stocks-and-etfs-to-solana
- Ondo renamed Ondo Stocks, $1B+ (2026-07-13): https://genfinity.io/2026/07/13/ondo-global-markets-becomes-ondo-stocks-tokenized-equities-leader/
- Ondo 24/7 mint/redeem (2026-06-25): https://ondo.finance/blog/real-24-7-trading-for-tokenized-stocks
- Ondo eligibility: https://docs.ondo.finance/ondo-global-markets/eligibility · Important notes: https://docs.ondo.finance/ondo-stocks/important-notes · API: https://docs.ondo.finance/api-reference/overview
- Ondo Solana program: https://github.com/ondoprotocol/global-markets-solana
- Jupiter × Ondo RFQ: https://cryptopotato.com/jupiter-ondo-partner-to-bring-over-200-tokenized-us-stocks-to-solana/
- Sunrise explainer: https://learn.backpack.exchange/articles/what-is-sunrise · Backpack Securities: https://learn.backpack.exchange/articles/what-is-backpack-securities · Sunrise API: https://api.sunrise.xyz/v1/tokens?limit=200
- Backpack Reg S / UCC-8 (search summary): https://learn.backpack.exchange/articles/%20access-us-securities-onchain
- SPCX launch: https://genfinity.io/2026/06/11/spacex-spcx-tokenized-stock-solana/ · MSTR listing: https://solanacompass.com/news/backpack-securities-lists-tokenized-strategy-mstr-shares-on-solana-redeemable-11-for-real-stock · $465M supply: https://cryptobriefing.com/solana-tokenized-equity-market-465m-sunrise-healthcare/
- Superstate: https://docs.superstate.com/investors/tokenized-equities.md · https://superstate.com/assets · Kamino collateral: https://thedefiant.io/news/defi/superstate-tokenized-shares-collateral-solana-defi-kamino
- Galaxy GLXY on Solana: https://www.coindesk.com/business/2025/09/03/galaxy-digital-tokenizes-its-shares-on-solana-with-superstate
- Securitize SECZ (2026-07-02): https://www.coindesk.com/business/2026/07/02/securitize-tokenizes-usd295-million-of-its-own-stock-on-solana-and-avalanche-amid-nyse-debut
- Dinari (Solana "coming soon", 2026-08-04): https://www.coindesk.com/business/2026/08/04/dinari-brings-tokenized-u-s-stocks-to-american-investors-as-equity-race-heats-up
- Remora shutdown: https://www.web3isgoinggreat.com/single/step-finance-shuts-down · https://www.thestreet.com/crypto/bankruptcy/major-crypto-platform-shuts-down-after-26m-hack
- PreStocks: https://solanalevelup.substack.com/p/prestocks-on-solana-guide-tokenized · OpenAI/Anthropic warning: https://www.coindesk.com/markets/2026/05/13/anthropic-openai-tokens-plunge-nearly-40-as-ai-firms-warn-spv-transfers-are-invalid · https://beincrypto.com/solana-investor-appetite-pre-ipo-tokens/
- Tessera: https://www.forbes.com/sites/boazsobrado/2026/05/13/15-trillion-spacex-inside-wall-streets-tokenization-stack/
- Robinhood Chain: https://cryptobriefing.com/robinhood-chain-surpasses-solana-tokenized-stocks/ · https://crypto.news/robinhood-chain-vs-solana-two-months-challenging/ · https://eco.com/support/en/articles/15083160-robinhood-tokenized-stocks-what-s-live-and-how-it-works
- Binance bStocks: https://www.prnewswire.com/news-releases/binance-exchange-launches-bstocks-tokenized-securities-11-backing-and-247-trading-302798876.html
- Bitget Reality: https://www.theblock.co/post/402518/bitget-launches-reality-rwa
- R3 Corda Protocol: https://www.coindesk.com/business/2026/01/24/r3-bets-on-solana-to-bring-institutional-yield-onchain
- Solana roundups: https://solana.com/news/solana-ecosystem-roundup-june-2026 · https://solana.com/news/solana-ecosystem-roundup-august-2026
- $10B cumulative: https://en.coinotag.com/solana-sol-tokenized-stock-volume-crosses-10-billion · H1 $4.9B: https://cryptobriefing.com/solana-tokenized-stocks-volume-surges-h1-2026/ · 95% weekly: https://cryptorank.io/news/feed/9b625-solana-captures-95-of-tokenized-stock-trading-as-weekly-volume-hits-record
- rwa.xyz Solana stocks dashboard (2026-07-20): https://solanacompass.com/news/rwaxyz-launches-tokenized-stock-analytics-dashboard-as-solana-captures-95-of-on-chain-equity-volume
- rwa.xyz live: https://app.rwa.xyz/stocks · https://app.rwa.xyz/networks/solana
- Labor Day weekend >$1B: https://cryptobriefing.com/tokenized-stocks-labor-day-weekend-trading-volume/

**Token mechanics**
- Solana ScaledUiAmount: https://solana.com/docs/tokens/extensions/scaled-ui-amount
- QuickNode ScaledUiAmount guide: https://www.quicknode.com/guides/solana-development/spl-tokens/token-2022/scaled-ui-amount
- On-chain reads: Solana mainnet RPC `getAccountInfo` (jsonParsed) for TSLAx, SPYx, MU, NVDAon, GLXY, SECZ; devnet RPC `getMultipleAccounts` for the 113 dev xStocks mints (performed 2026-09-13)
- Jupiter token search API: https://lite-api.jup.ag/tokens/v2/search?query=TSLAx
- Chainlink 24/5 equity feeds: https://finance.yahoo.com/news/chainlink-launches-24-5-price-040708261.html · https://docs.chain.link/data-streams/market-hours

**Regulatory**
- CNBC, SEC may get involved (2026-07-16): https://www.cnbc.com/2026/07/16/the-sec-may-get-involved-as-prediction-market-bring-new-contracts.html
- Bradley, SEC–CFTC joint request (2026-06-18): https://www.bradley.com/insights/publications/2026/06/is-the-sec-entering-fight-over-prediction-market-oversight
- CFTC NPRM (2026-06-10): https://www.mayerbrown.com/en/insights/publications/2026/06/the-odds-are-in-cftc-proposes-framework-for-event-contracts-and-prediction-markets · https://www.cftc.gov/media/14151/NPRM_PredictionMarkets060926/download
- CFTC advisory 26-08: https://www.regulatoryoversight.com/2026/03/cftc-issues-new-guidance-for-prediction-markets/
- Norton Rose Fulbright: https://www.nortonrosefulbright.com/en-us/knowledge/publications/fed865b0/cftc-advances-regulatory-framework-for-prediction-markets
- CRS on prediction markets: https://www.congress.gov/crs-product/IF13187
- Polymarket daily finance: https://polymarket.com/finance/daily · NVDA Up/Down rules: https://polymarket.com/event/nvda-up-or-down-on-june-1-2026
- Kalshi S&P markets: https://kalshi.com/category/financials/sandp · Robinhood S&P: https://robinhood.com/us/en/prediction-markets/financial/sp/
- Kalshi stock perps (2026-09-11): https://www.coindesk.com/markets/2026/09/11/kalshi-wants-24-7-tesla-and-nvidia-perps-as-wall-street-fights-over-who-regulates-them

**Competition**
- https://github.com/criptocbas/tape-stocklana · https://github.com/bellabaelfire/stocklana-sharelens · https://github.com/MallorcaBCDays/stocklana-baskets · https://github.com/PoulavBhowmick03/Erodoro_Stocklana · https://github.com/Nebulaz7/Divvyr · https://github.com/Pabby01/MITIGATOR · https://github.com/AlperJ/exdate · https://github.com/umutyesildal/foliox · https://github.com/operatoruplift/lotline · https://github.com/Sketchify-Dev/nocturne · https://github.com/0xagentlabs/xstocks-portfolio-autopilot · https://github.com/DOCKPORT/xStocks-Terminal · https://github.com/blakehendo/RWA-price-check · https://github.com/gnanam1990/corporate-action-guard · https://github.com/Kelsay849/Stocklana-Meme
