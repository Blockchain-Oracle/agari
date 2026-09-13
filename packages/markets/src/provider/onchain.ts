import type { Reading } from "@masayume/core/schemas";
import type { MarketId, OnchainSnapshot } from "@masayume/core/types";
import { getClient } from "../runtime/read-runtime";
import { toOnchainSnapshot } from "../mappers/onchain";
import { withReading } from "./reading";

/** Takes the bytes32 market id, not an address (0.13 breaking change, canon #2). */
export async function getOnchain(marketId: MarketId): Promise<Reading<OnchainSnapshot>> {
  return withReading(`onchain:${marketId}`, async () => toOnchainSnapshot(marketId, await getClient().getMarketOnchain(marketId)));
}
