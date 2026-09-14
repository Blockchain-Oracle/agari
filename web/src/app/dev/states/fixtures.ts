import { diagnosis, err, ok, stale, txUrl, type Diagnosis, type Reading } from "@agari/core";
import { fixtureAddress, fixtureMarketId, fixtureSignature } from "../fixture-ids";

export const DECIMALS = 6;
export const SYMBOL = "tUSDC";
export const FIXED_NOW_MS = Date.UTC(2026, 8, 1, 14, 35, 0);
export const FIXED_NOW_SEC = FIXED_NOW_MS / 1000;
export const CADENCE_SEC = 300;

export const TX_HASH = fixtureSignature("0x9f3b2c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809");
export const WALLET = fixtureAddress("0x8ba1f109551bD432803012645Ac136ddd64DBA72");
export const TX_URL = txUrl(TX_HASH);
/** The print proof is the settling transaction until S5 adds each source's own proof (D-012). */
export const ORACLE_URL = TX_URL;

export const DIAGNOSES: readonly Diagnosis[] = [
  diagnosis("out-of-gas", "SendTransactionError: insufficient lamports for the fee (fee payer has 0 SOL)"),
  diagnosis("market-not-trading", "custom program error: 0x17d4 (MarketNotTrading)", { errorName: "MarketNotTrading" }),
  diagnosis("indexer-down", "IndexerError: request failed — /api/index/windows"),
];

export const LIVE_BALANCE: Reading<bigint> = ok(1_204_500_000n, FIXED_NOW_MS);
export const STALE_BALANCE: Reading<bigint> = stale(ok(1_204_500_000n, FIXED_NOW_MS - 90_000), "refresh-failed");
export const FAILED_BALANCE: Reading<bigint> = err(DIAGNOSES[2]!);

export const TICKER_ENTRIES = [
  { asset: "TSLA", priceText: "365.48", direction: "up" },
  { asset: "NVDA", priceText: "178.22", direction: "down", staleAsOfMs: FIXED_NOW_MS - 20_000 },
  { asset: "QQQ", priceText: "714.90", direction: "flat" },
] as const;
