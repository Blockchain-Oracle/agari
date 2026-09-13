"use client";

import { isOk } from "@masayume/core/schemas";
import { remainingSec } from "@masayume/core/units";
import { useLanes } from "@masayume/markets/react";
import { useMemo } from "react";
import { TICKER_SLOTS, useTickerPrices } from "@/components/chrome/useTickerPrices";
import { useNowMs } from "@/components/data/useNowMs";
import { useVenue } from "@/features/markets/useVenue";

// The ticker earns its motion by carrying live signal: asset prices and the countdown to
// the next close. Every figure here is a real DreamDEX reading — when there is nothing to
// show it says so rather than scrolling invented numbers.
interface MarqueeItem {
  label: string;
  value: string;
  direction?: "up" | "down" | "";
}

function mmss(totalSec: number): string {
  const s = Math.max(0, totalSec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function Marquee() {
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  const nowMs = useNowMs();

  const assets = useMemo(() => {
    if (!lanes || !isOk(lanes)) return [];
    const seen = new Set<string>();
    for (const lane of lanes.value.lanes) for (const market of lane.markets) seen.add(market.asset);
    return [...seen].sort().slice(0, TICKER_SLOTS);
  }, [lanes]);

  const prices = useTickerPrices(assets);

  // The soonest close across every live window — the same clock the hero counts down.
  const nextExpirySec = useMemo(() => {
    if (!lanes || !isOk(lanes)) return null;
    let soonest: number | null = null;
    for (const lane of lanes.value.lanes) {
      for (const market of lane.markets) {
        if (soonest === null || market.expirySec < soonest) soonest = market.expirySec;
      }
    }
    return soonest;
  }, [lanes]);

  const items: MarqueeItem[] = prices.map((p) => ({
    label: p.asset,
    value: p.priceText,
    direction: p.direction === "flat" ? "" : p.direction,
  }));

  if (nextExpirySec !== null && nowMs > 0) {
    items.push({ label: "NEXT CLOSE", value: mmss(remainingSec(nowMs, nextExpirySec)), direction: "" });
  }

  // An honest holding state: loading is a product state, invented prices are not.
  if (items.length === 0) items.push({ label: "MASAYUME", value: "LOADING", direction: "" });

  const renderCells = (keyPrefix: string) =>
    items.map((item, i) => (
      <span key={`${keyPrefix}-${i}`} className="marquee-cell">
        <span className="lbl">{item.label}</span>
        <span className="val">{item.value}</span>
        {item.direction && <span className={item.direction}>{item.direction === "up" ? "↑" : "↓"}</span>}
      </span>
    ));

  return (
    <div className="marquee">
      <div className="marquee-track">
        {renderCells("a")}
        {renderCells("b")}
        {renderCells("c")}
      </div>
    </div>
  );
}
