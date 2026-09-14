/**
 * Hand decoders for the two engine accounts the IDL can't describe past their fixed headers (events-accounts.md §3.8,
 * §3.9; D-025): the Book's ladders and FIFO nodes, and the Ledger's seats. Pure: bytes in, views out. Offsets are
 * account offsets (the 8-byte discriminator included). The Book decode is a money path, checked against the shared
 * book vectors and a devnet capture (`decode.test.ts`).
 */
import type { BookSideView, WalkNode } from "@agari/core/market";
import { getAddressDecoder, getAddressEncoder, type Address, type ReadonlyUint8Array } from "@solana/kit";

const BOOK = {
  market: 8,
  series: 40,
  generation: 80,
  orderCount: 88,
  highWater: 96,
  bidBits: 104,
  askBits: 232,
  bids: 392,
  asks: 16_392,
  nodes: 32_392,
} as const;
const BITMAP_WORDS = 16;
const LEVELS = 1000;
const LEVEL_BYTES = 16;
const NODE_BYTES = 48;
const NODE_LIVE = 1;

export interface BookState {
  address: Address;
  /** The Window the Book is bound to; the default address when free. A caller keyed on another Window reads it empty. */
  market: Address;
  series: Address;
  bids: BookSideView;
  asks: BookSideView;
  /** The context slot the bytes were read at (the rested-order filter's clock). */
  slot: bigint;
  generation: number;
  orderCount: number;
}

const view = (bytes: ReadonlyUint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

function decodeSide(data: DataView, bitsAt: number, levelsAt: number, nodes: readonly WalkNode[]): BookSideView {
  const bits: bigint[] = new Array(BITMAP_WORDS);
  for (let w = 0; w < BITMAP_WORDS; w++) bits[w] = data.getBigUint64(bitsAt + 8 * w, true);
  const heads: number[] = new Array(LEVELS);
  for (let p = 0; p < LEVELS; p++) heads[p] = data.getUint32(levelsAt + LEVEL_BYTES * p, true);
  return { bits, heads, nodes };
}

/** A Book account's bytes as two walkable sides sharing one node array (`next` refs are 1-based into it). */
export function decodeBook(address: Address, bytes: ReadonlyUint8Array, slot: bigint): BookState {
  if (bytes.byteLength < BOOK.nodes) throw new Error(`Book ${address}: ${bytes.byteLength} bytes, expected at least ${BOOK.nodes}`);
  const data = view(bytes);
  const highWater = Math.min(data.getUint32(BOOK.highWater, true), Math.floor((bytes.byteLength - BOOK.nodes) / NODE_BYTES));
  const nodes: WalkNode[] = new Array(highWater);
  for (let i = 0; i < highWater; i++) {
    const at = BOOK.nodes + NODE_BYTES * i;
    nodes[i] = {
      lots: data.getBigUint64(at, true),
      expireTs: data.getBigInt64(at + 16, true),
      placedSlot: data.getBigUint64(at + 24, true),
      next: data.getUint32(at + 36, true),
      live: (data.getUint8(at + 45) & NODE_LIVE) !== 0,
    };
  }
  const addresses = getAddressDecoder();
  return {
    address,
    market: addresses.decode(bytes.subarray(BOOK.market, BOOK.market + 32)),
    series: addresses.decode(bytes.subarray(BOOK.series, BOOK.series + 32)),
    bids: decodeSide(data, BOOK.bidBits, BOOK.bids, nodes),
    asks: decodeSide(data, BOOK.askBits, BOOK.asks, nodes),
    slot,
    generation: data.getUint32(BOOK.generation, true),
    orderCount: data.getUint32(BOOK.orderCount, true),
  };
}

export interface LedgerSeat {
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
}

/** `Seat.flags` bits. */
export const SEAT_FLAG = { program: 1, bonded: 2 } as const;

const LEDGER_HEADER = 8 + 96;
const SEAT_BYTES = 88;

function decodeSeat(data: DataView, bytes: ReadonlyUint8Array, index: number, owner: Address): LedgerSeat {
  const at = LEDGER_HEADER + SEAT_BYTES * index;
  const u64 = (offset: number) => data.getBigUint64(at + offset, true);
  return {
    index,
    owner,
    credit: u64(32),
    lockedCash: u64(40),
    yesFree: u64(48),
    yesLocked: u64(56),
    noFree: u64(64),
    noLocked: u64(72),
    openOrders: data.getUint16(at + 80, true),
    flags: bytes[at + 82]!,
  };
}

export interface LedgerView {
  seatBond: bigint;
  capacity: number;
  seatsUsed: number;
}

export function decodeLedgerHeader(bytes: ReadonlyUint8Array): LedgerView {
  const data = view(bytes);
  return { seatBond: data.getBigUint64(8 + 64, true), capacity: data.getUint16(8 + 72, true), seatsUsed: data.getUint16(8 + 74, true) };
}

/** The owner's seat, comparing raw key bytes over every seat (as the ops decoder does; ≤ 1,024 × 32 B); null = no seat. */
export function findSeat(bytes: ReadonlyUint8Array, owner: Address): LedgerSeat | null {
  const { capacity } = decodeLedgerHeader(bytes);
  const key = getAddressEncoder().encode(owner);
  const data = view(bytes);
  const scan = Math.min(capacity, Math.floor((bytes.byteLength - LEDGER_HEADER) / SEAT_BYTES));
  for (let i = 0; i < scan; i++) {
    const at = LEDGER_HEADER + SEAT_BYTES * i;
    let match = true;
    for (let b = 0; b < 32 && match; b++) match = bytes[at + b] === key[b];
    if (match) return decodeSeat(data, bytes, i, owner);
  }
  return null;
}
