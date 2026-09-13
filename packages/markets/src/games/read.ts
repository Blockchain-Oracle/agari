import {
  arenaStatusOf,
  cardsInMask,
  pickOf as pickFromIndex,
  type ArenaAgent,
  type ArenaMatch,
  type ArenaParams,
  type ArenaPick,
  type ArenaQuote,
  type ArenaTier,
  type Pick,
  type Seat,
} from "@masayume/core/games";
import type { Reading } from "@masayume/core/schemas";
import { toMarketId, type Address, type Bytes32, type MarketId } from "@masayume/core/types";
import { zeroAddress, type PublicClient } from "viem";
import { MULTICALL3_ADDRESS } from "../chain";
import { gameArenaAbi } from "../contracts/game-arena.abi";
import { withReading } from "../provider/reading";
import { getArenaDeployment, getClient } from "../runtime/read-runtime";

/** The public `params` getter flattens the struct into a tuple, in declaration order. */
type ParamsTuple = readonly [number, number, number, number, number, number];
type TierTuple = readonly [bigint, bigint, boolean];

interface MatchTuple {
  creator: Address;
  tier: number;
  status: number;
  deckSize: number;
  pickedMask0: number;
  challenger: Address;
  pickedMask1: number;
  settledMask: number;
  policyVersion: number;
  deckHash: `0x${string}`;
  createdAtSec: bigint;
  joinedAtSec: bigint;
  revealedAtSec: bigint;
  pickDeadlineSec: bigint;
  potBase: bigint;
  perCardCapBase: bigint;
}

interface PickTuple {
  placed: boolean;
  settled: boolean;
  outcomeIdx: number;
  quantity: bigint;
  costBase: bigint;
  payoutBase: bigint;
}

/** One match as the chain holds it: the record, the revealed deck, both seats' picks and the running PnL. */
export interface ArenaMatchView {
  match: ArenaMatch;
  cards: readonly MarketId[];
  picks: readonly ArenaPick[];
  creatorPnlBase: bigint;
  challengerPnlBase: bigint;
}

/** The arena's tunables, its priced tiers and whether it is taking new matches. */
export interface ArenaState {
  address: Address;
  params: ArenaParams;
  tiers: readonly ArenaTier[];
  paused: boolean;
  escrowedBase: bigint;
  creditedBase: bigint;
}

const TIER_COUNT = 4;

function viem(): PublicClient {
  return getClient().getViemClient() as PublicClient;
}

function arenaContract() {
  const deployment = getArenaDeployment();
  return deployment ? ({ address: deployment.gameArena, abi: gameArenaAbi } as const) : null;
}

export function toArenaParams(p: ParamsTuple): ArenaParams {
  return {
    joinWindowSec: p[0],
    revealWindowSec: p[1],
    pickWindowSec: p[2],
    minDeckSize: p[3],
    maxDeckSize: p[4],
    minCardLifeSec: p[5],
  };
}

export function toArenaMatch(matchId: Bytes32, m: MatchTuple): ArenaMatch {
  return {
    matchId,
    creator: m.creator.toLowerCase() as Address,
    challenger: m.challenger.toLowerCase() as Address,
    tier: m.tier,
    status: arenaStatusOf(m.status),
    deckSize: m.deckSize,
    pickedMask0: m.pickedMask0,
    pickedMask1: m.pickedMask1,
    settledMask: m.settledMask,
    policyVersion: m.policyVersion,
    deckHash: m.deckHash as Bytes32,
    createdAtSec: Number(m.createdAtSec),
    joinedAtSec: Number(m.joinedAtSec),
    revealedAtSec: Number(m.revealedAtSec),
    pickDeadlineSec: Number(m.pickDeadlineSec),
    potBase: m.potBase,
    perCardCapBase: m.perCardCapBase,
  };
}

function toArenaPick(cardIndex: number, seat: Seat, p: PickTuple): ArenaPick {
  return {
    cardIndex,
    seat,
    placed: p.placed,
    settled: p.settled,
    pick: pickFromIndex(p.outcomeIdx),
    quantity: p.quantity,
    costBase: p.costBase,
    payoutBase: p.payoutBase,
  };
}

