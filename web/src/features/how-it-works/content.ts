import {
  ClockIcon,
  CoinsIcon,
  EyeOffIcon,
  LockIcon,
  ShieldIcon,
  TargetIcon,
  TrendingUpIcon,
  TrophyIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * The page's content, as data — the reference keeps `steps`, `mechanics` and `faqs` as
 * arrays inside the component; they live here so each fact can carry its source.
 *
 * Sources (asserted, not assumed): `context/01-dreamdex-event-contracts.md` (the protocol),
 * `packages/core/src/claims/payout.ts` (payout rule), `packages/core/src/lifecycle/headroom.ts`
 * and `constants/timing.ts` (no-entry buffer), `packages/core/src/copy/question.ts` (what UP
 * means), `packages/markets/src/submitter/steps/send.ts` (IOC takers), `packages/markets/src/
 * provider/fees.ts` (the fee is read from chain), `packages/core/src/constants/faucet.ts`.
 */

export type Tone = "mint" | "blue";

export interface Step {
  number: number;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
}

export const STEPS: readonly Step[] = [
  {
    number: 1,
    title: "Connect & Fund",
    description:
      "Connect any EVM wallet on Somnia Shannon testnet. Get test funds adds STT to eligible wallets, then asks you to confirm a 10,000 tUSDC mint from the venue’s faucet. STT pays network fees.",
    icon: CoinsIcon,
    tone: "mint",
  },
  {
    number: 2,
    title: "Pick a Window",
    description:
      "Each Window is an asset — BTC or ETH today — on a cadence lane the venue lists: 5m, 15m, 1h, 4h, 1d. The line is the opening print, the oracle's own first price of the round.",
    icon: TargetIcon,
    tone: "blue",
  },
  {
    number: 3,
    title: "Trade UP or DOWN",
    description:
      "Go UP if the Window closes at or above its opening print, DOWN if below. Stake in tUSDC and see the exact quote for your size before you sign.",
    icon: ZapIcon,
    tone: "mint",
  },
  {
    number: 4,
    title: "Collect Payout",
    description:
      "When the Window closes the oracle prints the close. Winning contracts redeem for 1 tUSDC each less the settlement fee; losing contracts pay 0; a void pays 0.5 to both sides. Collect it on the Window's result, or everything at once from Portfolio.",
    icon: TrophyIcon,
    tone: "blue",
  },
];

export interface Mechanic {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const MECHANICS: readonly Mechanic[] = [
  {
    title: "Order-Book Pricing",
    description:
      "A fully on-chain limit order book. UP and DOWN are the two sides of one book, and a UP buy and a DOWN buy can match into a freshly minted complete set — no house takes the other end of your trade.",
    icon: CoinsIcon,
  },
  {
    title: "Live Price",
    description:
      "The chart plots the same oracle feed the Window settles on, so the distance to the line is the distance that matters. A stale tick is shown frozen, never as live.",
    icon: TrendingUpIcon,
  },
  {
    title: "Fast Rounds",
    description:
      "Windows run back to back on fixed cadences. Entries close inside a no-entry buffer before expiry — 40% of the round, never under 30 s or over 5 min — so a call cannot be made after the answer is in.",
    icon: ClockIcon,
  },
  {
    title: "On-Chain Settlement",
    description:
      "Positions are ERC-6909 outcome tokens on Somnia, settled by the DreamDEX contracts with sub-second finality. Every fill, settlement and redemption is a transaction anyone can open.",
    icon: ShieldIcon,
  },
];

/** The real quote fields — `Quote` in `packages/core/src/types/trading.ts`. */
export const QUOTE_FIELDS: readonly [string, string][] = [
  ["stake", "what you put in"],
  ["contracts", "how many the book fills for that stake"],
  ["avg price", "the average fill across the book's levels"],
  ["max cost", "escrow locked at the protective limit — a fill can never cost more"],
  ["payout if right", "contracts × 1.00, before the settlement fee"],
  ["odds", "the price of UP in cents — the market's probability"],
];

export interface FeeItem {
  title: string;
  body: string;
}

export const FEES: readonly FeeItem[] = [
  {
    title: "Settlement Fee",
    body: "A basis-point skim on winning contracts at redemption, set by the venue per market and read from chain at use time — never assumed. It is printed on every receipt. A void pays 0.5 per side with no fee.",
  },
  {
    title: "Trading Fees",
    body: "DreamDEX runs at zero maker and taker fees today; the protocol supports them and the venue sets 0. Your only cost of entry is the price you pay per contract.",
  },
  {
    title: "Total Cost",
    body: "Cost per contract = the book price. Winning contracts pay 1.00 less the settlement fee, so a contract bought under 1.00 always profits if it is right.",
  },
];

export interface SettlementStep {
  step: string;
  label: string;
  desc: string;
}

export const SETTLEMENT_STEPS: readonly SettlementStep[] = [
  { step: "1", label: "Window Closes", desc: "The round reaches its scheduled expiry." },
  { step: "2", label: "Oracle Prints", desc: "The Somnia oracle hub answers the settlement question; its resolution graph is linked from every receipt." },
  { step: "3", label: "Settlement", desc: "The DreamDEX binary settlement contract compares the close with the opening print and resolves the Window. If no reliable print arrives inside the settlement window, anyone can void it." },
  { step: "4", label: "Payout", desc: "Winning contracts redeem for 1 tUSDC less the settlement fee. Redemption is a contract call you make — on the Window's result, or everything at once from Portfolio." },
];

export interface ArchitectureCard {
  title: string;
  body: string;
  icon: LucideIcon;
}

export const ARCHITECTURE: readonly ArchitectureCard[] = [
  {
    title: "Transparent Positions",
    body: "Your side and size are ERC-6909 outcome tokens on Somnia — one shared token contract, one id per side of each Window. Every position is verifiable in the explorer.",
    icon: EyeOffIcon,
  },
  {
    title: "Instant Finality",
    body: "Somnia confirms in under a second, so a fill is final almost as soon as you sign, and settlement lands the moment the oracle prints.",
    icon: LockIcon,
  },
  {
    title: "Smart-Contract Settlement",
    body: "The DreamDEX contracts hold the collateral, resolve the Window from the oracle's answer and pay redemptions. No middleman, and permissionless backstops so funds can never strand.",
    icon: ShieldIcon,
  },
];

export interface Faq {
  question: string;
  answer: string;
}

export const FAQS: readonly Faq[] = [
  {
    question: "What currency does Masayume use?",
    answer: "tUSDC, the test collateral DreamDEX Event Contracts use on Somnia Shannon. Choose Get test funds from the header or Portfolio. Eligible wallets receive STT for gas first, then you confirm the tUSDC mint. External STT faucets are available if needed.",
  },
  {
    question: "How is the outcome decided?",
    answer: "When the Window closes, the Somnia oracle prints the closing price. Close at or above the opening print and UP wins; below it and DOWN wins. The contract does the comparison; the oracle's resolution graph is linked from the receipt.",
  },
  {
    question: "How much do I win?",
    answer: "Each winning contract redeems for 1 tUSDC less the settlement fee; a losing contract pays 0; a void pays 0.5 per contract to both sides. Your cost is the book price you paid, so profit is payout minus cost.",
  },
  {
    question: "What wallet do I need?",
    answer: "Any EVM wallet. The connect dialog offers your browser wallet, Rabby and Brave, plus MetaMask, Rainbow and WalletConnect where a WalletConnect project is configured. Masayume never holds a key.",
  },
  {
    question: "Is this real money?",
    answer: "No. Masayume runs on Somnia Shannon testnet with tUSDC from a faucet. Nothing here is worth anything off the testnet.",
  },
  {
    question: "How does Masayume ensure fair pricing?",
    answer: "It doesn't set prices at all. Every quote is read off DreamDEX's open on-chain order book for your exact size, and orders go in immediate-or-cancel at a protective limit, so a fill can never cost more than the quote you confirmed.",
  },
  {
    question: "Can I sell a position before settlement?",
    answer: "The venue allows it — a position can be sold back to the book at the live price. Masayume's cash-out control is not connected yet; until it is, a position is held to the close and redeemed.",
  },
];
