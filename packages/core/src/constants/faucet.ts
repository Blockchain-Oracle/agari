/** The venue's per-call cap on the tUSDC faucet, in whole units. */
export const FAUCET_UNITS = 100_000n;

/** Where to send a wallet with no devnet SOL for fees, in preference order. */
export const SOL_FAUCETS = [
  { name: "Solana devnet faucet", url: "https://faucet.solana.com/" },
] as const;
