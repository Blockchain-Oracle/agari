import type { BetRoute } from "@agari/db";

/** Enough for any tab's session; the oldest drop first. */
const LOCAL_FILLS_MAX = 500;

const localFills = new Set<string>();

/**
 * Tells the Room's registry about a confirmed fill. Fire-and-forget: the server re-reads the fill from the index before
 * it writes anything, and a failure here costs the bettor nothing — the gate's index and seat steps still admit them.
 * Called from every lane that confirms a position on a Window — the reference records the bet inside the bet.
 *
 * It also remembers the signature for this tab, so the lifecycle notifications (lane 13d) do not announce a fill the
 * user just watched land.
 */
export function recordBet(marketId: string, address: string, txHash: string, route: BetRoute): void {
  localFills.add(txHash);
  if (localFills.size > LOCAL_FILLS_MAX) localFills.delete(localFills.values().next().value as string);
  void fetch("/api/room/bet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ marketId, address, txHash, route }),
    keepalive: true,
  }).catch(() => undefined);
}

/** The fill signatures this tab confirmed (via `recordBet`) since it loaded. */
export function localFillSignatures(): ReadonlySet<string> {
  return localFills;
}
