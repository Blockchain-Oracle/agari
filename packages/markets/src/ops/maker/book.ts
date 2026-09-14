/** The top of a Window's YES-quoted book (events-accounts.md §3.9): best live bid and ask ticks, and the order count. */
import { getBase64Encoder, type Address } from "@solana/kit";
import type { OpsClient } from "../client";

export type BookTop = { bestBidTicks: number | null; bestAskTicks: number | null; orderCount: number };

/** Level i (16 B: head u32, tail u32, live_lots u64) of bids starts at 8 + 384 + 16·i, asks at 8 + 16,384 + 16·i. */
export async function readBookTop(client: OpsClient, book: Address): Promise<BookTop | null> {
  const info = await client.rpc.getAccountInfo(book, { encoding: "base64" }).send();
  if (!info.value) return null;
  const data = getBase64Encoder().encode(info.value.data[0]);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const orderCount = view.getUint32(8 + 80, true);
  const live = (side: number, price: number) => view.getBigUint64(8 + side + 16 * price + 8, true) > 0n;
  let bestBidTicks: number | null = null;
  let bestAskTicks: number | null = null;
  for (let p = 999; p >= 1 && bestBidTicks === null; p--) if (live(384, p)) bestBidTicks = p;
  for (let p = 1; p <= 999 && bestAskTicks === null; p++) if (live(16_384, p)) bestAskTicks = p;
  return { bestBidTicks, bestAskTicks, orderCount };
}
