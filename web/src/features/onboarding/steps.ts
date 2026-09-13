/**
 * The first-run walkthrough — ported from reference/yosuku/components/Tutorial.tsx (L19–41).
 *
 * Five screens, in the reference's own order and job: what this is, how a round
 * works, the account that signs, where the money sits, and one closing choice
 * that ends on connecting. The prose is rewritten because the reference's is
 * about a different chain and a capability set Masayume has not built yet:
 *
 *  - Sui/zkLogin/Google sign-in and sponsored gas → Somnia, and every order is a
 *    transaction the user approves themselves. There is no sponsorship today.
 *  - The reference's "Trading Balance" is its on-chain vault. Masayume's
 *    `EventVault` is Stage 4, so step 4 describes the pools that *do* exist:
 *    spendable, order escrow, venue payout credit (the same three the balance
 *    plate labels).
 *  - Fixed 1m/5m/1h cadences → whatever the venue is running, since lanes derive
 *    from live `intervalSec`.
 *
 * Copy lives here rather than in `lib/copy.ts` because it is a five-screen
 * narrative, not a label table — and copy.ts is near the 400-line cap.
 */

export interface TutorialStep {
  readonly title: string;
  readonly description: string;
  /** The closing screen: pick how markets read, then connect. Never auto-advances. */
  readonly choice?: true;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    title: "Welcome to Masayume",
    description:
      "A prediction market on Somnia. Pick a side of a live Window, and the venue's oracle settles it at the close — the price decides, nobody else. This is the Shannon testnet: test funds only, no real money.",
  },
  {
    title: "How a Window works",
    description:
      "A Window opens at a print and settles on the oracle price at its close. Some run every few minutes, some once a day — whatever the venue is listing. Tap UP or DOWN. Each side is its own contract with its own live price from the book, so the two sides do not add up to $1. The ticket shows the exact cost before you sign.",
  },
  {
    title: "Your wallet signs",
    description:
      "Connect any Somnia wallet and choose Get test funds. Eligible wallets receive STT for gas before you confirm the test tUSDC mint. Nothing here holds your funds and nothing signs on your behalf — every order is a transaction you approve yourself.",
  },
  {
    title: "Where your money sits",
    description:
      "One number is spendable: what you can bet right now. Every other pool is labelled beneath it and never added in — tUSDC locked in resting orders until they fill or you cancel, and venue payout credit, which is spent first on your next buy in that same Window.",
  },
  {
    title: "How should markets read?",
    description: "Switch anytime with the Plain words toggle above the live Windows.",
    choice: true,
  },
];

export const TUTORIAL_UI = {
  close: "Close",
  skip: "Skip",
  next: "Next",
  done: "Get started",
  lastStep: "Last step",
  connectTitle: "Connect to start trading",
  connectNote: "Any Somnia wallet. Testnet, so these are test funds — and you sign every transaction yourself.",
  progress: (step: number, total: number) => `Step ${step} of ${total}`,
} as const;
