import type { ArenaParams } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Hex } from "@masayume/core/types";
import { closeRuntime, createMemoryJournal, createSubmitterSession, ensureMarkets, parseMarketsEnv } from "@masayume/markets";
import { getArenaState, resolveArenaDeployment, writeGameArena } from "@masayume/markets/games";
import { finish } from "./finish";

/**
 * Reads the arena's parameters, and with `APPLY=1` writes the owner's approved set.
 *
 * Why these numbers (owner's decision, 2026-09-03, measured by `spike:deck-supply`): Somnia supplies two
 * Windows per cadence, and the arena checks card life at reveal — so a 15m Window is only dealable for
 * the part of its cycle that outlasts join + reveal + card life. At `minDeckSize` 3 with 180/120 windows
 * a duel was dealable 40% of the time. A floor of two and tighter windows takes that to 90%.
 *
 * The windows shrink safely because both players are already live on sockets when they are paired — 60
 * seconds to sign a create and a join is generous for someone looking at the screen — and a player who
 * misses it triggers `refundUnjoined`, which returns the pot. The failure is a refund, not a loss.
 *
 *   pnpm --filter @masayume/ops spike:arena-params            (read)
 *   ADMIN_KEY=… APPLY=1 pnpm --filter @masayume/ops spike:arena-params   (write)
 */
const TARGET: ArenaParams = {
  joinWindowSec: Number(process.env.JOIN_WINDOW_SEC ?? 60),
  revealWindowSec: Number(process.env.REVEAL_WINDOW_SEC ?? 45),
  pickWindowSec: Number(process.env.PICK_WINDOW_SEC ?? 180),
  minDeckSize: Number(process.env.MIN_DECK_SIZE ?? 2),
  maxDeckSize: Number(process.env.MAX_DECK_SIZE ?? 5),
  minCardLifeSec: Number(process.env.MIN_CARD_LIFE_SEC ?? 240),
};

const show = (p: ArenaParams) =>
  `join ${p.joinWindowSec}s · reveal ${p.revealWindowSec}s · pick ${p.pickWindowSec}s · deck ${p.minDeckSize}–${p.maxDeckSize} · cardLife ${p.minCardLifeSec}s`;

async function main(): Promise<void> {
  const env = parseMarketsEnv();
  ensureMarkets(env);
  const deployment = resolveArenaDeployment(env);
  if (!deployment) throw new Error("no GameArena on this network");

  const before = await getArenaState();
  if (!isOk(before) || !before.value) throw new Error("the arena is unreadable");
  console.log(`arena  ${deployment.gameArena} on chain ${deployment.chainId}`);
  console.log(`now    ${show(before.value.params)}`);
  console.log(`target ${show(TARGET)}`);

  // The contract's own guard, restated so a bad set is refused here rather than costing a reverted send.
  if (TARGET.minCardLifeSec <= TARGET.pickWindowSec) throw new Error("minCardLifeSec must outlast pickWindowSec");
  if (TARGET.minDeckSize === 0 || TARGET.maxDeckSize < TARGET.minDeckSize) throw new Error("bad deck bounds");

  if (process.env.APPLY !== "1") return void console.log("\nread-only; set APPLY=1 with ADMIN_KEY to write");

  const key = process.env.ADMIN_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("ADMIN_KEY is required to write");
  const session = await createSubmitterSession({ env, authority: "user-wallet", signer: { privateKey: key as Hex }, journal: createMemoryJournal() });
  console.log(`\nsigning as ${session.address}`);

  // Through the port, so this spike never holds the arena's ABI (AD-10): the simulate inside it is also
  // what turns the contract's own `BadParams` into a decoded revert rather than an opaque one.
  const sent = await writeGameArena(session.contracts, "setParams", [TARGET], "setParams");
  console.log(`setParams ${sent.hash} · gas ${sent.receipt.gasUsed} · status ${sent.receipt.status}`);

  // Read back from the chain rather than trusting the send: the point of the exercise is the new rule.
  const after = await getArenaState();
  if (!isOk(after) || !after.value) throw new Error("unreadable after the write");
  console.log(`after  ${show(after.value.params)}`);
  const matches = (Object.keys(TARGET) as (keyof ArenaParams)[]).every((k) => after.value?.params[k] === TARGET[k]);
  console.log(matches ? "\nthe chain holds exactly the target set" : "\nMISMATCH: the chain does not hold the target set");
  await session.dispose();
  await closeRuntime();
}

void main()
  .then(() => finish(0))
  .catch((error: unknown) => {
    console.error(error);
    finish(1);
  });
