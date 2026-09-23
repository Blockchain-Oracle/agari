import { isOk } from "@agari/core/schemas";
import { decideMirror, type MirrorSpec } from "@agari/core/strategies";
import type { Address } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { listWalletFills } from "@agari/markets";
import type { Scan } from "./decide";
import { tradingStockWindows } from "./stock-hours";

/** A trader's calls are read from the index, so the window of interest is also the only history this needs. */
const FILL_LIMIT = 50;

/**
 * One read of the venue for a copy-a-trader strategy (A-3b): every Trading Window that named wallet has just
 * taken a side on.
 *
 * Reads only — nothing here can send. The trader's own fills are the signal, so a Window they have not touched is
 * not a decision to sit out, it is simply not a candidate; the "why" says how many Windows they were quiet on so a
 * subscriber can tell a resting trader from a broken runner.
 */
export async function scanVenueMirror(venueId: Address, spec: MirrorSpec, nowMs: number): Promise<Scan> {
  const lanes = await marketsProvider.listLiveLanes(venueId);
  if (!isOk(lanes) || lanes.stale) return { candidates: [], scanned: 0, closestBps: null, why: `lanes unreadable: ${isOk(lanes) ? "stale state" : lanes.error.technical}` };
  const markets = tradingStockWindows(lanes.value, nowMs);
  const sinceSec = Math.floor(nowMs / 1_000) - spec.withinSec;
  const fills = await listWalletFills(spec.trader, { sinceSec, limit: FILL_LIMIT });
  if (!isOk(fills) || fills.stale) {
    return { candidates: [], scanned: markets.length, closestBps: null, why: `this trader's calls are unreadable: ${isOk(fills) ? "stale index" : fills.error.technical}` };
  }
  const candidates: Scan["candidates"] = [];
  let quiet = 0;
  for (const market of markets) {
    const own = fills.value.filter((fill) => fill.marketId === market.marketId);
    const decision = decideMirror({ fills: own, spec, nowMs });
    if (decision.side) candidates.push({ market, decision });
    else quiet += 1;
  }
  const why =
    candidates.length > 0
      ? `scanned ${markets.length} markets, this trader is net on ${candidates.length}`
      : `scanned ${markets.length} markets, this trader has taken no side in the last ${spec.withinSec}s (${quiet} quiet)`;
  return { candidates, scanned: markets.length, closestBps: null, why };
}
