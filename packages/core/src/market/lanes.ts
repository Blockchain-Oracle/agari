import type { Address } from "../types/primitives";
import { GAP_CADENCE_SEC, type EventMarket, type Lane, type LaneBasis, type LaneSet } from "../types/market";

const SEC_PER_MIN = 60;
const SEC_PER_HOUR = 3_600;
const SEC_PER_DAY = 86_400;

export function formatCadence(intervalSec: number): string {
  if (intervalSec % SEC_PER_DAY === 0) return `${intervalSec / SEC_PER_DAY}d`;
  if (intervalSec % SEC_PER_HOUR === 0) return `${intervalSec / SEC_PER_HOUR}h`;
  if (intervalSec % SEC_PER_MIN === 0) return `${intervalSec / SEC_PER_MIN}m`;
  return `${intervalSec}s`;
}

/** Board order: the in-session lanes, then the weekend Gap, then the 24/7 token lanes. */
const BASIS_ORDER: Record<LaneBasis, number> = { regular: 0, gap: 1, token: 2 };

export function laneLabel(basis: LaneBasis, intervalSec: number): string {
  return basis === "gap" && intervalSec === GAP_CADENCE_SEC ? "Gap" : formatCadence(intervalSec);
}

/**
 * Lanes derive from the live Windows — never a hardcoded list (FR-6). A lane is one (basis, cadence) pair,
 * so a 5m stock lane and a 5m token lane stay apart: they price different things.
 */
export function groupIntoLanes(markets: readonly EventMarket[], venueId: Address): LaneSet {
  const byLane = new Map<string, { basis: LaneBasis; intervalSec: number; markets: EventMarket[] }>();
  for (const market of markets) {
    const key = `${market.lane}:${market.intervalSec}`;
    const lane = byLane.get(key) ?? { basis: market.lane, intervalSec: market.intervalSec, markets: [] };
    lane.markets.push(market);
    byLane.set(key, lane);
  }
  const lanes: Lane[] = [...byLane.values()]
    .sort((a, b) => BASIS_ORDER[a.basis] - BASIS_ORDER[b.basis] || a.intervalSec - b.intervalSec)
    .map(({ basis, intervalSec, markets: laneMarkets }) => ({
      basis,
      intervalSec,
      label: laneLabel(basis, intervalSec),
      markets: laneMarkets.sort((a, b) => a.expirySec - b.expirySec),
      nextStartSec: null,
    }));
  return { venueId, lanes };
}
