"use client";

import { isOk, type Reading } from "@masayume/core/schemas";
import { formatBaseUnits } from "@masayume/core/units";
import { formatClock, remainingSec } from "@masayume/core/units";
import { useMemo } from "react";
import { SectionHeader } from "@/components/chrome";
import { diagnosisCopy } from "@/lib/copy";
import { Banzuke, banzukeRows } from "./Banzuke";
import { LEADERBOARD } from "./copy";
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
  retry?: () => void;
}

function Hero({ data, nextExpirySec, nowMs }: { data: BoardData | null; nextExpirySec: number | null; nowMs: number }) {
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
              <div>{words.traders}</div>
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
              {words.stamp}
              <div className="stamp-sub">{words.stampSub}</div>
            </div>
          </div>
        </div>
        <div className="lb-filter-bar">
          <div className="asset-tabs">
            <span className="asset-tab active">{words.assets}</span>
            <span className="asset-tab">{words.period}</span>
          </div>
          <div className="lb-filter-meta">{meta ? (meta.complete ? words.closedCalls(meta.closedCalls) : words.partial(meta.closedCalls)) : words.counting}</div>
        </div>
      </div>
    </section>
  );
}

/** The board's every state, ported from the reference page: reading, failed, empty, podium, the field, and you. */
export function LeaderboardBoard({ reading, address, nextExpirySec, nowMs, retry }: LeaderboardBoardProps) {
  const data = reading && isOk(reading) ? reading.value : null;
  const podium = useMemo(() => (data ? podiumOrder(data.rankings) : []), [data]);
  const field = useMemo(() => (data ? banzukeRows(data.rankings) : []), [data]);

  return (
    <div className="lb-page">
      <Hero data={data} nextExpirySec={nextExpirySec} nowMs={nowMs} />
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
          {data && podium.length > 0 && (
            <section>
              <SectionHeader index={LEADERBOARD.podium.number} title={LEADERBOARD.podium.title} desc={LEADERBOARD.podium.desc} className="lb-section-head" />
              <Podium spots={podium} decimals={data.meta.decimals} symbol={data.meta.symbol} />
            </section>
          )}
          {data && field.length > 0 && (
            <section>
              <SectionHeader index={LEADERBOARD.field.number} title={LEADERBOARD.field.title} desc={LEADERBOARD.field.desc} eyebrow={LEADERBOARD.field.meta} className="lb-section-head" />
              <Banzuke rows={field} decimals={data.meta.decimals} />
            </section>
          )}
          {address && data && <YouBar address={address} data={data} />}
        </div>
      </div>
    </div>
  );
}
