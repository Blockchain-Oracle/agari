import { AGARI_RANGE_PROGRAM_ADDRESS, findReservePda, findVaultPda } from "@agari/clients/agari-range";
import type { Address } from "@agari/core/types";
import type { Address as KitAddress } from "@solana/kit";
import { getAddressEncoder, getProgramDerivedAddress, getI64Encoder, getU64Encoder } from "@solana/kit";
import { peekClient } from "../runtime/read-runtime";

/**
 * Where `agari-range` lives on this cluster, and the PDAs everything else is read from.
 *
 * `rangeReserve` is the Reserve PDA rather than the program id: it is the account a reader actually opens, and
 * the product type (`RangeDeployment`) names the thing holding the balance sheet, as its EVM original did.
 */
export function rangeProgramId(): Address {
  return peekClient()?.rangeProgramId ?? (AGARI_RANGE_PROGRAM_ADDRESS as string as Address);
}

export const kit = (value: string) => value as KitAddress;

export async function reserveAddress(): Promise<Address> {
  const [pda] = await findReservePda({ programAddress: kit(rangeProgramId()) });
  return pda as string as Address;
}

export async function vaultAddress(): Promise<Address> {
  const [pda] = await findVaultPda({ programAddress: kit(rangeProgramId()) });
  return pda as string as Address;
}

/** Codama cannot derive a PDA whose seed is a runtime id, so the round and boundary seeds are spelled here. */
export async function roundAddress(roundId: bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: kit(rangeProgramId()),
    seeds: [new TextEncoder().encode("round"), getU64Encoder().encode(roundId)],
  });
  return pda as string as Address;
}

export async function expiryBookAddress(expirySec: number | bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: kit(rangeProgramId()),
    seeds: [new TextEncoder().encode("expiry"), getI64Encoder().encode(BigInt(expirySec))],
  });
  return pda as string as Address;
}

export async function providerAddress(wallet: Address): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: kit(rangeProgramId()),
    seeds: [new TextEncoder().encode("provider"), getAddressEncoder().encode(kit(wallet))],
  });
  return pda as string as Address;
}
