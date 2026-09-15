"use client";

import { sessionPhrase } from "@agari/core/copy";
import { formatEtClock, type TickerSymbol } from "@agari/core/market";
import type { Reading } from "@agari/core/schemas";
import type { EventMarket, MarketId } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { useTick } from "@agari/markets/react";
import { useState } from "react";
import { ReadingBoundary } from "@/components/states";
import { SESSION_COPY } from "@/lib/copy-session";
import type { HistoryRange } from "../asset-history/range";
import { historyDayChange, useAssetHistory, type AssetHistory } from "../asset-history/useAssetHistory";
import { TickerPicker } from "../lanes/TickerPicker";
import { useMarketSession, type MarketSession } from "../session";
import { HeroAssetHead } from "./HeroAssetHead";
import { PriceChart } from "./PriceChart";
import { ScheduleCallButton } from "./ScheduleCallButton";
import { usdLine } from "./units";
import "./asset-hero.css";

/** The head's countdown and phrase move by the minute; one shared 30 s beat serves both. */
const CLOCK_TICK_MS = 30_000;
const NO_PAUSES: ReadonlyMap<TickerSymbol, string> = new Map();

export interface HeroAssetChartViewProps {
  asset: TickerSymbol;
  /** Every ticker the picker offers; the hero follows the rail's pin. */
  tickers: readonly TickerSymbol[];
  onPickAsset: (asset: TickerSymbol | null) => void;
  session: MarketSession;
  history: Reading<AssetHistory> | null;
  nowSec: number;
  range: HistoryRange;
  onRange: (range: HistoryRange) => void;
  /** Selects a listed Window for the schedule seam (D-088); absent on a fixture, which then shows no seam. */
  onSelect?: (marketId: MarketId) => void;
  /** The listed Window the page has selected (D-088): the head names it and the rail is already its schedule ticket, so no seam. */
  window?: EventMarket | null;
}

/**
 * The hero with no Window in it (D-086), or with a listed one (D-088): the asset is the page. Masayume's `.hero-chart` panel, block for block —
 * head, canvas, foot — over the signed archive of the last session and the live tick. The reference line is the
 * previous close (the session's open when the archive starts here); the foot says the session phrase, the last
 * close and where the prints come from, and carries the schedule seam where the live hero keeps the Room (D-088).
 */
export function HeroAssetChartView({ asset, tickers, onPickAsset, session, history, nowSec, range, onRange, onSelect, window = null }: HeroAssetChartViewProps) {
  const h = history?.ok ? history.value : null;
  const latest = h?.latest ?? null;
  const live = h !== null && h.liveSec !== null;
  const change = h ? historyDayChange(h) : null;
  const closeLine = h?.lastClose ? SESSION_COPY.next.lastClose(usdLine(h.lastClose.priceRaw), formatEtClock(h.lastClose.sec)) : null;
  return (
    <div className="hero-chart" data-asset={asset}>
      <HeroAssetHead
        asset={asset}
        session={session}
        nowSec={nowSec}
        price={latest ? { raw: latest.valueRaw, sec: latest.timeSec } : null}
        live={live}
        change={change}
        range={range}
        onRange={onRange}
        window={window}
      />
      {tickers.length > 1 && (
        <div className="mh-asset-pick">
          <TickerPicker tickers={tickers} basis="regular" paused={NO_PAUSES} ticker={asset} onPick={onPickAsset} />
        </div>
      )}
      <div className="hero-chart-canvas">
        <div className="mh-chart-fill">
          {/* `tick={false}`: an aged archive read is the last session by definition, never a stale live value (D-086). */}
          <ReadingBoundary reading={history} shape="chart" tick={false} isEmpty={(v) => v.points.length < 2} empty={{ why: SESSION_COPY.hero.noHistory(asset) }}>
            {(v) => (
              // Keyed by asset: the chart fixes its reference line at creation, so a new asset gets a new chart.
              <PriceChart
                key={asset}
                points={v.points}
                openingRaw={v.prevClose?.priceRaw ?? null}
                lineLabel={v.lineIsOpen ? SESSION_COPY.hero.openLine : SESSION_COPY.hero.prevCloseLine}
                className="h-full w-full"
              />
            )}
          </ReadingBoundary>
        </div>
      </div>
      <div className="hero-chart-foot">
        {/* A div, not a span: Masayume's `.hero-chart-foot > span:first-child` caps its own source note's width. */}
        <div className="mh-foot-line">
          <span>{sessionPhrase(session.status, nowSec)}</span>
          {closeLine && <span className="mh-foot-soft">· {closeLine}</span>}
          <span className="mh-foot-soft mh-foot-source">· {SESSION_COPY.hero.source}</span>
        </div>
        {onSelect && !window && <ScheduleCallButton asset={asset} session={session} nowSec={nowSec} onSelect={onSelect} variant="foot" opensSec={session.status.nextOpenSec} />}
      </div>
    </div>
  );
}

export interface HeroAssetChartProps {
  asset: TickerSymbol;
  tickers: readonly TickerSymbol[];
  onPickAsset: (asset: TickerSymbol | null) => void;
  onSelect?: (marketId: MarketId) => void;
  window?: EventMarket | null;
}

/** The live hero for an asset: the session, its archive and the tick, on the shared 30 s beat. */
export function HeroAssetChart({ asset, tickers, onPickAsset, onSelect, window = null }: HeroAssetChartProps) {
  const session = useMarketSession(asset);
  const [range, setRange] = useState<HistoryRange>("1D");
  const history = useAssetHistory(asset, session, range);
  useTick(CLOCK_TICK_MS);
  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  if (!session) return null;
  return <HeroAssetChartView asset={asset} tickers={tickers} onPickAsset={onPickAsset} session={session} history={history} nowSec={nowSec} range={range} onRange={setRange} onSelect={onSelect} window={window} />;
}
