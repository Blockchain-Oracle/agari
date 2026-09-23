import { betweenRoundsLine } from "@agari/core/copy";
import { TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { Lane } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { laneAssetLabel, laneCadenceLabel, laneTabParts, type LaneTabKey } from "@/features/markets/lanes/lane-view";
import { configuredLaneKeys, configuredTickers } from "@/features/markets/lanes/next-window";
import { useLaneNextStart, type LanesState } from "@/features/markets/lanes/useLanes";
import { laneTickers, tickerMarkets } from "@/features/markets/lanes/useTickerPin";
import { laneState, useMarketSession, type MarketSession } from "@/features/markets/session/useMarketSession";
import { useVenue } from "@/features/markets/useVenue";
import { MARKETS } from "@/lib/copy";
import { SESSION_COPY } from "@/lib/copy-session";
import { useSessionPhrase } from "@/lib/when";
import { Button, EmptyState, LoadingState, ReadingView } from "~/components/kit";
import { LaneTabs, TickerPicker } from "./LaneTabs";
import { PausedCard } from "./ListedCard";
import { MarketCard } from "./MarketCard";
import { NextWindowCard } from "./NextWindowCard";

/** web's lane page: two rows of the four-up rail; a phone shows as many and offers the rest. */
const PAGE = 8;
const NO_PAUSES: ReadonlyMap<TickerSymbol, string> = new Map();

/** The roller's paused tickers in a lane (a closed Regular lane says nothing: every ticker is closed, not paused). */
function pausedIn(session: MarketSession | null, lane: Lane): Map<TickerSymbol, string> {
  const paused = new Map<TickerSymbol, string>();
  if (!session || (lane.basis === "regular" && !session.open)) return paused;
  for (const symbol of TICKER_SYMBOLS) {
    const state = laneState(session, symbol, lane.basis, lane.intervalSec);
    if (state?.startsWith("paused")) paused.set(symbol, state);
  }
  return paused;
}

/**
 * web's CadenceLanes: the lane tabs (live lanes, and ops' configured lanes while none is live), the ticker picker, and
 * the rail — live cards and paused slots; on a closed Regular lane, the next-Window cards; on an empty lane, when the
 * next Window opens.
 */
export function LaneBoard({ state, nowMs }: { state: LanesState; nowMs: number }) {
  const session = useMarketSession();
  const configured = useMemo(() => configuredLaneKeys(session), [session]);
  const activeKey = state.activeKey ?? configured[0] ?? null;
  const nowSec = Math.floor(nowMs / 1000);
  const lane = state.activeLane;
  const listsNext = session !== null && !session.open && activeKey !== null && laneTabParts(activeKey).basis === "regular" && configuredTickers(session, activeKey).length > 0;

  return (
    <ReadingView reading={state.reading} loading="list" retry={state.retry}>
      {(laneSet) =>
        laneSet.lanes.length === 0 && !state.pinnedMissing && configured.length === 0 ? (
          <EmptyState why={MARKETS.noLiveWindows.why} />
        ) : (
          <View style={styles.stack}>
            <LaneTabs lanes={laneSet.lanes} activeKey={activeKey} pinnedMissingKey={state.pinnedMissing ? state.activeKey : null} extraKeys={configured} onPin={state.pin} />
            {lane !== null && lane.markets.length > 0 ? (
              <TickerRail lane={lane} ticker={state.ticker} onPick={state.pinTicker} session={session} nowMs={nowMs} />
            ) : listsNext && session && activeKey ? (
              <NextRail laneKey={activeKey} session={session} nowSec={nowSec} ticker={state.ticker} onPick={state.pinTicker} />
            ) : (
              <BetweenRounds activeKey={activeKey} nowMs={nowMs} session={session} />
            )}
          </View>
        )
      }
    </ReadingView>
  );
}

/** web's TickerLane: the picker over every listed, paused or pinned ticker, then the live cards and the paused slots. */
function TickerRail({ lane, ticker, onPick, session, nowMs }: { lane: Lane; ticker: TickerSymbol | null; onPick: (t: TickerSymbol | null) => void; session: MarketSession | null; nowMs: number }) {
  const [shown, setShown] = useState(PAGE);
  const paused = pausedIn(session, lane);
  const listed = laneTickers(lane);
  const tickers = TICKER_SYMBOLS.filter((symbol) => listed.includes(symbol) || paused.has(symbol) || symbol === ticker);
  const markets = tickerMarkets(lane, ticker);
  const pausedShown = [...paused].filter(([symbol]) => ticker === null || symbol === ticker);
  return (
    <View style={styles.stack}>
      {tickers.length > 1 || ticker !== null ? <TickerPicker tickers={tickers} basis={lane.basis} paused={paused} ticker={ticker} onPick={onPick} /> : null}
      {markets.length === 0 && pausedShown.length === 0 ? (
        <EmptyState why={MARKETS.tickers.none(ticker ? laneAssetLabel(ticker, lane.basis) : "", laneCadenceLabel(lane.basis, lane.intervalSec))} />
      ) : (
        <>
          {markets.slice(0, shown).map((market, index) => (
            <MarketCard key={market.marketId} market={market} nowMs={nowMs} index={index} />
          ))}
          {markets.length > shown ? <Button label={`Show ${Math.min(PAGE, markets.length - shown)} more`} variant="secondary" onPress={() => setShown((n) => n + PAGE)} /> : null}
          {markets.length <= shown
            ? pausedShown.map(([symbol, laneWord]) => <PausedCard key={symbol} asset={symbol} basis={lane.basis} intervalSec={lane.intervalSec} state={laneWord} />)
            : null}
        </>
      )}
    </View>
  );
}

/** web's NextWindowRail: a closed Regular lane, one next-Window card per configured ticker. */
function NextRail({ laneKey, session, nowSec, ticker, onPick }: { laneKey: LaneTabKey; session: MarketSession; nowSec: number; ticker: TickerSymbol | null; onPick: (t: TickerSymbol | null) => void }) {
  const { basis, intervalSec } = laneTabParts(laneKey);
  const tickers = configuredTickers(session, laneKey);
  const shown = ticker === null ? tickers : tickers.filter((symbol) => symbol === ticker);
  return (
    <View style={styles.stack}>
      {tickers.length > 1 || ticker !== null ? <TickerPicker tickers={tickers} basis={basis} paused={NO_PAUSES} ticker={ticker} onPick={onPick} /> : null}
      {shown.length === 0 ? (
        <EmptyState why={MARKETS.tickers.none(ticker ? laneAssetLabel(ticker, basis) : "", laneCadenceLabel(basis, intervalSec))} />
      ) : (
        shown.map((symbol) => <NextWindowCard key={symbol} asset={symbol} basis={basis} intervalSec={intervalSec} session={session} nowSec={nowSec} />)
      )}
    </View>
  );
}

/** web's BetweenRounds: an empty lane says when its next Window opens — an estimate from the last expiry, never a timetable. */
function BetweenRounds({ activeKey, nowMs, session }: { activeKey: LaneTabKey | null; nowMs: number; session: MarketSession | null }) {
  const phrase = useSessionPhrase();
  const { venueId } = useVenue();
  const parts = activeKey ? laneTabParts(activeKey) : null;
  const closed = parts?.basis === "regular" && session !== null && !session.open;
  const next = useLaneNextStart(closed ? null : venueId, parts?.intervalSec ?? null);
  if (closed && session) {
    return <EmptyState why={SESSION_COPY.lanes.closed(phrase(session.status, Math.floor(nowMs / 1000)))} action={{ label: SESSION_COPY.ticket.readWire, onPress: () => router.push("/news") }} />;
  }
  if (next === null || nowMs === 0 || !parts) return <LoadingState shape="line" />;
  const nextStartMs = isOk(next) && next.value !== null && secToMs(next.value) > nowMs ? secToMs(next.value) : null;
  const line = betweenRoundsLine(nextStartMs, nowMs, parts.intervalSec);
  return <EmptyState why={nextStartMs === null ? line : `${line} (${MARKETS.estimated})`} />;
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
});
