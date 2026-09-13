"use client";

import type { EventMarket } from "@masayume/core/types";
import { formatWallClock } from "@masayume/core/units";
import { marketDeepLink } from "@masayume/core/urls";
import { ORACLE_PRICE_SCALE } from "@masayume/markets/identity";
import Link from "next/link";
import { Countdown } from "@/components/data";
import { MARKETS, PLAIN_WORDS, WORD_BOARD, wordQuestion } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { AssetDisc } from "../hero/asset-mark";
import { useTopOfBook } from "../hero/useTopOfBook";

interface WordCardProps {
  market: EventMarket;
  nowMs: number;
}

/** The share of the two asks that sits on UP, as a whole percent; null unless both sides rest. */
function impliedUpShare(upCents: number | null, downCents: number | null): number | null {
  if (upCents === null || downCents === null) return null;
  const total = upCents + downCents;
  return total === 0 ? null : Math.round((upCents / total) * 100);
}

const cents = (value: number | null, hydrating: boolean): string =>
  value === null ? (hydrating ? "…" : MARKETS.noBook) : `${value}¢`;

/**
 * One Window as a plain question with a price on each answer.
 *
 * The reference invents both numbers on this card: the line comes from `strike624`
 * (a strike derived from spot) and the odds from `probAbove`, a client-side logistic
 * model — "an honest client-side odds estimate", in its own words. Both are barred
 * by doc 05 §No-fake-data, and neither is needed, because this venue has a real
 * opening print and a real book. So the level is the print the Window settles
 * against and the prices are the top of the book, exactly as the hero's UP/DOWN
 * buttons read them.
 *
 * That has one visible consequence worth knowing: the reference prints No as
 * `100 - yes`, because its model produces a single probability. Here each side is
 * its own contract with its own ask, so the two do not sum to 100 and neither is
 * derived from the other. Only the bar is a derivation, and it says so.
 */
export function WordCard({ market, nowMs }: WordCardProps) {
  const { upCents, downCents, hydrating } = useTopOfBook(market);
  const closeMs = market.expirySec * 1000;
  const closeClock = formatWallClock(closeMs);
  const question = wordQuestion({ ...market, marketId: String(market.marketId) }, ORACLE_PRICE_SCALE, closeClock);
  const share = impliedUpShare(upCents, downCents);

  return (
    <div className="wq-card">
      <div className="wq-top">
        <AssetDisc asset={market.asset} className="wq-btc" />
        <span className="wq-meta">{market.asset}</span>
        <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} className="wq-clock" />
      </div>

      <p className={cn("wq-q", question.pending && "wq-q-pending")}>{question.text}</p>

      {/* No bar at all until both asks are known — an empty track reads as 0% lean. */}
      {share === null ? (
        <div className="wq-oddsbar wq-oddsbar-unknown" aria-hidden />
      ) : (
        <div className="wq-oddsbar" aria-hidden>
          <div className="wq-oddsfill" style={{ width: `${share}%` }} />
        </div>
      )}

      <div className="wq-oddsrow">
        <span className="wq-close">{WORD_BOARD.closes(closeClock)}</span>
        <span className="wq-yeslead">
          {share === null ? WORD_BOARD.noLean : <>{WORD_BOARD.implied(share)}</>}
        </span>
      </div>

      <div className="wq-actions">
        <Link className="wq-btn yes" href={marketDeepLink({ marketId: market.marketId, dir: "up" })} data-cursor="hover">
          <span className="wq-side">{PLAIN_WORDS.yes}</span>
          <span className="wq-cents">{cents(upCents, hydrating)}</span>
        </Link>
        <Link className="wq-btn no" href={marketDeepLink({ marketId: market.marketId, dir: "down" })} data-cursor="hover">
          <span className="wq-side">{PLAIN_WORDS.no}</span>
          <span className="wq-cents">{cents(downCents, hydrating)}</span>
        </Link>
      </div>
    </div>
  );
}
