"use client";

import { phase } from "@masayume/core/lifecycle";
import type { EventMarket, MarketId, Side } from "@masayume/core/types";
import { formatOracleRaw } from "@masayume/core/units";
import { Countdown } from "@/components/data";
import { formatCadence, HERO_HEAD, LANE_CARD, MARKETS } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { AssetDisc } from "../hero/asset-mark";
import { ORACLE_SCALE } from "../hero/units";
import { useChartSeries } from "../hero/useChartSeries";
import { useTopOfBook } from "../hero/useTopOfBook";
import { CardSpark } from "./CardSpark";

interface MarketCardProps {
  market: EventMarket;
  nowMs: number;
  selected: boolean;
  onSelect: (marketId: MarketId, side?: Side) => void;
  /** Opens this Window's Room. The sheet is mounted by the screen, not the card. */
  onOpenRoom: (market: EventMarket) => void;
}

/** Whole dollars, grouped — the card's own scale, as the hero headline uses. */
const usd0 = (raw: bigint): string => `$${formatOracleRaw(raw, ORACLE_SCALE, 0)}`;

const price = (value: number | null, hydrating: boolean): string =>
  value === null ? (hydrating ? LANE_CARD.priceLoading : HERO_HEAD.noPrice) : `${value}¢`;

/**
 * One live Window in the reference's chart-card language — ported from
 * `Market624Card` in `reference/yosuku/app/markets/page.tsx` (L251–400).
 *
 * `.market-card` and every `.mc-*` rule are already in `yosuku/part-06.css` and
 * `part-16.css`, light theme in `part-14/15`; only the two places where the source
 * assumes BTC or a house model are in `styles/market-card.css`.
 *
 * This replaces the text row that stood here. Both said the Window in words, which
 * left `/markets` asking the same question twice once the §02 board landed — the
 * reference has no such overlap because its §01 is exactly this: a chart card.
 *
 * Numbers, as everywhere: the line is the opening print, and UP/DOWN are the top of
 * the real book. The reference fills its ramp with `odds?.upCents ?? 50`, so an
 * unread book shows as an even market; here an unread side shows nothing.
 */
export function MarketCard({ market, nowMs, selected, onSelect, onOpenRoom }: MarketCardProps) {
  const series = useChartSeries(market);
  const { upCents, downCents, hydrating } = useTopOfBook(market);

  const openingRaw = market.openingPriceRaw;
  const points = series?.ok ? series.value.points : [];
  const latestRaw = series?.ok ? (series.value.latest?.valueRaw ?? null) : null;
  // The reference approximates its cutoff with `minMintMs * 0.6`; `phase` is the
  // rule every other surface already derives from (AD-1).
  const closing = nowMs > 0 && phase(market, nowMs) !== "trading";

  const openCard = () => onSelect(market.marketId);

  return (
    <article
      className="market-card"
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      aria-label={LANE_CARD.openTicket(market.asset)}
      data-cursor="hover"
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
          <span className="mc-ticker">{market.asset}</span>
          <span className="mc-cadence">{formatCadence(market.intervalSec)}</span>
        </span>
        <span className="mc-countdown">
          <span className="clock-dot" aria-hidden />
          <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />
        </span>
      </div>

      <div className="mc-body">
        <div className="mc-question">
          {openingRaw === null ? (
            <>
              {HERO_HEAD.holdsAbove(market.asset)} <span className="strike-loading">···</span>
            </>
          ) : (
            <>
              {HERO_HEAD.holdsAbove(market.asset)} {usd0(openingRaw)}?<span className="strike-dot" aria-hidden />
            </>
          )}
        </div>

        <div className="mc-pricebar">
          <div className="px">
            <span className="big">{latestRaw === null ? HERO_HEAD.noPrice : usd0(latestRaw)}</span>
            {/* Against the line this Window settles on, not a 24h figure: it is the
                only comparison that decides anything here. */}
            {openingRaw !== null && latestRaw !== null && (
              <span className={cn("chg", latestRaw >= openingRaw ? "up" : "down")}>
                {latestRaw >= openingRaw ? "+" : "−"}
                {usd0(latestRaw >= openingRaw ? latestRaw - openingRaw : openingRaw - latestRaw)}
              </span>
            )}
          </div>
        </div>

        <div className="mc-spark">
          <CardSpark points={points} openingRaw={openingRaw} />
        </div>

        <div className="mc-strip">
          {closing ? (
            <span>{LANE_CARD.closing}</span>
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
          <button
            type="button"
            className="mc-side up"
            data-cursor="up"
            aria-label={HERO_HEAD.betUp}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(market.marketId, "up");
            }}
          >
            <span>{MARKETS.up}</span>
            <span className="price">{price(upCents, hydrating)}</span>
          </button>
          <button
            type="button"
            className="mc-side down"
            data-cursor="hover"
            aria-label={HERO_HEAD.betDown}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(market.marketId, "down");
            }}
          >
            <span>{MARKETS.down}</span>
            <span className="price">{price(downCents, hydrating)}</span>
          </button>
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
