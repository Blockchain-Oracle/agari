"use client";

import { isOk, type Reading } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { formatClock, remainingSec } from "@agari/core/units";
import { etDateOf } from "@agari/core/market";
import { useMemo } from "react";
import { SectionHeader } from "@/components/chrome";
import { diagnosisCopy } from "@/lib/copy";
import { Banzuke, banzukeRows } from "./Banzuke";
import { BoardFilters, type BoardScope } from "./BoardFilters";
import { FriendsBoard } from "@/features/social/FriendsBoard";
import { LEADERBOARD, type BoardSpan } from "./copy";
import type { BoardQuery } from "./leaderboard-client";
import { Podium, podiumOrder } from "./Podium";
import type { BoardData } from "./protocol";
import { YouBar } from "./YouBar";

export interface LeaderboardBoardProps {
  reading: Reading<BoardData> | null;
  address: string | null;
  /** Soonest live expiry on the venue, unix seconds; null while unknown. */
  nextExpirySec: number | null;
  /** Chain-corrected clock; 0 before the first client tick. */
  nowMs: number;
  /** The period and ticker tabs; a canned board without them is the venue's 24 h board. */
  board?: BoardQuery;
  onBoard?: (board: BoardQuery) => void;
  /** Q-S13-8: the whole board, or only the wallets you follow. */
  scope?: BoardScope;
  onScope?: (scope: BoardScope) => void;
  retry?: () => void;
}

const SETTLE_TAIL_MS = 900_000;
const VENUE_DAY: BoardQuery = { period: "24h", ticker: null };
const ignore = () => undefined;

/** The span the shown board covers; before the first answer, the selected period with no session yet. */
function spanOf(data: BoardData | null, board: BoardQuery, nowMs: number): BoardSpan {
  const session = data?.meta.session ?? null;
  if (!data || data.meta.period !== board.period || session === null) return { period: board.period, sessionDate: null, today: false, live: false };
  return {
    period: data.meta.period,
    sessionDate: session.date,
    today: nowMs > 0 && etDateOf(Math.floor(nowMs / 1000)) === session.date,
    live: data.meta.windowEndMs < session.closeSec * 1000 + SETTLE_TAIL_MS,
  };
}

interface HeroProps {
  data: BoardData | null;
  nextExpirySec: number | null;
  nowMs: number;
  board: BoardQuery;
  onBoard: (board: BoardQuery) => void;
  span: BoardSpan;
  scope: BoardScope;
  onScope: (scope: BoardScope) => void;
}

function Hero({ data, nextExpirySec, nowMs, board, onBoard, scope, onScope, span }: HeroProps) {
  const words = LEADERBOARD.hero;
  const meta = data?.meta ?? null;
  const dash = LEADERBOARD.dash;
  const seal = nextExpirySec !== null && nowMs > 0 ? formatClock(remainingSec(nowMs, nextExpirySec)) : dash;
  return (
    <section className="container">
      <div className="lb-hero">
        <div className="lb-hero-grid">
          <div>
            <div className="lb-hero-eyebrow">
              <span className="dash" />
              <span>{words.eyebrow}</span>
            </div>
            <h1 className="lb-hero-title">
              {words.title[0]}
              <br />
              <span className="vermilion">{words.title[1]}</span>
              <br />
              {words.title[2]}
            </h1>
          </div>
          <div className="lb-meta-col">
            <div>
              <div>{words.traders(board.period)}</div>
              <div className="big">{meta && meta.rankedTraders > 0 ? meta.rankedTraders.toLocaleString() : dash}</div>
            </div>
            <div>
              <div>{words.staked}</div>
              <div className="big">
                {meta && meta.totalVolumeBase > 0n ? (
                  <>
                    {formatBaseUnits(meta.totalVolumeBase, meta.decimals, { maxDp: 0, minDp: 0 })} <span className="lb-symbol">{meta.symbol}</span>
                  </>
                ) : (
                  dash
                )}
              </div>
            </div>
            <div>
              <div>{words.nextClose}</div>
              <div className="big">{seal}</div>
            </div>
            <div className="stamp">
              {words.stamp(board.period)}
              <div className="stamp-sub">{words.stampSub(span)}</div>
            </div>
          </div>
        </div>
        <BoardFilters board={board} onBoard={onBoard} scope={scope} onScope={onScope} meta={meta ? words.closedCalls(meta.closedCalls, span, meta.complete, meta.ticker ?? null) : words.counting} />
      </div>
    </section>
  );
}

