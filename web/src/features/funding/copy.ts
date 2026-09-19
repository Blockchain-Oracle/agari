/**
 * What the money is, said once (the owner's 2026-09-19 note: the unit read as "USDC", nothing said whether bets were
 * in SOL, Circle's USDC or something of our own). Every surface that names the unit points at these words.
 */
export const MONEY = {
  /** A tooltip's worth, for the unit wherever it stands alone. */
  short: "tUSDC is Agari's test dollar on Solana devnet. It is free from the faucet and 1 tUSDC stands for $1. SOL only pays network fees.",
  title: "What is tUSDC?",
  points: [
    { k: "You bet in tUSDC", v: "Every stake, price and payout is in tUSDC, a test dollar Agari mints on Solana devnet. A winning contract pays 1 tUSDC, so a price of 64¢ reads as a 64% chance." },
    { k: "Not SOL", v: "Stocks are priced in dollars. A bet held in SOL would also be a bet on SOL's own price. SOL is only used for network fees." },
    { k: "Not Circle's USDC", v: "Circle hands out its devnet USDC in small amounts from its own site, so it could not fund you here in one tap. tUSDC is Agari's own mint. It has no value anywhere, and the venue's collateral is one setting that a mainnet launch would point at real USDC." },
  ],
} as const;

/** Test funds: a bounded devnet SOL treasury for fees and a server-sent tUSDC mint, both behind one free signature (D-034). */
export const FUNDING = {
  pill: {
    title: `${MONEY.short} Tap to add more.`,
    unit: (symbol: string) => symbol,
    plus: "+",
    aria: "Your balance — tap to add money",
  },
  modal: {
    eyebrow: "Add funds · devnet",
    title: "Get test funds",
    body: "SOL pays network fees. We add a little first when your wallet is below 0.005 SOL, then add free tUSDC for trading. One free signature covers both. You can start with an empty wallet.",
    sequence: (amount: string, symbol: string) => `1. Add SOL if needed → 2. Add ${amount} ${symbol}`,
    gasPolicy: "Below 0.005 SOL: top up to 0.02 SOL, at most once per 24 hours while funds last. With enough SOL, skip straight to tUSDC.",
    connectFirst: "Connect a wallet first.",
    account: "Your account",
    copied: "copied ✓",
    request: (_amount: string, _symbol: string) => "Get test funds",
    requesting: "Adding test tUSDC…",
    done: (amount: string, symbol: string) => `${amount} ${symbol} added to your wallet.`,
    trade: "Trade from wallet →",
    close: "Close add funds",
    needMore: "External SOL faucets ↗",
    gasFirst: "Need SOL for fees while our allocation is unavailable? Use an external faucet:",
  },
  welcome: {
    eyebrow: "You're funded",
    title: (amount: string, symbol: string) => `${amount} ${symbol} is in your wallet`,
    body: "On the house. These are devnet play chips, not real money. You're ready to take your first side.",
    cta: "Let's go →",
    close: "Close",
  },
} as const;

/** The reference's `yosuku:open-funds` / `yosuku:credited`, under our name. Anything may open the modal; only a credit fires the welcome. */
export const OPEN_FUNDS_EVENT = "agari:open-funds";
export const CREDITED_EVENT = "agari:credited";
