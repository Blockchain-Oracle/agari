/** Structural rows the indexer hands the store; the store never imports the chain adapter (venue-ops.md §3). */

/** One decoded Market-scoped event, JSON-safe: u64/i64 values arrive as decimal strings. */
export interface IdxEvent {
  signature: string;
  slot: number;
  blockTimeSec: number | null;
  outerIx: number;
  innerIx: number;
  name: string;
  market: string | null;
  seq: string | null;
  data: Record<string, unknown>;
}

export interface IdxTransaction {
  signature: string;
  slot: number;
  blockTimeSec: number | null;
  failed: boolean;
  events: IdxEvent[];
}

export interface IdxSeries {
  series: string;
  ticker: number;
  symbol: string | null;
  cadenceSec: number;
  basis: number;
  lotBase: string;
  tickBase: string;
  cashUnit: string;
}

export type IdxCommitment = "confirmed" | "finalized";

export interface IdxCursor {
  program: string;
  slot: number;
  signature: string;
}
