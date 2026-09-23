# How Agari uses PreStocks and Pyth

Agari enters Stocklana's [main, PreStocks and Pyth tracks](https://hackathons.solana.com/hackathons/stocklana). This page connects each integration to code, a user path and recorded evidence as of 23 September 2026. A **Window** is one timed Up or Down market. A **print** is the opening or closing price accepted by the Solana program.

## PreStocks

Agari uses the [PreStocks catalogue](https://prestocks.com/api/prestocks) for its pre-IPO token prices, marks and holder counts. The catalogue is unsigned. For settlement, Agari signs a boundary read with its own attestor, and the event program checks that signature and the Window's price policy. This is a venue-attested PreStocks price, not an independent PreStocks oracle. Agari integrates no other pre-IPO issuer or token, consistent with the [bounty's eligibility rule](https://hackathons.solana.com/hackathons/stocklana).

| Product path | Source | User path and evidence |
| --- | --- | --- |
| **OpenAI around the clock**: a one-hour Up/Down Window rolls, prints and settles on the OpenAI PreStocks token price. | [Price adapter](../../packages/markets/src/prices/prestocks.ts), [series setup](../../scripts/deploy/init-prestocks-series.ts) | [Markets](https://useagari.xyz/markets); [first unattended open](https://explorer.solana.com/tx/2PTZDJ5yY9oEmJKCQUcdNrweZj5qPnx3veo2BvBrsbSnMjxkntwh21rP5S4o3fUpjZCV3sKHVzN6AA9AKr3so1dH?cluster=devnet), [opening print](https://explorer.solana.com/tx/4TJTb2gTRkpg6p3HHG7WDKRYcTdzLxyz3zC23dLNF3zLUZksP12DB3B2yiixYq96WZTHHmmfGEfsAUN3j5yCXwPT?cluster=devnet) |
| **Cover what a wallet holds**: read PreStocks mints on mainnet without moving them, then offer a devnet Down call. | [Cover UI](../../web/src/features/hedge), [cover drive](../../scripts/drive/cover-call.ts) | [Portfolio](https://useagari.xyz/portfolio); the 19 September holder fill and result are in the [ledger](../evidence/acceptance.md) |
| **Five baskets**: equal-weight indices in points over PreStocks names, each computed from one catalogue read of every member. A missing member produces no valid print. | [Basket rules](../../packages/core/src/market/baskets.ts) | [Baskets](https://useagari.xyz/baskets); [AI Labs settle](https://explorer.solana.com/tx/5xkJKmS47fZBYRNyeJ83iffHTxzpE2vMr9SGBMvKb3eeN6wNh1xC3WeWYpknWAynR1mAjmKF2ZpVEWwRU3RuZm3f?cluster=devnet), [Defense & Space settle](https://explorer.solana.com/tx/YnwMzy8g1Fp6KkRrFTF3XHTEWhF7JgK4Y3FGAidnzR2B2uzYwgpe8SmPPafQqNcqUgvp9yjf721qghLrsznBdP4?cluster=devnet) |
| **Paper desk**: draft a basket and limits, then see hourly decisions using PreStocks marks and Jupiter quotes. The proposed program checks a price ceiling against the mark. | [Desk program](../../anchor/programs/agari-desk), [desk runner](../../services/ops/src/actors/desk-runner) | [Desk](https://useagari.xyz/desk); 31 checks passed on a Surfpool fork of mainnet on 22 September. Mainnet deployment is pending. |
| **Pre-IPO facts**: token price, mark, premium or discount and holder count. | [Ticker page](../../web/src/features/ticker-hub/PreIpoStats.tsx) | [OpenAI](https://useagari.xyz/tickers/OPENAI) |

PreStocks tokens are not affiliated with, endorsed by, or issued by the companies they reference, and are unavailable in the U.S. The [PreStocks and Pyth guide](https://docs.useagari.xyz/architecture/prestocks-and-pyth) explains the two price meanings and the desk's trust boundary.

## Pyth

Pyth does work at settlement. For TSLA, QQQ and VOO policies, the price relay obtains a pull update from Hermes for the exact Window boundary; the event program accepts a fully verified update only when its feed, time and confidence satisfy the registered policy. It does not settle on a latest display quote. TSLA also names RedStone as its cross-check: an excessive gap voids the Window.

| Product path | Source | User path and evidence |
| --- | --- | --- |
| **Boundary verification** | [On-chain verifier](../../anchor/programs/agari-events/src/instructions/record_print_sources.rs), [Pyth helper](../../anchor/crates/agari-common/src/print/pyth.rs), [Hermes fetch](../../services/ops/src/actors/price-relay/hermes-fetch.ts) | [TSLA settle](https://explorer.solana.com/tx/xjKyBjRk51GitA35CZoP6fKd9huZ15EMH5RPmv8Lkj6XCKYn71zUDFfJaQPHyyresAX4Es13UCFGs4GSogvmzwt?cluster=devnet) |
| **Divergence and missing prints** | Same program path | [Cross-check void](https://explorer.solana.com/tx/24R75m6PE6NohCTE1Z6t3oQvReGP628DVdUsEMM3kKs7gHFWmhTeA32QUKvJEWeWeUW8VzN8VSdQo2rrkCebHYaj?cluster=devnet), [missing-print void](https://explorer.solana.com/tx/3p3AwjvW66Y24cV97pPYH4CR7ftXeuFH7GYBeWXhsVCmf1htuSpoYXTNz1nSL7kZhPdmBw1wGB1sFmPQpMM2G1WH?cluster=devnet) |
| **Proof and replay**: list each settled Window's source and print transactions; optionally post an archived update again. | [Proof UI](../../web/src/features/proof) | [Proof](https://useagari.xyz/proof). The replay payer was funded; the ledger does not yet record a successful replay transaction. |
| **Pre-IPO valuation indices**: separate Pyth-priced valuation lanes, hub comparison and optional desk premium reference. | [Entitlement probe](../../services/ops/src/runtime/pyth-entitlement.ts), [desk checks](../../anchor/programs/agari-desk) | Current trial key receives 403 for the index group; no valuation Series is registered or listed. An entitled key would still require Series registration before those lanes list. |

The current TSLA/QQQ/VOO trial policy ends at the NYSE close on **25 September 2026**. TSLA has a next RedStone policy; QQQ and VOO pause without renewed Pyth access. For the live state, use [Status](https://useagari.xyz/status). For dated transactions, use the [public evidence ledger](../evidence/acceptance.md).

## What Solana enforces

The wallet signs an order or grants bounded Trading Balance permission. The on-chain event program owns the order book, collateral, admitted price prints, settlement and claims. Operators roll Windows and submit evidence, but cannot choose a result outside the registered policy. The [architecture diagrams](https://docs.useagari.xyz/architecture/overview) show the signer and trust boundaries. The prediction paths above use **devnet tUSDC**; the desk's real-money path is **fork-rehearsed only**.
