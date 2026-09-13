"use client";

import type { MarketId, Side } from "@masayume/core/types";
import { HERO_HEAD, MARKETS } from "@/lib/copy";

interface HeroYesNoProps {
  marketId: MarketId;
  upCents: number | null;
  downCents: number | null;
  onSelect: (marketId: MarketId, side: Side) => void;
}

const price = (cents: number | null): string => (cents === null ? HERO_HEAD.noPrice : `${cents}¢`);

/**
 * The call, on a phone.
 *
 * Below 900px the ticket rail is gone and these two buttons are the way into it —
 * part-04.css shows them at exactly that breakpoint. Tapping one is the choice:
 * it selects the side, which opens the ticket drawer.
 */
export function HeroYesNo({ marketId, upCents, downCents, onSelect }: HeroYesNoProps) {
  return (
    <div className="hero-yesno">
      <button
        type="button"
        className="hyn hyn-yes"
        aria-label={HERO_HEAD.betUp}
        onClick={() => onSelect(marketId, "up")}
        data-cursor="hover"
      >
        <span className="hyn-label">{MARKETS.up}</span>
        <span className="hyn-price">{price(upCents)}</span>
      </button>
      <button
        type="button"
        className="hyn hyn-no"
        aria-label={HERO_HEAD.betDown}
        onClick={() => onSelect(marketId, "down")}
        data-cursor="hover"
      >
        <span className="hyn-label">{MARKETS.down}</span>
        <span className="hyn-price">{price(downCents)}</span>
      </button>
    </div>
  );
}
