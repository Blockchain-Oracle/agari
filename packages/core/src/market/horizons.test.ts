import { describe, expect, it } from "vitest";
import type { EventMarket, LaneSet } from "../types/market";
import { groupByHorizon, HORIZONS, WORD_BOARD_MIN_LEAD_MS } from "./horizons";

const NOW_MS = 1_800_000_000_000;
const NOW_SEC = NOW_MS / 1000;

/** Only the fields the grouping reads; the rest of EventMarket is irrelevant here. */
function market(id: string, secondsOut: number): EventMarket {
  return { marketId: id, expirySec: NOW_SEC + secondsOut } as unknown as EventMarket;
}

function laneSet(...markets: EventMarket[]): LaneSet {
  return { venueId: "0x0" as LaneSet["venueId"], excludedFixedStrike: 0, lanes: [{ intervalSec: 300, label: "5m", markets, nextStartSec: null }] };
}

const ids = (laneSetIn: LaneSet) => groupByHorizon(laneSetIn, NOW_MS).map((g) => [g.key, g.markets.map((m) => m.marketId)]);

describe("groupByHorizon", () => {
  it("separates the unread board from an empty one", () => {
    // Different states: one is "we have not read yet", the other is a claim about the venue.
    expect(groupByHorizon(null, NOW_MS)).toEqual([]);
    expect(groupByHorizon(laneSet(market("a", 60)), 0)).toEqual([]);
  });

  it("puts each Window in exactly one band, boundaries included", () => {
    const soonEdge = HORIZONS[0].withinMs / 1000;
    const hourEdge = HORIZONS[1].withinMs / 1000;
    expect(
      ids(laneSet(market("on-soon-edge", soonEdge), market("just-past-soon", soonEdge + 1), market("on-hour-edge", hourEdge), market("just-past-hour", hourEdge + 1))),
    ).toEqual([
      ["soon", ["on-soon-edge"]],
      ["hour", ["just-past-soon", "on-hour-edge"]],
      ["later", ["just-past-hour"]],
    ]);
  });

  it("drops Windows too close to expiry to act on, and keeps the one just inside", () => {
    const lead = WORD_BOARD_MIN_LEAD_MS / 1000;
    expect(ids(laneSet(market("expired", -5), market("on-the-lead", lead), market("inside", lead + 1)))).toEqual([["soon", ["inside"]]]);
  });

  it("orders by close across every lane and omits empty bands", () => {
    const twoLanes: LaneSet = {
      venueId: "0x0" as LaneSet["venueId"],
      excludedFixedStrike: 0,
      lanes: [
        { intervalSec: 3600, label: "1h", markets: [market("hourly", 120)], nextStartSec: null },
        { intervalSec: 300, label: "5m", markets: [market("five", 60)], nextStartSec: null },
      ],
    };
    // Only "soon" survives — the other two bands are dropped, not rendered empty.
    expect(ids(twoLanes)).toEqual([["soon", ["five", "hourly"]]]);
  });
});
