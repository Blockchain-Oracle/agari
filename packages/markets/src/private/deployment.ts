import { AGARI_PRIVATE_PROGRAM_ADDRESS, findBudgetPda, findCustodyPda, findDeskAccountPda, findDeskCreditFromPoolMarkPda, findMarkPda, findSeatPda, findSlotPda } from "@agari/clients/agari-private";
import type { Address, Hash32 } from "@agari/core/types";
import type { Address as KitAddress } from "@solana/kit";
import { peekClient } from "../runtime/read-runtime";

/** Where `agari-private` lives on this cluster, and the PDAs everything else is read from. */
export function privateProgramId(): Address {
  return peekClient()?.privateProgramId ?? (AGARI_PRIVATE_PROGRAM_ADDRESS as string as Address);
}

export const kit = (value: string) => value as KitAddress;
const config = () => ({ programAddress: kit(privateProgramId()) });
const out = (pda: readonly [KitAddress, number]) => pda[0] as string as Address;

/** A 32-byte key as the chain takes it. Keys travel as `0x` hex everywhere else (`Hash32`). */
export function keyBytes(key: Hash32): Uint8Array {
  const hex = key.slice(2);
  if (hex.length !== 64) throw new Error(`expected a 32-byte key, got ${hex.length / 2} bytes`);
  return Uint8Array.from({ length: 32 }, (_, i) => Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}

export const keyHex = (bytes: ArrayLike<number>): Hash32 => `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as Hash32;

export const deskAddress = async () => out(await findDeskAccountPda(config()));
/** Every unit the desk holds. Its token authority is the seat, because the engine moves it as the seat. */
export const custodyAddress = async () => out(await findCustodyPda(config()));
export const seatAddress = async () => out(await findSeatPda(config()));

// OWNER side: seeded by the owner and an opaque key, never by a slot.
export const budgetAddress = async (owner: Address) => out(await findBudgetPda({ owner: kit(owner) }, config()));
export const chargeMarkAddress = async (owner: Address, chargeKey: Hash32) => out(await findMarkPda({ owner: kit(owner), chargeKey: keyBytes(chargeKey) }, config()));
export const creditMarkAddress = async (owner: Address, creditKey: Hash32) => out(await findDeskCreditFromPoolMarkPda({ owner: kit(owner), creditKey: keyBytes(creditKey) }, config()));

// SLOT side: seeded by the slot id alone.
export const slotAddress = async (slotId: Hash32) => out(await findSlotPda({ slotId: keyBytes(slotId) }, config()));
