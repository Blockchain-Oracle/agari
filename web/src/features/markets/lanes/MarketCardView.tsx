"use client";

import { phase, type MarketPhase } from "@agari/core/lifecycle";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { Countdown } from "@/components/data";
import { HERO_HEAD, LANE_CARD, LANE_STATE, MARKETS } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { sidesInOrder, useBetAgainst } from "../bet-against";
import { AssetDisc } from "../hero/asset-mark";
import { usdLine } from "../hero/units";
import type { ChartPoint } from "../hero/useChartSeries";
import { CardSpark } from "./CardSpark";
import { etWeekday, laneAssetLabel, laneCadenceLabel } from "./lane-view";
import { ListedCard } from "./ListedCard";
import { useWhen, type WhenOptions } from "@/lib/when";

type When = (sec: number, options?: WhenOptions) => string;

/** What the card reads: the chart series and the top of the book, from the live hooks or a `/dev` fixture. */
export interface MarketCardData {
  points: readonly ChartPoint[];
  latestRaw: bigint | null;
  upCents: number | null;
  downCents: number | null;
  hydrating: boolean;
}

export interface MarketCardViewProps extends MarketCardData {
  market: EventMarket;
  nowMs: number;
  selected: boolean;
  onSelect: (marketId: MarketId, side?: Side) => void;
  /** Opens this Window's Room. The sheet is mounted by the screen, not the card. */
  onOpenRoom: (market: EventMarket) => void;
}

/** A Gap Window that far from its lock names the lock instead of counting 50 hours down. */
const GAP_COUNTDOWN_FROM_SEC = 3_600;

const price = (value: number | null, hydrating: boolean): string =>
  value === null ? (hydrating ? LANE_CARD.priceLoading : HERO_HEAD.noPrice) : `${value}¢`;

/** The strip when the Window no longer takes calls: Masayume's closing line, or the Gap's own locked and settled words. */
function closedStrip(market: EventMarket, current: MarketPhase, when: When): string {
  if (market.lane !== "gap") return LANE_CARD.closing;
  // A Gap's Friday print may post until the lock (ADMIT_UNTIL_LOCK), so this wait can be long enough to name.
  if (current === "pendingOpeningPrint") return LANE_STATE.gap.pendingOpen;
  if (current === "voided") return LANE_STATE.gap.settled.void;
  if (current === "settledUnclaimed" || current === "finalized") return market.winningOutcome === 1 ? LANE_STATE.gap.settled.down : LANE_STATE.gap.settled.up;
  return LANE_STATE.gap.locked(when(market.expirySec, { seconds: true }));
}

/**
 * A Gap runs for days, so its clock names the next instant until the last hour, then counts it down: "Locks Sun 20:00 ET"
 * → the lock countdown → "Settles Mon 09:30 ET" → the settle countdown. A settled Gap says so.
 */
function GapClock({ market, nowMs, current }: { market: EventMarket; nowMs: number; current: MarketPhase | null }) {
  const when = useWhen();
  if (current === "settledUnclaimed" || current === "finalized" || current === "voided") return <span>{LANE_STATE.gap.settledClock}</span>;
  const nowSec = Math.floor(nowMs / 1000);
  const target = nowSec < market.lockAtSec ? market.lockAtSec : market.expirySec;
  if (nowMs === 0 || target - nowSec > GAP_COUNTDOWN_FROM_SEC) {
    return <span>{target === market.lockAtSec ? LANE_STATE.gap.locks(when(market.lockAtSec)) : LANE_STATE.gap.settles(when(market.expirySec))}</span>;
  }
  return <Countdown expirySec={target} intervalSec={GAP_COUNTDOWN_FROM_SEC} nowMs={nowMs} />;
}

/**
 * One live Window in the reference's chart-card language — ported from
 * `Market624Card` in `reference/yosuku/app/markets/page.tsx` (L251–400), Masayume's `MarketCard.tsx` markup for markup.
 *
 * `.market-card` and every `.mc-*` rule are already in `yosuku/part-06.css` and
 * `part-16.css`, light theme in `part-14/15`; only the two places where the source
 * assumes BTC or a house model are in `styles/market-card.css`.
 *
 * S6 lanes change words, never the anatomy (session-lanes.md §5): a token Window names its xStock ("TSLAx"); a Gap
 * Window asks about the Monday open, counts to its Sunday lock, and before Friday's close is the pending card. A
 * listed Regular or Gap Window before its open is the pending card that schedules a call (D-088, `ListedCard`).
 *
 * Numbers, as everywhere: the line is the opening print, and UP/DOWN are the top of
 * the real book. The reference fills its ramp with `odds?.upCents ?? 50`, so an
 * unread book shows as an even market; here an unread side shows nothing.
 */
