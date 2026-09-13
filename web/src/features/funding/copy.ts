/** Test funds use a bounded STT treasury and a separate wallet-signed tUSDC mint. */
export const FUNDING = {
  pill: {
    title: "Tap to add money.",
    unit: (symbol: string) => symbol,
    plus: "+",
    aria: "Your balance — tap to add money",
  },
  modal: {
    eyebrow: "Add funds · testnet",
    title: "Get test funds",
    body: "STT pays for transactions. We add it first when your wallet is below 1 STT, then you confirm the free tUSDC claim for trading. You can start with an empty wallet.",
    sequence: (amount: string, symbol: string) => `1. Add STT if needed → 2. Claim ${amount} ${symbol}`,
    gasPolicy: "Below 1 STT: top up to 2 STT, at most once per 24 hours while funds last. With enough STT, skip straight to tUSDC.",
    connectFirst: "Connect a wallet first.",
    account: "Your account",
    copied: "copied ✓",
    request: (_amount: string, _symbol: string) => "Get test funds",
    requesting: "Minting…",
    done: (amount: string, symbol: string) => `${amount} ${symbol} added to your wallet.`,
    trade: "Trade from wallet →",
    close: "Close add funds",
    needMore: "External STT faucets ↗",
    gasFirst: "Need gas while our allocation is unavailable? Use an external faucet:",
  },
  welcome: {
    eyebrow: "You're funded",
    title: (amount: string, symbol: string) => `${amount} ${symbol} is in your wallet`,
    body: "On the house. These are testnet play chips, not real money. You're ready to take your first side.",
    cta: "Let's go →",
    close: "Close",
  },
} as const;

/** The reference's `yosuku:open-funds` / `yosuku:credited`, under our name. Anything may open the modal; only a credit fires the welcome. */
export const OPEN_FUNDS_EVENT = "masayume:open-funds";
export const CREDITED_EVENT = "masayume:credited";
