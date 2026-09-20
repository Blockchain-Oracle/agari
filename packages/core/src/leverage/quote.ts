import { BPS_DENOMINATOR } from "../constants/sizing";
import type { Side } from "../types/market";
import { ceilDiv } from "../units/money";
import { budgetFor, isKnockable, knockoutLine, markOverLevels, sidePrice, terms, walkBudget, walkQuantity, winIfRight, type YesLevel } from "./sizing";
import type { LeverageParams, LeverageQuote } from "./types";

const BPS = BigInt(BPS_DENOMINATOR);
const LEVERAGE_ONE_BPS = 10_000;

/** What the reserve's books say right now; every figure is the chain's own. */
export interface LeverageBooks {
  /** Custody less what the reserve owes owners: the capital a front can come out of. */
  liquidBase: bigint;
  outstandingBase: bigint;
  /** Already fronted on this Window. */
  windowFrontedBase: bigint;
  openPositions: number;
}

export interface LeverageQuoteInput {
  side: Side;
  /** What the owner offers. With `fixedQuantityRaw` it is ignored: the size is given and the stake follows from it. */
  stakeBase: bigint;
  /** A preview by size rather than by stake. The chain only opens stake-first; this prices a size for display. */
  fixedQuantityRaw?: bigint;
  leverageBps: number;
  /** The side the open would take, every live order, in YES terms. */
  entry: readonly YesLevel[];
  /** The side an exit would meet, rested orders only (PD-2): what `owner_open` judges health against. */
  exitRested: readonly YesLevel[];
  one: bigint;
  lotRaw: bigint;
  /** The venue's smallest order, in contracts. */
  minQuantityRaw: bigint;
  params: LeverageParams;
  books: LeverageBooks;
  expirySec: number;
  nowSec: number;
  decimals: number;
  nowMs: number;
}

/** Why `owner_open` would refuse, in the order the program checks. */
export type LeverageRefusal =
  | { kind: "zero" }
  | { kind: "bad-leverage"; maxLeverageBps: number }
  | { kind: "too-late"; leftSec: number; minSec: number }
  | { kind: "below-min"; quantityRaw: bigint; minQuantityRaw: bigint }
  | { kind: "thin-book"; filledRaw: bigint; quantityRaw: bigint }
  | { kind: "outside-band"; priceRaw: bigint; minRaw: bigint; maxRaw: bigint }
  | { kind: "underpriced" }
  | { kind: "liquidity"; needBase: bigint; haveBase: bigint }
  | { kind: "thin-exit"; filledRaw: bigint; quantityRaw: bigint }
  | { kind: "unhealthy"; markBase: bigint; lineBase: bigint }
  | { kind: "position-cap"; frontedBase: bigint; capBase: bigint }
  | { kind: "window-cap"; frontedBase: bigint; capBase: bigint }
  | { kind: "exposure"; outstandingBase: bigint; totalBase: bigint; maxBps: number }
  | { kind: "too-many-open"; max: number };

export type LeverageQuoteResult = { ok: true; quote: LeverageQuote } | { ok: false; refusal: LeverageRefusal };

/**
 * The boost `agari-leverage` would open right now, by the program's own steps in the program's own order.
 *
 * Stake-first: the stake and the multiple set a budget, the budget buys as many contracts as the entry side sells,
 * and the walk's actual cost sets the owner's charge, the reserve's front and its premium. Then the two checks the
 * reference does not make (D-114): the whole size must sell into rested depth, and at that mark the position
 * must not already be under its knock-out line. The reserve's caps come last, as `book_front` applies them.
 */
