/**
 * The two events the write lanes book from: `OrderExecuted` (an order's fills) and `Redeemed` (a Window's payout).
 * Same rule as the indexer's decoder (`ops/indexer/decode.ts`, server-only): an event is an agari-events inner
 * instruction whose first account is the event authority and whose data is `EVENT_IX_TAG ‖ discriminator ‖ Borsh`.
 */
import {
  AGARI_EVENTS_PROGRAM_ADDRESS,
  getOrderExecutedEventDecoder,
  getRedeemedEventDecoder,
  ORDER_EXECUTED_EVENT_DISCRIMINATOR,
  REDEEMED_EVENT_DISCRIMINATOR,
  type OrderExecutedEvent,
  type RedeemedEvent,
} from "@agari/clients/agari-events";
import { getBase58Encoder, getProgramDerivedAddress, type Address, type ReadonlyUint8Array } from "@solana/kit";

type Numeric = number | bigint | string;

/** The part of a `getTransaction(…, { encoding: "json" })` response decoding reads (Kit bigints or fixture strings). */
export interface JsonTransaction {
  meta: {
    err: unknown;
    innerInstructions?: ReadonlyArray<{ index: Numeric; instructions: ReadonlyArray<{ programIdIndex: Numeric; accounts: readonly Numeric[]; data: string }> }> | null;
    loadedAddresses?: { writable: readonly string[]; readonly: readonly string[] } | null;
  } | null;
  transaction: { signatures: readonly string[]; message: { accountKeys: readonly string[] } };
}

export type WriteEvent = { name: "OrderExecuted"; data: OrderExecutedEvent } | { name: "Redeemed"; data: RedeemedEvent };

/** Anchor's `EVENT_IX_TAG` (`0x1d9acb512ea545e4`), little-endian. */
const EVENT_IX_TAG = Uint8Array.from([0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d]);
const TAG = EVENT_IX_TAG.length;

let eventAuthority: Promise<Address> | null = null;

export function eventAuthorityAddress(): Promise<Address> {
  eventAuthority ??= getProgramDerivedAddress({ programAddress: AGARI_EVENTS_PROGRAM_ADDRESS, seeds: ["__event_authority"] }).then(([pda]) => pda);
  return eventAuthority;
}

const matches = (data: ReadonlyUint8Array, prefix: ReadonlyUint8Array, at: number) =>
  data.length >= at + prefix.length && prefix.every((byte, i) => data[at + i] === byte);

/** Every `OrderExecuted` and `Redeemed` a successful transaction emitted, in order; none for a failed one. */
export async function decodeWriteEvents(tx: JsonTransaction): Promise<WriteEvent[]> {
  if (!tx.meta || tx.meta.err !== null) return [];
  const authority = await eventAuthorityAddress();
  const keys = [...tx.transaction.message.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
  const base58 = getBase58Encoder();
  const events: WriteEvent[] = [];
  for (const group of tx.meta.innerInstructions ?? []) {
    for (const ix of group.instructions) {
      if (keys[Number(ix.programIdIndex)] !== AGARI_EVENTS_PROGRAM_ADDRESS || keys[Number(ix.accounts[0] ?? -1)] !== authority) continue;
      const data = base58.encode(ix.data);
      if (!matches(data, EVENT_IX_TAG, 0)) continue;
      const payload = data.subarray(TAG);
      if (matches(data, ORDER_EXECUTED_EVENT_DISCRIMINATOR, TAG)) events.push({ name: "OrderExecuted", data: getOrderExecutedEventDecoder().decode(payload) });
      else if (matches(data, REDEEMED_EVENT_DISCRIMINATOR, TAG)) events.push({ name: "Redeemed", data: getRedeemedEventDecoder().decode(payload) });
    }
  }
  return events;
}
