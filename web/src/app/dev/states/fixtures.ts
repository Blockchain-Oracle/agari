import { diagnosis, err, ok, stale, type Diagnosis, type Reading } from "@masayume/core";

export const DECIMALS = 6;
export const SYMBOL = "tUSDC";
export const FIXED_NOW_MS = Date.UTC(2026, 8, 1, 14, 35, 0);
export const FIXED_NOW_SEC = FIXED_NOW_MS / 1000;
export const CADENCE_SEC = 300;

export const TX_HASH = "0x9f3b2c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809";
export const WALLET = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";
export const TX_URL = `https://shannon-explorer.somnia.network/tx/${TX_HASH}`;
export const ORACLE_URL = "https://prd.oracle.somnia.host/questions/1842?view=graph";

export const DIAGNOSES: readonly Diagnosis[] = [
  diagnosis("out-of-gas", 'RpcError: Missing or invalid parameters (gas envelope unfunded for 0x8ba1…ba72)'),
  diagnosis("market-not-trading", "ContractRevertError: MarketNotTrading()", { errorName: "MarketNotTrading" }),
  diagnosis("indexer-down", "IndexerError: request failed — https://dev.smk.somnia.host/v1/graphql"),
];

export const LIVE_BALANCE: Reading<bigint> = ok(1_204_500_000n, FIXED_NOW_MS);
export const STALE_BALANCE: Reading<bigint> = stale(ok(1_204_500_000n, FIXED_NOW_MS - 90_000), "refresh-failed");
export const FAILED_BALANCE: Reading<bigint> = err(DIAGNOSES[2]!);

export const TICKER_ENTRIES = [
  { asset: "BTC", priceText: "64,182.40", direction: "up" },
  { asset: "ETH", priceText: "2,411.05", direction: "down", staleAsOfMs: FIXED_NOW_MS - 20_000 },
  { asset: "SOMI", priceText: "0.4210", direction: "flat" },
] as const;