export function quoteLeverage(input: LeverageQuoteInput): LeverageQuoteResult {
  const { side, stakeBase, leverageBps, entry, exitRested, one, lotRaw, params, books } = input;
  const refuse = (refusal: LeverageRefusal): LeverageQuoteResult => ({ ok: false, refusal });
  const invert = side === "down";

  const fixed = input.fixedQuantityRaw;
  if (fixed === undefined ? stakeBase <= 0n : fixed <= 0n) return refuse({ kind: "zero" });
  if (leverageBps <= LEVERAGE_ONE_BPS || leverageBps > params.maxLeverageBps) return refuse({ kind: "bad-leverage", maxLeverageBps: params.maxLeverageBps });
  const leftSec = input.expirySec - input.nowSec;
  if (leftSec < params.minTimeLeftSec) return refuse({ kind: "too-late", leftSec, minSec: params.minTimeLeftSec });

  const quantityRaw = fixed === undefined
    ? walkBudget(entry, invert, one, budgetFor(stakeBase, leverageBps, params.premiumBps), lotRaw)
    : (fixed / lotRaw) * lotRaw;
  const least = input.minQuantityRaw > lotRaw ? input.minQuantityRaw : lotRaw;
  if (quantityRaw < least) return refuse({ kind: "below-min", quantityRaw, minQuantityRaw: least });
  const walk = walkQuantity(entry, invert, one, quantityRaw);
  if (walk.filledRaw < quantityRaw) return refuse({ kind: "thin-book", filledRaw: walk.filledRaw, quantityRaw });
  const priceRaw = ceilDiv(walk.costBase * one, quantityRaw);
  if (priceRaw < params.minEntryPriceRaw || priceRaw > params.maxEntryPriceRaw) {
    return refuse({ kind: "outside-band", priceRaw, minRaw: params.minEntryPriceRaw, maxRaw: params.maxEntryPriceRaw });
  }
  const t = terms(walk.costBase, leverageBps, params.premiumBps);
  const winIfRightBase = winIfRight(quantityRaw, t.frontedBase);
  if (winIfRightBase <= t.stakeBase) return refuse({ kind: "underpriced" });

  // The venue escrows the limit for the whole size up front; custody covers it beyond the stake.
  const escrow = ceilDiv(quantityRaw * sidePrice(walk.limitYesRaw, invert, one), one);
  const offered = fixed === undefined ? stakeBase : t.stakeBase;
  if (books.liquidBase + offered < escrow) return refuse({ kind: "liquidity", needBase: escrow - offered, haveBase: books.liquidBase });

  const exit = markOverLevels(exitRested, invert, one, quantityRaw);
  if (exit.filledRaw < quantityRaw) return refuse({ kind: "thin-exit", filledRaw: exit.filledRaw, quantityRaw });
  const lineBase = knockoutLine(t.frontedBase, params.maintenanceBps);
  if (isKnockable(exit.markBase, t.frontedBase, params.maintenanceBps)) return refuse({ kind: "unhealthy", markBase: exit.markBase, lineBase });

  const funds = books.liquidBase + t.premiumBase;
  if (funds < t.frontedBase) return refuse({ kind: "liquidity", needBase: t.frontedBase, haveBase: funds });
  if (t.frontedBase > params.maxFrontedPerPositionBase) return refuse({ kind: "position-cap", frontedBase: t.frontedBase, capBase: params.maxFrontedPerPositionBase });
  const windowFronted = books.windowFrontedBase + t.frontedBase;
  if (windowFronted > params.maxWindowFrontedBase) return refuse({ kind: "window-cap", frontedBase: windowFronted, capBase: params.maxWindowFrontedBase });
  const outstanding = books.outstandingBase + t.frontedBase;
  const total = funds - t.frontedBase + outstanding;
  if (outstanding * BPS > total * BigInt(params.maxExposureBps)) return refuse({ kind: "exposure", outstandingBase: outstanding, totalBase: total, maxBps: params.maxExposureBps });
  if (books.openPositions >= params.maxOpenPositions) return refuse({ kind: "too-many-open", max: params.maxOpenPositions });

  return {
    ok: true,
    quote: {
      side,
      leverageBps,
      quantityRaw,
      costBase: walk.costBase,
      limitYesRaw: walk.limitYesRaw,
      priceRaw,
      stakeBase: t.stakeBase,
      frontedBase: t.frontedBase,
      premiumBase: t.premiumBase,
      winIfRightBase,
      lineBase,
      decimals: input.decimals,
      quotedAtMs: input.nowMs,
    },
  };
}
