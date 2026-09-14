/**
 * The engine's redeem, mirrored (spec `events-engine.md` §8.2–8.4): a payout vector over 10⁷, win (10⁷, 0),
 * void (5·10⁶, 5·10⁶), floored once. Registration forces `tick_base × 1000 == 10^dec`, so one outcome base unit
 * pays exactly one collateral base unit on a win on every valid grid. Agari charges no settlement fee.
 */
export const PAYOUT_DENOMINATOR = 10_000_000n;

export const PAYOUT_NUMERATOR = { win: 10_000_000n, void: 5_000_000n } as const;

/** Collateral base units a winning or voided holding redeems for: `⌊amountRaw × numerator / 10⁷⌋`, as `user_redeem`. */
export function estPayoutBase(amountRaw: bigint, kind: "win" | "void"): bigint {
  return (amountRaw * PAYOUT_NUMERATOR[kind]) / PAYOUT_DENOMINATOR;
}
