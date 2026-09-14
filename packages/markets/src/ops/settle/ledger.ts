/**
 * The Ledger header and every owned seat in one read (events-accounts.md §3.8). The IDL decoder stops at the
 * header, so seats are decoded by hand like `deploy/cycle/accounts.ts` `readSeats`, plus `rent_payer` and the bond flag.
 */
import { getAddressDecoder, getBase64Encoder, type Address } from "@solana/kit";
import type { OpsClient } from "../client";

export type LedgerSeat = {
  index: number;
  owner: Address;
  credit: bigint;
  lockedCash: bigint;
  yesFree: bigint;
  yesLocked: bigint;
  noFree: bigint;
  noLocked: bigint;
  openOrders: number;
  flags: number;
};

export type LedgerState = { address: Address; rentPayer: Address; capacity: number; seatsUsed: number; seats: LedgerSeat[] };

/** `Seat.flags` bits. */
export const SEAT_FLAG = { program: 1, bonded: 2 } as const;

const HEADER = 8 + 96;
const SEAT_BYTES = 88;

/** "Drained" (events-engine.md §6): all six balances zero and no open orders; the bond is excluded. */
export function isDrained(s: LedgerSeat): boolean {
  return s.credit === 0n && s.lockedCash === 0n && s.yesFree === 0n && s.yesLocked === 0n && s.noFree === 0n && s.noLocked === 0n && s.openOrders === 0;
}

export const isProgramSeat = (s: LedgerSeat) => (s.flags & SEAT_FLAG.program) !== 0;

/** Null when the Ledger is closed. */
export async function readLedger(client: OpsClient, ledger: Address): Promise<LedgerState | null> {
  const info = await client.rpc.getAccountInfo(ledger, { encoding: "base64" }).send();
  if (!info.value) return null;
  const data = getBase64Encoder().encode(info.value.data[0]);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const address = getAddressDecoder();
  const capacity = view.getUint16(8 + 72, true);
  const seats: LedgerSeat[] = [];
  for (let i = 0; i < capacity; i++) {
    const at = HEADER + i * SEAT_BYTES;
    const owner = data.subarray(at, at + 32);
    if (owner.every((b) => b === 0)) continue;
    const u64 = (off: number) => view.getBigUint64(at + off, true);
    seats.push({
      index: i, owner: address.decode(owner), credit: u64(32), lockedCash: u64(40), yesFree: u64(48), yesLocked: u64(56),
      noFree: u64(64), noLocked: u64(72), openOrders: view.getUint16(at + 80, true), flags: data[at + 82]!,
    });
  }
  return { address: ledger, rentPayer: address.decode(data.subarray(8 + 32, 8 + 64)), capacity, seatsUsed: view.getUint16(8 + 74, true), seats };
}
