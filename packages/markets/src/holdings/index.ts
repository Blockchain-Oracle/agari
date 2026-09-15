/**
 * `@agari/markets/holdings` (session-lanes.md §4): a connected wallet's mainnet xStocks and Ondo tokens, read-only, with
 * ScaledUiAmount applied in bigint fixed-point. Server-only (the Helius key never leaves the server); not re-exported
 * from the package root. Lane 6d owns `holdings/**`.
 */
export { HoldingsReadError, readHoldings, type Holding, type HoldingsBody, type HoldingsInput } from "./reader";
export { decimalToE12, effectiveMultiplierE12, exposureUsdE6, MULTIPLIER_SCALE, sharesE8, type ScaledUiAmountState } from "./scaled-amount";

/** Helius mainnet. The key is a query parameter, so this string is a secret: pass it to `readHoldings`, never to a log. */
export const heliusMainnetUrl = (apiKey: string): string => `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey)}`;
