import type { EventMarket } from "@agari/core/types";
import type { DeskReelDecision } from "@/features/desk/DeskReelCard";
import type { HedgePick } from "@/features/hedge/hedge-target";
import type { FeedTake } from "./protocol";

export type ReelItem = { kind: "market"; market: EventMarket } | { kind: "take"; take: FeedTake } | { kind: "holding"; pick: HedgePick } | { kind: "desk"; decision: DeskReelDecision };

/** One "you hold this" card in every this-many items (plan Step 7: "once in a while", never pinned at the top). */
export const HOLDING_EVERY = 8;
/** The desk's latest notable decision sits this many items in (plan §5.2 "occasional"), or last in a short feed. */
export const DESK_AT = 4;

/**
 * Weave community takes into the live-market reel so the snap scroll is one stream
 * of live Windows and social calls: market, take, market, take… then whichever list
 * has a tail. Starting on a live Window keeps the first card actionable — the
 * reference's own rule (`app/reels/page.tsx` L40–53), verbatim.
 */
export function weaveReel(rounds: readonly EventMarket[], takes: readonly FeedTake[], holdings: readonly HedgePick[] = [], desk: DeskReelDecision | null = null): ReelItem[] {
  const woven = weaveHoldings(rounds, takes, holdings);
  if (!desk || woven.length === 0) return woven;
  const at = Math.min(DESK_AT, woven.length);
  return [...woven.slice(0, at), { kind: "desk", decision: desk }, ...woven.slice(at)];
}

function weaveHoldings(rounds: readonly EventMarket[], takes: readonly FeedTake[], holdings: readonly HedgePick[]): ReelItem[] {
  const out: ReelItem[] = [];
  const max = Math.max(rounds.length, takes.length);
  for (let i = 0; i < max; i += 1) {
    const market = rounds[i];
    const take = takes[i];
    if (market) out.push({ kind: "market", market });
    if (take) out.push({ kind: "take", take });
  }
  if (holdings.length === 0 || out.length === 0) return out;
  // Every HOLDING_EVERY items a holding card, rotating through the wallet's names; a feed too short for one gets it last.
  const woven: ReelItem[] = [];
  let next = 0;
  for (const item of out) {
    if (woven.length > 0 && woven.length % (HOLDING_EVERY + 1) === HOLDING_EVERY) woven.push({ kind: "holding", pick: holdings[next++ % holdings.length]! });
    woven.push(item);
  }
  if (next === 0) woven.push({ kind: "holding", pick: holdings[0]! });
  return woven;
}
