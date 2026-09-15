import { isTickerSymbol, type TickerSymbol } from "@agari/core/market";
import { addressSchema, type LaneBasis } from "@agari/core/types";
import { getDb, indexReader } from "@agari/db";
import { withinBudget } from "./read-budget";

/** The index's `basis` byte → lane, as the markets port reads it (`packages/markets/src/provider/rows.ts`). */
const BASIS: Readonly<Record<number, LaneBasis>> = { 0: "regular", 1: "gap", 2: "token" };

export interface MarketCard {
  asset: TickerSymbol;
  lane: LaneBasis;
  intervalSec: number;
  expirySec: number;
  /** `open` covers a listed Window before its start too: both still close in the future. */
  settled: boolean;
}

async function readCard(id: string): Promise<MarketCard | null> {
  const market = addressSchema.safeParse(id);
  const db = getDb();
  if (!market.success || !db) return null;
  const [row] = await indexReader(db).markets({ market: market.data, limit: 1 });
  if (!row) return null;
  const symbol = String(row.symbol ?? "");
  const lane = BASIS[Number(row.basis)];
  const intervalSec = Number(row.cadence_sec);
  const expirySec = Number(row.expiry_sec);
  if (!isTickerSymbol(symbol) || !lane || !Number.isFinite(intervalSec) || !Number.isFinite(expirySec)) return null;
  return { asset: symbol, lane, intervalSec, expirySec, settled: row.state !== "open" };
}

/**
 * One Window's preview facts from the index row the market pages read (asset, lane, cadence, close), on the server.
 * Null for an id that is not an address, a Window the index does not hold, or an index that is slow or down.
 */
export function readMarketCard(id: string): Promise<MarketCard | null> {
  return withinBudget(readCard(id));
}