/** The board's every state, ported from the reference page: reading, failed, empty, podium, the field, and you. */
export function LeaderboardBoard({ reading, address, nextExpirySec, nowMs, board = VENUE_DAY, onBoard = ignore, scope = "all", onScope = ignore, retry }: LeaderboardBoardProps) {
  const data = reading && isOk(reading) ? reading.value : null;
  const span = spanOf(data, board, nowMs);
  const podium = useMemo(() => (data ? podiumOrder(data.rankings) : []), [data]);
  const field = useMemo(() => (data ? banzukeRows(data.rankings) : []), [data]);

  return (
    <div className="lb-page">
      <Hero data={data} nextExpirySec={nextExpirySec} nowMs={nowMs} board={board} onBoard={onBoard} scope={scope} onScope={onScope} span={span} />
      <div>
        <div className="container">
          {reading?.ok && (
            <p className="lb-freshness" role="status">
              {LEADERBOARD.updated(reading.asOfMs)}
              {reading.stale && <> · {reading.staleReason === "refresh-failed" ? LEADERBOARD.refreshFailed : LEADERBOARD.refreshing}</>}
            </p>
          )}
          {reading === null && (
            <div className="lb-state" role="status" aria-busy="true">
              {LEADERBOARD.loading}
            </div>
          )}
          {reading !== null && !isOk(reading) && (
            <div className="lb-state lb-state-empty" role="alert">
              <div className="lb-state-glyph">◷</div>
              {LEADERBOARD.failed}
              <br />
              <span className="lb-state-sub">{diagnosisCopy(reading.error.kind).headline}</span>
              {retry && (
                <div>
                  <button type="button" className="btn btn-primary lb-retry" onClick={retry} data-cursor="hover">
                    {LEADERBOARD.retry}
                  </button>
                </div>
              )}
            </div>
          )}
          {data && data.rankings.length === 0 && (
            <div className="lb-state lb-state-empty">
              <div className="lb-state-glyph">◷</div>
              {LEADERBOARD.empty.headline}
              <br />
              <span className="lb-state-sub">{LEADERBOARD.empty.body}</span>
            </div>
          )}
          {scope === "friends" && (
            <section>
              <SectionHeader index={LEADERBOARD.friends.number} title={LEADERBOARD.friends.title} desc={LEADERBOARD.friends.desc} className="lb-section-head" />
              <FriendsBoard />
            </section>
          )}
          {scope === "all" && data && podium.length > 0 && (
            <section>
              <SectionHeader index={LEADERBOARD.podium.number} title={LEADERBOARD.podium.title} desc={LEADERBOARD.podium.desc(span)} className="lb-section-head" />
              <Podium spots={podium} decimals={data.meta.decimals} symbol={data.meta.symbol} />
            </section>
          )}
          {scope === "all" && data && field.length > 0 && (
            <section>
              <SectionHeader index={LEADERBOARD.field.number} title={LEADERBOARD.field.title} desc={LEADERBOARD.field.desc} eyebrow={LEADERBOARD.field.meta(span)} className="lb-section-head" />
              <Banzuke rows={field} decimals={data.meta.decimals} span={span} />
            </section>
          )}
          {scope === "all" && address && data && <YouBar address={address} data={data} span={span} />}
        </div>
      </div>
    </div>
  );
}
