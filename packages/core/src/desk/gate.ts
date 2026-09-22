/**
 * The limits check (desk.md §5). Plain arithmetic, no AI. It can veto. It never originates and never resizes.
 *
 * It must predict what the program will do, so it repeats `guard.rs`'s integer maths, rounding included:
 *   - a buy counts `usdc_in` against the caps; its floor is `usdc_in × 10^23 × 92 / (multiplier × price × 100)`
 *   - a sell is valued at `((raw × price) / 10^11) × multiplier / 10^12` and counts the LARGER of the USDC received
 *     and that value: the attested value is the one number the operator cannot move
 *   - the operator's minimum output is raised to 8 % inside the attested price, so a quote beyond that band reverts by
 *     design, and the gate says so first, in words
 *   - a buy must not be further above its reference (the mark, or Pyth's index) than the owner's ceiling
 * Plus two refusals TIGHTER than the chain for an ordinary rebalance: a spot more than 3 % from its own half-hour mean
 * is a broken reading, not a bargain; a trade costing more than 2.5 % (the 1 % transfer fee inside it) is too large
 * for the route. `gate.vectors.json` is asserted here and in `guard.rs`.
 */
import { deskCopy } from "./copy";
import type { DeskSide } from "./needs";
import { BPS, maxBigint, minBigint, VALUE_SCALE } from "./units";

export const BAND_BPS = 800n;
/** `(10000 − 800) / 10000` reduced, so the program's u128 headroom reaches $37 M an action. */
export const BAND_KEEP_NUM = 92n;
export const BAND_KEEP_DEN = 100n;
export const MAX_GAP_BPS = 300;
export const MAX_COST_BPS = 250;
const E11 = 10n ** 11n;
const E12 = 10n ** 12n;

export interface DeskGateInput {
  side: DeskSide;
  /** USDC E6 for a buy; raw tokens for a sell. */
  amountIn: bigint;
  /** What Jupiter quotes for exactly `amountIn` (raw tokens for a buy; USDC E6 for a sell). */
  quoteOut: bigint;
  /** The venue-attested token price the program measures against (`DeskRef.token_price_e8`). */
  tokenPriceE8: bigint;
  multiplierE12: bigint;
  /** The premium reference (the mark, or Pyth's index when required); null when there is none. Buys only. */
  referenceE8: bigint | null;
  maxPremiumBps: number;
  slippageBps: bigint;
  /** The owner's own limits, which may be TIGHTER than the chain's; the smaller of the two binds. */
  mandate: { perActionCapE6: bigint; dailyCapE6: bigint; spentTodayE6: bigint } | null;
  desk: {
    paused: boolean;
    /** 0 practice, 1 ask first, 2 on its own: the program refuses buys and sells in mode 0. */
    mode: number;
    perActionCapE6: bigint;
    remainingDailyCapE6: bigint;
    cashE6: bigint;
    /** The desk's raw balance of the candidate name. */
    tokenBalanceRaw: bigint;
    configured: boolean;
    enabled: boolean;
    referenceFresh: boolean;
  };
  /** Spot against its half-hour mean, and what this exact trade costs against the spot. */
  gapBps: number;
  costBps: number;
  /** True when the owner's own standing instruction demanded this sale (never, today). */
  protective: boolean;
  /** What this holding and the whole desk are worth now, and the largest share the owner allows. Buys only. */
  position: { holdingE6: bigint; totalE6: bigint; maxPositionBps: number } | null;
}

export interface DeskGateResult {
  result: "allow" | "deny";
  reasons: string[];
  /** What the program will count against the per-action and daily caps. */
  countedE6: bigint;
  /** A sell's attested value in USDC (0 for a buy). */
  oracleValueE6: bigint;
  /** The least output the program will accept from the operator, from the attested price and the 8 % band. */
  oracleFloor: bigint;
  /** The floor we send: our slippage floor or the program's, whichever is higher. */
  minOut: bigint;
  premiumOk: boolean;
}

/** `guard::buy_floor`: the least raw tokens `usdcE6` must bring back. */
export function buyFloor(usdcE6: bigint, multiplierE12: bigint, tokenPriceE8: bigint): bigint {
  return (usdcE6 * VALUE_SCALE * BAND_KEEP_NUM) / (multiplierE12 * tokenPriceE8 * BAND_KEEP_DEN);
}

