import type { Bytes32 } from "../types/primitives";
import type { EventMarket, Lane, LaneSet } from "../types/market";

const SEC_PER_MIN = 60;
const SEC_PER_HOUR = 3_600;
const SEC_PER_DAY = 86_400;

export function formatCadence(intervalSec: number): string {
  if (intervalSec % SEC_PER_DAY === 0) return `${intervalSec / SEC_PER_DAY}d`;
  if (intervalSec % SEC_PER_HOUR === 0) return `${intervalSec / SEC_PER_HOUR}h`;
  if (intervalSec % SEC_PER_MIN === 0) return `${intervalSec / SEC_PER_MIN}m`;
  return `${intervalSec}s`;
}

/** Lanes derive from the live `intervalSec` values — never a hardcoded list (FR-6). Fixed-strike markets are excluded and counted. */
export function groupIntoLanes(markets: readonly EventMarket[], venueId: Bytes32): LaneSet {
  const byInterval = new Map<number, EventMarket[]>();
  let excludedFixedStrike = 0;
  for (const market of markets) {
    if (!market.isUpDown) {
      excludedFixedStrike += 1;
      continue;
    }
    const lane = byInterval.get(market.intervalSec) ?? [];
    lane.push(market);
    byInterval.set(market.intervalSec, lane);
  }
  const lanes: Lane[] = [...byInterval.entries()]
    .sort(([a], [b]) => a - b)
    .map(([intervalSec, laneMarkets]) => ({
      intervalSec,
      label: formatCadence(intervalSec),
      markets: laneMarkets.sort((a, b) => a.expirySec - b.expirySec),
      nextStartSec: null,
    }));
  return { venueId, lanes, excludedFixedStrike };
}
