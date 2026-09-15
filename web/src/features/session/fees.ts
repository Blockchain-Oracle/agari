import { LAMPORTS_PER_SIGNATURE } from "@agari/core/constants";

/** SOL has 9 decimals: 1 SOL = 10⁹ lamports. */
export const SOL_DECIMALS = 9;

/** One tap from the session key: one signature's base fee (devnet charges no compute-unit price by default). */
export const LAMPORTS_PER_TAP = LAMPORTS_PER_SIGNATURE;

/** What the enable transaction moves to a key that pays its own fees: 0.01 SOL, 2,000 taps at the base fee. */
export const SESSION_KEY_TOPUP_LAMPORTS = 10_000_000n;
