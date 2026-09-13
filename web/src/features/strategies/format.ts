import { bpsToPriceRaw, formatBaseUnits, parseDecimalToBaseUnits } from "@masayume/core/units";
import type { VaultCaps } from "@masayume/core/vault";
import { STRATEGIES } from "./copy";

export type RiskMode = "guarded" | "balanced" | "active";

/** `fmtDusdc` ported: two decimals under a thousand, none above. */
export function money(base: bigint, decimals: number, symbol?: string): string {
  const text = formatBaseUnits(base, decimals);
  return symbol ? `${text} ${symbol}` : text;
}

export function parseAmount(text: string, decimals: number): bigint {
  const clean = text.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean)) return 0n;
  return parseDecimalToBaseUnits(clean, decimals) ?? 0n;
}

export const RISK_MODES: Array<{ id: RiskMode; label: string; detail: string }> = [
  { id: "guarded", label: STRATEGIES.desk.risk.guarded[0], detail: STRATEGIES.desk.risk.guarded[1] },
  { id: "balanced", label: STRATEGIES.desk.risk.balanced[0], detail: STRATEGIES.desk.risk.balanced[1] },
  { id: "active", label: STRATEGIES.desk.risk.active[0], detail: STRATEGIES.desk.risk.active[1] },
];

/**
 * The reference's `riskTerms`, on this vault's caps: the per-trade ceiling the user typed, a daily cap
 * of at least the budget, one or two open positions, and a price ceiling in the guarded modes. The
 * envelope clips every value so a subscribe never fails on a cap the creator never allowed.
 */
export function capsFor(mode: RiskMode, perTradeBase: bigint, budgetBase: bigint, decimals: number, envelope: VaultCaps): VaultCaps {
  const min = (a: bigint, b: bigint) => (a < b ? a : b);
  const perTrade = min(perTradeBase > 0n ? perTradeBase : budgetBase, envelope.maxStakePerTradeBase);
  const daily = min(budgetBase > perTrade ? budgetBase : perTrade, envelope.maxDailySpendBase);
  const open = Math.min(mode === "active" && budgetBase >= perTrade * 2n ? 2 : 1, envelope.maxOpenPositions);
  const wanted = mode === "guarded" ? bpsToPriceRaw(7_000, decimals) : mode === "balanced" ? bpsToPriceRaw(8_500, decimals) : 0n;
  const price = envelope.maxPriceRaw === 0n ? wanted : wanted === 0n ? envelope.maxPriceRaw : min(wanted, envelope.maxPriceRaw);
  return { maxStakePerTradeBase: perTrade, maxDailySpendBase: daily, maxOpenPositions: open, maxPriceRaw: price };
}

/** The join floor (reference `joinFloor`): enough for several trades at what they actually cost now, never just the first. */
export function joinFloorBase(typicalCostBase: bigint, perTradeBase: bigint): bigint {
  const runway = (typicalCostBase * 115n * 3n) / 100n;
  return runway > perTradeBase ? runway : perTradeBase;
}
