/**
 * A short as a position the owner manages, rather than a bet held to a bell.
 *
 * The reserve already records everything a managed position needs — what was staked, what it fronted, the price
 * per contract paid at open — and `getLeverageMark` already walks the exit side for what the book would pay now.
 * What was missing is the arithmetic between them: the owner's equity against their stake, the price per contract
 * now against the price they entered at, and how far the mark may fall before anyone may knock the position out.
 *
 * Nothing here is a projection. Every figure is either the chain's own or a difference of two of them.
 */
import { equityOf } from "./sizing";
import type { LeverageMark, LeveragePosition } from "./types";

const BPS = 10_000n;

/** Within this much of the mark, a short is close enough to its line that the surface says so. */
export const SHORT_CLOSE_BPS = 2_000;

/** `clear` has room, `close` is inside `SHORT_CLOSE_BPS` of its line, `at-line` may be knocked out now, `unfronted` is a 1× short with no line at all. */
export type ShortBand = "clear" | "close" | "at-line" | "unfronted";

export interface ShortHealth {
  band: ShortBand;
  /** Mark less line, never below zero: what the book would have to take off this position to reach the line. */
  headroomBase: bigint;
  /** That headroom as a share of the mark, in bps — the fall that reaches the line. Null when nothing is fronted. */
  dropToLineBps: number | null;
}

/**
 * How far a live short is from its knock-out line. A 1× short fronts nothing, so `is_knockable` can never be
 * true for it (`fronted_base != 0` is the program's first term) and it has no line to report.
 */
export function shortHealth(mark: LeverageMark, frontedBase: bigint): ShortHealth {
  if (frontedBase <= 0n) return { band: "unfronted", headroomBase: mark.markBase, dropToLineBps: null };
  if (mark.knockable || mark.markBase <= mark.lineBase) return { band: "at-line", headroomBase: 0n, dropToLineBps: 0 };
  const headroomBase = mark.markBase - mark.lineBase;
  const dropToLineBps = Number((headroomBase * BPS) / mark.markBase);
  return { band: dropToLineBps < SHORT_CLOSE_BPS ? "close" : "clear", headroomBase, dropToLineBps };
}

/** Whether the book can take the whole position: a mark over a partial walk is not what an exit would fetch. */
export function shortPriced(position: LeveragePosition, mark: LeverageMark | null): boolean {
  return mark !== null && mark.filledRaw >= position.quantityRaw;
}

export type ShortSign = "up" | "down" | "level";

export interface ShortPnl {
  /** What the owner would hold after an exit here, the reserve's front repaid first. */
  equityBase: bigint;
  /** That against what they staked, signed. */
  pnlBase: bigint;
  sign: ShortSign;
}

/** A live short at the book's mark. */
export function shortPnl(position: LeveragePosition, markBase: bigint): ShortPnl {
  const equityBase = equityOf(markBase, position.frontedBase);
  return { equityBase, ...deltaOf(equityBase, position.stakeBase) };
}

/** A finished short, from what actually came back rather than from any mark. */
export function shortResult(position: LeveragePosition): ShortPnl {
  return { equityBase: position.returnedBase, ...deltaOf(position.returnedBase, position.stakeBase) };
}

function deltaOf(worthBase: bigint, stakeBase: bigint): { pnlBase: bigint; sign: ShortSign } {
  const pnlBase = worthBase - stakeBase;
  return { pnlBase, sign: pnlBase > 0n ? "up" : pnlBase < 0n ? "down" : "level" };
}

/**
 * The mark as a price per whole contract, in the position's own side terms, so it can be read beside the price
 * it entered at. The position holds a fixed quantity, so the mark and the cost that bought it are the same
 * contracts priced twice: `entry × mark / cost`. Cost is `stake + fronted − premium`, the program's own identity
 * (`math.rs::terms`), which means this needs no book read and no venue constant.
 */
export function shortMarkPriceRaw(position: LeveragePosition, markBase: bigint): bigint {
  const costBase = position.stakeBase + position.frontedBase - position.premiumBase;
  return costBase <= 0n ? 0n : (position.entryPriceRaw * markBase) / costBase;
}

export interface ShortBookTotals {
  /** Live positions held, and how many of them the book can currently price in full. */
  live: number;
  priced: number;
  /** Staked, worth and the difference — over the priced positions only, so no unpriced one is counted as a loss. */
  stakedBase: bigint;
  equityBase: bigint;
  pnlBase: bigint;
  sign: ShortSign;
}

/** One line for a wallet's open shorts. A position the book cannot take in full is counted, not marked. */
export function shortBookTotals(rows: readonly { position: LeveragePosition; mark: LeverageMark | null }[]): ShortBookTotals {
  let priced = 0;
  let stakedBase = 0n;
  let equityBase = 0n;
  for (const row of rows) {
    if (!shortPriced(row.position, row.mark)) continue;
    priced += 1;
    stakedBase += row.position.stakeBase;
    equityBase += shortPnl(row.position, (row.mark as LeverageMark).markBase).equityBase;
  }
  return { live: rows.length, priced, stakedBase, equityBase, ...deltaOf(equityBase, stakedBase) };
}
