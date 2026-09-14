/** GameArena (duels) and the season pool on Solana are `agari-arena` (S12). Until deployed: `null`/zero reads. */
import { ARENA_NOT_DEPLOYED, type ArenaAgent, type ArenaDeployment, type ArenaEventLog, type ArenaMatch, type ArenaParams, type ArenaPick, type ArenaQuote, type ArenaTier, type Pick } from "@agari/core/games";
import type { Reading } from "@agari/core/schemas";
import type { Address, Hash32, MarketId } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import { absent, unavailableFor } from "../stub/product";

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

export interface SeasonPoolDeployment {
  chainId: number;
  seasonPrizePool: Address;
  fromSlot: bigint;
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

export const resolveArenaDeployment = (_env?: Partial<MarketsEnv>): ArenaDeployment | null => null;
export const resolveSeasonPoolDeployment = (_chainId?: number): SeasonPoolDeployment | null => null;
export const getArenaState = (): Promise<Reading<ArenaState | null>> => absent(null);
export const getArenaMatch = (_matchId: Hash32): Promise<Reading<ArenaMatchView | null>> => absent(null);
export const quoteArenaPick = (_marketId: MarketId, _pick: Pick, _stakeBase: bigint): Promise<Reading<ArenaQuote | null>> => absent(null);
export const getArenaCredit = (_wallet: Address): Promise<Reading<bigint>> => absent(0n);
export const readArenaAgent = (_matchId: Hash32, _player: Address): Promise<Reading<ArenaAgent | null>> => absent(null);
export const getSeasonPool = (): Promise<Reading<SeasonPoolState | null>> => absent(null);

/** The newest slot the projector may read up to: needs the RPC client and the arena program (S12). */
export const arenaHeadBlock = (): Promise<Reading<bigint>> => unavailableFor(ARENA_NOT_DEPLOYED);

/** Every arena event in a slot range, in chain order; empty without an arena. */
export const listArenaEvents = (_fromSlot: bigint, _toSlot: bigint): Promise<Reading<readonly ArenaEventLog[]>> => absent([]);
