"use client";

import { groupByHorizon, LISTED_HORIZON, type TickerSymbol } from "@agari/core/market";
import { diagnosisCopy } from "@agari/core/copy";
import type { Diagnosis, EventMarket, LaneSet } from "@agari/core/types";
import { useMemo } from "react";
import { EmptyState } from "@/components/states";
import { WORD_BOARD } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { SESSION_COPY } from "@/lib/copy-session";
import { useSessionPhrase, useWhen } from "@/lib/when";
import { useMarketSession } from "../session";
import { WordCard } from "./WordCard";
import { WordListedCard } from "./WordListedCard";

/** Listed Windows as one card per company, in the group's order (earliest open, shortest cadence first). */
function byAsset(markets: readonly EventMarket[]): EventMarket[][] {
  const rows = new Map<string, EventMarket[]>();
  for (const m of markets) rows.set(m.asset, [...(rows.get(m.asset) ?? []), m]);
  return [...rows.values()];
}

interface WordMarketBoardProps {
  /** The lane set the rail already holds — the board never opens a second market stream. */
  laneSet: LaneSet | null;
  /** Why there is no lane set, when the read failed rather than is still in flight. */
  failure: Diagnosis | null;
  /** The rail's pinned ticker: nine tickers in three cadences is 27 questions, so the board narrows with the rail. */
  ticker: TickerSymbol | null;
  nowMs: number;
}

function forTicker(laneSet: LaneSet | null, ticker: TickerSymbol | null): LaneSet | null {
  if (laneSet === null || ticker === null) return laneSet;
  return { ...laneSet, lanes: laneSet.lanes.map((lane) => ({ ...lane, markets: lane.markets.filter((market) => market.asset === ticker) })) };
}

/**
 * The word board — ported from `reference/yosuku/components/WordMarketBoard.tsx`.
 *
 * The same live Windows the rail lists, said as time-scheduled Yes/No questions and
 * grouped by how soon they close. Two structural adaptations:
 *
 *  - The reference fetches its own markets and spot on a 12 s poll so it can also
 *    stand alone. Here it takes the lane set as a prop, so `/markets` runs one
 *    market stream rather than two (RESUME.md, §The read pipeline).
 *  - Its questions are BTC-only; these follow whatever the venue lists.
 *
 * `nowMs` is 0 until the first client tick, which is what keeps the wall-clock times
 * out of the server render — so "reading the board…" is also the pre-hydration state,
 * exactly as the reference's `now === 0` guard makes it.
 */
export function WordMarketBoard({ laneSet: allLanes, failure, ticker, nowMs }: WordMarketBoardProps) {
  const laneSet = useMemo(() => forTicker(allLanes, ticker), [allLanes, ticker]);
  const session = useMarketSession();
  const when = useWhen();
  const phrase = useSessionPhrase();
  const groups = groupByHorizon(laneSet, nowMs);
  const closed = session !== null && !session.open;

  if (laneSet === null && failure) return <div className="words-empty">{diagnosisCopy(failure.kind).body}</div>;

  if (laneSet === null || nowMs === 0) return <div className="words-empty">{WORD_BOARD.reading}</div>;
  // Closed: the phrase says when the questions return, and the wire is the next thing to read (D-086).
  if (groups.length === 0 && session && !session.open) {
    return <EmptyState why={SESSION_COPY.board.closed(phrase(session.status, Math.floor(nowMs / 1000)))} nextAction={{ label: SESSION_COPY.board.nextAction, href: "/news" }} />;
  }
  if (groups.length === 0) return <div className="words-empty">{WORD_BOARD.between}</div>;

  return (
    <>
      {closed && (
        <div className="words-closed" role="status">
          <span className="words-closed-dot" aria-hidden />
          <strong>{CLOSED.strip(phrase(session.status, Math.floor(nowMs / 1000)))}</strong>
          <span>{CLOSED.stripTail}</span>
        </div>
      )}
      {groups.map((group) => {
        const listed = group.key === LISTED_HORIZON.key;
        const first = group.markets[0];
        const label = listed && first ? CLOSED.listed(when(first.tradingStartSec)) : group.label;
        const rows = listed ? byAsset(group.markets) : null;
        return (
          <section key={group.key} className="words-section" aria-label={label} data-group={group.key}>
            <div className="words-sechead">
              <span className="words-sec-label">{label}</span>
              <span className="words-sec-count">{rows ? rows.length : group.markets.length}</span>
            </div>
            <div className="words-grid">
              {rows
                ? rows.map((markets) => <WordListedCard key={markets[0]!.asset} markets={markets} />)
                : group.markets.map((market) => <WordCard key={market.marketId} market={market} nowMs={nowMs} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}
