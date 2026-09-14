import { LAMPORTS_PER_SIGNATURE } from "@agari/core/constants";

/** SOL has 9 decimals: 1 SOL = 10⁹ lamports. */
export const SOL_DECIMALS = 9;

/** One tap from the session key: one signature's base fee (devnet charges no compute-unit price by default). */
export const LAMPORTS_PER_TAP = LAMPORTS_PER_SIGNATURE;

/** What the enable flow moves to a key that pays its own fees: 0.01 SOL, 2,000 taps at the base fee. */
export const SESSION_KEY_TOPUP_LAMPORTS = 10_000_000n;

/** Honest refusal until the vault program and the fee-payer co-sign exist (S7): the key can't be funded or read yet. */
export const KEY_FEES_UNAVAILABLE = "SOL top-ups for the session key arrive with the Trading Balance program";
