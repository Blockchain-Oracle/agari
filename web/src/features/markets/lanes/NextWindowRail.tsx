"use client";

import type { TickerSymbol } from "@agari/core/market";
import type { MarketId } from "@agari/core/types";
import { Pager } from "@/components/chrome";
import { EmptyState } from "@/components/states";
import { MARKETS } from "@/lib/copy";
import { usePager } from "@/lib/use-pager";
import type { MarketSession } from "../session";
import { laneAssetLabel, laneCadenceLabel, laneTabParts, type LaneTabKey } from "./lane-view";
import { configuredTickers } from "./next-window";
import { NextWindowCard } from "./NextWindowCard";
import { TickerPicker } from "./TickerPicker";

/** The same page as the live rail (`TickerLane`): two rows of the four-up grid at 1440. */
const LANE_PAGE_SIZE = 8;
const NO_PAUSES: ReadonlyMap<TickerSymbol, string> = new Map();

interface NextWindowRailProps {
  laneKey: LaneTabKey;
  session: MarketSession;
  nowSec: number;
  ticker: TickerSymbol | null;
  onPick: (ticker: TickerSymbol | null) => void;
  /** Selects a listed Window from a card's schedule seam (D-088). */
  onSelect: (marketId: MarketId) => void;
}

/** A Regular lane while the market is closed (D-086): one next-Window card per configured ticker, picker and pager as the live rail. */
export function NextWindowRail({ laneKey, session, nowSec, ticker, onPick, onSelect }: NextWindowRailProps) {
  const { basis, intervalSec } = laneTabParts(laneKey);
  const tickers = configuredTickers(session, laneKey);
  const shown = ticker === null ? tickers : tickers.filter((symbol) => symbol === ticker);
  const pager = usePager(shown, LANE_PAGE_SIZE);
  return (
    <>
      {(tickers.length > 1 || ticker !== null) && <TickerPicker tickers={tickers} basis={basis} paused={NO_PAUSES} ticker={ticker} onPick={onPick} />}
      {shown.length === 0 ? (
        <EmptyState why={MARKETS.tickers.none(ticker ? laneAssetLabel(ticker, basis) : "", laneCadenceLabel(basis, intervalSec))} />
      ) : (
        <div className="markets-grid markets-grid-live">
          {pager.slice.map((symbol) => (
            <NextWindowCard key={symbol} asset={symbol} basis={basis} intervalSec={intervalSec} session={session} nowSec={nowSec} onSelect={onSelect} />
          ))}
        </div>
      )}
      <Pager pager={pager} />
    </>
  );
}
