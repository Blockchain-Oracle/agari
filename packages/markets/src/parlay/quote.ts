import { outcomeLevels, type NodeFilter } from "@agari/core/market";
import { quoteParlay, type ParlayLegInput, type ParlayMode, type ParlayParams, type ParlayQuote, type ParlayRefusal, type QuoteLeg } from "@agari/core/parlay";
import type { Reading } from "@agari/core/schemas";
import { diagnosis, type BookLevelView, type Diagnosis } from "@agari/core/types";
import { ReadingError } from "../errors/reading-error";
import { nowMs, nowSec } from "../provider/clock";
import { withReading } from "../provider/reading";
import { readBook, readMarket, readSeries } from "../runtime/accounts";

/** Levels read per side, as the program reads them (`PRICE_LEVELS` in `agari-parlay`). */
const PRICE_LEVELS = 32;
const TICKS_TO_BPS = 10;
const PAIR_TICKS = 1_000n;

/**
 * One leg's book, walked exactly as `agari-parlay` walks it: only orders that are live, unexpired and have rested
 * `max(series.min_rest_slots, params.minRestSlots)`, in the bought side's own terms, scaled to the client's units
 * (`ticks × tickBase`, `lots × lotBase`). The ticket a person sees is priced by the same walk the chain will run,
 * so a quote shown here is a quote the chain honours unless the book has moved since.
 */
async function readLeg(leg: ParlayLegInput, params: ParlayParams): Promise<{ quoteLeg: QuoteLeg; one: bigint }> {
  const market = await readMarket(leg.marketId);
  if (!market) throw new ReadingError(diagnosis("market-not-trading", `Window not found: ${leg.marketId}`));
  const [series, book] = await Promise.all([readSeries(market.data.series), readBook(market.data.book)]);
  if (!book) throw new ReadingError(diagnosis("thin-book", `no Book for Window ${leg.marketId}`));

  const floor = BigInt(params.minRestSlots);
  const filter: NodeFilter = {
    now: BigInt(nowSec()),
    slot: book.slot,
    restedOnly: true,
    minRestSlots: series.minRestSlots > floor ? series.minRestSlots : floor,
  };
  const levels = outcomeLevels(leg.side === "up" ? "BUY_YES" : "BUY_NO", book.bids, book.asks, PRICE_LEVELS, filter);
  const asks: BookLevelView[] = levels.map(([ticks, lots]) => ({
    priceRaw: BigInt(ticks) * series.tickBase,
    priceBps: ticks * TICKS_TO_BPS,
    quantityRaw: lots * series.lotBase,
  }));
  return { quoteLeg: { expirySec: Number(market.data.expiry), asks }, one: series.tickBase * PAIR_TICKS };
}

function refusalDiagnosis(refusal: ParlayRefusal): Diagnosis {
  switch (refusal.kind) {
    case "thin-book":
      return diagnosis("thin-book", `leg ${refusal.legIdx + 1} has ${refusal.availableRaw} of the ${refusal.neededRaw} rested depth this payout needs`);
    case "legs":
      return diagnosis("unknown", `a ticket takes ${refusal.min} to ${refusal.max} legs, not ${refusal.count}`);
    case "long-shot":
      return diagnosis("reserve-cap", `combined chance ${refusal.combinedProbRaw} is under the reserve's floor ${refusal.minCombinedProbRaw}`);
    case "over-payout-cap":
      return diagnosis("reserve-cap", `payout ${refusal.maxPayoutBase} is over the reserve's cap ${refusal.capBase}`);
    case "underpriced":
      return diagnosis("reserve-cap", `stake ${refusal.stakeBase} would not be less than payout ${refusal.maxPayoutBase}`);
    case "zero":
      return diagnosis("below-min-quantity", "the amount is zero");
  }
}

/** The ticket the reserve would sell right now, priced off each Window's rested book at the chain's own rules. */
export function quoteParlayOnchain(legs: readonly ParlayLegInput[], mode: ParlayMode, params: ParlayParams): Promise<Reading<ParlayQuote>> {
  const amount = mode.kind === "fixStake" ? mode.stakeBase : mode.maxPayoutBase;
  const key = `parlay:quote:${legs.map((leg) => `${leg.marketId}:${leg.side}`).join(",")}:${mode.kind}:${amount}`;
  return withReading(key, async () => {
    const read = await Promise.all(legs.map((leg) => readLeg(leg, params)));
    const one = read[0]?.one ?? 1_000_000n;
    const decimals = one.toString().length - 1;
    const result = quoteParlay({ legs: read.map((leg) => leg.quoteLeg), mode, params, one, decimals, nowMs: nowMs() });
    if (!result.ok) throw new ReadingError(refusalDiagnosis(result.refusal));
    return result.quote;
  });
}
