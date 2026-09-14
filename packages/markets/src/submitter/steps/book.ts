import type { BookedOrder } from "@agari/core/ports";
import type { Address, MarketId, Side, Signature } from "@agari/core/types";
import type { Signature as KitSignature } from "@solana/kit";
import { decodeWriteEvents, type JsonTransaction, type WriteEvent } from "../events";
import type { WriteRpc } from "./message";

const PAIR_TICKS = 1000n;
const BPS_PER_TICK = 10n;
/** `OrderExecuted.kind` for the two taker buys users send. */
const BUY_NO = 2;

export interface BookContext {
  wallet: Address;
  marketId: MarketId;
  side: Side;
  /** The Series' lot size in outcome base units (`contractsRaw = lots × lot_base`). */
  lotBase: bigint;
  txHash: Signature;
}

/**
 * What was bought is what `OrderExecuted` says, never the requested size (FR-9): `contractsRaw = filled_lots × lot_base`,
 * `costBase = cash_spent` (already in base units, own terms), the average price in the buyer's own terms. Null when
 * the transaction holds no execution of this wallet's on this Window, or it filled nothing.
 */
export function bookFromEvents(events: readonly WriteEvent[], ctx: BookContext): BookedOrder | null {
  const executed = events.find((e) => e.name === "OrderExecuted" && e.data.taker === (ctx.wallet as string) && e.data.market === (ctx.marketId as string));
  if (!executed || executed.name !== "OrderExecuted" || executed.data.filledLots === 0n) return null;
  const { data } = executed;
  // Fill prices are YES ticks; a Down (BUY_NO) buyer pays the complement (events-engine.md §2).
  const ownTicksLots = data.fills.reduce((sum, fill) => sum + fill.lots * (data.kind === BUY_NO ? PAIR_TICKS - BigInt(fill.price) : BigInt(fill.price)), 0n);
  return {
    marketId: ctx.marketId,
    side: ctx.side,
    contractsRaw: data.filledLots * ctx.lotBase,
    costBase: data.cashSpent,
    avgPriceBps: Number((ownTicksLots * BPS_PER_TICK) / data.filledLots),
    txHash: ctx.txHash,
    fillCount: data.fills.length,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A confirmed transaction's decoded events. An RPC can answer a status before it serves the transaction itself, so this
 * retries for a while; null when it still can't read it (the order landed, but its fills aren't readable yet).
 */
export async function fetchWriteEvents(rpc: WriteRpc, signature: Signature, attempts = 20, delayMs = 1_500): Promise<WriteEvent[] | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const tx = await rpc
      .getTransaction(signature as string as KitSignature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" })
      .send()
      .catch(() => null);
    if (tx) return decodeWriteEvents(tx as unknown as JsonTransaction);
    await sleep(delayMs);
  }
  return null;
}
