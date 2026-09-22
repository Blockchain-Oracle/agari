/**
 * What, if anything, would move the desk back toward its mandate (desk.md §8). Plain arithmetic, no AI. The model
 * never proposes a trade and never sets a size: it is only ever asked WHEN, about a candidate that came from here.
 *
 * A candidate is a holding that drifted past its threshold, or a name the mandate no longer holds. No candidates means
 * "nothing to do", with no model call at all. That is the common case.
 */
import type { PreIpoSymbol } from "../market/tickers";
import { deskCopy } from "./copy";
import { nameOf, type DeskMandate } from "./mandate";
import { BPS, maxBigint, minBigint, rawFor } from "./units";
import type { DeskHoldingValue, DeskValuation } from "./valuation";

/** Below this an action is not worth its network fee, which the operator pays. One USDC. */
export const MIN_TRADE_E6 = 1_000_000n;
/** At most this many trades are considered in one check. */
export const MAX_CANDIDATES = 3;
/** A trade must correct a drift worth this many times what one leg costs. */
export const COST_MULTIPLE = 5;
/** PreStocks' transfer fee, on every transfer of every name (mainnet, 2026-09-22). */
export const TRANSFER_FEE_BPS = 100;
/** What a Jupiter route through Manifest / Meteora costs at the desk's sizes (measured 2026-09-22: 3–4 bps impact plus fees). */
export const DEX_FEE_BPS_EST = 10;
/** One leg: the transfer fee plus the route's fee. */
export const ONE_WAY_COST_BPS = TRANSFER_FEE_BPS + DEX_FEE_BPS_EST;
/**
 * How far under the per-action cap a sell is sized. The program values a sell at the larger of what came back and
 * the attested value, and both move between sizing and sending.
 */
export const SELL_HEADROOM_BPS = 200;

export type DeskSide = "buy" | "sell";

/**
 * One thing arithmetic says would move the desk toward its mandate. The model never invents a candidate and never
 * changes its size beyond the fixed part sizes. It only says when.
 */
export interface DeskCandidate {
  id: string;
  side: DeskSide;
  symbol: PreIpoSymbol;
  mint: string;
  /** USDC E6 for a buy; raw token units (9 dp) for a sell. */
  amountIn: bigint;
  /** Why arithmetic proposed it, in one plain sentence. */
  why: string;
  /** True when the owner's own standing instruction demanded it (no such instruction exists yet: always false). */
  protective: boolean;
}

export interface DeskNeed {
  candidate: DeskCandidate;
  driftBps: number;
  /** The drift this name must exceed before the desk considers acting: the mandate's, or cost-based if larger. */
  thresholdBps: number;
  /** True when the full correction was larger than the per-action limit and was cut down to fit. */
  limitedByPerAction: boolean;
}

/** The drift threshold: the owner's tolerance, or `COST_MULTIPLE × one leg` (550 bps) when that is larger. The studio says so. */
export function thresholdBps(mandate: Pick<DeskMandate, "driftToleranceBps">): number {
  return Math.max(mandate.driftToleranceBps, Math.ceil(COST_MULTIPLE * ONE_WAY_COST_BPS));
}

/**
 * A sell is sized off the valuation price, but the PROGRAM counts it at the larger of the USDC received and the
 * attested value. Whenever the attested spot sits above the mean, a sell sized to exactly the cap is counted as more
 * than the cap and refused on chain. So a sell leaves headroom, measured against the highest price the program might
 * use, and never proposes a sale it cannot make.
 */
function sellAmountFor(h: DeskHoldingValue, usdcE6: bigint): bigint {
  const highest = maxBigint(h.spotE8 ?? 0n, h.priceE8);
  const amount = rawFor((usdcE6 * (BPS - BigInt(SELL_HEADROOM_BPS))) / BPS, h.multiplierE12, highest);
  return minBigint(amount, h.raw);
}

export function findNeeds(v: DeskValuation, mandate: DeskMandate, chainPerActionCapE6: bigint): DeskNeed[] {
  // The smaller of the owner's mandate and what the chain will actually allow.
  const cap = minBigint(chainPerActionCapE6, mandate.perActionCapE6);
  // A buy never takes cash below the mandate's cash target: what it may spend is the cash above that floor.
  const cashFloor = (v.totalE6 * BigInt(v.cashTargetBps)) / BPS;
  const spendable = v.cashE6 > cashFloor ? v.cashE6 - cashFloor : 0n;
  const threshold = thresholdBps(mandate);
  const needs: DeskNeed[] = [];

  for (const h of v.holdings) {
    const notInMandate = h.targetBps === 0;
    // A name the mandate no longer names is sold whatever its size. Anything else must be past its threshold.
    if (!notInMandate && Math.abs(h.driftBps) <= threshold) continue;
    if (h.driftBps === 0 || h.priceE8 <= 0n) continue;
    // A frozen account cannot move and a paused mint cannot transfer: no candidate, the flags are shown instead.
    if (h.frozen || h.paused) continue;

    const side: DeskSide = h.driftBps > 0 ? "sell" : "buy";
    const fullE6 = (v.totalE6 * BigInt(Math.abs(h.driftBps))) / BPS;
    let usdcE6 = fullE6 > cap ? cap : fullE6;
    if (side === "buy") usdcE6 = minBigint(usdcE6, spendable);
    if (usdcE6 < MIN_TRADE_E6) continue;

    // Selling a name the mandate dropped sells the balance itself, so no dust is left behind.
    const sellAll = side === "sell" && notInMandate && fullE6 <= cap;
    const amountIn = side === "buy" ? usdcE6 : sellAll ? h.raw : sellAmountFor(h, usdcE6);
    if (amountIn === 0n) continue;

    const name = nameOf(h.symbol);
    needs.push({
      candidate: {
        id: "c0",
        side,
        symbol: h.symbol,
        mint: h.mint,
        amountIn,
        why: notInMandate ? deskCopy.need.dropped(name) : deskCopy.need.drifted(name, h.weightBps, h.targetBps, threshold),
        protective: false,
      },
      driftBps: h.driftBps,
      thresholdBps: threshold,
      limitedByPerAction: fullE6 > cap,
    });
  }
  // Sales first, because they free the cash that buys need. Within a side, the largest drift first.
  const rank = (n: DeskNeed) => (n.candidate.side === "sell" ? 0 : 1);
  return needs
    .sort((a, b) => rank(a) - rank(b) || Math.abs(b.driftBps) - Math.abs(a.driftBps))
    .slice(0, MAX_CANDIDATES)
    .map((n, i) => ({ ...n, candidate: { ...n.candidate, id: `c${i + 1}` } }));
}
