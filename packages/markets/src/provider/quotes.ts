import type { Reading } from "@masayume/core/schemas";
import type { QuoteTarget } from "@masayume/core/ports";
import { bufferToSlippageBps, costCapBufferBps } from "@masayume/core/sizing";
import { SLIPPAGE_MIN_TICKS } from "@masayume/core/constants";
import type { BookParams, Quote, Side } from "@masayume/core/types";
import { oneUnit } from "@masayume/core/units";
import { quoteBinaryOrderOverBook, quoteBinaryStakeOverBook, type BinaryOrderBook } from "@somnia-chain/markets-sdk";
import { getClient } from "../runtime/read-runtime";
import { toQuote } from "../mappers/quote";
import { toBuySide } from "../mappers/side";
import { DEFAULT_BOOK_DEPTH } from "./books";
import { nowMs } from "./clock";
import { settlementFeeBps } from "./fees";
import { withReading } from "./reading";

export interface QuoteInput {
  book: BinaryOrderBook;
  params: BookParams;
  target: QuoteTarget;
  side: Side;
  stakeBase: bigint;
  feeBps: number;
}

/** One pure quote kernel for both the composing Ticket (live book) and the click-time re-quote (chain book). */
export function quoteFromBook({ book, params, target, side, stakeBase, feeBps }: QuoteInput): Quote | null {
  const one = oneUnit(target.decimals);
  const buySide = toBuySide(side);
  const stakeQuote = quoteBinaryStakeOverBook(book, buySide, stakeBase, one, {
    tickSize: params.tickSizeRaw,
    lotSize: params.lotSizeRaw,
    minQuantity: params.minQuantityRaw,
    slippageBps: BigInt(bufferToSlippageBps(costCapBufferBps(target.intervalSec))),
    slippageMinTicks: SLIPPAGE_MIN_TICKS,
  });
  if (!stakeQuote) return null;
  const orderQuote = quoteBinaryOrderOverBook(book, buySide, stakeQuote.quantity, one);
  return toQuote({ side, stakeBase, stakeQuote, orderQuote, decimals: target.decimals, feeBps, quotedAtMs: nowMs() });
}

/** Watch-free: reads the chain book directly so the Submitter never depends on React watch state (plan ruling #3). */
export async function freshQuoteStake(target: QuoteTarget, side: Side, stakeBase: bigint): Promise<Reading<Quote | null>> {
  return withReading(`quote:${target.marketId}:${side}:${stakeBase}`, async (inner) => {
    const client = getClient();
    const [book, params, fee] = await Promise.all([
      client.getBinaryOrderBook(target.poolAddress, { depth: DEFAULT_BOOK_DEPTH, decimals: target.decimals }),
      client.getBinaryBookParams(target.poolAddress),
      settlementFeeBps(target.marketId),
    ]);
    const feeBps = inner(fee);
    return quoteFromBook({
      book,
      params: { tickSizeRaw: params.tickSize, lotSizeRaw: params.lotSize, minQuantityRaw: params.minQuantity },
      target,
      side,
      stakeBase,
      feeBps,
    });
  });
}
