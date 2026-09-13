import { isOk } from "@masayume/core/schemas";
import type { Bytes32, MarketId } from "@masayume/core/types";
import type { SubmitterSession } from "@masayume/markets";
import { quoteArenaPick, sendArenaIntent } from "@masayume/markets/games";

/**
 * One card, one side, retried while the pick deadline allows.
 *
 * The retry is not defensive padding — it is the answer to something the first live duel exposed
 * (2026-09-03). Both seats of a match swipe the same card at the same moment, and on a binary pool
 * buying UP and buying DOWN draw on the same resting liquidity: the creator's fill consumed the level
 * the challenger had just been quoted against, and the challenger's `placePick` reverted while the
 * creator's landed in the same second. Nothing was wrong with either pick. Whoever loses that race has
 * simply to ask again, which is why the floor loosens on each attempt rather than the stake changing —
 * the arena refunds whatever the walk does not spend, so a smaller fill costs the player nothing extra.
 */
export interface PickAttempt {
  placed: boolean;
  attempts: number;
  why?: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The floor under the quote, loosening per attempt: 90% of the quote, then 70%, then 50%. */
function floorFor(quantityRaw: bigint, attempt: number): bigint {
  const bps = [9_000n, 7_000n, 5_000n][Math.min(attempt - 1, 2)] as bigint;
  return (quantityRaw * bps) / 10_000n;
}

export async function placePickWithRetry(
  session: SubmitterSession,
  matchId: Bytes32,
  cardIndex: number,
  marketId: MarketId,
  side: "up" | "down",
  stakeBase: bigint,
  deadlineSec: number,
  log: (line: string) => void,
  maxAttempts = 4,
): Promise<PickAttempt> {
  let why = "the deadline passed before the pick landed";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (Math.floor(Date.now() / 1_000) >= deadlineSec - 3) break;
    const quote = await quoteArenaPick(marketId, side, stakeBase);
    if (!isOk(quote) || !quote.value) {
      why = isOk(quote) ? "the quote came back empty" : (quote.error.technical.split("\n")[0] ?? "unreadable");
      await sleep(1_500);
      continue;
    }
    try {
      const sent = await sendArenaIntent(session.contracts, {
        kind: "arena-pick",
        matchId,
        cardIndex,
        pick: side,
        stakeBase,
        minQuantityRaw: floorFor(quote.value.quantityRaw, attempt),
      });
      log(`card ${cardIndex} ${side}${attempt > 1 ? ` (attempt ${attempt})` : ""} · ${sent.hash} · gas ${sent.receipt.gasUsed}`);
      return { placed: sent.receipt.status === "success", attempts: attempt };
    } catch (error) {
      why = (error instanceof Error ? error.message.split("\n")[0] : String(error)) ?? "reverted";
      log(`card ${cardIndex} ${side} attempt ${attempt} lost the race: ${why}`);
      await sleep(1_500);
    }
  }
  return { placed: false, attempts: maxAttempts, why };
}
