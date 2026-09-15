/**
 * halt-watch's pure step (session-lanes.md §3.1): what each asset's sources say now, then the confirmed board after
 * this observation. Stock lanes are watched in regular hours only; outside them every stock halt clears at once. The
 * token lane trades 24/7, so its issuer flag and quote streaks always count.
 */
import {
  confirmHalt,
  HALT_ASSETS,
  stockHaltReason,
  TICKER_SYMBOLS,
  tokenHaltReason,
  XSTOCK_SYMBOLS,
  type HaltAsset,
  type HaltStreak,
  type PythTick,
  type TickerSymbol,
  type XStockSymbol,
} from "@agari/core/market";
import type { HaltReason, PrintSource } from "@agari/core/types";

export interface Observations {
  nowSec: number;
  inRegularHours: boolean;
  /** Each ticker's primary source now (its newest valid version); absent or null = no signed source. */
  primary: Partial<Record<TickerSymbol, PrintSource | null>>;
  /** The newest Pyth tick seen per ticker (kept across failed reads, so a gap in reads ages it honestly). */
  pyth: Partial<Record<TickerSymbol, PythTick>>;
  /** The newest RedStone package time per ticker. */
  redstoneNewestSec: Partial<Record<TickerSymbol, number>>;
  /** The xStocks `isMarketTradingHalted` flag; absent = not read yet. */
  issuer: Partial<Record<XStockSymbol, boolean>>;
  quoteFailures: Partial<Record<XStockSymbol, number>>;
}

export type ObservedHalts = Record<HaltAsset, HaltReason | null>;

export function observeHalts(o: Observations): ObservedHalts {
  const out = Object.fromEntries(HALT_ASSETS.map((asset) => [asset, null])) as ObservedHalts;
  if (o.inRegularHours) {
    for (const symbol of TICKER_SYMBOLS) {
      out[symbol] = stockHaltReason(o.primary[symbol] ?? null, o.pyth[symbol] ?? null, o.redstoneNewestSec[symbol] ?? null, o.nowSec);
    }
  }
  for (const xstock of XSTOCK_SYMBOLS) out[xstock] = tokenHaltReason(o.issuer[xstock] ?? null, o.quoteFailures[xstock] ?? 0);
  return out;
}

export interface HaltState {
  confirmed: Map<HaltAsset, HaltReason | null>;
  streaks: Map<HaltAsset, HaltStreak | null>;
}

export const emptyHaltState = (): HaltState => ({ confirmed: new Map(), streaks: new Map() });

const isToken = (asset: HaltAsset): boolean => (XSTOCK_SYMBOLS as readonly string[]).includes(asset);

/** Folds one observation into the state (mutated) and returns the confirmed reasons. */
export function stepHalts(state: HaltState, observed: ObservedHalts, inRegularHours: boolean): Map<HaltAsset, HaltReason | null> {
  for (const asset of HALT_ASSETS) {
    if (!inRegularHours && !isToken(asset)) {
      state.confirmed.set(asset, null);
      state.streaks.set(asset, null);
      continue;
    }
    const next = confirmHalt(state.confirmed.get(asset) ?? null, state.streaks.get(asset) ?? null, observed[asset]);
    state.confirmed.set(asset, next.confirmed);
    state.streaks.set(asset, next.streak);
  }
  return state.confirmed;
}
