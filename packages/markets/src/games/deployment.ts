import { AGARI_ARENA_PROGRAM_ADDRESS, findAgentAccountPda, findArenaPda, findCreditPda, findCustodyPda, findGamePda, findSeasonPda, findSeatPda, findVaultPda } from "@agari/clients/agari-arena";
import { CLUSTER_ID } from "@agari/core/constants";
import type { ArenaDeployment } from "@agari/core/games";
import type { Address, Hash32 } from "@agari/core/types";
import type { Address as KitAddress } from "@solana/kit";
import type { MarketsEnv } from "../env";
import { peekClient } from "../runtime/read-runtime";
import { solana } from "../runtime/solana";

/** Where `agari-arena` lives on this cluster, and the PDAs everything else is read from. */
export function arenaProgramId(env?: Partial<MarketsEnv>): Address {
  return env?.arenaProgramId ?? peekClient()?.arenaProgramId ?? (AGARI_ARENA_PROGRAM_ADDRESS as string as Address);
}

export const kit = (value: string) => value as KitAddress;
const config = (env?: Partial<MarketsEnv>) => ({ programAddress: kit(arenaProgramId(env)) });
const out = (pda: readonly [KitAddress, number]) => pda[0] as string as Address;

/** A 32-byte id as the chain takes it. Match ids travel as `0x` hex everywhere else (`Hash32`). */
export function idBytes(id: Hash32): Uint8Array {
  const hex = id.slice(2);
  if (hex.length !== 64) throw new Error(`expected a 32-byte id, got ${hex.length / 2} bytes`);
  return Uint8Array.from({ length: 32 }, (_, i) => Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}

export const idHex = (bytes: ArrayLike<number>): Hash32 => `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as Hash32;

/** The Arena account. Its address is the `arena` word of every deck commitment, so it is what a deployment IS. */
export const arenaAddress = async (env?: Partial<MarketsEnv>) => out(await findArenaPda(config(env)));
export const custodyAddress = async () => out(await findCustodyPda(config()));
export const seatAddress = async () => out(await findSeatPda(config()));
export const matchAddress = async (matchId: Hash32) => out(await findGamePda({ matchId: idBytes(matchId) }, config()));
export const agentAddress = async (matchId: Hash32, player: Address) => out(await findAgentAccountPda({ matchId: idBytes(matchId), player: kit(player) }, config()));
export const creditAddress = async (player: Address) => out(await findCreditPda({ player: kit(player) }, config()));
export const seasonAddress = async (seasonId: string) => out(await findSeasonPda({ seasonId }, config()));
export const seasonVaultAddress = async (season: Address) => out(await findVaultPda({ season: kit(season) }, config()));

let known: ArenaDeployment | null = null;

/** The slot the Arena account was created in: the oldest transaction that names it. Where a complete projection starts. */
async function createdSlot(address: Address): Promise<bigint> {
  let before: string | undefined;
  let oldest = 0n;
  // Newest first, a thousand at a time. An arena busy enough to need more pages than this has a stored cursor by then.
  for (let page = 0; page < 20; page += 1) {
    const rows = await solana().rpc.getSignaturesForAddress(kit(address), { limit: 1000, ...(before ? { before: before as never } : {}) }).send();
    const last = rows[rows.length - 1];
    if (!last) break;
    oldest = BigInt(last.slot);
    before = last.signature;
    if (rows.length < 1000) break;
  }
  return oldest;
}

/**
 * The arena on this cluster, or null while there is none. Asynchronous on Solana: the deployment is a PDA, and
 * whether it exists is a chain read. Cached once found, because an initialised arena does not go away.
 */
export async function resolveArenaDeployment(env?: Partial<MarketsEnv>): Promise<ArenaDeployment | null> {
  if (known) return known;
  const address = await arenaAddress(env);
  const info = await solana().rpc.getAccountInfo(kit(address), { encoding: "base64" }).send();
  if (!info.value) return null;
  known = { chainId: CLUSTER_ID[env?.cluster ?? peekClient()?.cluster ?? "devnet"], gameArena: address, fromBlock: await createdSlot(address) };
  return known;
}
