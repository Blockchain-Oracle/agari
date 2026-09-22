"use client";

import { TICKERS, type Basket } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { marketDeepLink } from "@agari/core/urls";
import Link from "next/link";
import { Countdown } from "@/components/data";
import { bpsPct, windowText } from "@/features/hedge/calm";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { pointsLine } from "@/features/markets/hero/units";
import { laneTabLabel } from "@/features/markets/lanes/lane-view";
import { MarkCluster } from "@/features/news/NewsRow";
import { tickerHref } from "@/features/takes/cashtags";
import type { PreIpoMove } from "@/features/ticker-hub/usePreIpoFacts";
import { BASKETS_COPY } from "./copy";
import "./baskets.css";

/** Hold opens the studio on this basket (plan §5.2): `/desk/new?basket=<SYM>`. */
const deskHref = (symbol: string) => `/desk/new?basket=${symbol}`;

export interface BasketCardProps {
  basket: Basket;
  /** The live index at the print scale (points × 10⁸), null before the first read. */
  indexRaw: bigint | null;
  move: PreIpoMove | null;
  window: EventMarket | null;
  /** Top of the Window's book; null while it hydrates or when no Window trades. */
  book: { upCents: number | null; downCents: number | null } | null;
  nowMs: number;
  /** Members this wallet holds; null with no wallet connected. */
  heldCount: number | null;
  coverable: boolean;
}

/**
 * One basket on `/baskets` (S19 §5.2): the members' marks clustered, the live index and its move, the live 60 m Window
 * with both sides' prices, and the three things one can do with a basket — Predict (test money), Cover (test money, when
 * two or more members are held), Hold (real money, through a desk). Presentational: `/dev/basket` feeds it canned.
 */
export function BasketCard({ basket, indexRaw, move, window, book, nowMs, heldCount, coverable }: BasketCardProps) {
  const C = BASKETS_COPY.card;
  const memberSymbols = basket.members.map((m) => m.symbol);
  const names = basket.members.map((m) => TICKERS[m.symbol].name).join(", ");
  const cents = (value: number | null) => (value === null ? C.unquoted : `${value}¢`);
  const coverWhy = heldCount === null ? C.coverWhy.connect : !window ? C.coverWhy.noWindow : !coverable ? C.coverWhy.needsTwo(heldCount) : C.coverWhy.ready(heldCount, basket.members.length);
  return (
    <article className="bk-card" aria-label={C.aria(basket.name)} data-window={window ? "" : undefined}>
      <div className="bk-head">
        <AssetDisc asset={basket.symbol} className="bk-mark" />
        <div className="bk-title">
          <span className="bk-name">
            {basket.name}{" "}
            <Link href={tickerHref(basket.symbol)} className="bk-cashtag" data-cursor="hover">
              ${basket.symbol}
            </Link>
          </span>
          <span className="bk-blurb">{basket.blurb}</span>
        </div>
      </div>
      <div className="bk-members">
        <MarkCluster symbols={memberSymbols} />
        <span className="bk-members-text">{C.members(names)}</span>
      </div>
      <div className="bk-index">
        <span className="bk-index-label">{C.index}</span>
        <span className="bk-index-value numbers">{indexRaw === null ? C.noIndex : pointsLine(indexRaw)}</span>
        <span className="bk-index-move">{move ? C.moved(bpsPct(move.rangeBps), windowText(move.windowSec)) : C.quiet}</span>
      </div>
      <div className="bk-window">
        {window ? (
          <>
            <span className="bk-window-label">
              {C.window(laneTabLabel(window.lane, window.intervalSec))}
              <span className="bk-window-clock">
                <span className="clock-dot" aria-hidden />
                <Countdown expirySec={window.expirySec} intervalSec={window.intervalSec} nowMs={nowMs} />
              </span>
            </span>
            <span className="bk-window-book">
              <span className="bk-side up">
                {C.up} <b className="numbers">{cents(book?.upCents ?? null)}</b>
              </span>
              <span className="bk-side down">
                {C.down} <b className="numbers">{cents(book?.downCents ?? null)}</b>
              </span>
            </span>
          </>
        ) : (
          <span className="bk-window-none">{C.noWindow}</span>
        )}
      </div>
      <div className="bk-actions">
        <Link href={window ? marketDeepLink({ marketId: window.marketId }) : tickerHref(basket.symbol)} className="bk-action" data-kind="predict" data-cursor="hover">
          {C.predict}
        </Link>
        {window && coverable ? (
          <Link href={marketDeepLink({ marketId: window.marketId, dir: "down" })} className="bk-action" data-kind="cover" data-cursor="hover" title={coverWhy}>
            {C.cover}
          </Link>
        ) : (
          <span className="bk-action" data-kind="cover" data-off="" title={coverWhy}>
            {C.cover}
          </span>
        )}
        <Link href={deskHref(basket.symbol)} className="bk-action" data-kind="hold" data-cursor="hover" title={C.holdWhy}>
          {C.hold}
        </Link>
      </div>
      <p className="bk-why">{coverWhy}</p>
    </article>
  );
}
