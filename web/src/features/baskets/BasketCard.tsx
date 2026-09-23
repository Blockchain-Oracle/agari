"use client";

import { TICKERS, type Basket } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { marketDeepLink } from "@agari/core/urls";
import Link from "next/link";
import { Countdown } from "@/components/data";
import { LogoStack, Sparkline } from "@/components/ui/desk-kit";
import { bpsPct, windowText } from "@/features/hedge/calm";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { pointsLine } from "@/features/markets/hero/units";
import { laneTabLabel } from "@/features/markets/lanes/lane-view";
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
  /** The basket's hourly index over the last week, oldest first (S23); empty before the marks load. */
  line?: readonly number[];
}

/**
 * One basket on `/baskets` (S19 §5.2, rebuilt S23 on the desk kit): every row keeps its height whatever arrives, so a
 * read landing or a Window rolling never moves the card — the header, the members' marks, the index with its week,
 * the Window row, the three actions. Presentational: `/dev/basket` feeds it canned.
 */
export function BasketCard({ basket, indexRaw, move, window, book, nowMs, heldCount, coverable, line = [] }: BasketCardProps) {
  const C = BASKETS_COPY.card;
  const memberSymbols = basket.members.map((m) => m.symbol);
  const names = basket.members.map((m) => TICKERS[m.symbol].name);
  const coverWhy = heldCount === null ? C.coverWhy.connect : !window ? C.coverWhy.noWindow : !coverable ? C.coverWhy.needsTwo(heldCount) : C.coverWhy.ready(heldCount, basket.members.length);
  const quoted = book !== null && (book.upCents !== null || book.downCents !== null);
  const weekMove = line.length >= 2 && line[0] ? Math.round((((line.at(-1) ?? 0) - line[0]) / line[0]) * 10_000) : null;
  return (
    <article className="bk-card" aria-label={C.aria(basket.name)}>
      <header className="bk-head">
        <AssetDisc asset={basket.symbol} className="bk-mark" />
        <div className="bk-title">
          <span className="bk-name">{basket.name}</span>
          <Link href={tickerHref(basket.symbol)} className="bk-cashtag" data-cursor="hover">
            ${basket.symbol}
          </Link>
        </div>
      </header>
      <p className="bk-blurb">{basket.blurb}</p>

      <div className="bk-members">
        <LogoStack symbols={memberSymbols} names={names} max={5} size="sm" />
        <span className="bk-members-text">{C.count(basket.members.length)}</span>
      </div>

      <div className="bk-index">
        <div className="bk-index-figures">
          <span className="bk-index-label">{C.index}</span>
          {indexRaw === null ? <span className="bk-skel bk-skel-value" aria-label={C.loading} /> : <span className="bk-index-value numbers">{pointsLine(indexRaw)}</span>}
          <span className="bk-index-move">{move ? C.moved(bpsPct(move.rangeBps), windowText(move.windowSec)) : C.quiet}</span>
        </div>
        <div className="bk-index-week">
          <Sparkline values={line} width={120} height={40} />
          <span className="bk-week-label" data-tone={weekMove === null ? undefined : weekMove > 0 ? "up" : weekMove < 0 ? "down" : undefined}>
            {weekMove === null ? C.weekNone : C.week(`${weekMove > 0 ? "+" : weekMove < 0 ? "−" : ""}${bpsPct(Math.abs(weekMove))}`)}
          </span>
        </div>
      </div>

      <div className="bk-window" data-state={!window ? "none" : quoted ? "quoted" : book === null ? "reading" : "empty"}>
        {window ? (
          <>
            <span className="bk-window-label">
              <span className="bk-live-dot" aria-hidden />
              {C.window(laneTabLabel(window.lane, window.intervalSec))}
              <span className="bk-window-clock numbers">
                <Countdown expirySec={window.expirySec} intervalSec={window.intervalSec} nowMs={nowMs} />
              </span>
            </span>
            {book === null ? (
              <span className="bk-skel bk-skel-book" aria-label={C.loading} />
            ) : quoted ? (
              <span className="bk-window-book">
                <span className="bk-side" data-side="up">
                  {C.up} <b className="numbers">{book.upCents === null ? C.unquoted : `${book.upCents}¢`}</b>
                </span>
                <span className="bk-side" data-side="down">
                  {C.down} <b className="numbers">{book.downCents === null ? C.unquoted : `${book.downCents}¢`}</b>
                </span>
              </span>
            ) : (
              <span className="bk-window-empty">{C.noQuotes}</span>
            )}
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
          <span className="bk-action" data-kind="cover" data-off="" title={coverWhy} aria-disabled="true">
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
