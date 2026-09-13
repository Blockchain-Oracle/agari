"use client";

import { formatCadence } from "@masayume/core/market";
import type { EventMarket } from "@masayume/core/types";
import { formatOracleRaw } from "@masayume/core/units";
import { marketDeepLink } from "@masayume/core/urls";
import Link from "next/link";
import { useState } from "react";
import { Countdown } from "@/components/data";
import { HERO_HEAD, MARKETS } from "@/lib/copy";
import { ORACLE_SCALE } from "../markets/hero/units";
import { SENSEI_UI } from "./copy";
import type { SenseiMarket } from "./protocol";

interface SenseiTradeCardsProps {
  markets: readonly EventMarket[];
  snapshotMarkets: readonly SenseiMarket[];
  nowMs: number;
  onAct: () => void;
}

const usd0 = (raw: bigint | null): string => (raw === null ? HERO_HEAD.noPrice : `$${formatOracleRaw(raw, ORACLE_SCALE, 0)}`);
const cents = (value: number | null): string => (value === null ? MARKETS.noBook : `${value}¢`);

/**
 * Act on the read, without leaving the drawer — ported from
 * `reference/yosuku/components/SenseiTradeCards.tsx`.
 *
 * **The reference's version is a second trade path.** It carries stake chips and a
 * Place button and calls `placeMint624` / `placeFirstBet624` directly, so the drawer
 * signs its own transactions. Doc 02 says DreamDEX calls do not scatter through
 * components, and every other surface in this port — the reel, the word board, the
 * §01 card — hands off to the one Ticket through the deep-link grammar instead.
 * A second signing path inside a chat drawer is exactly what that rule exists to
 * prevent, so these cards keep the job and drop the mechanism: tap a side and the
 * Window opens in the ticket with that side already chosen.
 *
 * Its odds came from `probAbove`, the same invented logistic the word board used,
 * and `payoutX` derived a multiple from it. These are the top of the real book, and
 * `.st-sidepay` carries what the price means rather than a payout computed from a
 * number nobody quoted.
 */
export function SenseiTradeCards({ markets, snapshotMarkets, nowMs, onAct }: SenseiTradeCardsProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div className="sensei-trade">
      <div className="st-head">
        <span>{SENSEI_UI.tradeHead}</span>
        <div className="st-headright">
          <span className="st-sub">{SENSEI_UI.tradeSub}</span>
          <button type="button" className="st-hide" onClick={() => setHidden(true)} aria-label={SENSEI_UI.tradeHide} data-cursor="hover">
            ✕
          </button>
        </div>
      </div>
      <div className="st-list">
        {markets.length === 0 && <p className="st-meta">{SENSEI_UI.tradeEmpty}</p>}
        {markets.map((market, index) => {
          const book = snapshotMarkets[index];
          return (
            <div key={market.marketId} className="st-card">
              <div className="st-cardhead">
                <span className="st-asset">
                  {market.asset} <b>{formatCadence(market.intervalSec)}</b>
                </span>
                <span className="st-meta">
                  {usd0(market.openingPriceRaw)} ·{" "}
                  <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />
                </span>
              </div>
              <div className="st-sides">
                <Link className="st-side up" href={marketDeepLink({ marketId: market.marketId, dir: "up" })} scroll={false} onClick={onAct} data-cursor="up">
                  <span className="st-sidetop">
                    <span className="st-sidelabel">{MARKETS.up}</span>
                    <span className="st-sideprob">{cents(book?.upCents ?? null)}</span>
                  </span>
                  <span className="st-sidepay">{SENSEI_UI.perDollar}</span>
                </Link>
                <Link className="st-side down" href={marketDeepLink({ marketId: market.marketId, dir: "down" })} scroll={false} onClick={onAct} data-cursor="hover">
                  <span className="st-sidetop">
                    <span className="st-sidelabel">{MARKETS.down}</span>
                    <span className="st-sideprob">{cents(book?.downCents ?? null)}</span>
                  </span>
                  <span className="st-sidepay">{SENSEI_UI.perDollar}</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
