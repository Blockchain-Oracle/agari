import type { Reading } from "@masayume/core/schemas";
import type { Address, Holdings, OnchainSnapshot, OpenPosition } from "@masayume/core/types";
import { getClient } from "../runtime/read-runtime";
import { toOpenPosition } from "../mappers/position";
import { withReading } from "./reading";

export async function listOpenPositions(wallet: Address): Promise<Reading<OpenPosition[]>> {
  return withReading(`positions:${wallet}`, async () => (await getClient().getOpenPositionsWithPnL(wallet)).map(toOpenPosition));
}

/** Authoritative ERC-6909 balances for one market generation — the ids encode (pool, nonce), so a recycled pool can't bleed through. */
export async function getHoldings(wallet: Address, onchain: OnchainSnapshot): Promise<Reading<Holdings>> {
  return withReading(`holdings:${wallet}:${onchain.marketId}`, async () => {
    const [upRaw = 0n, downRaw = 0n] = await getClient().getBalances(
      [
        { token: onchain.outcomeToken, id: onchain.yesId },
        { token: onchain.outcomeToken, id: onchain.noId },
      ],
      wallet,
    );
    return { upRaw, downRaw };
  });
}
