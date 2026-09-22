/**
 * Starting points, so nobody faces an empty form (plan §5.4 step 01): the five baskets of `market/baskets.ts` as desk
 * presets. A basket's member weights total 10,000; a preset scales them to `10,000 − cashBps` and puts the rounding
 * remainder on the largest weight, so the targets and cash always total exactly 100 %.
 */
import { BASKET_SYMBOLS, BASKETS, type BasketSymbol } from "../market/baskets";
import type { PreIpoSymbol } from "../market/tickers";
import type { DeskMandate, DeskTargets } from "./mandate";

/** Defaults offered beside a preset (plan §5.4 step 02). The owner can change every one. */
export const DEFAULT_LIMITS = {
  cashBps: 2000,
  driftToleranceBps: 500,
  maxPositionBps: 5000,
  lossStopBps: 1500,
  maxPremiumBps: 1000,
} as const;

/** "Most in one action $50 · Most in a day $150 · Ask me first above $100". */
export const DEFAULT_MONEY = {
  perActionCapE6: 50_000_000n,
  dailyCapE6: 150_000_000n,
  largeActionE6: 100_000_000n,
} as const;

export interface DeskPreset {
  /** The basket's brand slug: `ailabs`, `frontier`, `predmkts`, `defspace`, `preall`. */
  id: string;
  basket: BasketSymbol;
  name: string;
  description: string;
  cashBps: number;
  tokens: DeskTargets["tokens"];
}

/** Member weights scaled to `10,000 − cashBps`, remainder on the largest weight (the first of equals). */
export function presetTokens(basket: BasketSymbol, cashBps: number): DeskTargets["tokens"] {
  const members = BASKETS[basket].members;
  const room = 10_000 - cashBps;
  const scaled = members.map((m) => ({ symbol: m.symbol, weightBps: Math.floor((m.weightBps * room) / 10_000) }));
  const remainder = room - scaled.reduce((sum, t) => sum + t.weightBps, 0);
  if (remainder > 0 && scaled.length > 0) {
    let largest = 0;
    scaled.forEach((t, i) => {
      if (t.weightBps > (scaled[largest] as { weightBps: number }).weightBps) largest = i;
    });
    (scaled[largest] as { weightBps: number }).weightBps += remainder;
  }
  return scaled;
}

export const DESK_PRESETS: readonly DeskPreset[] = BASKET_SYMBOLS.map((symbol) => {
  const basket = BASKETS[symbol];
  return { id: basket.brand.slug, basket: symbol, name: basket.name, description: basket.blurb, cashBps: DEFAULT_LIMITS.cashBps, tokens: presetTokens(symbol, DEFAULT_LIMITS.cashBps) };
});

export const presetById = (id: string): DeskPreset | undefined => DESK_PRESETS.find((p) => p.id === id);

/** A whole mandate from a preset and the defaults; `cashBps` rescales the members, `notes` defaults to empty. */
export function presetMandate(id: string, overrides: Partial<Omit<DeskMandate, "preset" | "targets">> & { cashBps?: number } = {}): DeskMandate | null {
  const preset = presetById(id);
  if (!preset) return null;
  const cashBps = overrides.cashBps ?? preset.cashBps;
  const { cashBps: _cash, ...rest } = overrides;
  return {
    preset: preset.id,
    targets: { cashBps, tokens: presetTokens(preset.basket, cashBps) },
    driftToleranceBps: DEFAULT_LIMITS.driftToleranceBps,
    maxPositionBps: DEFAULT_LIMITS.maxPositionBps,
    lossStopBps: DEFAULT_LIMITS.lossStopBps,
    maxPremiumBps: DEFAULT_LIMITS.maxPremiumBps,
    perActionCapE6: DEFAULT_MONEY.perActionCapE6,
    dailyCapE6: DEFAULT_MONEY.dailyCapE6,
    largeActionE6: DEFAULT_MONEY.largeActionE6,
    notes: "",
    ...rest,
  };
}

/** Every name a mandate's targets name, in basket order. */
export const mandateSymbols = (targets: DeskTargets): PreIpoSymbol[] => targets.tokens.map((t) => t.symbol);
