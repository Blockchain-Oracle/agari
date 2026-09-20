/**
 * agari-arena bootstrap (S12b), ensure-style: `admin_init_arena` once, with the reference's launch parameters and its
 * four tiers, and the arena's `["seat"]` PDA registered at `program_authorities[4]` (D-063). Without the registration
 * the engine gives the arena no PROGRAM seat and every pick refuses with `ArenaNotRegistered`.
 *
 * Only the program's upgrade authority may initialise the arena (D-118), so the payer here is the deployer.
 */
import { findConfigPda } from "@agari/clients/agari-events";
import {
  AGARI_ARENA_PROGRAM_ADDRESS, findArenaPda, findCustodyPda, findSeatPda,
  getAdminInitArenaInstructionAsync, type ArenaParamsArgs, type TierArgs,
} from "@agari/clients/agari-arena";
import { CLUSTER_ID } from "@agari/core/constants";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Address } from "@solana/kit";
import { registerProgramSeat } from "./program-seat";
import { send, type SendContext } from "./send";
import { programDataAddress } from "./vault";

/** The fixed table (D-063). The arena's seat lives at 4 and nowhere else. */
export const ARENA_AUTHORITY_INDEX = 4;

/** tUSDC has 6 decimals, so one whole unit is 1e6 base units. */
const UNIT = 1_000_000n;

/**
 * The reference's own launch parameters (`DeployGameArena.s.sol`), unchanged: three minutes to be joined, two for the
 * deck to be opened, three to pick; decks of three to five cards; and every card's Window must still have four
 * minutes to run at the reveal, so nobody is dealt a Window about to lock.
 */
export const DEVNET_ARENA_PARAMS: ArenaParamsArgs = { joinWindowSec: 180, revealWindowSec: 120, pickWindowSec: 180, minDeckSize: 3, maxDeckSize: 5, minCardLifeSec: 240 };

/** Free, 1, 5 and 10 tUSDC a player, each card capped at 1 tUSDC. Free is a tier with a zero pot: its picks are still real orders. */
export const DEVNET_ARENA_TIERS: TierArgs[] = [0n, 1n, 5n, 10n].map((pot) => ({ potBase: pot * UNIT, perCardCapBase: UNIT, enabled: true }));

/** The arena's addresses for scripts, which never import the clients package. */
export async function arenaAddresses(): Promise<{ program: Address; arena: Address; custody: Address; seat: Address }> {
  const [arena] = await findArenaPda();
  const [custody] = await findCustodyPda();
  const [seat] = await findSeatPda();
  return { program: AGARI_ARENA_PROGRAM_ADDRESS, arena, custody, seat };
}

/** `admin_init_arena` signed by the client's payer, which must be the upgrade authority; skipped when it exists. */
export async function initArena(ctx: SendContext, cluster: "devnet" | "localnet"): Promise<{ arena: Address; custody: Address; seat: Address; signature: string | null }> {
  const { arena, custody, seat } = await arenaAddresses();
  const existing = await ctx.client.rpc.getAccountInfo(arena, { encoding: "base64" }).send();
  if (existing.value) {
    ctx.log({ step: "init arena", signature: null, note: `exists ${arena}` });
    return { arena, custody, seat, signature: null };
  }
  const [eventsConfig] = await findConfigPda();
  const venue = await ctx.client.agariEvents.accounts.globalConfig.fetch(eventsConfig);
  const ix = await getAdminInitArenaInstructionAsync({
    admin: ctx.client.payer,
    collateralMint: venue.data.collateralMint,
    programData: await programDataAddress(AGARI_ARENA_PROGRAM_ADDRESS),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    // The cluster id the deck commitment carries: the same number `deckCommitmentPreimage` is given off chain.
    chainId: BigInt(CLUSTER_ID[cluster]),
    params: DEVNET_ARENA_PARAMS,
    tiers: DEVNET_ARENA_TIERS,
  });
  const signature = await send(ctx, "init arena", [ix], `Arena ${arena}, custody ${custody}, seat ${seat}, chain id ${CLUSTER_ID[cluster]}`);
  return { arena, custody, seat, signature };
}

/** Registers the arena's seat at `ARENA_AUTHORITY_INDEX`; every other authority is re-sent unchanged. */
export async function registerArenaSeat(ctx: SendContext): Promise<string | null> {
  const { seat } = await arenaAddresses();
  return registerProgramSeat(ctx, ARENA_AUTHORITY_INDEX, seat, "arena");
}
