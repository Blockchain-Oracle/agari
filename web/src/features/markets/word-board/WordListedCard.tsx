"use client";

import { formatCadence, isTickerSymbol, TICKERS } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { marketDeepLink } from "@agari/core/urls";
import Link from "next/link";
import { useState } from "react";
import { CLOSED } from "@/lib/copy-closed";
import { PREOPEN } from "@/lib/copy-preopen";
import { useWhen } from "@/lib/when";
import { AssetDisc } from "../hero/asset-mark";

/**
 * One company's listed Windows as one card (S23): a stock Window before its bell takes a scheduled call, so the card
 * says when it opens, lets you pick the Window length, and hands Up or Down to the pre-open ticket. There is no
 * countdown to an expiry hours away and no Yes/No against a book that cannot exist yet.
 */
export function WordListedCard({ markets }: { markets: readonly EventMarket[] }) {
  const when = useWhen();
  const [picked, setPicked] = useState(0);
  const market = markets[Math.min(picked, markets.length - 1)];
  if (!market) return null;
  const name = isTickerSymbol(market.asset) ? TICKERS[market.asset].name : market.asset;
  return (
    <div className="wq-card wq-listed">
      <div className="wq-top">
        <AssetDisc asset={market.asset} className="wq-btc" />
        <span className="wq-meta">{market.asset}</span>
        <span className="wq-listed-chip">{PREOPEN.card.clock}</span>
      </div>
      <p className="wq-q">{name}</p>
      <p className="wq-listed-when">{PREOPEN.card.headline(when(market.tradingStartSec))}</p>
      {markets.length > 1 && (
        <div className="wq-cadences" role="group" aria-label={CLOSED.cadencesAria}>
          {markets.map((m, i) => (
            <button key={String(m.marketId)} type="button" className="wq-cadence" aria-pressed={i === picked} onClick={() => setPicked(i)}>
              {formatCadence(m.intervalSec)}
            </button>
          ))}
        </div>
      )}
      <div className="wq-actions">
        <Link className="wq-btn yes" href={marketDeepLink({ marketId: market.marketId, dir: "up" })} data-cursor="hover">
          <span className="wq-side">{CLOSED.callUp}</span>
        </Link>
        <Link className="wq-btn no" href={marketDeepLink({ marketId: market.marketId, dir: "down" })} data-cursor="hover">
          <span className="wq-side">{CLOSED.callDown}</span>
        </Link>
      </div>
    </div>
  );
}
