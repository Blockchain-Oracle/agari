/**
 * The hedge stake preset (session-lanes.md §4, Q-S6-8): `min(exposure × HEDGE_BPS / 10⁴, ticket max, tUSDC balance)` in
 * collateral base units, all integers. The exposure is USD × 10⁶ of mainnet shares; the stake is devnet test tUSDC, so
 * "10% of exposure" is a size, never a claim that the devnet position protects the mainnet one.
 */

export const HEDGE_BPS = 1_000n;
const BPS_DENOMINATOR = 10_000n;
const USD_E6 = 10n ** 6n;

export interface HedgeSizeInput {
  /** USD × 10⁶ of the holding's underlying; null when ops had no fresh spot. */
  exposureUsdE6: bigint | null;
  /** The collateral's decimals (tUSDC: 6). */
  decimals: number;
  /** A ceiling the ticket imposes, in base units; null = none (the book names what it can fill). */
  ticketMaxBase: bigint | null;
  /** Wallet spendable plus venue credit, in base units; null until the balance sheet answers. */
  balanceBase: bigint | null;
}

/** USD × 10⁶ → base units at `decimals`, floored (one tUSDC = one US dollar of size). */
export function usdE6ToBase(usdE6: bigint, decimals: number): bigint {
  return (usdE6 * 10n ** BigInt(decimals)) / USD_E6;
}

/** The preset, or null when there is nothing honest to put in the box (no price, no balance, or it floors to zero). */
export function hedgeStakeBase({ exposureUsdE6, decimals, ticketMaxBase, balanceBase }: HedgeSizeInput): bigint | null {
  if (exposureUsdE6 === null || balanceBase === null) return null;
  let stake = usdE6ToBase((exposureUsdE6 * HEDGE_BPS) / BPS_DENOMINATOR, decimals);
  if (ticketMaxBase !== null && ticketMaxBase < stake) stake = ticketMaxBase;
  if (balanceBase < stake) stake = balanceBase;
  return stake > 0n ? stake : null;
}
