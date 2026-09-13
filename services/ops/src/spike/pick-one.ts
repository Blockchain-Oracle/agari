import { isOk } from "@masayume/core/schemas";
import type { Bytes32, Hex } from "@masayume/core/types";
import { closeRuntime, createMemoryJournal, createSubmitterSession, ensureMarkets, loadCollateral, parseMarketsEnv } from "@masayume/markets";
import { getArenaMatch } from "@masayume/markets/games";
import { finish } from "./finish";
import { placePickWithRetry } from "./pick";

/**
 * One pick, retried until the deadline. The recovery a swipe needs when it loses a race for the book.
 *
 *   PLAYER_KEY=… MATCH_ID=… CARD=1 SIDE=down pnpm --filter @masayume/ops spike:pick-one
 */
async function main(): Promise<void> {
  const env = parseMarketsEnv();
  ensureMarkets(env);
  const collateral = await loadCollateral();
  if (!isOk(collateral)) throw new Error("collateral unreadable");
  const matchId = process.env.MATCH_ID as Bytes32;
  const cardIndex = Number(process.env.CARD ?? 0);
  const side = (process.env.SIDE ?? "down") as "up" | "down";
  const stakeBase = BigInt(process.env.STAKE_CENTS ?? 1) * 10n ** BigInt(collateral.value.decimals) / 100n;
  const session = await createSubmitterSession({ env, authority: "user-wallet", signer: { privateKey: process.env.PLAYER_KEY as Hex }, journal: createMemoryJournal() });

  const view = await getArenaMatch(matchId);
  if (!isOk(view) || !view.value) throw new Error("match unreadable");
  const marketId = view.value.cards[cardIndex];
  if (!marketId) throw new Error(`no card ${cardIndex}`);
  const deadline = view.value.match.pickDeadlineSec;
  console.log(`card ${cardIndex} ${side} on ${marketId}; deadline ${deadline}`);

  const attempt = await placePickWithRetry(session, matchId, cardIndex, marketId, side, stakeBase, deadline, (line) => console.log(line), 8);
  const after = await getArenaMatch(matchId);
  if (isOk(after) && after.value) console.log(`status ${after.value.match.status} after ${attempt.attempts} attempt(s)`);
  await session.dispose();
  if (!attempt.placed) throw new Error(attempt.why ?? "the pick never landed");
  return;

}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeRuntime();
    finish(typeof process.exitCode === "number" ? process.exitCode : 0);
  });
