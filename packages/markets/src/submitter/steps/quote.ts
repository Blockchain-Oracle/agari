import type { QuoteTarget } from "@masayume/core/ports";
import { admissibilityBlocker, belowMinStake } from "@masayume/core/sizing";
import { diagnosis, type Quote, type Side } from "@masayume/core/types";
import { ReadingError } from "../../errors/reading-error";
import { freshQuoteStake } from "../../provider/quotes";
import { OrderRefusedError, RequoteError } from "../errors";

export interface FreshQuoteInput {
  target: QuoteTarget;
  side: Side;
  stakeBase: bigint;
  /** The quote the user confirmed; its escrow is the cap a fill may never exceed. */
  displayed: Quote;
}

/**
 * Re-quotes off the chain book at click time (FR-9). Nothing fillable, an inadmissible price, or a stake
 * below the floor refuses; a fresh escrow above the confirmed one is surfaced as a requote, never sent.
 * Odds drifting inside the confirmed escrow are accepted by design — the max loss is still what was shown.
 */
export async function freshQuote({ target, side, stakeBase, displayed }: FreshQuoteInput): Promise<Quote> {
  if (belowMinStake(stakeBase, target.decimals)) {
    throw new OrderRefusedError(diagnosis("below-min-quantity", `stake ${stakeBase} is below the minimum`));
  }
  const reading = await freshQuoteStake(target, side, stakeBase);
  if (!reading.ok) throw new ReadingError(reading.error);
  if (reading.stale) throw new OrderRefusedError(diagnosis("rpc-down", "could not read a fresh book"));

  const quote = reading.value;
  if (!quote) throw new OrderRefusedError(diagnosis("no-liquidity", `nothing fillable for ${stakeBase} on the ${side} side`));
  const band = admissibilityBlocker(quote.avgPriceBps);
  if (band) throw new OrderRefusedError(diagnosis("outside-band", `${band}: the book quotes ${quote.avgPriceBps} bps`));
  if (quote.maxCostBase > displayed.maxCostBase) throw new RequoteError(quote);
  return quote;
}
