import type { EventMarket, LaneSet } from "@agari/core/types";
import { describe, expect, it } from "vitest";
import { fixtureAddress, fixtureMarketId } from "@/app/dev/fixture-ids";
import { fixtureWindow } from "@/app/dev/fixture-window";
import { nextListedWindow } from "./next-window";

const NOW = 1_789_473_600; // Tue 09-15 08:00 ET
const OPEN = NOW + 5_400; // 09:30 ET
const VENUE = fixtureAddress("0xa1");

const window = (n: number, over: Partial<EventMarket> & { intervalSec: number; expirySec: number }) =>
  fixtureWindow({ marketId: fixtureMarketId(0x18_0000 + n), decimals: 6, status: "Listed", ...over });

const lanes = (...markets: EventMarket[]): LaneSet => {
  const byKey = new Map<string, EventMarket[]>();
  for (const m of markets) byKey.set(`${m.lane}:${m.intervalSec}`, [...(byKey.get(`${m.lane}:${m.intervalSec}`) ?? []), m]);
  return { venueId: VENUE, lanes: [...byKey.entries()].map(([key, list]) => ({ basis: list[0]!.lane, intervalSec: Number(key.split(":")[1]), label: "", markets: list, nextStartSec: null })) };
};

describe("nextListedWindow", () => {
  const tsla5 = window(1, { intervalSec: 300, expirySec: OPEN + 300 });
  const tsla60 = window(2, { intervalSec: 3_600, expirySec: OPEN + 1_800 + 3_600 });
  const nvda5 = window(3, { asset: "NVDA", intervalSec: 300, expirySec: OPEN + 300 });
  const tslaGap = window(4, { lane: "gap", intervalSec: 604_800, expirySec: OPEN + 86_400 * 3 });

  it("prefers the site's own cadence, then the soonest Regular Window of the asset", () => {
    const set = lanes(tsla60, tsla5, nvda5, tslaGap);
    expect(nextListedWindow(set, "TSLA", NOW, 300)?.marketId).toBe(tsla5.marketId);
    expect(nextListedWindow(set, "TSLA", NOW, 3_600)?.marketId).toBe(tsla60.marketId);
    expect(nextListedWindow(set, "TSLA", NOW, 900)?.marketId).toBe(tsla5.marketId);
    expect(nextListedWindow(set, "TSLA", NOW)?.marketId).toBe(tsla5.marketId);
    expect(nextListedWindow(set, "NVDA", NOW, 3_600)?.marketId).toBe(nvda5.marketId);
  });
  it("offers nothing once the Window is trading, and never a Gap or another asset's Window", () => {
    expect(nextListedWindow(lanes(tsla5), "TSLA", OPEN)).toBeNull();
    expect(nextListedWindow(lanes(tslaGap, nvda5), "TSLA", NOW)).toBeNull();
    expect(nextListedWindow(null, "TSLA", NOW)).toBeNull();
  });
});
