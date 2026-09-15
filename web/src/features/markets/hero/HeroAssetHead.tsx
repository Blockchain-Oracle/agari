"use client";

import { formatSessionSpan, sessionCountdown } from "@agari/core/copy";
import { formatEtClock, TICKERS, type TickerSymbol } from "@agari/core/market";
import { HERO_HEAD } from "@/lib/copy";
import { SESSION_COPY } from "@/lib/copy-session";
import { cn } from "@/lib/utils";
import { formatDayChange, type DayChange } from "../asset-history/day-change";
import type { HistoryRange } from "../asset-history/range";
import type { MarketSession } from "../session";
import { MarketSessionChipView } from "../session/MarketSessionChip";
import { AssetDisc } from "./asset-mark";
import { HistoryRangeTabs } from "./HistoryRangeTabs";
import { usdLine } from "./units";

export interface HeroAssetHeadProps {
  asset: TickerSymbol;
  session: MarketSession;
  nowSec: number;
  /** The last price shown: the live tick when it has moved off the close, else the archived close. */
  price: { raw: bigint; sec: number } | null;
  /** True when `price` is a live extended-hours tick rather than an archived print. */
  live: boolean;
  change: DayChange | null;
  range: HistoryRange;
  onRange: (range: HistoryRange) => void;
}

/** "Last close", or "Pre-market" / "After hours" / "Live" for a moved extended-hours tick. */
function priceWord(session: MarketSession, live: boolean): string {
  if (!live) return SESSION_COPY.hero.lastClose;
  const state = session.status.state;
  return state === "pre" ? SESSION_COPY.hero.extended.pre : state === "post" ? SESSION_COPY.hero.extended.post : SESSION_COPY.hero.extended.live;
}

/**
 * The closed hero's head on Masayume's `.hero-chart-head` skeleton: the asset where the Window's asset was, the range
 * tabs where the cadence tabs were, the last price in the question slot with the reference's own `.pair-meta` line
 * under it ("Last close · as of 16:00 ET"), the day's move in the distance slot, and the countdown to the open in the
 * "Settles in" slot. Aged readings are labelled, never ticked (D-086).
 */
export function HeroAssetHead({ asset, session, nowSec, price, live, change, range, onRange }: HeroAssetHeadProps) {
  const countdown = sessionCountdown(session.status, nowSec);
  const move = change ? formatDayChange(change) : null;
  return (
    <div className="hero-chart-head">
      <div>
        <div className="mh-asset-row">
          <AssetDisc asset={asset} className="mh-asset-badge" />
          <span className="mh-asset-label">
            {TICKERS[asset].name} · {asset}
          </span>
          <HistoryRangeTabs range={range} onPick={onRange} />
          <MarketSessionChipView session={session} asset={asset} nowSec={nowSec} />
        </div>
        <h2 className="mh-question">{price ? <span className="mh-question-line">{usdLine(price.raw)}</span> : HERO_HEAD.pair(asset)}</h2>
        {price && (
          <span className="pair-meta">
            {priceWord(session, live)} <span className="meta-soft">· {SESSION_COPY.hero.asOf(formatEtClock(price.sec))}</span>
          </span>
        )}
        <div className="mh-distance">
          {move && change ? (
            <>
              <span className={cn("mh-distance-value", move.direction === "down" ? "below" : "above")}>
                {move.dollars} · {move.percent}
              </span>
              <span className="mh-since">{SESSION_COPY.hero.since[change.since]}</span>
            </>
          ) : (
            <span className="mh-distance-pending">{price ? SESSION_COPY.hero.noReference : HERO_HEAD.noPrice}</span>
          )}
        </div>
      </div>
      <div className="mh-settles">
        <span className="mh-settles-label">{countdown?.kind === "closes" ? SESSION_COPY.hero.closesIn : SESSION_COPY.hero.opensIn}</span>
        <span className="mh-settles-value">{countdown ? formatSessionSpan(countdown.remainingSec) : SESSION_COPY.hero.noClock}</span>
      </div>
    </div>
  );
}
