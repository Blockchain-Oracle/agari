"use client";

import { diagnosisCopy } from "@agari/core/copy";
import { LAUNCH_TICKERS } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import { remainingSec } from "@agari/core/units";
import { useLanes } from "@agari/markets/react";
import { useMemo } from "react";
import { TICKER_SLOTS, useTickerPrices } from "@/components/chrome/useTickerPrices";
import { useNowMs } from "@/components/data/useNowMs";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { useMarketSession, type MarketSession } from "@/features/markets/session/useMarketSession";
import { useVenue } from "@/features/markets/useVenue";
import type { SentimentReading } from "@/features/news/protocol";
import { useSentiment } from "@/features/news/useSentiment";

// The ticker earns its motion by carrying live signal: asset prices, the countdown to the next close (or, off-hours,
// the next open) and the crowd's lean. Every figure here is a real Agari reading — when there is nothing to show it
// says so rather than scrolling invented numbers.
interface MarqueeItem {
  /** A price cell: the asset whose mark leads the label (D-085). */
  asset?: string;
  label: string;
  value: string;
  direction?: "up" | "down" | "";
  /** Words in the direction's ink instead of its arrow (the sentiment cell's `UP` / `DOWN`). */
  tag?: string;
}

function mmss(totalSec: number): string {
  const s = Math.max(0, totalSec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Off-hours: "Opens Mon 09:30 ET" → `OPENS MON 09:30 ET`; a closed day with no known open, or a halt, says just that. */
function sessionCell(session: MarketSession): MarqueeItem {
  const opens = /^Opens (.+)$/.exec(session.label);
  return opens ? { label: "OPENS", value: (opens[1] as string).toUpperCase() } : { label: "NYSE", value: session.label.toUpperCase() };
}

/** Q-S13-1: the crowd's lean as its majority side in whole percent, `SENTIMENT —` below the fill floor or unread. */
function sentimentCell(reading: SentimentReading | null): MarqueeItem {
  if (reading === null || reading.upBps === null) return { label: "SENTIMENT", value: "—" };
  const up = reading.upBps >= 5_000;
  const shareBps = up ? reading.upBps : 10_000 - reading.upBps;
  return { label: "CROWD", value: `${Math.floor((shareBps + 50) / 100)}%`, direction: up ? "up" : "down", tag: up ? "UP" : "DOWN" };
}

export default function Marquee() {
  const { venueId, venueFailure } = useVenue();
  const lanes = useLanes(venueId);
  const session = useMarketSession();
  const sentiment = useSentiment();
  const nowMs = useNowMs();

  // Live-lane tickers first, then the registry's launch order, so off-hours the strip still carries the last prices.
  const assets = useMemo(() => {
    const live = new Set<string>();
    if (lanes && isOk(lanes)) for (const lane of lanes.value.lanes) for (const market of lane.markets) live.add(market.asset);
    return [...new Set([...[...live].sort(), ...LAUNCH_TICKERS])].slice(0, TICKER_SLOTS);
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
    asset: p.asset,
    label: p.asset,
    value: p.priceText,
    direction: p.direction === "flat" ? "" : p.direction,
  }));

  // In session (or while the session is unknown) the next close; outside it, when the market next opens.
  if (session && !session.open) items.push(sessionCell(session));
  else if (nextExpirySec !== null && nowMs > 0) {
    items.push({ label: "NEXT CLOSE", value: mmss(remainingSec(nowMs, nextExpirySec)), direction: "" });
  }

  // An honest holding state: loading is a product state, invented prices are not. A read that failed is not
  // loading, so it says why instead of spinning forever.
  if (items.length === 0) {
    const failure = lanes && !isOk(lanes) ? lanes.error : venueFailure;
    const failed = failure ? diagnosisCopy(failure.kind).headline.toUpperCase() : null;
    items.push({ label: "AGARI", value: failed ?? "LOADING", direction: "" });
  }

  items.push(sentimentCell(sentiment?.ok ? sentiment.value : null));

  const renderCells = (keyPrefix: string) =>
    items.map((item, i) => (
      <span key={`${keyPrefix}-${i}`} className="marquee-cell">
        {item.asset && <AssetDisc asset={item.asset} className="marquee-mark" />}
        <span className="lbl">{item.label}</span>
        <span className="val">{item.value}</span>
        {item.direction && <span className={item.direction}>{item.tag ?? (item.direction === "up" ? "↑" : "↓")}</span>}
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
