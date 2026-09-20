import { quoteLeverage, type LeverageQuote, type LeverageRefusal } from "@agari/core/leverage";
import type { Reading } from "@agari/core/schemas";
import { diagnosis, type Address, type Diagnosis, type MarketId, type Side } from "@agari/core/types";
import { ReadingError } from "../errors/reading-error";
import { nowMs, nowSec } from "../provider/clock";
import { withReading } from "../provider/reading";
import { readSeat } from "../runtime/accounts";
import { readBoostBook } from "./book";
import { seatAddress } from "./deployment";
import { paramsOf, readReserve, windowFrontedBase } from "./reads";

/** A refusal in the ticket's words. The reserve's own policy is one kind; the venue's book is another. */
export function refusalDiagnosis(refusal: LeverageRefusal): Diagnosis {
  switch (refusal.kind) {
    case "zero":
      return diagnosis("below-min-quantity", "the amount is zero");
    case "below-min":
      return diagnosis("below-min-quantity", `this stake buys ${refusal.quantityRaw}, under the venue's minimum ${refusal.minQuantityRaw}`);
    case "bad-leverage":
      return diagnosis("reserve-cap", `the reserve boosts above 1x and up to ${refusal.maxLeverageBps / 10_000}x`);
    case "too-late":
      return diagnosis("market-not-trading", `${refusal.leftSec}s left; boosts close ${refusal.minSec}s before the Window ends`);
    case "thin-book":
      return diagnosis("thin-book", `${refusal.filledRaw} of the ${refusal.quantityRaw} this stake buys is on offer`);
    case "thin-exit":
      return diagnosis("thin-book", `rested orders would take ${refusal.filledRaw} of ${refusal.quantityRaw} back: the position could not be sold whole`);
    case "unhealthy":
      return diagnosis("thin-book", `the spread is too wide: the position would mark at ${refusal.markBase}, under its knock-out line ${refusal.lineBase}, the moment it opened`);
    case "outside-band":
      return diagnosis("outside-band", `entry ${refusal.priceRaw} is outside the reserve's band ${refusal.minRaw}–${refusal.maxRaw}`);
    case "underpriced":
      return diagnosis("outside-band", "at this price a boost would pay no more than the plain bet");
    case "liquidity":
      return diagnosis("reserve-cap", `the reserve has ${refusal.haveBase} liquid and this boost needs ${refusal.needBase}`);
    case "position-cap":
      return diagnosis("reserve-cap", `front ${refusal.frontedBase} is over the per-position cap ${refusal.capBase}`);
    case "window-cap":
      return diagnosis("reserve-cap", `this Window would carry ${refusal.frontedBase} fronted, over its cap ${refusal.capBase}`);
    case "exposure":
      return diagnosis("reserve-cap", `${refusal.outstandingBase} fronted of ${refusal.totalBase} is over the reserve's ${refusal.maxBps / 100}% limit`);
    case "too-many-open":
      return diagnosis("reserve-cap", `the reserve already carries its ${refusal.max} open positions`);
  }
}

/** Windows whose Ledger is known to carry the reserve's seat. A seat does not leave a live Window, so one look is enough. */
const seated = new Set<string>();

/**
 * The engine seats every registered program when it opens a Window, so a Window older than the reserve's
 * registration has no seat for it and `owner_open` there refuses with `WindowPredatesReserve`.
 */
async function requireSeat(marketId: MarketId, ledger: Address): Promise<void> {
  if (seated.has(marketId)) return;
  const found = await readSeat(ledger, await seatAddress());
  if (!found?.seat) throw new ReadingError(diagnosis("market-not-trading", "this Window opened before the reserve was seated; the next one can be boosted"));
  seated.add(marketId);
}

type Sizing = { stakeBase: bigint } | { quantityRaw: bigint };

/**
 * The boost the reserve would open right now, priced off the Window's own book and the reserve's own books by the
 * chain's rules (`quoteLeverage` is `owner_open`, step for step). A quote shown here is one the chain honours
 * unless the book has moved since, and a refusal here is the refusal the chain would give.
 */
function quote(key: string, marketId: MarketId, side: Side, leverageBps: number, sizing: Sizing): Promise<Reading<LeverageQuote>> {
  return withReading(key, async () => {
    const [book, reserve, windowFronted] = await Promise.all([readBoostBook(marketId, side), readReserve(), windowFrontedBase(marketId)]);
    if (!reserve) throw new ReadingError(diagnosis("not-deployed", "no leverage reserve on this cluster"));
    if (reserve.data.paused) throw new ReadingError(diagnosis("reserve-cap", "the reserve is paused"));
    await requireSeat(marketId, book.ledger);
    const result = quoteLeverage({
      side,
      leverageBps,
      stakeBase: "stakeBase" in sizing ? sizing.stakeBase : 0n,
      ...("quantityRaw" in sizing ? { fixedQuantityRaw: sizing.quantityRaw } : {}),
      entry: book.entry,
      exitRested: book.exitRested,
      one: book.one,
      lotRaw: book.lotRaw,
      minQuantityRaw: book.minQuantityRaw,
      params: paramsOf(reserve.data.params),
      books: { liquidBase: reserve.liquidBase, outstandingBase: reserve.data.outstandingBase, windowFrontedBase: windowFronted, openPositions: reserve.openPositions },
      expirySec: book.expirySec,
      nowSec: nowSec(),
      decimals: book.decimals,
      nowMs: nowMs(),
    });
    if (!result.ok) throw new ReadingError(refusalDiagnosis(result.refusal));
    return result.quote;
  });
}

/** Stake-first, as the chain opens: what this stake at this multiple buys. `_maintenanceBps` is the reserve's own, read live. */
export function sizeLeverageForStake(marketId: MarketId, side: Side, stakeBase: bigint, leverageBps: number, _maintenanceBps?: number): Promise<Reading<LeverageQuote>> {
  return quote(`leverage:size:${marketId}:${side}:${leverageBps}:${stakeBase}`, marketId, side, leverageBps, { stakeBase });
}

/** A size priced for display: what boosting exactly `quantityRaw` contracts would cost the owner. */
export function previewLeverageOpen(marketId: MarketId, side: Side, quantityRaw: bigint, leverageBps: number, _maintenanceBps?: number): Promise<Reading<LeverageQuote>> {
  return quote(`leverage:preview:${marketId}:${side}:${leverageBps}:${quantityRaw}`, marketId, side, leverageBps, { quantityRaw });
}
