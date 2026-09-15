"use client";

import { formatSessionSpan, sessionCountdown, sessionPhrase } from "@agari/core/copy";
import type { TickerSymbol } from "@agari/core/market";
import type { LaneBasis } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { useTick } from "@agari/markets/react";
import { AssetDisc } from "../markets/hero/asset-mark";
import { etWhen, laneAssetLabel } from "../markets/lanes/lane-view";
import { useMarketSession, type MarketSession } from "../markets/session";
import { LANDING } from "./copy";
import { laneBoard, type LaneBoard } from "./data";

/** The lane lines count to the minute; the same 30 s beat the hero head and the session chip share. */
const CLOCK_TICK_MS = 30_000;
/** One row of marks at 1440; the rest fold into "+n". */
const MARKS_SHOWN = 9;
const BASES: readonly LaneBasis[] = ["regular", "gap", "token"];

function LaneMarks({ basis, tickers }: { basis: LaneBasis; tickers: readonly TickerSymbol[] }) {
  if (tickers.length === 0) return null;
  const shown = tickers.slice(0, MARKS_SHOWN);
  return (
    <ul className="lp-lane-marks" aria-label={LANDING.lanes.names(tickers.length)}>
      {shown.map((symbol) => {
        const label = laneAssetLabel(symbol, basis);
        return (
          <li key={symbol} title={label}>
            <AssetDisc asset={label} className="lp-mark" />
            <span className="sr-only">{label}</span>
          </li>
        );
      })}
      {tickers.length > shown.length && <li className="lp-lane-more">+{tickers.length - shown.length}</li>}
    </ul>
  );
}

/** What the lane does next, in one line: the open countdown, each cadence's first Window, the next weekend, or 24/7. */
function laneLine(basis: LaneBasis, board: LaneBoard, session: MarketSession, nowSec: number): string {
  if (board.tickers[basis].length === 0) return LANDING.lanes.notListed;
  if (basis === "token") return LANDING.lanes.token.open(board.tokenCadences.join(" · "));
  if (basis === "gap") return board.weekend ? LANDING.lanes.gap.next(etWhen(board.weekend.closeSec), etWhen(board.weekend.openSec)) : sessionPhrase(session.status, nowSec);
  const countdown = sessionCountdown(session.status, nowSec);
  if (session.open && countdown?.kind === "closes") return LANDING.lanes.regular.open(formatSessionSpan(countdown.remainingSec));
  const starts = board.regular.flatMap((c) => (c.startSec === null ? [] : [LANDING.lanes.regular.first(c.cadence, etWhen(c.startSec))]));
  return starts.length > 0 ? starts.join(" · ") : sessionPhrase(session.status, nowSec);
}

/**
 * The three lanes (D-093): each lane's rule never moves, so it renders at once; the names and the next Window come
 * from the shared `/session` read. A lane ops does not configure says so, rather than showing a board it cannot fill.
 */
export function LandingLanes() {
  const session = useMarketSession();
  useTick(CLOCK_TICK_MS);
  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  const board = session ? laneBoard(session, nowSec) : null;
  return (
    <div className="lp-lanes">
      {BASES.map((basis) => {
        const words = LANDING.lanes[basis];
        const listed = board ? board.tickers[basis].length > 0 : null;
        return (
          <article key={basis} className="lp-lane" data-lane={basis} data-listed={listed === null ? undefined : String(listed)}>
            <header className="lp-lane-head">
              <h3 className="lp-lane-name">{words.name}</h3>
              <span className="lp-lane-clock">{words.clock}</span>
            </header>
            <p className="lp-lane-body">{words.body}</p>
            {board && <LaneMarks basis={basis} tickers={board.tickers[basis]} />}
            <p className="lp-lane-next" role="status">
              <span className="lp-lane-dot" aria-hidden />
              {session && board ? laneLine(basis, board, session, nowSec) : LANDING.lanes.reading}
            </p>
          </article>
        );
      })}
    </div>
  );
}
