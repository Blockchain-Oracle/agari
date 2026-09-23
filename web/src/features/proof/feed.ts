import { TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";
import { laneBasisOf, type LaneBasis, type PrintSource, type VoidReason } from "@agari/core/types";
import { printSourceName, windowSourceLabel } from "@/features/markets/price-source/source-label";

/**
 * `/proof`'s feed (S25), pure over the index's terminal Window rows (`markets?settled=1`, prints included): one row per
 * settled or voided Window, its two prints, the source that closed it and where that source's feed lives.
 */

/** The index row fields the feed reads; prices and seconds are the decimal strings Postgres returns. */
export interface SettledRowWire {
  market: string;
  symbol: string | null;
  cadence_sec: number | null;
  basis: number | null;
  state: string;
  winner: number | null;
  void_reason: number | null;
  expiry_sec: string;
  prints?: Record<string, { source: number; price: string } | undefined> | null;
}

export type FeedOutcome = "up" | "down" | "void";

export interface FeedRow {
  market: string;
  asset: TickerSymbol;
  lane: LaneBasis;
  cadenceSec: number;
  expirySec: number;
  outcome: FeedOutcome;
  voidReason: VoidReason | null;
  openE8: bigint | null;
  closeE8: bigint | null;
  /** The closing print's source, else the opening print's (a Window voided for a missing close has only its open). */
  source: PrintSource | null;
  /** The source's name on every surface (`printSourceName`); the filter chips key on it. */
  sourceName: string | null;
  /** The source's own feed page where one is pinned (Pyth Terminal, the PreStocks mint); null otherwise. */
  sourceHref: string | null;
}

const SOURCE: Record<number, PrintSource> = { 1: "pyth", 2: "redstone", 3: "switchboard", 4: "attested" };
const VOID_REASON: Record<number, VoidReason> = { 1: "missing-print", 2: "cross-check-divergence" };
const isTicker = (s: string | null): s is TickerSymbol => s !== null && (TICKER_SYMBOLS as readonly string[]).includes(s);

/** One wire row → a feed row; null for a row the feed cannot name (no registry symbol, an unknown lane, still open). */
export function toFeedRow(row: SettledRowWire): FeedRow | null {
  const lane = row.basis === null ? null : laneBasisOf(row.basis);
  if (!isTicker(row.symbol) || lane === null || row.state === "open") return null;
  const open = row.prints?.["0"] ?? null;
  const close = row.prints?.["1"] ?? null;
  const source = SOURCE[close?.source ?? open?.source ?? 0] ?? null;
  const outcome: FeedOutcome = row.state === "voided" ? "void" : row.winner === 1 ? "down" : "up";
  const label = source ? windowSourceLabel({ asset: row.symbol, lane, printSource: source }) : null;
  return {
    market: row.market,
    asset: row.symbol,
    lane,
    cadenceSec: row.cadence_sec ?? 0,
    expirySec: Number(row.expiry_sec),
    outcome,
    voidReason: outcome === "void" && row.void_reason ? (VOID_REASON[row.void_reason] ?? null) : null,
    openE8: open ? BigInt(open.price) : null,
    closeE8: close ? BigInt(close.price) : null,
    source,
    sourceName: source ? printSourceName(source, row.symbol) : null,
    sourceHref: label?.href ?? null,
  };
}

export function toFeed(rows: readonly SettledRowWire[]): FeedRow[] {
  return rows
    .map(toFeedRow)
    .filter((r): r is FeedRow => r !== null)
    .sort((a, b) => b.expirySec - a.expirySec);
}

/** The chips' order; a source the rows never name gets no chip, and a name outside this list trails it. */
const CHIP_ORDER = ["PreStocks", "Pyth", "RedStone", "Switchboard"];

/** The source filter chips the rows support, in a fixed order: "All" is the caller's. */
export function sourceChips(rows: readonly FeedRow[]): string[] {
  const names = new Set(rows.map((r) => r.sourceName).filter((n): n is string => n !== null));
  const known = CHIP_ORDER.filter((n) => names.has(n));
  return [...known, ...[...names].filter((n) => !CHIP_ORDER.includes(n)).sort()];
}
