import { arenaRefundReasonOf, arenaStatusOf, pickOf, type ArenaEvent, type ArenaEventLog } from "@masayume/core/games";
import type { Reading } from "@masayume/core/schemas";
import { toMarketId, type Address, type Bytes32 } from "@masayume/core/types";
import { parseEventLogs, zeroAddress, type Log, type PublicClient } from "viem";
import { gameArenaAbi } from "../contracts/game-arena.abi";
import { withReading } from "../provider/reading";
import { getArenaDeployment, getClient } from "../runtime/read-runtime";

/**
 * The arena's own log, decoded once, so exactly one module in the repo knows this ABI (AD-10).
 *
 * The projector gets `ArenaEvent`s in the contract's vocabulary and never a topic, a hex word or a
 * viem type. That boundary is what lets the projection be written and tested against core's types, and
 * what keeps a future ABI change from being a change to the ops service.
 */

const ZERO = "0x0000000000000000000000000000000000000000";

type Decoded = ReturnType<typeof parseEventLogs<typeof gameArenaAbi>>[number];

function lower(value: string): Address {
  return value.toLowerCase() as Address;
}

/** One decoded log as an `ArenaEvent`, or null for an admin event a match's story does not include. */
function toEvent(log: Decoded): ArenaEvent | null {
  switch (log.eventName) {
    case "MatchCreated":
      return {
        kind: "created",
        matchId: log.args.matchId,
        creator: lower(log.args.creator),
        tier: log.args.tier,
        potBase: log.args.potBase,
        deckHash: log.args.deckHash,
        deckSize: log.args.deckSize,
        joinDeadlineSec: Number(log.args.joinDeadlineSec),
      };
    case "MatchJoined":
      return {
        kind: "joined",
        matchId: log.args.matchId,
        challenger: lower(log.args.challenger),
        potBase: log.args.potBase,
        revealDeadlineSec: Number(log.args.revealDeadlineSec),
      };
    case "DeckRevealed":
      return {
        kind: "revealed",
        matchId: log.args.matchId,
        policyVersion: log.args.policyVersion,
        cards: log.args.cards.map(toMarketId),
        pickDeadlineSec: Number(log.args.pickDeadlineSec),
      };
    case "PickFilled":
      return {
        kind: "picked",
        matchId: log.args.matchId,
        player: lower(log.args.player),
        marketId: toMarketId(log.args.marketId),
        cardIndex: log.args.cardIndex,
        pick: pickOf(log.args.outcomeIdx),
        quantity: log.args.quantity,
        costBase: log.args.costBase,
        refundBase: log.args.refundBase,
      };
    case "PicksLocked":
      return {
        kind: "locked",
        matchId: log.args.matchId,
        status: arenaStatusOf(log.args.status),
        forfeitedBy: log.args.forfeitedBy === ZERO ? null : lower(log.args.forfeitedBy),
      };
    case "CardSettled":
      return {
        kind: "settled",
        matchId: log.args.matchId,
        player: lower(log.args.player),
        marketId: toMarketId(log.args.marketId),
        cardIndex: log.args.cardIndex,
        payoutBase: log.args.payoutBase,
        pnlBase: log.args.pnlBase,
      };
    case "MatchFinalized":
      return {
        kind: "finalized",
        matchId: log.args.matchId,
        winner: log.args.winner === ZERO ? null : lower(log.args.winner),
        creatorPnlBase: log.args.creatorPnlBase,
        challengerPnlBase: log.args.challengerPnlBase,
        potAwardedBase: log.args.potAwarded,
      };
    case "MatchRefunded":
      return { kind: "refunded", matchId: log.args.matchId, reason: arenaRefundReasonOf(log.args.reason), perPlayerBase: log.args.perPlayerBase };
    case "CreditClaimed":
      return { kind: "claimed", player: lower(log.args.player), amountBase: log.args.amount, by: lower(log.args.by) };
    case "AgentAuthorized":
      return {
        kind: "agent",
        matchId: log.args.matchId,
        player: lower(log.args.player),
        agent: log.args.agent === zeroAddress ? null : lower(log.args.agent),
        expiresAtSec: Number(log.args.expiresAtSec),
        budgetBase: log.args.budgetBase,
      };
    default:
      return null;
  }
}

function viem(): PublicClient {
  return getClient().getViemClient() as PublicClient;
}

/** The head this projector may read up to. */
export async function arenaHeadBlock(): Promise<Reading<bigint>> {
  return withReading("arenaHead", async () => viem().getBlockNumber());
}

/**
 * Every arena event in a block range, in chain order.
 *
 * The range is the caller's to choose and to keep small: a public RPC will refuse a wide one, and a
 * projector that asks for the whole chain at once fails at exactly the moment it matters — the first
 * run after a deployment. Timestamps come from the logs' own blocks, batched, so a range of one block
 * costs one extra call rather than one per event.
 */
export async function listArenaEvents(fromBlock: bigint, toBlock: bigint): Promise<Reading<readonly ArenaEventLog[]>> {
  return withReading(`arenaEvents:${fromBlock}:${toBlock}`, async () => {
    const deployment = getArenaDeployment();
    if (!deployment) return [];
    const client = viem();
    const logs = await client.getLogs({ address: deployment.gameArena, fromBlock, toBlock });
    const parsed = parseEventLogs({ abi: gameArenaAbi, logs: logs as Log[] });

    const blocks = new Map<bigint, number>();
    for (const log of parsed) if (log.blockNumber !== null) blocks.set(log.blockNumber, 0);
    await Promise.all(
      [...blocks.keys()].map(async (blockNumber) => {
        const block = await client.getBlock({ blockNumber });
        blocks.set(blockNumber, Number(block.timestamp));
      }),
    );

    const out: ArenaEventLog[] = [];
    for (const log of parsed) {
      const event = toEvent(log);
      if (!event || log.blockNumber === null || log.logIndex === null) continue;
      out.push({
        event,
        blockNumber: log.blockNumber,
        txHash: (log.transactionHash ?? "0x") as Bytes32,
        logIndex: log.logIndex,
        blockTimeSec: blocks.get(log.blockNumber) ?? 0,
      });
    }
    return out.sort((a, b) => Number(a.blockNumber - b.blockNumber) || a.logIndex - b.logIndex);
  });
}
