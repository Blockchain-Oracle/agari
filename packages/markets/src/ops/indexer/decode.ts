/**
 * Event decode from a `getTransaction` result (plan §4 indexer step 4): the inner instructions agari-events invokes on
 * itself through `emit_cpi!`, whose data is `EVENT_IX_TAG ‖ discriminator ‖ Borsh`. Logs are never read for events.
 * Pure over a structural transaction shape, so the fixture test feeds recorded JSON straight in.
 */
import { getBase58Encoder } from "@solana/kit";
import { decodeEventPayload, toJsonSafe, type EventName, type JsonSafe } from "./events";

/** Anchor's `EVENT_IX_TAG` (`0x1d9acb512ea545e4`) in little-endian byte order. */
export const EVENT_IX_TAG = Uint8Array.from([0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d]);

type Numeric = number | bigint | string;

/** The part of a JSON-encoded `getTransaction` response decoding needs (Kit returns bigints; fixtures carry strings). */
export interface RawTransaction {
  slot: Numeric;
  blockTime: Numeric | null;
  meta: {
    err: unknown;
    innerInstructions?: ReadonlyArray<{ index: Numeric; instructions: ReadonlyArray<{ programIdIndex: Numeric; accounts: readonly Numeric[]; data: string }> }> | null;
    loadedAddresses?: { writable: readonly string[]; readonly: readonly string[] } | null;
  } | null;
  transaction: { signatures: readonly string[]; message: { accountKeys: readonly string[] } };
}

/** One decoded event, JSON-safe, keyed by its position in the transaction. */
export interface DecodedEvent {
  signature: string;
  slot: number;
  blockTimeSec: number | null;
  /** The top-level instruction whose execution emitted it. */
  outerIx: number;
  /** Its position among that instruction's inner instructions. */
  innerIx: number;
  name: EventName;
  market: string | null;
  seq: string | null;
  data: { [key: string]: JsonSafe };
}

export interface DecodedTransaction {
  signature: string;
  slot: number;
  blockTimeSec: number | null;
  failed: boolean;
  events: DecodedEvent[];
}

const startsWith = (data: Uint8Array, prefix: Uint8Array) => data.length >= prefix.length && prefix.every((b, i) => data[i] === b);

/**
 * Every agari-events event in `tx`. A failed transaction yields none. An inner instruction counts only when it
 * invokes `programId` with the event authority as its first account, so a look-alike payload is ignored.
 */
export function decodeTransactionEvents(tx: RawTransaction, programId: string, eventAuthority: string): DecodedTransaction {
  const signature = tx.transaction.signatures[0]!;
  const slot = Number(tx.slot);
  const blockTimeSec = tx.blockTime === null ? null : Number(tx.blockTime);
  const failed = tx.meta === null || tx.meta.err !== null;
  const base = { signature, slot, blockTimeSec };
  if (failed) return { ...base, failed, events: [] };
  const keys = [...tx.transaction.message.accountKeys, ...(tx.meta!.loadedAddresses?.writable ?? []), ...(tx.meta!.loadedAddresses?.readonly ?? [])];
  const base58 = getBase58Encoder();
  const events: DecodedEvent[] = [];
  for (const group of tx.meta!.innerInstructions ?? []) {
    group.instructions.forEach((ix, innerIx) => {
      if (keys[Number(ix.programIdIndex)] !== programId) return;
      if (keys[Number(ix.accounts[0] ?? -1)] !== eventAuthority) return;
      const data = Uint8Array.from(base58.encode(ix.data));
      if (!startsWith(data, EVENT_IX_TAG)) return;
      const decoded = decodeEventPayload(data.subarray(EVENT_IX_TAG.length));
      if (!decoded) return;
      const safe = toJsonSafe(decoded.data) as { [key: string]: JsonSafe };
      events.push({
        ...base,
        outerIx: Number(group.index),
        innerIx,
        name: decoded.name,
        market: typeof safe.market === "string" ? safe.market : null,
        seq: typeof safe.seq === "string" ? safe.seq : null,
        data: safe,
      });
    });
  }
  return { ...base, failed, events };
}
