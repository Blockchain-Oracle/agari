import type { MarketId, Side } from "@agari/core/types";
import type { FeedTake, TakesFeed } from "@/features/takes/protocol";

/** How far back a stored take may be stamped and still be this attempt (clock skew between phone and server). */
const SKEW_MS = 60_000;

/**
 * After a post whose answer never arrived (a dropped connection, not a refusal), ask the feed whether the take landed:
 * the author's newest takes, matched on Window, side and the exact words, stamped no earlier than this attempt. The
 * row is the server's own, so what the screen then calls "posted" is what was stored.
 */
export async function findPostedTake(input: { address: string; marketId: MarketId; side: Side; caption: string; sinceMs: number }): Promise<FeedTake | null> {
  try {
    const response = await fetch(`/api/takes?authors=${encodeURIComponent(input.address)}&limit=5`);
    if (!response.ok) return null;
    const feed = (await response.json()) as TakesFeed;
    return (
      feed.takes.find(
        (take) =>
          take.marketId === input.marketId &&
          take.side === input.side &&
          take.caption === input.caption &&
          take.createdAtMs >= input.sinceMs - SKEW_MS,
      ) ?? null
    );
  } catch {
    return null;
  }
}
