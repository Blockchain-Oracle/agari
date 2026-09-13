import { phase } from "@masayume/core/lifecycle";
import { isOk } from "@masayume/core/schemas";
import { decideOracleFollow, distanceToTriggerBps, type Decision, type OracleFollowSpec } from "@masayume/core/strategies";
import type { Bytes32, EventMarket } from "@masayume/core/types";
import { marketsProvider } from "@masayume/markets";
import { openingOnFeedScale } from "@masayume/markets/strategies";

export interface Scan {
  /** Windows the runner could act on this cycle, each with its decision. */
  candidates: Array<{ market: EventMarket; decision: Decision }>;
  scanned: number;
  closestBps: number | null;
  why: string;
}

/**
 * One read of the venue: every Trading Window with an opening print and a fresh feed, decided by
 * the pure model. Reads only — nothing here can send.
 */
export async function scanVenue(venueId: Bytes32, spec: OracleFollowSpec, nowMs: number): Promise<Scan> {
  const lanes = await marketsProvider.listLiveLanes(venueId);
  if (!isOk(lanes) || lanes.stale) return { candidates: [], scanned: 0, closestBps: null, why: `lanes unreadable: ${isOk(lanes) ? "stale state" : lanes.error.technical}` };
  const markets = lanes.value.lanes.flatMap((lane) => lane.markets).filter((m) => phase(m, nowMs) === "trading");
  const candidates: Scan["candidates"] = [];
  let closest: number | null = null;
  const skipped: string[] = [];
  for (const market of markets) {
    const [opening, price] = await Promise.all([marketsProvider.getOpeningPrice(market.marketId), marketsProvider.getAssetPrice(market.asset)]);
    if (!isOk(opening) || opening.stale || opening.value === null) {
      skipped.push(`${market.asset}/${market.intervalSec}s: no print yet`);
      continue;
    }
    if (!isOk(price) || price.stale || price.value === null) {
      skipped.push(`${market.asset}/${market.intervalSec}s: no fresh price`);
      continue;
    }
    const openingRaw = openingOnFeedScale(opening.value, price.value.decimals);
    const decision = decideOracleFollow({ openingRaw, priceRaw: price.value.emaRaw, spec });
    const distance = distanceToTriggerBps(decision);
    if (closest === null || distance < closest) closest = distance;
    if (decision.side) candidates.push({ market, decision });
  }
  const why =
    candidates.length > 0
      ? `scanned ${markets.length} markets, ${candidates.length} past the trigger`
      : `scanned ${markets.length} markets, closest trigger ${closest ?? "—"} bps away${skipped.length ? `; ${skipped.length} skipped (${skipped[0]})` : ""}`;
  return { candidates, scanned: markets.length, closestBps: closest, why };
}
