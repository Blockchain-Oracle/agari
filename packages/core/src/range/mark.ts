import { PAIR_TICKS } from "../orders/resting-quote";

/**
 * The venue's mark on the maths' scale (mirrors `center_q_e6_of` in `agari-range`).
 *
 * A YES tick is P(close ≥ open) in thousandths: the grid runs 1..999 of `PAIR_TICKS`. The band maths works in
 * millionths, so the factor is `1e6 / PAIR_TICKS`. It is derived from the grid rather than restated because it was
 * once restated wrong, as 100, in the program, the page's read and the drive at once: all three agreed with each
 * other, so the quotes matched, and every round was priced as if a 65.0¢ market were a 6.5% one.
 */
export const YES_TICK_TO_E6 = 1_000_000n / BigInt(PAIR_TICKS);

export function centerQE6OfTicks(lastPriceTicks: bigint | number): bigint {
  return BigInt(lastPriceTicks) * YES_TICK_TO_E6;
}
