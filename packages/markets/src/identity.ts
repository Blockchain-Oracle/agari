import { PRINT_EXPO } from "@agari/core/market";
import { toMarketId, type MarketId } from "@agari/core/types";

/** Decimal places of every recorded print: prints are normalized on-chain to expo −8 (spec `prints.md` §4.6). */
export const ORACLE_PRICE_SCALE = -PRINT_EXPO;

/**
 * Which price series tracks a Window's prints; the chart and the Fair Value model read this one. Agari's prints are
 * signed spot prices at exact T (Pyth, RedStone), so the chart follows spot.
 */
export const PRICE_BASIS: "spot" | "ema" = "spot";

/** A row's Window id: the base58 Market PDA, taken exactly as written (never re-cased, D-010). */
export function marketIdOf(row: { marketId: string }): MarketId {
  return toMarketId(row.marketId);
}
