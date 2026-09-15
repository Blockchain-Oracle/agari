/**
 * The Gap lane's quotes (session-lanes.md §1.5): Friday 16:00 → Sunday 19:59 ET, the `fair.ts` z-score against the xStock
 * weekend spot for TSLA/NVDA/QQQ and 500 ticks elsewhere, capped at `MM_GAP_MAX_CASH`. Lane 6a owns this file.
 *
 * The underlying doesn't trade over the weekend, so the only live reference is the 24/7 xStock token (Jupiter's per-UI-token
 * price, which carries the ScaledUiAmount multiplier, so it is quoted per share like the print). A name without an xStock,
 * or whose xStock spot is stale or issuer-halted, quotes 500: it knows nothing past Friday's print.
 */
import { TICKERS, type XStockSymbol } from "@agari/core/market";
import { fairYesTicks } from "./fair";
import type { LaneQuote, LaneQuoteInput } from "./lane-quote";
import type { MakerPhase } from "./quote";

/** Fair with no weekend reference. */
export const GAP_BLIND_FAIR_TICKS = 500;
/** Weekend uncertainty at the Friday close, as seconds of regular-session variance (one session), shrinking with the span left. */
export const GAP_VARIANCE_SEC = 23_400;
/** Stop quoting this long before the Sunday lock, like every lane (entry closes 30 s before it, D-011). */
export const GAP_STOP_BEFORE_LOCK_SEC = 60;

export interface GapFairInput {
  nowSec: number;
  tradingStartSec: number;
  lockAtSec: number;
  expirySec: number;
  /** The recorded Friday print × 10⁸; null until it lands. */
  openE8: bigint | null;
  /** The xStock spot × 10⁸, fresh; null when the name has none or it is stale. */
  referenceE8: bigint | null;
  sigmaBps: number;
  minTick: number;
}

export function gapPhase(i: { nowSec: number; tradingStartSec: number; lockAtSec: number; halted: boolean }): MakerPhase {
  if (i.halted || i.nowSec < i.tradingStartSec) return "pull";
  return i.nowSec >= i.lockAtSec - GAP_STOP_BEFORE_LOCK_SEC ? "stop" : "quote";
}

/** Seconds of session variance left: `GAP_VARIANCE_SEC × (expiry − now) / (expiry − tradingStart)`. */
export function gapVarianceSecLeft(i: { nowSec: number; tradingStartSec: number; expirySec: number }): number {
  const span = Math.max(1, i.expirySec - i.tradingStartSec);
  const left = Math.min(span, Math.max(0, i.expirySec - i.nowSec));
  return Math.floor((GAP_VARIANCE_SEC * left) / span);
}

/** YES ticks: the z-score against the reference when both prices exist, else `GAP_BLIND_FAIR_TICKS`; null before the open print. */
export function gapFairTicks(i: GapFairInput): number | null {
  if (i.openE8 === null) return null;
  if (i.referenceE8 === null) return GAP_BLIND_FAIR_TICKS;
  return fairYesTicks({ spotE8: i.referenceE8, openE8: i.openE8, secondsLeft: gapVarianceSecLeft(i), sigmaBps: i.sigmaBps, minTick: i.minTick });
}

/**
 * 6b's `xstock-spot.ts` publishes Jupiter's price under the xStock symbol; `SpotFeed.latest` is typed for tickers until
 * the stage owner widens it. Method parameters are bivariant, so the feed reads through this shape without a cast.
 */
type XStockSpot = { latest(symbol: string, maxAgeSec?: number): { priceE8: bigint } | null };

function referenceOf(input: LaneQuoteInput, xstock: XStockSymbol | null): bigint | null {
  if (!xstock || input.halts[xstock]) return null;
  const feed: XStockSpot | null = input.spot;
  return feed?.latest(xstock, input.env.spotMaxAgeSec)?.priceE8 ?? null;
}

export function gapQuote(input: LaneQuoteInput): LaneQuote {
  const d = input.market.data;
  const [tradingStartSec, lockAtSec, expirySec] = [Number(d.tradingStart), Number(d.lockAt), Number(d.expiry)];
  const cap = input.env.gapMaxCash;
  const halted = Boolean(input.halts[input.symbol]);
  const phase = gapPhase({ nowSec: input.nowSec, tradingStartSec, lockAtSec, halted });
  if (phase !== "quote") {
    const why = halted ? `halted (${input.halts[input.symbol]!.reason})` : phase === "stop" ? "60 s before the Sunday lock" : "Gap not trading yet";
    return { phase, fairTicks: null, maxCashPerWindow: cap, why };
  }
  const xstock = TICKERS[input.symbol].xstock?.symbol ?? null;
  const referenceE8 = referenceOf(input, xstock);
  const openE8 = d.open.source === 0 ? null : d.open.price;
  const fairTicks = gapFairTicks({ nowSec: input.nowSec, tradingStartSec, lockAtSec, expirySec, openE8, referenceE8, sigmaBps: input.env.sigmaBps(input.symbol), minTick: input.env.minTick });
  const why =
    openE8 === null ? "waiting for the Friday print"
    : referenceE8 !== null ? `${xstock} reference`
    : xstock && input.halts[xstock] ? `${xstock} halted (${input.halts[xstock]!.reason}): ${GAP_BLIND_FAIR_TICKS}`
    : xstock ? `${xstock} spot unavailable: ${GAP_BLIND_FAIR_TICKS}`
    : `no weekend reference: ${GAP_BLIND_FAIR_TICKS}`;
  return { phase, fairTicks, maxCashPerWindow: cap, why };
}
