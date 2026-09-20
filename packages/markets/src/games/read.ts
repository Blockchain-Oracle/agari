/** GameArena (duels) and the season pool on Solana are `agari-arena` (S12b). Every figure here is read from the chain. */
import { fetchMaybeAgent, fetchMaybeArena, fetchMaybeCredit, fetchMaybeGameMatch, fetchMaybeSeasonPool } from "@agari/clients/agari-arena";
import { arenaStatusOf, pickOf, type ArenaAgent, type ArenaMatch, type ArenaParams, type ArenaPick, type ArenaQuote, type ArenaTier, type Pick, type Seat } from "@agari/core/games";
import { walkBudget, walkQuantity } from "@agari/core/leverage";
import type { Reading } from "@agari/core/schemas";
import type { Address, Hash32, MarketId } from "@agari/core/types";
import { ceilDiv } from "@agari/core/units";
import { fetchEncodedAccount } from "@solana/kit";
import { readBoostBook } from "../leverage/book";
import { withReading } from "../provider/reading";
import { requireProgramSeat } from "../runtime/program-seat";
import { solana } from "../runtime/solana";
import { agentAddress, arenaAddress, creditAddress, custodyAddress, idHex, kit, matchAddress, seasonAddress, seasonVaultAddress, seatAddress } from "./deployment";

export { arenaHeadBlock, listArenaEvents } from "./events";
export { resolveArenaDeployment } from "./deployment";

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
  /** The three counters custody equals after every instruction: open pots, players' credits, seats' key escrows. */
  escrowedBase: bigint;
  creditedBase: bigint;
  agentEscrowBase: bigint;
  /** Custody's own token balance, so a reader can check that identity rather than take the program's word. */
  custodyBase: bigint;
}

/** The pool as the chain holds it: what it escrows, what it was ever given, and whether it has paid. */
export interface SeasonPoolState {
  address: Address;
  seasonId: string;
  endsAtSec: number;
  admin: Address;
  balanceBase: bigint;
  depositedBase: bigint;
  distributed: boolean;
}

/** The SPL token account `amount` u64. */
const TOKEN_AMOUNT_OFFSET = 64;

async function tokenBalance(account: Address): Promise<bigint> {
  const found = await fetchEncodedAccount(solana().rpc, kit(account));
  if (!found.exists || found.data.byteLength < TOKEN_AMOUNT_OFFSET + 8) return 0n;
  return new DataView(found.data.buffer, found.data.byteOffset, found.data.byteLength).getBigUint64(TOKEN_AMOUNT_OFFSET, true);
}

export async function readArena() {
  const address = await arenaAddress();
  const account = await fetchMaybeArena(solana().rpc, kit(address));
  return account.exists ? { address, data: account.data } : null;
}

/** `null`, not an error, when there is no arena on this cluster. */
export function getArenaState(): Promise<Reading<ArenaState | null>> {
  return withReading("arena:state", async () => {
    const arena = await readArena();
    if (!arena) return null;
    const { data } = arena;
    return {
      address: arena.address,
      params: { ...data.params },
      tiers: data.tiers.map((t, tier) => ({ tier, potBase: t.potBase, perCardCapBase: t.perCardCapBase, enabled: t.enabled })),
      paused: data.paused,
      escrowedBase: data.escrowedBase,
      creditedBase: data.creditedBase,
      agentEscrowBase: data.agentEscrowBase,
      custodyBase: await tokenBalance(await custodyAddress()),
    } satisfies ArenaState;
  });
}

