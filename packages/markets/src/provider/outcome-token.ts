import type { Address, MarketId } from "@masayume/core/types";
import { getOnchain } from "./onchain";
import type { Unwrap } from "./reading";

let outcomeToken: Address | null = null;

/** OutcomeToken6909 is one singleton for every market; learn its address from any market once. */
export async function resolveOutcomeToken(inner: Unwrap, marketId: MarketId): Promise<Address> {
  if (outcomeToken) return outcomeToken;
  outcomeToken = inner(await getOnchain(marketId)).outcomeToken;
  return outcomeToken;
}
