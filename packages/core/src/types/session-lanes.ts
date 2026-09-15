import type { TickerSymbol, XStockSymbol } from "../market/tickers";
import type { LaneBasis, PrintSource, VoidReason } from "./market";

/**
 * The S6 session-lane inputs every consumer shares (`docs/plan/specs/session-lanes.md` §3, D-051). Frozen at the S6
 * foundation: ops `halt-watch` and the earnings/corporate readers produce them, `/session` serves them, the roller,
 * the maker and the web states read them.
 */

/**
 * Why a lane is halted off-chain (§3.1). No licensed halt feed exists (C:02 §B), so these are signed-source health
 * signals plus the xStocks issuer flag. A halt never changes the chain: an open Window voids by itself when its print
 * can't be recorded.
 */
export const HALT_REASONS = ["pyth-wide", "pyth-stale", "redstone-stale", "issuer-halt", "quote-unavailable"] as const;
export type HaltReason = (typeof HALT_REASONS)[number];

/** Only these say "Trading halted"; the stale and quote reasons say "Signed price stale" (Q-S6-9). */
export const TRADING_HALT_REASONS: readonly HaltReason[] = ["pyth-wide", "issuer-halt"];

export interface HaltEntry {
  reason: HaltReason;
  /** When this reason was first seen (the entry keeps it while the reason holds). */
  sinceSec: number;
}

/** Keyed by the lane's asset: the ticker for Regular and Gap Windows, the xStock for the token lane. */
export type HaltBoard = Partial<Record<TickerSymbol | XStockSymbol, HaltEntry>>;

/** Finnhub's report timing: before the open, after the close, during market hours. */
export type EarningsHour = "bmo" | "amc" | "dmh";

/** One Finnhub `/calendar/earnings` row (§3.3); the same shape as S13's `finnhub.server.ts` (Q-S13-9). */
export interface EarningsEvent {
  symbol: TickerSymbol;
  /** ET date, `YYYY-MM-DD`. */
  dateEt: string;
  hour: EarningsHour | null;
}

/** `earnings-session`: a Regular Window on a report date. `earnings-gap`: a Gap over an `amc` Friday or a `bmo` Monday. */
export type EarningsFlag = "earnings-session" | "earnings-gap";

/** `services/ops/config/corporate-actions.json` `skips[]` (§3.4). No `lanes` = every lane of that ticker. */
export interface CorporateSkip {
  symbol: TickerSymbol;
  /** ET date, `YYYY-MM-DD`. A Gap matches its Friday or its Monday. */
  date: string;
  why: string;
  lanes?: readonly LaneBasis[];
}

/** `multipliers[]`: an xStock ScaledUiAmount change. The token lane skips a Window whose span contains `effectiveSec`. */
export interface MultiplierChange {
  xstock: XStockSymbol;
  effectiveSec: number;
  /** Decimal strings, exactly as the issuer publishes them (never parsed to floats). */
  from: string;
  to: string;
  why: string;
}

export type VoidSlot = "open" | "close";

/** What a void verdict names (§3.2): the on-chain reason plus the empty slot, when the result shows one. */
export interface VoidDetail {
  reason: VoidReason;
  slot: VoidSlot | null;
  source: PrintSource | null;
  /** The boundary T of the missing or diverging print. */
  boundarySec: number | null;
  /** The last admissible second for that print. */
  deadlineSec: number | null;
}
