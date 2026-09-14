/**
 * A Window's redemption for one wallet (first-call.md §2.2, D-032): the wallet's own `user_redeem`, or the settler's
 * `redeem_for` after the claim grace. Read from the index (`wallet/:w/actions`), so the verdict can say "Paid
 * automatically" with the transaction once the seat is gone from the Ledger.
 */
import type { Reading } from "@agari/core/schemas";
import { toSignature, type Address, type MarketId, type Signature } from "@agari/core/types";
import { indexRows, type ActionRow } from "./index-api";
import { withReading } from "./reading";

export interface Redemption {
  txHash: Signature;
  /** True when the settler's `redeem_for` paid the seat, not the wallet's own claim. */
  byCrank: boolean;
}

/** A wallet redeems a Window once (a full redeem), so the newest 200 actions reach any Window still on screen. */
const ACTIONS_LIMIT = 200;

export function getRedemption(wallet: Address, marketId: MarketId): Promise<Reading<Redemption | null>> {
  return withReading(`redemption:${wallet}:${marketId}`, async () => {
    const rows = await indexRows<ActionRow>(`wallet/${wallet}/actions`, { limit: ACTIONS_LIMIT });
    const row = rows.find((action) => action.name === "Redeemed" && action.market === marketId);
    return row ? { txHash: toSignature(row.signature), byCrank: row.data.byCrank === true } : null;
  });
}
