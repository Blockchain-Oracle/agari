import type { Hex } from "./primitives";

export interface AssetPrice {
  asset: string;
  priceRaw: bigint;
  emaRaw: bigint;
  decimals: number;
  blockTimestampSec: number;
}

export interface PricePoint {
  priceRaw: bigint;
  emaRaw: bigint;
  blockTimestampSec: number;
}

export interface ClockSync {
  offsetMs: number;
  rttMs: number;
  blockNumber: number;
}

export interface Resolution {
  openingRaw: bigint | null;
  closingRaw: bigint | null;
  settlementTxHash: Hex | null;
  oracleQuestionId: string | null;
  settledAtMs: number | null;
  voided: boolean;
}