/** `guard::sell_oracle_value`: what `raw` tokens are worth at the attested price, in USDC E6, in the program's order of operations. */
export function sellOracleValue(raw: bigint, multiplierE12: bigint, tokenPriceE8: bigint): bigint {
  return (((raw * tokenPriceE8) / E11) * multiplierE12) / E12;
}

/** `guard::sell_floor`: 8 % inside the attested value. */
export function sellFloor(oracleValueE6: bigint): bigint {
  return (oracleValueE6 * BAND_KEEP_NUM) / BAND_KEEP_DEN;
}

/** `guard::premium_ok`: `token × 10000 ≤ reference × (10000 + max)`; false without a positive reference. */
export function premiumOk(tokenPriceE8: bigint, referenceE8: bigint | null, maxPremiumBps: number): boolean {
  if (referenceE8 === null || referenceE8 <= 0n) return false;
  return tokenPriceE8 * BPS <= referenceE8 * (BPS + BigInt(maxPremiumBps));
}

export function gate(g: DeskGateInput): DeskGateResult {
  if (g.amountIn <= 0n || g.tokenPriceE8 <= 0n || g.multiplierE12 <= 0n) {
    return { result: "deny", reasons: [deskCopy.gate.nothingToTrade], countedE6: 0n, oracleValueE6: 0n, oracleFloor: 0n, minOut: 0n, premiumOk: false };
  }
  const oracleValueE6 = g.side === "sell" ? sellOracleValue(g.amountIn, g.multiplierE12, g.tokenPriceE8) : 0n;
  const countedE6 = g.side === "buy" ? g.amountIn : maxBigint(g.quoteOut, oracleValueE6);
  const oracleFloor = g.side === "buy" ? buyFloor(g.amountIn, g.multiplierE12, g.tokenPriceE8) : sellFloor(oracleValueE6);
  const ourFloor = (g.quoteOut * (BPS - g.slippageBps)) / BPS;
  const minOut = maxBigint(ourFloor, oracleFloor);
  const premium = g.side === "buy" ? premiumOk(g.tokenPriceE8, g.referenceE8, g.maxPremiumBps) : true;

  // The program's own order (desk.md §4.5), then the two tighter refusals, then the owner's shares and balances.
  const reasons: string[] = [];
  if (g.desk.paused) reasons.push(deskCopy.gate.paused);
  if (g.desk.mode === 0) reasons.push(deskCopy.gate.practice);
  if (!g.desk.configured || (g.side === "buy" && !g.desk.enabled)) reasons.push(deskCopy.gate.tokenNotAllowed);
  if (!g.desk.referenceFresh) reasons.push(deskCopy.gate.referenceStale);
  if (!premium) reasons.push(deskCopy.gate.premiumTooHigh);
  const perAction = g.mandate ? minBigint(g.mandate.perActionCapE6, g.desk.perActionCapE6) : g.desk.perActionCapE6;
  const leftToday = g.mandate ? minBigint(g.desk.remainingDailyCapE6, g.mandate.dailyCapE6 - g.mandate.spentTodayE6) : g.desk.remainingDailyCapE6;
  if (countedE6 > perAction) reasons.push(deskCopy.gate.overPerAction);
  if (countedE6 > leftToday) reasons.push(deskCopy.gate.overDaily);
  if (g.quoteOut < oracleFloor) reasons.push(deskCopy.gate.beyondBand);
  if (!g.protective && Math.abs(g.gapBps) > MAX_GAP_BPS) reasons.push(deskCopy.gate.farFromReference);
  if (!g.protective && g.costBps > MAX_COST_BPS) reasons.push(deskCopy.gate.tooCostly);
  if (g.side === "buy" && g.position && g.position.totalE6 > 0n) {
    const afterBps = ((g.position.holdingE6 + g.amountIn) * BPS) / g.position.totalE6;
    if (afterBps > BigInt(g.position.maxPositionBps)) reasons.push(deskCopy.gate.holdingTooLarge);
  }
  if (g.side === "buy" && g.amountIn > g.desk.cashE6) reasons.push(deskCopy.gate.notEnoughCash);
  if (g.side === "sell" && g.amountIn > g.desk.tokenBalanceRaw) reasons.push(deskCopy.gate.notEnoughTokens);

  return { result: reasons.length === 0 ? "allow" : "deny", reasons, countedE6, oracleValueE6, oracleFloor, minOut, premiumOk: premium };
}
