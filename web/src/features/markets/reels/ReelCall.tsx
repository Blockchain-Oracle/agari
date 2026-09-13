"use client";

import type { MarketId } from "@masayume/core/types";
import { marketDeepLink } from "@masayume/core/urls";
import Link from "next/link";
import { REELS } from "@/lib/copy";

interface ReelCallProps {
  marketId: MarketId;
  /** Inside the no-entry buffer the Window takes no more entries; the card says so instead. */
  closing: boolean;
}

/**
 * The one tap out of the card.
 *
 * Yosuku's buttons link to a bare `/markets` and leave you to find the round again.
 * The deep-link grammar already exists here (`/markets?m=…&dir=…`, UX-DR21), so the
 * side you tapped arrives selected with its ticket open — the same intent, without
 * the second search.
 */
export function ReelCall({ marketId, closing }: ReelCallProps) {
  if (closing) {
    return (
      <div className="reel-call">
        <p className="reel-note">{REELS.closing}</p>
      </div>
    );
  }
  return (
    <div className="reel-call">
      <div className="reel-call-pair">
        <Link href={marketDeepLink({ marketId, dir: "up" })} data-cursor="hover" className="reel-side up">
          {REELS.up}
        </Link>
        <Link href={marketDeepLink({ marketId, dir: "down" })} data-cursor="hover" className="reel-side down">
          {REELS.down}
        </Link>
      </div>
    </div>
  );
}
