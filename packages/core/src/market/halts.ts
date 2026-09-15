import { TRADING_HALT_REASONS, type HaltBoard, type HaltEntry, type HaltReason } from "../types/session-lanes";
import type { PrintSource } from "../types/market";
import { TICKER_SYMBOLS, XSTOCK_SYMBOLS, type TickerSymbol, type XStockSymbol } from "./tickers";

/**
 * Halt rules (session-lanes.md §3.1, D-057). No licensed halt feed exists (C:02 §B), so a lane is halted when the
 * signed source it settles on stops being printable: the thresholds are the chain's own (a Pyth tick wider than the
 * policy's 50 bps can't print, prints.md §4.1 step 5). Pure: `halt-watch` reads the sources, this decides.
 *
 * A halt never touches the chain. It stops the roller listing and the maker quoting; a Window already open voids by
 * itself when its print can't be recorded, and its verdict names the missing print, never the halt (§3.2).
 */

export type HaltAsset = TickerSymbol | XStockSymbol;

/** Every asset a halt can be keyed by: the ticker (Regular and Gap lanes), the xStock (token lane). */
export const HALT_ASSETS: readonly HaltAsset[] = [...TICKER_SYMBOLS, ...XSTOCK_SYMBOLS];

/** The Pyth policy's `max_conf_bps` (D-003): a wider tick could not print. */
export const PYTH_HALT_CONF_BPS = 50;
/** A Pyth equity feed ticks every ≈ 400 ms in regular hours; 15 s without one is a stopped feed. */
export const PYTH_STALE_SEC = 15;
/** RedStone packages land every ≈ 10 s; the newest older than 60 s is a stopped feed. */
export const REDSTONE_STALE_SEC = 60;
/** Consecutive failed Switchboard quotes before the token lane halts. */
export const QUOTE_FAILURES_TO_HALT = 3;

/** One Pyth tick in the source's own exponent (both scaled alike, so the ratio needs no normalization). */
export interface PythTick {
  price: bigint;
  conf: bigint;
  publishTimeSec: number;
}

/**
 * `pyth-stale` when no tick is newer than 15 s (a stale tick's width says nothing about now, so staleness wins),
 * else `pyth-wide` when `conf × 10⁴ > price × 50` or the price isn't positive.
 */
export function pythHaltReason(tick: PythTick | null, nowSec: number, maxConfBps = PYTH_HALT_CONF_BPS): HaltReason | null {
  if (!tick || nowSec - tick.publishTimeSec > PYTH_STALE_SEC) return "pyth-stale";
  if (tick.price <= 0n || tick.conf * 10_000n > tick.price * BigInt(maxConfBps)) return "pyth-wide";
  return null;
}

/** `redstone-stale` when the newest package of the feed is older than 60 s, or none was seen. */
export function redstoneHaltReason(newestPackageSec: number | null, nowSec: number): HaltReason | null {
  return newestPackageSec === null || nowSec - newestPackageSec > REDSTONE_STALE_SEC ? "redstone-stale" : null;
}

/** The token lane: the issuer's own halt flag first (`null` = not read yet), then three failed quotes in a row. */
export function tokenHaltReason(issuerHalted: boolean | null, consecutiveQuoteFailures: number): HaltReason | null {
  if (issuerHalted === true) return "issuer-halt";
  return consecutiveQuoteFailures >= QUOTE_FAILURES_TO_HALT ? "quote-unavailable" : null;
}

/** A ticker's policy versions reduced to what halts need (`price-sources.json` `tickers.<SYM>.versions`). */
export interface SourceVersion {
  validFromSec: number;
  /** Null = open-ended. Inclusive, like the roller's coverage rule (prints.md §2.3). */
  validUntilSec: number | null;
  primary: PrintSource;
}

/** The primary source of the newest version valid at `nowSec`; null when no version is (the lane is paused, not halted). */
export function primarySourceAt(versions: readonly SourceVersion[], nowSec: number): PrintSource | null {
  for (let i = versions.length - 1; i >= 0; i--) {
    const v = versions[i]!;
    if (v.validFromSec <= nowSec && (v.validUntilSec === null || nowSec <= v.validUntilSec)) return v.primary;
  }
  return null;
}

/** A Regular/Gap lane's halt from its primary source. A check source never halts: a missing check only flags `single_source`. */
export function stockHaltReason(primary: PrintSource | null, pyth: PythTick | null, redstoneNewestSec: number | null, nowSec: number): HaltReason | null {
  if (primary === "pyth") return pythHaltReason(pyth, nowSec);
  if (primary === "redstone") return redstoneHaltReason(redstoneNewestSec, nowSec);
  return null;
}

/** Observations in a row before a lane's halt state changes. The issuer flag is authoritative and applies at once. */
export function confirmPasses(observed: HaltReason | null): number {
  return observed === "issuer-halt" ? 1 : 2;
}

export interface HaltStreak {
  /** The observed state that differs from the confirmed one. */
  pending: HaltReason | null;
  seen: number;
}

/**
 * One observation against the confirmed state: a different reason (or a clear) takes effect only after
 * `confirmPasses` observations in a row, so one late tick or one failed read never flips a lane.
 */
export function confirmHalt(confirmed: HaltReason | null, streak: HaltStreak | null, observed: HaltReason | null): { confirmed: HaltReason | null; streak: HaltStreak | null } {
  if (observed === confirmed) return { confirmed, streak: null };
  const seen = streak && streak.pending === observed ? streak.seen + 1 : 1;
  return seen >= confirmPasses(observed) ? { confirmed: observed, streak: null } : { confirmed, streak: { pending: observed, seen } };
}

/** Q-S6-9: only a wide Pyth confidence or the issuer's flag says "Trading halted"; a stale or unquoted source says why. */
export function haltLabel(reason: HaltReason): "Trading halted" | "Signed price stale" {
  return TRADING_HALT_REASONS.includes(reason) ? "Trading halted" : "Signed price stale";
}

/** The roller's lane state for a halted asset. */
export function haltPausedState(entry: HaltEntry): string {
  return `paused: halted (${entry.reason})`;
}

export function haltOf(board: HaltBoard, asset: HaltAsset): HaltEntry | null {
  return board[asset] ?? null;
}
