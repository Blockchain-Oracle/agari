import type { Side } from "../types/market";
import type { VaultGrant } from "./types";

const DAY_SEC = 86_400;

export type CapRefusal =
  | { kind: "revoked" }
  | { kind: "expired"; expiresAtSec: number }
  | { kind: "price"; sidePriceRaw: bigint; capRaw: bigint }
  | { kind: "escrow"; worstBase: bigint; budgetBase: bigint }
  | { kind: "stake"; spendBase: bigint; capBase: bigint }
  | { kind: "daily"; wouldBeBase: bigint; capBase: bigint }
  | { kind: "positions"; wouldBe: number; cap: number };

export type CapVerdict = { ok: true; headroomBase: bigint } | { ok: false; refusal: CapRefusal };

export interface CapCheckInput {
  grant: VaultGrant;
  nowSec: number;
  /** The order's price in the bought side's own terms (YES price, or 1 − it for NO). */
  sidePriceRaw: bigint;
  quantityRaw: bigint;
  /** What the fill would actually charge; the worst case (limit × quantity) when unknown. */
  spendBase: bigint;
  /** One whole unit of collateral (10^decimals). */
  one: bigint;
  opensNewPosition: boolean;
}

export function utcDayOf(sec: number): number {
  return Math.floor(sec / DAY_SEC);
}

/** The next 00:00 UTC — the copy says "resets 00:00 UTC", never "midnight your time" (AD-5 cap clock). */
export function capResetsAtSec(nowSec: number): number {
  return (utcDayOf(nowSec) + 1) * DAY_SEC;
}

/** What the grant has left today: the daily cap net of today's spend, bounded by the budget. */
export function dailyHeadroomBase(grant: VaultGrant, nowSec: number): bigint {
  const today = grant.spentDay === utcDayOf(nowSec) ? grant.spentTodayBase : 0n;
  const dailyLeft = grant.caps.maxDailySpendBase > today ? grant.caps.maxDailySpendBase - today : 0n;
  return dailyLeft < grant.budgetBase ? dailyLeft : grant.budgetBase;
}

/**
 * Mirrors `EventVault.placeFor` for a buy, check for check and in the contract's order:
 * live → price cap → escrow against the budget → per-trade cap → UTC-day cap → budget → position cap.
 * Golden-tested against `contracts/test/vectors/caps.json`, which the forge suite asserts too.
 */
export function simulateCaps(input: CapCheckInput): CapVerdict {
  const { grant, nowSec, sidePriceRaw, quantityRaw, spendBase, one, opensNewPosition } = input;
  const { caps } = grant;
  if (grant.revoked) return { ok: false, refusal: { kind: "revoked" } };
  if (nowSec > grant.expiresAtSec) return { ok: false, refusal: { kind: "expired", expiresAtSec: grant.expiresAtSec } };
  if (caps.maxPriceRaw !== 0n && sidePriceRaw > caps.maxPriceRaw) {
    return { ok: false, refusal: { kind: "price", sidePriceRaw, capRaw: caps.maxPriceRaw } };
  }
  const worstBase = (quantityRaw * sidePriceRaw) / one;
  if (grant.budgetBase < worstBase) return { ok: false, refusal: { kind: "escrow", worstBase, budgetBase: grant.budgetBase } };
  if (spendBase > caps.maxStakePerTradeBase) return { ok: false, refusal: { kind: "stake", spendBase, capBase: caps.maxStakePerTradeBase } };
  const today = grant.spentDay === utcDayOf(nowSec) ? grant.spentTodayBase : 0n;
  if (today + spendBase > caps.maxDailySpendBase) {
    return { ok: false, refusal: { kind: "daily", wouldBeBase: today + spendBase, capBase: caps.maxDailySpendBase } };
  }
  if (grant.budgetBase < spendBase) return { ok: false, refusal: { kind: "escrow", worstBase: spendBase, budgetBase: grant.budgetBase } };
  if (opensNewPosition && grant.openPositions + 1 > caps.maxOpenPositions) {
    return { ok: false, refusal: { kind: "positions", wouldBe: grant.openPositions + 1, cap: caps.maxOpenPositions } };
  }
  return { ok: true, headroomBase: dailyHeadroomBase(grant, nowSec) - spendBase };
}

export interface CappableQuote {
  /** The IOC limit in YES terms, padded by the cadence's crossing cushion. */
  limitPriceRaw: bigint;
  contractsRaw: bigint;
  expectedCostBase: bigint;
  maxCostBase: bigint;
}

/**
 * A grant tap's limit held to the grant's price cap. A quote's limit is the walked price plus the cadence's crossing
 * cushion (about 56 % on a 5m Window), so a tap filling at 70¢ carries a limit near 99¢ and the 95¢ cap would refuse
 * almost every tap above 61¢. The cap is a ceiling on what a contract may cost, not on the cushion: where the walk's
 * average fits under it, the limit (and the escrow it implies) comes down to the cap, tick-aligned, and the IOC fills
 * what the book offers at or under it. A quote already under the cap, a cap of 0 (none) or an average over the cap
 * comes back unchanged — the last is a real price refusal and says so.
 */
export function capQuoteToGrant<Q extends CappableQuote>(quote: Q, side: Side, maxPriceRaw: bigint, one: bigint, tickRaw: bigint): Q {
  if (maxPriceRaw === 0n || quote.contractsRaw === 0n || tickRaw <= 0n) return quote;
  const ownLimit = side === "up" ? quote.limitPriceRaw : one - quote.limitPriceRaw;
  const cap = maxPriceRaw - (maxPriceRaw % tickRaw);
  if (ownLimit <= cap) return quote;
  if (quote.expectedCostBase * one > cap * quote.contractsRaw) return quote;
  return { ...quote, limitPriceRaw: side === "up" ? cap : one - cap, maxCostBase: (quote.contractsRaw * cap) / one };
}
