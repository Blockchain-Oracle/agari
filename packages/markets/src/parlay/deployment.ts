import { AGARI_PARLAY_PROGRAM_ADDRESS, findReservePda, findVaultPda } from "@agari/clients/agari-parlay";
import type { Address } from "@agari/core/types";
import type { Address as KitAddress } from "@solana/kit";
import { getAddressEncoder, getProgramDerivedAddress, getU64Encoder } from "@solana/kit";
import { peekClient } from "../runtime/read-runtime";

/** Where `agari-parlay` lives on this cluster, and the PDAs everything else is read from. */
export function parlayProgramId(): Address {
  return peekClient()?.parlayProgramId ?? (AGARI_PARLAY_PROGRAM_ADDRESS as string as Address);
}

export const kit = (value: string) => value as KitAddress;

export async function reserveAddress(): Promise<Address> {
  const [pda] = await findReservePda({ programAddress: kit(parlayProgramId()) });
  return pda as string as Address;
}

export async function vaultAddress(): Promise<Address> {
  const [pda] = await findVaultPda({ programAddress: kit(parlayProgramId()) });
  return pda as string as Address;
}

/** Codama cannot derive a PDA whose seed is a runtime id, so the ticket and provider seeds are spelled here. */
export async function ticketAddress(parlayId: bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: kit(parlayProgramId()),
    seeds: [new TextEncoder().encode("ticket"), getU64Encoder().encode(parlayId)],
  });
  return pda as string as Address;
}

export async function providerAddress(wallet: Address): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: kit(parlayProgramId()),
    seeds: [new TextEncoder().encode("provider"), getAddressEncoder().encode(kit(wallet))],
  });
  return pda as string as Address;
}
