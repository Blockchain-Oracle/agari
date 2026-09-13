import { ROLL_GAP_SEC } from "@masayume/core/constants";
import type { Reading } from "@masayume/core/schemas";
import type { Bytes32, EventMarket } from "@masayume/core/types";
import { getClient } from "../runtime/read-runtime";
import { toEventMarket } from "../mappers/market";
import { activeVenue } from "../venue";
import { nowSec } from "./clock";
import { fetchOpeningPrices } from "./prices";
import { withReading } from "./reading";

const SUCCESSOR_PAGE = 20;
const HISTORY_PAGE = 50;

/**
 * The successor window of the same asset and cadence — for Ticket auto-advance and dead-deep-link routing (AD-1).
 * Tail-discovered rows carry no venue id; the lookup stays scoped to the active venue regardless (canon #8).
 */
export async function nextWindow(market: EventMarket): Promise<Reading<EventMarket | null>> {
  return withReading(`next:${market.marketId}`, async () => {
    const rows = await getClient().listLiveBinaryMarkets({
      venueId: market.venueId ?? activeVenue()?.venueId ?? undefined,
      asset: market.asset,
      limit: SUCCESSOR_PAGE,
      nowSec: nowSec(),
    });
    const candidates = rows.map((row) => toEventMarket(row, null)).filter((m) => m.isUpDown && m.intervalSec === market.intervalSec && m.expirySec > market.expirySec);
    const successor = candidates.sort((a, b) => a.expirySec - b.expirySec)[0] ?? null;
    if (!successor) return null;
    const prints = await fetchOpeningPrices([successor.marketId]);
    return { ...successor, openingPriceRaw: prints.get(successor.marketId) ?? null };
  });
}

/** Next start for an empty lane: windows are contiguous, so it is the last expiry plus the (zero) roll gap. */
export async function laneNextStart(venueId: Bytes32, intervalSec: number): Promise<Reading<number | null>> {
  return withReading(`laneNext:${venueId}:${intervalSec}`, async () => {
    const rows = await getClient().listPastBinaryMarkets({ venueId, limit: HISTORY_PAGE, nowSec: nowSec() });
    const latest = rows.map((row) => toEventMarket(row, null)).filter((m) => m.intervalSec === intervalSec).sort((a, b) => b.expirySec - a.expirySec)[0];
    return latest ? latest.expirySec + ROLL_GAP_SEC : null;
  });
}
