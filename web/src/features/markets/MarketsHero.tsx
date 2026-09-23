"use client";

import { isRestable } from "@agari/core/lifecycle";
import { LAUNCH_TICKERS, type TickerSymbol } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { mark } from "@agari/markets/perf";
import type { ReactNode } from "react";
import { ErrorState, LoadingState } from "@/components/states";
import { HeroAssetChart } from "./hero/HeroAssetChart";
import { HeroChart } from "./hero/HeroChart";
import type { LanesState } from "./lanes";
import { nextListedWindow } from "./lanes/next-window";
import { assetSourceLabel, windowSourceLabel } from "./price-source/source-label";
import { TicketPlaceholder } from "./ticket/TicketPlaceholder";
import { useWindowPhase } from "./ticket/useTicket";
import type { MarketsSelection } from "./useMarketsSelection";

export interface MarketsHeroProps {
  selection: MarketsSelection;
  lanes: LanesState;
  /** Selects a Window, with a side from the hero's UP/DOWN; without one from the closed hero's schedule seam (D-088). */
  onSelect: (marketId: MarketId, side?: Side) => void;
  /** Opens the Room for the Window in the hero. Held by the screen, not here — see MarketsScreen. */
  onOpenRoom: () => void;
  /** The ticket rail; it renders itself into the grid's second column, or as a drawer. */
  renderTicket: (selection: MarketsSelection) => ReactNode;
}

/**
 * The page hero — the question, the chart, and the ticket as one object.
 *
 * Ported from `reference/yosuku/app/markets/page.tsx`. The reference's structural
 * claim is that the market you are betting on is the page, not a card inside it:
 * the lanes below became a way to change the hero rather than a list you pick from
 * and then scroll past.
 */
/** The hero's asset when no Window is selected: the rail's pinned ticker, else the registry's first launch ticker. */
const DEFAULT_ASSET: TickerSymbol = LAUNCH_TICKERS[0] ?? "TSLA";

/**
 * What the hero shows before it has a Window.
 *
 * These were one branch — "Pick a Window above to read it here" — shown whenever the lane set
 * was not yet a value. That sentence asks the reader to act, so a cold load and a dead RPC both
 * looked like the app waiting for a click it never needed. Two faces remain here: still loading,
 * actually broken. A lane set with no Window in it is the asset hero (D-086), never an empty panel.
 */
function HeroPlaceholder({ lanes }: { lanes: LanesState }) {
  if (lanes.reading === null) return <LoadingState shape="chart" label="Loading live Windows" />;
  if (!isOk(lanes.reading)) return <ErrorState diagnosis={lanes.reading.error} retry={lanes.retry} />;
  return <LoadingState shape="chart" />;
}

/**
 * A selected Window that is listed but not yet open on the Regular or Gap lane (D-088). Before the first clock tick
 * the index's own status stands in, so the page never flashes the live hero on a Window with no print.
 */
function isListedSelection(market: EventMarket | null, phase: ReturnType<typeof useWindowPhase>): market is EventMarket {
  if (!market || market.lane === "token") return false;
  return phase ? isRestable(phase) : market.status === "Listed";
}

export function MarketsHero({ selection, lanes, onSelect, onOpenRoom, renderTicket }: MarketsHeroProps) {
  const laneList = lanes.laneSet?.lanes ?? [];
  const { market } = selection;
  const phase = useWindowPhase(market, selection.nowMs);
  // The closed page keeps the asset hero while a listed Window is selected (D-086 over D-088): the last session's
  // chart, price and change, with the head naming the Window and the rail already its schedule ticket. The live hero
  // takes over the moment the Window's opening print lands. The picker offers only assets with a listed Window in
  // the same cadence, so every pick resolves to a Window; the selection never silently outlives the pin.
  const listed = isListedSelection(market, phase);
  const nowSec = Math.floor((selection.nowMs > 0 ? selection.nowMs : marketsProvider.nowMs()) / 1000);
  const listedTickers = listed ? LAUNCH_TICKERS.filter((ticker) => nextListedWindow(lanes.laneSet, ticker, nowSec, market.intervalSec) !== null) : LAUNCH_TICKERS;
  const pickListed = (ticker: TickerSymbol | null) => {
    lanes.pinTicker(ticker);
    const next = ticker && listed ? nextListedWindow(lanes.laneSet, ticker, nowSec, market.intervalSec) : null;
    if (next) onSelect(next.marketId);
  };
  if (market) mark("route.useful", "markets.hero");
  return (
    <section className="page-hero markets-hero">
      <span className="crop tl" />
      <span className="crop tr" />
      <span className="crop bl" />
      <span className="crop br" />

      <div className="container">
        <div className="hero-grid hero-grid-mini">
          {listed ? (
            <HeroAssetChart asset={market.asset} tickers={listedTickers} onPickAsset={pickListed} window={market} source={windowSourceLabel(market)} />
          ) : market ? (
            <HeroChart
              market={market}
              nowMs={selection.nowMs}
              lanes={laneList}
              activeLaneKey={lanes.activeKey}
              pinnedMissingKey={lanes.pinnedMissing ? lanes.activeKey : null}
              onPin={lanes.pin}
              onSelect={onSelect}
              onOpenRoom={onOpenRoom}
            />
          ) : lanes.laneSet ? (
            <HeroAssetChart
              asset={lanes.ticker ?? DEFAULT_ASSET}
              tickers={LAUNCH_TICKERS}
              onPickAsset={lanes.pinTicker}
              onSelect={onSelect}
              source={assetSourceLabel(lanes.ticker ?? DEFAULT_ASSET, lanes.laneSet)}
            />
          ) : (
            <div className="hero-chart mh-hero-empty">
              <HeroPlaceholder lanes={lanes} />
            </div>
          )}
          {market ? renderTicket(selection) : lanes.laneSet ? <TicketPlaceholder asset={lanes.ticker ?? DEFAULT_ASSET} onSelect={onSelect} /> : null}
        </div>
      </div>
    </section>
  );
}
