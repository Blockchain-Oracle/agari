/**
 * What the desk is worth and how it is spread, right now (desk.md §8). Holdings are valued on the 30-minute mean of the
 * venue's PreStocks reads (`priceE8`), never on one instant: a loss limit measured on one print could fire on a wobble.
 * A holding whose price could not be read is NOT valued and NOT traded, and the record says so; every weight is a share
 * of what could be valued.
 */
import type { PreIpoSymbol } from "../market/tickers";
import { deskCopy } from "./copy";
import { nameOf, type DeskTargets } from "./mandate";
import { bpsBetween, bpsOf, valueE6 } from "./units";

export interface DeskHoldingInput {
  symbol: PreIpoSymbol;
  mint: string;
  /** The desk's raw balance (9 dp base units). */
  raw: bigint;
  multiplierE12: bigint;
  /** The valuation price per UI token (the 30-minute mean); null when it could not be read. */
  priceE8: bigint | null;
  /** The venue-attested token price this instant, the reference the program uses; null when missing. */
  spotE8: bigint | null;
  /** PreStocks' mark (the SPV's valuation per token); null when missing. */
  markE8: bigint | null;
  /** Why the price is null, when it is (a short reason for the record). */
  unpricedWhy?: string;
  /** Token-2022 flags read from the mint and the desk's ATA. */
  paused: boolean;
  frozen: boolean;
}

export interface DeskHoldingValue {
  symbol: PreIpoSymbol;
  mint: string;
  raw: bigint;
  multiplierE12: bigint;
  priceE8: bigint;
  spotE8: bigint | null;
  markE8: bigint | null;
  valueE6: bigint;
  weightBps: number;
  /** 0 for a name the desk holds but the mandate no longer names. */
  targetBps: number;
  /** Weight minus target. Positive means over target. */
  driftBps: number;
  /** The spot against the mark, in basis points; null without both. */
  premiumBps: number | null;
  paused: boolean;
  frozen: boolean;
}

export interface UnpricedHolding {
  symbol: PreIpoSymbol;
  mint: string;
  raw: bigint;
  why: string;
}

export interface DeskValuation {
  atSec: number;
  totalE6: bigint;
  cashE6: bigint;
  cashWeightBps: number;
  cashTargetBps: number;
  holdings: DeskHoldingValue[];
  /** Names whose price could not be read. Their value is NOT in `totalE6`. */
  unpriced: UnpricedHolding[];
}

export interface ValueDeskInput {
  atSec: number;
  cashE6: bigint;
  holdings: readonly DeskHoldingInput[];
  targets: DeskTargets;
}

/** Values every name the mandate names, plus anything else the desk still holds. */
export function valueDesk(input: ValueDeskInput): DeskValuation {
  const targets = new Map(input.targets.tokens.map((t) => [t.symbol, t.weightBps]));
  const relevant = input.holdings.filter((h) => targets.has(h.symbol) || h.raw > 0n);
  const priced = relevant.filter((h): h is DeskHoldingInput & { priceE8: bigint } => h.priceE8 !== null && h.priceE8 > 0n);
  const unpriced: UnpricedHolding[] = relevant
    .filter((h) => h.priceE8 === null || h.priceE8 <= 0n)
    .map((h) => ({ symbol: h.symbol, mint: h.mint, raw: h.raw, why: deskCopy.priceUnreadable(nameOf(h.symbol), h.unpricedWhy ?? "no price") }));

  const valued = priced.map((h) => ({ h, valueE6: valueE6(h.raw, h.multiplierE12, h.priceE8) }));
  const totalE6 = valued.reduce((sum, v) => sum + v.valueE6, input.cashE6);

  return {
    atSec: input.atSec,
    totalE6,
    cashE6: input.cashE6,
    cashWeightBps: bpsOf(input.cashE6, totalE6),
    cashTargetBps: input.targets.cashBps,
    unpriced,
    holdings: valued.map(({ h, valueE6: value }) => {
      const weightBps = bpsOf(value, totalE6);
      const targetBps = targets.get(h.symbol) ?? 0;
      return {
        symbol: h.symbol,
        mint: h.mint,
        raw: h.raw,
        multiplierE12: h.multiplierE12,
        priceE8: h.priceE8,
        spotE8: h.spotE8,
        markE8: h.markE8,
        valueE6: value,
        weightBps,
        targetBps,
        driftBps: weightBps - targetBps,
        premiumBps: h.spotE8 !== null && h.markE8 !== null && h.markE8 > 0n ? bpsBetween(h.spotE8, h.markE8) : null,
        paused: h.paused,
        frozen: h.frozen,
      };
    }),
  };
}

/** The loss-stop test: how far `totalE6` sits below `baselineE6`, in basis points (0 when not below). */
export function drawdownBps(totalE6: bigint, baselineE6: bigint): number {
  if (baselineE6 <= 0n || totalE6 >= baselineE6) return 0;
  return bpsOf(baselineE6 - totalE6, baselineE6);
}