/** The arena's sheet and tunables in one multicall; null where no arena is deployed. */
export async function getArenaState(): Promise<Reading<ArenaState | null>> {
  return withReading("gameArena", async () => {
    const contract = arenaContract();
    if (!contract) return null;
    const client = viem();
    // Two calls rather than one: viem narrows a mixed `contracts` array to the last entry's function,
    // and a per-tier read is a different shape from the sheet's four.
    const [params, paused, escrowed, credited] = await client.multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: [
        { ...contract, functionName: "params" },
        { ...contract, functionName: "paused" },
        { ...contract, functionName: "escrowed" },
        { ...contract, functionName: "credited" },
      ],
    });
    const tiers = await client.multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: Array.from({ length: TIER_COUNT }, (_, i) => ({ ...contract, functionName: "tierOf", args: [i] }) as const),
    });
    return {
      address: contract.address,
      params: toArenaParams(params as unknown as ParamsTuple),
      paused,
      escrowedBase: escrowed,
      creditedBase: credited,
      tiers: (tiers as unknown as readonly TierTuple[]).map((t, tier) => ({ tier, potBase: t[0], perCardCapBase: t[1], enabled: t[2] })),
    };
  });
}

/**
 * One match, whole. Two round trips rather than one: the deck size is only known from the record, and
 * asking for eight card slots that may not exist would read storage the match never wrote.
 */
export async function getArenaMatch(matchId: Bytes32): Promise<Reading<ArenaMatchView | null>> {
  return withReading(`arenaMatch:${matchId}`, async () => {
    const contract = arenaContract();
    if (!contract) return null;
    const client = viem();
    const [record, deck, pnl] = await client.multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: [
        { ...contract, functionName: "matchOf", args: [matchId] },
        { ...contract, functionName: "deckOf", args: [matchId] },
        { ...contract, functionName: "pnlOf", args: [matchId] },
      ],
    });
    const m = record as MatchTuple;
    if (m.creator === "0x0000000000000000000000000000000000000000") return null;
    const match = toArenaMatch(matchId, m);

    const slots: { cardIndex: number; seat: Seat }[] = [];
    for (let cardIndex = 0; cardIndex < match.deckSize; cardIndex += 1) {
      slots.push({ cardIndex, seat: 0 }, { cardIndex, seat: 1 });
    }
    const rows = slots.length
      ? await client.multicall({
          multicallAddress: MULTICALL3_ADDRESS,
          allowFailure: false,
          contracts: slots.map(({ cardIndex, seat }) => ({ ...contract, functionName: "pickOf", args: [matchId, cardIndex, seat] }) as const),
        })
      : [];
    const [creatorPnlBase, challengerPnlBase] = pnl as readonly [bigint, bigint];
    return {
      match,
      cards: (deck as readonly `0x${string}`[]).map(toMarketId),
      picks: slots.map((slot, i) => toArenaPick(slot.cardIndex, slot.seat, rows[i] as PickTuple)).filter((p) => p.placed),
      creatorPnlBase,
      challengerPnlBase,
    };
  });
}

/** What a stake buys on one side of one card right now — the same walk `placePick` will make. */
export async function quoteArenaPick(marketId: MarketId, pick: Pick, stakeBase: bigint): Promise<Reading<ArenaQuote | null>> {
  return withReading(`arenaQuote:${marketId}:${pick}:${stakeBase}`, async () => {
    const contract = arenaContract();
    if (!contract) return null;
    const q = await viem().readContract({ ...contract, functionName: "sizeForStake", args: [marketId, pick === "up" ? 0 : 1, stakeBase] });
    return q as ArenaQuote;
  });
}

/** What the arena owes one wallet: card payouts and pot alike, waiting on a pull. */
export async function getArenaCredit(wallet: Address): Promise<Reading<bigint>> {
  return withReading(`arenaCredit:${wallet}`, async () => {
    const contract = arenaContract();
    if (!contract) return 0n;
    return (await viem().readContract({ ...contract, functionName: "creditOf", args: [wallet] })) as bigint;
  });
}

/** The key a seat has named for this match, or null when none is live — read before a pick is routed through one. */
export async function readArenaAgent(matchId: Bytes32, player: Address): Promise<Reading<ArenaAgent | null>> {
  return withReading(`arenaAgent:${matchId}:${player}`, async () => {
    const contract = arenaContract();
    if (!contract) return null;
    const a = await viem().readContract({ ...contract, functionName: "agentOf", args: [matchId, player] });
    if (a.agent === zeroAddress) return null;
    return { agent: a.agent.toLowerCase() as Address, expiresAtSec: Number(a.expiresAtSec), budgetBase: a.budgetBase, spentBase: a.spentBase };
  });
}

/** The cards a seat still owes, straight off the chain's own completion mask. */
export function cardsOutstanding(match: ArenaMatch, seat: Seat): readonly number[] {
  const mask = seat === 0 ? match.pickedMask0 : match.pickedMask1;
  const all = cardsInMask((1 << match.deckSize) - 1, match.deckSize);
  return all.filter((i) => ((mask >> i) & 1) === 0);
}