export function getArenaMatch(matchId: Hash32): Promise<Reading<ArenaMatchView | null>> {
  return withReading(`arena:match:${matchId}`, async () => {
    const account = await fetchMaybeGameMatch(solana().rpc, kit(await matchAddress(matchId)));
    // `init_if_needed` can leave an account whose creator was never set, when a create was refused after the rent was paid.
    if (!account.exists || account.data.creator === "11111111111111111111111111111111") return null;
    const m = account.data;
    const match: ArenaMatch = {
      matchId: idHex(m.matchId),
      creator: m.creator as string as Address,
      challenger: m.challenger as string as Address,
      tier: m.tier,
      status: arenaStatusOf(Number(m.status)),
      deckSize: m.deckSize,
      pickedMask0: m.pickedMask0,
      pickedMask1: m.pickedMask1,
      settledMask: m.settledMask,
      policyVersion: m.policyVersion,
      deckHash: idHex(m.deckHash),
      createdAtSec: Number(m.createdAtSec),
      joinedAtSec: Number(m.joinedAtSec),
      revealedAtSec: Number(m.revealedAtSec),
      pickDeadlineSec: Number(m.pickDeadlineSec),
      potBase: m.potBase,
      perCardCapBase: m.perCardCapBase,
    };
    const revealed = m.revealedAtSec > 0n;
    const picks: ArenaPick[] = [];
    for (let cardIndex = 0; cardIndex < m.deckSize; cardIndex += 1) {
      for (const seat of [0, 1] as Seat[]) {
        const rec = m.picks[cardIndex * 2 + seat];
        if (rec?.placed) picks.push({ cardIndex, seat, placed: true, settled: rec.settled, pick: pickOf(rec.outcome), quantity: rec.lots * rec.lotBase, costBase: rec.costBase, payoutBase: rec.payoutBase });
      }
    }
    return {
      match,
      cards: revealed ? m.cards.slice(0, m.deckSize).map((c) => c as string as MarketId) : [],
      picks,
      creatorPnlBase: m.pnlBase[0] ?? 0n,
      challengerPnlBase: m.pnlBase[1] ?? 0n,
    } satisfies ArenaMatchView;
  });
}

/**
 * What a stake buys on one card right now, by `player_place_pick`'s own steps: the whole stake is the budget, the
 * size is what it buys off every live order on the taken side, floored to the lot. `null` when the book offers
 * nothing at this size, which is the one answer a swipe cannot act on.
 */
export function quoteArenaPick(marketId: MarketId, pick: Pick, stakeBase: bigint): Promise<Reading<ArenaQuote | null>> {
  return withReading(`arena:quote:${marketId}:${pick}:${stakeBase}`, async () => {
    const book = await readBoostBook(marketId, pick);
    await requireProgramSeat("the arena", marketId, book.ledger, await seatAddress());
    const invert = pick === "down";
    const quantityRaw = walkBudget(book.entry, invert, book.one, stakeBase, book.lotRaw);
    const least = book.minQuantityRaw > book.lotRaw ? book.minQuantityRaw : book.lotRaw;
    if (quantityRaw < least) return null;
    const walk = walkQuantity(book.entry, invert, book.one, quantityRaw);
    return { quantityRaw, costRaw: walk.costBase, limitYesRaw: walk.limitYesRaw, priceRaw: ceilDiv(walk.costBase * book.one, quantityRaw) } satisfies ArenaQuote;
  });
}

/** A player's claimable money: payouts, pots won or refunded, what a key never spent. */
export function getArenaCredit(wallet: Address): Promise<Reading<bigint>> {
  return withReading(`arena:credit:${wallet}`, async () => {
    const account = await fetchMaybeCredit(solana().rpc, kit(await creditAddress(wallet)));
    return account.exists ? account.data.amountBase : 0n;
  });
}

/** A seat's key as the chain holds it: null once released or never named. */
export function readArenaAgent(matchId: Hash32, player: Address): Promise<Reading<ArenaAgent | null>> {
  return withReading(`arena:agent:${matchId}:${player}`, async () => {
    const account = await fetchMaybeAgent(solana().rpc, kit(await agentAddress(matchId, player)));
    if (!account.exists || account.data.agent === "11111111111111111111111111111111") return null;
    const a = account.data;
    return { agent: a.agent as string as Address, expiresAtSec: Number(a.expiresAtSec), budgetBase: a.budgetBase, spentBase: a.spentBase } satisfies ArenaAgent;
  });
}

/** The season named in the environment (`SEASON_ID`), or the one asked for. `null` when no pool was created for it. */
export function getSeasonPool(seasonId: string | undefined = process.env.SEASON_ID): Promise<Reading<SeasonPoolState | null>> {
  return withReading(`arena:season:${seasonId ?? ""}`, async () => {
    if (!seasonId) return null;
    const address = await seasonAddress(seasonId);
    const account = await fetchMaybeSeasonPool(solana().rpc, kit(address));
    if (!account.exists) return null;
    const s = account.data;
    return {
      address,
      seasonId: s.seasonId,
      endsAtSec: Number(s.endsAtSec),
      admin: s.admin as string as Address,
      balanceBase: await tokenBalance(await seasonVaultAddress(address)),
      depositedBase: s.depositedBase,
      distributed: s.distributed,
    } satisfies SeasonPoolState;
  });
}
