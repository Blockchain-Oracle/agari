import { AGARI_LEVERAGE_PROGRAM_ADDRESS, findCustodyPda, findReservePda, findSeatPda } from "@agari/clients/agari-leverage";
import type { Address } from "@agari/core/types";
import type { Address as KitAddress } from "@solana/kit";
import { getAddressEncoder, getProgramDerivedAddress, getU64Encoder } from "@solana/kit";
import { peekClient } from "../runtime/read-runtime";

/** Where `agari-leverage` lives on this cluster, and the PDAs everything else is read from. */
export function leverageProgramId(): Address {
  return peekClient()?.leverageProgramId ?? (AGARI_LEVERAGE_PROGRAM_ADDRESS as string as Address);
}

export const kit = (value: string) => value as KitAddress;
const text = (seed: string) => new TextEncoder().encode(seed);
const config = () => ({ programAddress: kit(leverageProgramId()) });

export async function reserveAddress(): Promise<Address> {
  const [pda] = await findReservePda(config());
  return pda as string as Address;
}

/** Every unit the reserve holds. Its token authority is the seat, because the engine moves it as the seat. */
export async function custodyAddress(): Promise<Address> {
  const [pda] = await findCustodyPda(config());
  return pda as string as Address;
}

export async function seatAddress(): Promise<Address> {
  const [pda] = await findSeatPda(config());
  return pda as string as Address;
}

/**
 * The seeds a runtime id goes into are spelled here: Codama can derive a PDA only from an instruction's own
 * accounts and arguments, and a position's seed is a counter read from the reserve.
 */
async function derive(seeds: Uint8Array[]): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({ programAddress: kit(leverageProgramId()), seeds });
  return pda as string as Address;
}

export const positionAddress = (positionId: bigint) => derive([text("position"), getU64Encoder().encode(positionId) as Uint8Array]);
export const windowBookAddress = (market: Address) => derive([text("lwin"), getAddressEncoder().encode(kit(market)) as Uint8Array]);
export const providerAddress = (wallet: Address) => derive([text("provider"), getAddressEncoder().encode(kit(wallet)) as Uint8Array]);
