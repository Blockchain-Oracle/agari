import type { EventMarket, LaneSet } from "../types/market";

/**
 * How the word board groups live Windows by how soon they close.
 *
 * Bands are the reference's own (`components/WordMarketBoard.tsx` L31–35): 6 minutes
 * and 65 minutes. Only the third label changes. The reference's venue tops out at an
 * hour, so "Later today" was always true there; this venue lists 1d Windows, whose
 * close is often tomorrow — so the label states only the ordering it can prove.
 */
export const HORIZONS = [
  { key: "soon", label: "Closing in minutes", withinMs: 6 * 60_000 },
  { key: "hour", label: "Closing this hour", withinMs: 65 * 60_000 },
  { key: "later", label: "Later", withinMs: Number.POSITIVE_INFINITY },
] as const;

export type HorizonKey = (typeof HORIZONS)[number]["key"];

export interface HorizonGroup {
  key: HorizonKey;
  label: string;
  markets: EventMarket[];
}

/** Windows this close to expiry are past the point of a useful one-tap call (reference L69). */
export const WORD_BOARD_MIN_LEAD_MS = 20_000;

/**
 * Every live Window the venue lists, as one board ordered by close.
 *
 * Bands are half-open — `(previous, within]` — so a Window sitting exactly on a
 * boundary lands in the tighter group and in exactly one group. An empty group is
 * dropped rather than rendered as a heading with nothing under it.
 *
 * Returns `[]` for an unread lane set or a clock that has not ticked, which is what
 * lets the board show "reading the board…" rather than "between rounds" — those are
 * different states and only one of them is a claim about the venue.
 */
export function groupByHorizon(laneSet: LaneSet | null, nowMs: number): HorizonGroup[] {
  if (laneSet === null || nowMs === 0) return [];

  const live = laneSet.lanes
    .flatMap((lane) => lane.markets)
    .filter((market) => market.expirySec * 1000 - nowMs > WORD_BOARD_MIN_LEAD_MS)
    .sort((a, b) => a.expirySec - b.expirySec);

  return HORIZONS.map((horizon, index) => {
    const floorMs = index === 0 ? 0 : HORIZONS[index - 1]!.withinMs;
    return {
      key: horizon.key,
      label: horizon.label,
      markets: live.filter((market) => {
        const leftMs = market.expirySec * 1000 - nowMs;
        return leftMs > floorMs && leftMs <= horizon.withinMs;
      }),
    };
  }).filter((group) => group.markets.length > 0);
}
