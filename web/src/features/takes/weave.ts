import type { EventMarket } from "@masayume/core/types";
import type { FeedTake } from "./protocol";

export type ReelItem = { kind: "market"; market: EventMarket } | { kind: "take"; take: FeedTake };

/**
 * Weave community takes into the live-market reel so the snap scroll is one stream
 * of live Windows and social calls: market, take, market, take… then whichever list
 * has a tail. Starting on a live Window keeps the first card actionable — the
 * reference's own rule (`app/reels/page.tsx` L40–53), verbatim.
 */
export function weaveReel(rounds: readonly EventMarket[], takes: readonly FeedTake[]): ReelItem[] {
  const out: ReelItem[] = [];
  const max = Math.max(rounds.length, takes.length);
  for (let i = 0; i < max; i += 1) {
    const market = rounds[i];
    const take = takes[i];
    if (market) out.push({ kind: "market", market });
    if (take) out.push({ kind: "take", take });
  }
  return out;
}