export function MarketCardView({ market, nowMs, selected, onSelect, onOpenRoom, points, latestRaw, upCents, downCents, hydrating }: MarketCardViewProps) {
  const when = useWhen();
  const betAgainst = useBetAgainst();
  const current = nowMs > 0 ? phase(market, nowMs) : null;
  if (current === "upcoming" && market.lane !== "token") return <ListedCard market={market} selected={selected} onSelect={onSelect} />;

  const openingRaw = market.openingPriceRaw;
  const asset = laneAssetLabel(market.asset, market.lane);
  const ask = market.lane === "gap" ? LANE_STATE.gap.opensAbove(asset, etWeekday(market.expirySec)) : HERO_HEAD.holdsAbove(asset);
  // The reference approximates its cutoff with `minMintMs * 0.6`; `phase` is the
  // rule every other surface already derives from (AD-1).
  const closing = current !== null && current !== "trading";
  const openCard = () => onSelect(market.marketId);

  return (
    <article
      className="market-card"
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      aria-label={LANE_CARD.openTicket(asset)}
      data-cursor="hover"
      data-lane={market.lane}
      onClick={openCard}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openCard();
        }
      }}
    >
      <div className="mc-head">
        <span className="mc-asset">
          <AssetDisc asset={market.asset} className="glyph" />
          <span className="mc-ticker">{asset}</span>
          <span className="mc-cadence">{laneCadenceLabel(market.lane, market.intervalSec)}</span>
        </span>
        <span className="mc-countdown">
          <span className="clock-dot" aria-hidden />
          {market.lane === "gap" ? (
            <GapClock market={market} nowMs={nowMs} current={current} />
          ) : (
            <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />
          )}
        </span>
      </div>

      <div className="mc-body">
        <div className="mc-question">
          {openingRaw === null ? (
            <>
              {ask} <span className="strike-loading">···</span>
            </>
          ) : (
            <>
              {ask} {usdLine(openingRaw)}?<span className="strike-dot" aria-hidden />
            </>
          )}
        </div>

        <div className="mc-pricebar">
          <div className="px">
            <span className="big">{latestRaw === null ? HERO_HEAD.noPrice : usdLine(latestRaw)}</span>
            {/* Against the line this Window settles on, not a 24h figure: it is the
                only comparison that decides anything here. */}
            {openingRaw !== null && latestRaw !== null && (
              <span className={cn("chg", latestRaw >= openingRaw ? "up" : "down")}>
                {latestRaw >= openingRaw ? "+" : "−"}
                {usdLine(latestRaw >= openingRaw ? latestRaw - openingRaw : openingRaw - latestRaw, openingRaw)}
              </span>
            )}
          </div>
        </div>

        <div className="mc-spark">
          <CardSpark points={points} openingRaw={openingRaw} />
        </div>

        <div className="mc-strip">
          {closing ? (
            <span>{closedStrip(market, current, when)}</span>
          ) : (
            <>
              <span>{upCents === null ? LANE_CARD.oddsLoading : LANE_CARD.oddsLive}</span>
              <span className="ramp">
                <span>{HERO_HEAD.rampUp}</span>
                <span className="bar">{upCents !== null && <span className="fill" style={{ width: `${upCents}%` }} />}</span>
                <span className="pct">{price(upCents, hydrating)}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {!closing && (
        <div className="mc-foot">
          {sidesInOrder(betAgainst).map((option) => (
            <button
              key={option}
              type="button"
              className={option === "up" ? "mc-side up" : "mc-side down"}
              data-cursor={option === "up" ? "up" : "hover"}
              aria-label={option === "up" ? HERO_HEAD.betUp : HERO_HEAD.betDown}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(market.marketId, option);
              }}
            >
              <span>{option === "up" ? MARKETS.up : MARKETS.down}</span>
              <span className="price">{price(option === "up" ? upCents : downCents, hydrating)}</span>
            </button>
          ))}
        </div>
      )}

      {/* The reference's Room strip, live. `stopPropagation` because the whole card
          is the ticket trigger and this is the one control inside it that is not. */}
      <button
        type="button"
        className="mc-room"
        data-cursor="hover"
        onClick={(event) => {
          event.stopPropagation();
          onOpenRoom(market);
        }}
      >
        <span className="mc-room-label">{HERO_HEAD.room}</span>
        <span className="mc-room-hint">{HERO_HEAD.roomQualifier}</span>
      </button>
    </article>
  );
}
