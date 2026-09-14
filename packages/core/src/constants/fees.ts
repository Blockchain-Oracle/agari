/**
 * Solana fee and compute constants. Every send simulates first: its compute limit is the simulated units
 * plus a margin, never above the ceiling the sponsor co-sign policy allows (plan §3.2, §3.3).
 */
export const COMPUTE_UNIT_LIMIT_MAX = 400_000;

/** Simulated units × this / 10,000 becomes the transaction's compute-unit limit (+10%). */
export const COMPUTE_MARGIN_BPS = 11_000;

export const LAMPORTS_PER_SOL = 1_000_000_000n;

/** The base fee for each signature on a transaction. */
export const LAMPORTS_PER_SIGNATURE = 5_000n;

/**
 * A wallet paying its own fees must hold this before signing: two signatures (wallet + a co-signer) with room for
 * a retry. Sponsored sends (the `api/sponsor` fee-payer co-sign) need none.
 */
export const FEE_RESERVE_LAMPORTS = 4n * LAMPORTS_PER_SIGNATURE;
