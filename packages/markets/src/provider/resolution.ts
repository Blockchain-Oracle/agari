import type { Reading } from "@agari/core/schemas";
import type { MarketId, Resolution } from "@agari/core/types";
import { getClient } from "../runtime/read-runtime";
import { toResolution } from "../mappers/resolution";
import { withReading } from "./reading";

export async function getResolution(marketId: MarketId): Promise<Reading<Resolution>> {
  return withReading(`resolution:${marketId}`, async () => toResolution(await getClient().getMarketResolution(marketId)));
}
