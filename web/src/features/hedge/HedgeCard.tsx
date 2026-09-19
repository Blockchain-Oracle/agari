"use client";

import { TICKERS } from "@agari/core/market";
import type { MarketId, Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { laneAssetLabel, laneTabLabel } from "@/features/markets/lanes/lane-view";
import { presetStake } from "@/features/markets/ticket/stake-preset";
import { HEDGE } from "./copy";
import type { HedgePick } from "./hedge-target";
import "./hedge.css";

const SHARES_DP = 8;
const SHARES_SHOWN_DP = 4;
const USD_DP = 6;

export interface HedgeCardProps {
  pick: HedgePick;
  /** The preset from `hedgeStakeBase`; null opens the ticket empty. */
  stakeBase: bigint | null;
  decimals: number;
  symbol: string;
  /** The markets page's selection, as a card's DOWN button calls it (M `MarketCard.tsx:15-22`). */
  onSelect: (marketId: MarketId, side?: Side) => void;
  /** Example mode (plan Step 2): a stamp over the card, its own CTA words, and a note in the foot. */
  stamp?: string;
  ctaText?: string;
  note?: string;
}

/** "12.5 TSLAx + 3 TSLAon": every verified token of the underlying, in shares (UI amounts, the multiplier applied). */
export function holdingTokens(pick: HedgePick): string {
  return pick.holdings.map((h) => `${formatBaseUnits(h.sharesE8, SHARES_DP, { maxDp: SHARES_SHOWN_DP, minDp: 0 })} ${h.symbol}`).join(" + ");
}

/**
 * The holdings-aware hedge (session-lanes.md §4) in Masayume's `SeasonBanner` anatomy (M `SeasonBanner.tsx:14-31`):
 * the mark, then eyebrow · name · line, then the CTA; the whole card is the control, as Masayume wraps its banner in a
 * link and its market card is a button. Its markets voice replaces the games pixel face. A tap leaves the stake preset
 * and opens the unchanged S4 ticket on DOWN; nothing is sent from here.
 */
export function HedgeCard({ pick, stakeBase, decimals, symbol, onSelect, stamp, ctaText, note }: HedgeCardProps) {
  const { market, kind, horizon } = pick.target;
  const value = pick.exposureUsdE6 === null ? null : `$${formatBaseUnits(pick.exposureUsdE6, USD_DP, { maxDp: 0, minDp: 0 })}`;
  const line = HEDGE.line(holdingTokens(pick), value, TICKERS[pick.underlying].name, HEDGE.horizon[horizon]);
  const lead = pick.holdings[0];
  const leadToken = lead?.symbol ?? pick.underlying;
  const cta = ctaText ?? HEDGE.cta[kind];
  const hedge = () => {
    if (stakeBase !== null) presetStake(market.marketId, stakeBase);
    onSelect(market.marketId, "down");
  };

  return (
    <article
      className="hg-banner"
      role="button"
      tabIndex={0}
      aria-label={`${cta}: ${HEDGE.aria(line)}`}
      data-kind={kind}
      data-example={stamp ? "" : undefined}
      data-cursor="hover"
      onClick={hedge}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        hedge();
      }}
    >
      {stamp && <span className="hg-banner-stamp">{stamp}</span>}
      <AssetDisc asset={pick.underlying} className="hg-banner-mark" />
      <div className="hg-banner-text">
        <span className="hg-banner-eyebrow">{HEDGE.eyebrow(lead?.issuer ?? "xstocks")}</span>
        <span className="hg-banner-name">
          {laneAssetLabel(market.asset, market.lane)} · {laneTabLabel(market.lane, market.intervalSec)}
        </span>
        <span className="hg-banner-line">{line}</span>
      </div>
      <span className="hg-banner-cta" aria-hidden>
        {cta} →
      </span>
      <p className="hg-banner-foot">
        {note && `${note} `}
        {stakeBase !== null && `${HEDGE.stake(formatBaseUnits(stakeBase, decimals), symbol)} `}
        {HEDGE.foot(leadToken)}
      </p>
    </article>
  );
}
