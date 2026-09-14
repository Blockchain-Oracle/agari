"use client";

import { groupByHorizon, type TickerSymbol } from "@agari/core/market";
import { diagnosisCopy } from "@agari/core/copy";
import type { Diagnosis, LaneSet } from "@agari/core/types";
import { useMemo } from "react";
import { MARKETS, WORD_BOARD } from "@/lib/copy";
import { useMarketSession } from "../session";
import { WordCard } from "./WordCard";

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
  const groups = groupByHorizon(laneSet, nowMs);

  if (laneSet === null && failure) return <div className="words-empty">{diagnosisCopy(failure.kind).body}</div>;

  if (laneSet === null || nowMs === 0) return <div className="words-empty">{WORD_BOARD.reading}</div>;
  if (groups.length === 0) return <div className="words-empty">{session && !session.open ? MARKETS.closedWindows(session.label).why : WORD_BOARD.between}</div>;

  return (
    <>
      {groups.map((group) => (
        <section key={group.key} className="words-section" aria-label={group.label}>
          <div className="words-sechead">
            <span className="words-sec-label">{group.label}</span>
            <span className="words-sec-count">{group.markets.length}</span>
          </div>
          <div className="words-grid">
            {group.markets.map((market) => (
              <WordCard key={market.marketId} market={market} nowMs={nowMs} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
