/** The venue's per-call cap on the tUSDC faucet, in whole units. */
export const FAUCET_UNITS = 10_000n;

/** Where to send a wallet with no STT for gas, in preference order. */
export const STT_FAUCETS = [
  { name: "Somnia testnet faucet", url: "https://testnet.somnia.network/" },
  { name: "Google Cloud Web3 faucet", url: "https://cloud.google.com/application/web3/faucet/somnia/shannon" },
  { name: "Stakely faucet", url: "https://stakely.io/faucet/somnia-testnet-stt" },
] as const;
