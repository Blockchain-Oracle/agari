import type { Reading } from "@masayume/core/schemas";
import type { MarketId } from "@masayume/core/types";
import { getClient } from "../runtime/read-runtime";
import { numberOf } from "../mappers/scalars";
import { withReading } from "./reading";

/**
 * Settlement fee is read from the venue at use time and never cached at init (canon #15); this venue currently runs at 0.
 * A missing fee is an error arm, never 0 — the plate and the relayer must never disagree on a fee flip (AD-15).
 */
export async function settlementFeeBps(marketId: MarketId): Promise<Reading<number>> {
  return withReading(`fee:${marketId}`, async () => {
    const fees = await getClient().getMarketFees(marketId);
    const bps = numberOf(fees?.settlementFeeBps);
    if (bps === null) throw new Error(`settlement fee unavailable for market ${marketId}`);
    return bps;
  });
}
