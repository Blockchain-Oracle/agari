import { TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";
import type { EventMarket, Lane, MarketId, Side } from "@agari/core/types";
import { StyleSheet, View } from "react-native";
import { laneAssetLabel, laneCadenceLabel, laneTabParts, type LaneTabKey } from "@/features/markets/lanes/lane-view";
import { configuredTickers } from "@/features/markets/lanes/next-window";
import { laneTickers, tickerMarkets } from "@/features/markets/lanes/useTickerPin";
import { laneState, type MarketSession } from "@/features/markets/session/useMarketSession";
import { MARKETS } from "@/lib/copy";
import { usePager } from "@/lib/use-pager";
import { EmptyState } from "~/components/portfolio/web/states";
import { LanePager } from "./LanePager";
import { TickerPicker } from "./LaneTabs";
import { PausedCard } from "./ListedCard";
import { MarketCard } from "./MarketCard";
import { NextWindowCard } from "./NextWindowCard";

/** Two rows of web's four-up rail at 1440; nine tickers in three cadences would bury §02. */
const LANE_PAGE_SIZE = 8;
const NO_PAUSES: ReadonlyMap<TickerSymbol, string> = new Map();

/** The roller's paused tickers in a lane; a closed Regular lane says nothing (every ticker is closed, not paused). */
function pausedIn(session: MarketSession | null, lane: Lane): Map<TickerSymbol, string> {
  const paused = new Map<TickerSymbol, string>();
  if (!session || (lane.basis === "regular" && !session.open)) return paused;
  for (const symbol of TICKER_SYMBOLS) {
    const state = laneState(session, symbol, lane.basis, lane.intervalSec);
    if (state?.startsWith("paused")) paused.set(symbol, state);
  }
  return paused;
}

interface TickerLaneProps {
  lane: Lane;
  ticker: TickerSymbol | null;
  onPick: (ticker: TickerSymbol | null) => void;
  session: MarketSession | null;
  nowMs: number;
  selectedMarketId: MarketId | null;
  onSelect?: (marketId: MarketId, side?: Side) => void;
  onOpenRoom?: (market: EventMarket) => void;
}

/** web's TickerLane + LaneRows: the picker, the live rail (`.markets-grid-live`, 12 apart) paged by eight, the paused slots on the last page. */
export function TickerLane({ lane, ticker, onPick, session, nowMs, selectedMarketId, onSelect, onOpenRoom }: TickerLaneProps) {
  const pausedStates = pausedIn(session, lane);
  const listed = laneTickers(lane);
  const tickers = TICKER_SYMBOLS.filter((symbol) => listed.includes(symbol) || pausedStates.has(symbol) || symbol === ticker);
  const markets = tickerMarkets(lane, ticker);
  const pager = usePager(markets, LANE_PAGE_SIZE);
  const pausedShown = [...pausedStates].filter(([symbol]) => ticker === null || symbol === ticker);
  const lastPage = pager.page === pager.pageCount - 1;
  return (
    <>
      {tickers.length > 1 || ticker !== null ? <TickerPicker tickers={tickers} basis={lane.basis} paused={pausedStates} ticker={ticker} onPick={onPick} /> : null}
      {markets.length === 0 && pausedShown.length === 0 ? (
        <EmptyState why={MARKETS.tickers.none(ticker ? laneAssetLabel(ticker, lane.basis) : "", laneCadenceLabel(lane.basis, lane.intervalSec))} />
      ) : (
        <View style={styles.grid}>
          {pager.slice.map((market) => (
            <MarketCard key={market.marketId} market={market} nowMs={nowMs} selected={market.marketId === selectedMarketId} onSelect={onSelect} onOpenRoom={onOpenRoom} />
          ))}
          {(lastPage ? pausedShown : []).map(([asset, state]) => (
            <PausedCard key={asset} asset={asset} basis={lane.basis} intervalSec={lane.intervalSec} state={state} />
          ))}
        </View>
      )}
      <LanePager pager={pager} />
    </>
  );
}

interface NextWindowRailProps {
  laneKey: LaneTabKey;
  session: MarketSession;
  nowSec: number;
  ticker: TickerSymbol | null;
  onPick: (ticker: TickerSymbol | null) => void;
  onSelect: (marketId: MarketId) => void;
}

/** web's NextWindowRail: a Regular lane while the market is closed (D-086), one next-Window card per configured ticker. */
export function NextWindowRail({ laneKey, session, nowSec, ticker, onPick, onSelect }: NextWindowRailProps) {
  const { basis, intervalSec } = laneTabParts(laneKey);
  const tickers = configuredTickers(session, laneKey);
  const shown = ticker === null ? tickers : tickers.filter((symbol) => symbol === ticker);
  const pager = usePager(shown, LANE_PAGE_SIZE);
  return (
    <>
      {tickers.length > 1 || ticker !== null ? <TickerPicker tickers={tickers} basis={basis} paused={NO_PAUSES} ticker={ticker} onPick={onPick} /> : null}
      {shown.length === 0 ? (
        <EmptyState why={MARKETS.tickers.none(ticker ? laneAssetLabel(ticker, basis) : "", laneCadenceLabel(basis, intervalSec))} />
      ) : (
        <View style={styles.grid}>
          {pager.slice.map((symbol) => (
            <NextWindowCard key={symbol} asset={symbol} basis={basis} intervalSec={intervalSec} session={session} nowSec={nowSec} onSelect={onSelect} />
          ))}
        </View>
      )}
      <LanePager pager={pager} />
    </>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 12 },
});
