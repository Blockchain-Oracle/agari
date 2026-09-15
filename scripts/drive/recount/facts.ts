// recount: the facts both sources yield, mapped straight from decoded events (never from `idx_*` projections or the
// provider's rows). JSON-safe event data: u64/i64 as decimal strings.

export interface RawEvent {
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

export interface SeriesGrid {
  symbol: string | null;
  cadenceSec: number;
  lotBase: bigint;
  tickBase: bigint;
}

export interface WindowFact {
  market: string;
  series: string;
  tradingStartSec: number;
  expirySec: number;
  /** From `WindowResolved`; null while open. */
  resolved: { voided: boolean; winner: number; resolvedTsSec: number } | null;
}

export interface FillFact {
  signature: string;
  market: string;
  seq: bigint;
  fillIx: number;
  tsSec: number;
  taker: string;
  takerKind: number;
  maker: string;
  makerKind: number;
  priceTicks: number;
  lots: bigint;
}

export interface SetFact {
  signature: string;
  market: string;
  seq: bigint;
  owner: string;
  minted: boolean;
  lots: bigint;
  blockTimeSec: number;
}

export interface Tape {
  windows: Map<string, WindowFact>;
  fills: FillFact[];
  sets: SetFact[];
  grids: Map<string, SeriesGrid>;
  /** Source notes for the report: transactions read, unavailable ones, where the walk stopped. */
  notes: string[];
  /** Anything that makes this tape incomplete (an unavailable transaction); a non-empty list fails the recount. */
  problems: string[];
}

const text = (d: Record<string, unknown>, key: string): string => {
  const v = d[key];
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") return String(v);
  throw new Error(`event field ${key} missing`);
};
const list = (d: Record<string, unknown>, key: string) => (Array.isArray(d[key]) ? (d[key] as Record<string, unknown>[]) : []);

/** Folds one event into the tape's windows, fills and sets. Events may arrive in any order. */
export function absorb(tape: Pick<Tape, "windows" | "fills" | "sets">, e: RawEvent): void {
  if (!e.market) return;
  const d = e.data;
  switch (e.name) {
    case "WindowOpened": {
      const known = tape.windows.get(e.market);
      tape.windows.set(e.market, {
        market: e.market,
        series: text(d, "series"),
        tradingStartSec: Number(text(d, "tradingStart")),
        expirySec: Number(text(d, "expiry")),
        resolved: known?.resolved ?? null,
      });
      return;
    }
    case "WindowResolved": {
      const resolved = { voided: Number(text(d, "state")) !== 1, winner: Number(text(d, "winner")), resolvedTsSec: Number(text(d, "resolvedTs")) };
      const known = tape.windows.get(e.market);
      if (known) known.resolved = resolved;
      else tape.windows.set(e.market, { market: e.market, series: "", tradingStartSec: -1, expirySec: -1, resolved });
      return;
    }
    case "OrderExecuted":
      list(d, "fills").forEach((f, fillIx) => {
        tape.fills.push({
          signature: e.signature,
          market: e.market!,
          seq: BigInt(e.seq ?? "0"),
          fillIx,
          tsSec: Number(text(d, "ts")),
          taker: text(d, "taker"),
          takerKind: Number(text(d, "kind")),
          maker: text(f, "maker"),
          makerKind: Number(text(f, "makerKind")),
          priceTicks: Number(text(f, "price")),
          lots: BigInt(text(f, "lots")),
        });
      });
      return;
    case "CompleteSet":
      if (e.blockTimeSec === null) throw new Error(`CompleteSet ${e.signature} has no block time`);
      tape.sets.push({ signature: e.signature, market: e.market, seq: BigInt(e.seq ?? "0"), owner: text(d, "owner"), minted: d.minted === true, lots: BigInt(text(d, "lots")), blockTimeSec: e.blockTimeSec });
      return;
  }
}

/** The names a recount reads; everything else on the tape is irrelevant to boards and traction. */
export const RECOUNT_EVENTS = ["WindowOpened", "WindowResolved", "OrderExecuted", "CompleteSet"] as const;
