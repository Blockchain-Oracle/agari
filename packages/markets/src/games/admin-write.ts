/** Season payout is an operator-only path; keep its Node RPC transport out of the browser's duel writer. */
import { getAdminDistributeSeasonInstructionAsync } from "@agari/clients/agari-arena";
import type { Address, Signature } from "@agari/core/types";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { AccountRole, type Instruction } from "@solana/kit";
import { createDeployClient } from "../deploy/client";
import { send } from "../deploy/send";
import { arenaProgramId, kit, seasonAddress, seasonVaultAddress } from "./deployment";
import { readArena } from "./read";

export interface DistributeSeasonInput {
  /** The season admin role's 64-byte Solana keypair. */
  secretKey: Uint8Array;
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  seasonId: string;
  winners: readonly Address[];
  amountsBase: readonly bigint[];
}

/** Pay the season winners and lock the pool. Each winner receives tokens in their own account. */
export async function distributeSeasonPrizes(input: DistributeSeasonInput): Promise<Signature> {
  if (input.winners.length === 0 || input.winners.length !== input.amountsBase.length) throw new Error("winners and amounts differ in number, or there are none");
  const arena = await readArena();
  if (!arena) throw new Error("no arena on this cluster");
  const mint = arena.data.collateralMint as string;
  const client = await createDeployClient({ rpcUrl: input.rpcUrl, rpcSubscriptionsUrl: input.rpcSubscriptionsUrl, payerSecret: input.secretKey });
  const season = await seasonAddress(input.seasonId);
  const tokens = await Promise.all(input.winners.map(async (winner) => (await findAssociatedTokenPda({ owner: kit(winner), mint: kit(mint), tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0]));
  const creates = await Promise.all(input.winners.map((winner) => getCreateAssociatedTokenIdempotentInstructionAsync({ payer: client.payer, owner: kit(winner), mint: kit(mint) })));
  const distribute = await getAdminDistributeSeasonInstructionAsync({ admin: client.payer, season: kit(season), vault: kit(await seasonVaultAddress(season)), collateralMint: kit(mint), tokenProgram: TOKEN_PROGRAM_ADDRESS, amountsBase: [...input.amountsBase] }, { programAddress: kit(arenaProgramId()) });
  const withWinners: Instruction = { ...distribute, accounts: [...(distribute.accounts ?? []), ...tokens.map((address) => ({ address, role: AccountRole.WRITABLE }))] };
  return (await send({ client, log: () => undefined }, "distribute season", [...creates, withWinners], `${input.winners.length} winners of ${input.seasonId}`)) as Signature;
}
