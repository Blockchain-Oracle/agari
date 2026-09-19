"use client";

import { TICKERS } from "@agari/core/market";
import { formatBaseUnits } from "@agari/core/units";
import { marketDeepLink } from "@agari/core/urls";
import Link from "next/link";
import { memo } from "react";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { laneAssetLabel, laneTabLabel } from "@/features/markets/lanes/lane-view";
import { HEDGE } from "./copy";
import { holdingTokens } from "./HedgeCard";
import type { HedgePick } from "./hedge-target";
import "./hedge.css";

const USD_DP = 6;

/**
 * "You hold OpenAI. Cover it?" in the Reels feed (plan Step 7): the take card's frame and chip grammar (`take.css`),
 * so it reads as part of the feed rather than an advert. Woven in once every few cards, rotating through what the
 * wallet holds. Both bets are offered as links into the ticket; nothing is preset and nothing is sent from here.
 */
export const HoldingReelCard = memo(function HoldingReelCard({ pick }: { pick: HedgePick }) {
  const { market } = pick.target;
  const name = TICKERS[pick.underlying].name;
  const value = pick.exposureUsdE6 === null ? null : `$${formatBaseUnits(pick.exposureUsdE6, USD_DP, { maxDp: 0, minDp: 0 })}`;
  const line = value === null ? holdingTokens(pick) : `${holdingTokens(pick)} ≈ ${value}`;
  return (
    <article className="reel-card take-card holding-call" aria-label={HEDGE.reel.aria(name)}>
      <div aria-hidden className="reel-grain" />
      <div aria-hidden className="reel-heat" />

      <div className="take-author">
        <div className="take-ident">
          <AssetDisc asset={pick.underlying} className="take-chip-mark hc-mark" />
          <div className="min-w-0">
            <span className="take-name">{HEDGE.reel.title(name)}</span>
            <div className="take-meta">
              {laneAssetLabel(market.asset, market.lane)} · {laneTabLabel(market.lane, market.intervalSec)} · {HEDGE.horizon[pick.target.horizon]}
            </div>
          </div>
        </div>
        <span className="take-badge">{HEDGE.reel.badge}</span>
      </div>

      <div className="take-chip-row">
        <span className="take-chip">
          <span className="take-chip-band">{line}</span>
        </span>
      </div>

      <div className="take-voice">
        <p className="take-caption">{HEDGE.reel.voice}</p>
      </div>

      <div className="take-foot">
        <div className="hc-actions">
          <Link href={marketDeepLink({ marketId: market.marketId, dir: "down" })} className="take-cta hc-cta" data-side="down" data-cursor="hover">
            {HEDGE.stocks.cover}
          </Link>
          <Link href={marketDeepLink({ marketId: market.marketId, dir: "up" })} className="take-cta hc-cta" data-side="up" data-cursor="hover">
            {HEDGE.stocks.add}
          </Link>
        </div>
        <p className="hc-foot">{HEDGE.reel.foot}</p>
      </div>
    </article>
  );
});
