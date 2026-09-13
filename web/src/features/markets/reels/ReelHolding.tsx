"use client";

import type { ReactNode } from "react";

/**
 * The reel's own loading and empty card — the reference's `EmptyReel` (L199).
 *
 * It keeps the card's frame and adds a pulsing cue, so a viewer reads "working" or
 * "nothing right now" rather than a frozen screen. It never stands in for a market.
 */
export function ReelHolding({ children }: { children: ReactNode }) {
  return (
    <section className="feed-card reel-slot">
      <div className="reel-card holding">
        <p className="reel-holding-title">{children}</p>
        <div aria-hidden className="reel-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}
