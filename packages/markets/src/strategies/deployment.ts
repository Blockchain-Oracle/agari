import { AGARI_STRATEGY_PROGRAM_ADDRESS, findRegistryPda } from "@agari/clients/agari-strategy";
import type { Address } from "@agari/core/types";
import { getAddressEncoder, getProgramDerivedAddress, getU64Encoder, type Address as KitAddress } from "@solana/kit";
import { peekClient } from "../runtime/read-runtime";

/** Where `agari-strategy` lives on this cluster, and the PDAs everything else is read from. */
export function strategyProgramId(): Address {
  return peekClient()?.strategyProgramId ?? (AGARI_STRATEGY_PROGRAM_ADDRESS as string as Address);
}

export const kit = (value: string) => value as KitAddress;

export async function registryAddress(): Promise<Address> {
  const [pda] = await findRegistryPda({ programAddress: kit(strategyProgramId()) });
  return pda as string as Address;
}

/** Codama cannot derive a PDA whose seed is a runtime id, so the strategy and subscription seeds are spelled here. */
export async function strategyAddress(strategyId: bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: kit(strategyProgramId()),
    seeds: [new TextEncoder().encode("strategy"), getU64Encoder().encode(strategyId)],
  });
  return pda as string as Address;
}

export async function subscriptionAddress(strategyId: bigint, subscriber: Address): Promise<Address> {
  return consentAddress("subscription", strategyId, subscriber);
}

/** A-1c: the fade consent's own PDA — the same shape under its own seed, so a follow record is never mistaken for it. */
export async function fadeAddress(strategyId: bigint, subscriber: Address): Promise<Address> {
  return consentAddress("fade", strategyId, subscriber);
}

async function consentAddress(seed: string, strategyId: bigint, subscriber: Address): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: kit(strategyProgramId()),
    seeds: [new TextEncoder().encode(seed), getU64Encoder().encode(strategyId), getAddressEncoder().encode(kit(subscriber))],
  });
  return pda as string as Address;
}
