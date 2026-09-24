import type { SpotSymbol } from "../market/tickers";
import type { PrintSource, VoidReason } from "./market";
import type { Signature } from "./primitives";

/** Live spot for a ticker or an xStock from price-relay (display only; never a settlement input). */
export interface AssetPrice {
  asset: SpotSymbol;
  priceRaw: bigint;
  emaRaw: bigint;
  decimals: number;
  /** When the source published this price. */
  publishTimeSec: number;
}

export interface PricePoint {
  priceRaw: bigint;
  emaRaw: bigint;
  publishTimeSec: number;
}

export interface ClockSync {
  offsetMs: number;
  rttMs: number;
  slot: number;
}

/** How a Window settled, read from its `MarketResult` (prints normalized to `PRINT_EXPO`). */
export interface Resolution {
  openingRaw: bigint | null;
  closingRaw: bigint | null;
  settlementTxHash: Signature | null;
  printSource: PrintSource | null;
  /** Settled on the primary source alone because the check prints never arrived in time. */
  singleSource: boolean;
  settledAtMs: number | null;
  voided: boolean;
  voidReason: VoidReason | null;
}
