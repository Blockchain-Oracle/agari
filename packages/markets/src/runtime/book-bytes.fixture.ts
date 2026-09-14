/**
 * Test-only: writes Book account bytes from order lists, following events-accounts.md §3.9 independently of the
 * decoder under test. Layout rule of the shared vectors: each side's nodes are allocated in reverse list order and are
 * FIFO within a price in list order. Bids take node indices first, then asks, in one node array as on chain.
 */
import { getAddressEncoder, type Address } from "@solana/kit";

export interface FixtureOrder {
  price: number;
  lots: string | bigint;
  expireTs: string | bigint;
  placedSlot: string | bigint;
  live: boolean;
}

const NODES_AT = 32_392;

export function bookBytes(bids: readonly FixtureOrder[], asks: readonly FixtureOrder[], market?: Address, capacity = 256): Uint8Array {
  const bytes = new Uint8Array(NODES_AT + 48 * capacity);
  const data = new DataView(bytes.buffer);
  if (market) bytes.set(getAddressEncoder().encode(market), 8);
  let base = 0;
  let live = 0;
  const writeSide = (orders: readonly FixtureOrder[], bitsAt: number, levelsAt: number) => {
    const tails = new Map<number, number>();
    orders.forEach((order, k) => {
      const ref = base + (orders.length - 1 - k) + 1;
      const at = NODES_AT + 48 * (ref - 1);
      data.setBigUint64(at, BigInt(order.lots), true);
      data.setBigInt64(at + 16, BigInt(order.expireTs), true);
      data.setBigUint64(at + 24, BigInt(order.placedSlot), true);
      data.setUint16(at + 40, order.price, true);
      data.setUint8(at + 45, order.live ? 1 : 0);
      const level = levelsAt + 16 * order.price;
      const tail = tails.get(order.price);
      if (tail === undefined) data.setUint32(level, ref, true);
      else data.setUint32(NODES_AT + 48 * (tail - 1) + 36, ref, true);
      data.setUint32(level + 4, ref, true);
      tails.set(order.price, ref);
      if (order.live) {
        data.setBigUint64(level + 8, data.getBigUint64(level + 8, true) + BigInt(order.lots), true);
        live += 1;
      }
      const word = bitsAt + 8 * Math.floor(order.price / 64);
      data.setBigUint64(word, data.getBigUint64(word, true) | (1n << BigInt(order.price % 64)), true);
    });
    base += orders.length;
  };
  writeSide(bids, 104, 392);
  writeSide(asks, 232, 16_392);
  data.setUint32(84, capacity, true);
  data.setUint32(88, live, true);
  data.setUint32(96, base, true);
  return bytes;
}
