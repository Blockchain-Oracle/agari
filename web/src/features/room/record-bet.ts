import type { BetRoute } from "@masayume/db";

/**
 * Tells the Room's registry about a confirmed fill. Fire-and-forget: the server re-reads the receipt before it
 * writes anything, and a failure here costs the bettor a Room seat until the next fill, never the bet. Called
 * from every lane that confirms a position on a Window — the reference records the bet inside the bet.
 */
export function recordBet(marketId: string, address: string, txHash: string, route: BetRoute): void {
  void fetch("/api/room/bet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ marketId, address, txHash, route }),
    keepalive: true,
  }).catch(() => undefined);
}
