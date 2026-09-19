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
 * Sources (asserted, not assumed): `anchor/programs/agari-events/src/instructions/resolve_rules.rs`
 * (the settle and void decisions, PD-3's tie rule), `docs/plan/specs/prints.md` §2-§6 and
 * `services/ops/config/price-sources.json` (which signed source, and its thresholds),
 * `packages/core/src/claims/payout.ts` (payout rule), `packages/core/src/lifecycle/headroom.ts`
 * and `constants/timing.ts` (no-entry buffer), `packages/core/src/copy/question.ts` (what UP
 * means), `packages/markets/src/submitter/steps/send.ts` (IOC takers), `packages/markets/src/
 * provider/fees.ts` (the fee is read from chain), `packages/core/src/constants/faucet.ts`.
 * The lane, session, halt and void facts live next door in `sessions.ts`.
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
      "Connect any Solana wallet — Phantom, Solflare, Backpack — on devnet. Get test funds sends a little SOL for fees when your wallet is short, then mints the venue’s test tUSDC to you in one signature. SOL pays network fees.",
    icon: CoinsIcon,
    tone: "mint",
  },
  {
    number: 2,
    title: "Pick a Window",
    description:
      "Each Window is a stock — TSLA, NVDA, AAPL and six more — on a cadence lane the venue lists: 5m, 15m and 1h through the session, the overnight Gap, and the 24/7 token lane. The line is the opening print, the signed price recorded at the open of the round.",
    icon: TargetIcon,
    tone: "blue",
  },
  {
    number: 3,
    title: "Trade UP or DOWN",
    description:
      "Go UP if the Window closes at or above its opening print, DOWN if below — a close exactly on the line pays UP. Stake in tUSDC and see the exact quote for your size before you sign.",
    icon: ZapIcon,
    tone: "mint",
  },
  {
    number: 4,
    title: "Collect Payout",
    description:
      "When the Window closes, a signed price for that second is recorded on it. Winning contracts redeem for 1 tUSDC each less the settlement fee; losing contracts pay 0; a void pays 0.5 to both sides. Collect it on the Window's result, or everything at once from Portfolio.",
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
      "The chart plots the same feed the Window settles on, so the distance to the line is the distance that matters. A tick that has stopped is shown frozen with its age, never as live.",
    icon: TrendingUpIcon,
  },
  {
    title: "Fast Rounds",
    description:
      "Windows run back to back on fixed cadences while their lane is awake. Entries close inside a no-entry buffer before expiry — 40% of the round, never under 30 s or over 5 min — so a call cannot be made after the answer is in.",
    icon: ClockIcon,
  },
  {
    title: "On-Chain Settlement",
    description:
      "Positions are seats on the Window’s ledger, an account the agari-events program owns on Solana. Every fill, settlement and redemption is a transaction anyone can open on the explorer.",
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
    body: "The venue runs at zero maker and taker fees today; the program supports them and the venue sets 0. Your only cost of entry is the price you pay per contract.",
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
  { step: "1", label: "Window Closes", desc: "The round reaches its scheduled expiry — the second its settlement price is asked about." },
  { step: "2", label: "The Print Is Recorded", desc: "A signed price for that exact second is posted to the Window and verified on-chain: Pyth's own signature, or a RedStone package that at least 3 of 5 configured signers put their names to. Anyone may post it, and nobody can post a price the program has not checked." },
  { step: "3", label: "Settlement", desc: "The agari-events program compares the closing print with the opening one. Close at or above the open pays UP, and a close exactly on the line pays UP; anything below pays DOWN. Where the policy names a second source, both boundaries are cross-checked first and a gap wider than 25 bps voids the Window instead." },
  { step: "4", label: "Payout", desc: "Winning contracts redeem for 1 tUSDC less the settlement fee. Redemption is a program call you make — on the Window's result, or everything at once from Portfolio — and an unclaimed seat is cranked so nothing strands." },
];

export interface ArchitectureCard {
  title: string;
  body: string;
  icon: LucideIcon;
}

export const ARCHITECTURE: readonly ArchitectureCard[] = [
  {
    title: "Transparent Positions",
    body: "Your side and size are a seat on the Window’s ledger — one account per Window, one seat per wallet, each side’s contracts counted on it. Every position is verifiable on the explorer.",
    icon: EyeOffIcon,
  },
  {
    title: "Instant Finality",
    body: "Solana confirms in about a second, so a fill is final almost as soon as you sign, and settlement lands as soon as the closing print is on the Window.",
    icon: LockIcon,
  },
  {
    title: "Program Settlement",
    body: "The agari-events program holds the collateral, resolves the Window from the recorded print and pays redemptions. No middleman, and permissionless cranks so funds can never strand.",
    icon: ShieldIcon,
  },
];

export interface Faq {
  question: string;
  answer: string;
}

export const FAQS: readonly Faq[] = [
  {
    question: "What currency does Agari use?",
    answer: "tUSDC, a test dollar the venue mints on Solana devnet: every stake, price and payout is in it, and a winning contract pays 1 tUSDC. Choose Get test funds from the header or Portfolio: eligible wallets receive a little SOL for fees first, then the tUSDC mint. External SOL faucets are available if needed.",
  },
  {
    question: "Why not bet in SOL, or in Circle's USDC?",
    answer: "Stocks are priced in dollars, so the bet is too: a stake held in SOL would also be a bet on SOL's own price. SOL only pays network fees here. Only Circle can mint USDC, so Agari's faucet could not hand it out; tUSDC is Agari's own mint, which is how one signature funds a new wallet and how the house maker stays funded to quote every Window. It is worth nothing anywhere. The venue's collateral is a single setting, and a mainnet launch would point it at real USDC.",
  },
  {
    question: "When can I trade?",
    answer: "Regular Windows run while US markets are open, 09:30 to 16:00 ET on a trading day. The Gap Window covers the weekend, from Friday's close to Monday's open. The token lane, on tokenised stock, never closes. The session chip says which of those the hour is, and counts down to the next boundary.",
  },
  {
    question: "Can I make a call while the market is closed?",
    answer: "Yes. The venue lists the next session's first Windows at the close, and a call on one rests post-only at your price. Nothing fills before the open boundary; if the book comes to you in the first minute after the bell, it fills at your price, and if it doesn't the stake returns as venue credit. You can also choose to let it rest until the Window locks.",
  },
  {
    question: "How is the outcome decided?",
    answer: "When the Window closes, a signed price for that second is recorded on it. Close at or above the opening print and UP wins — a tie pays UP too; below it and DOWN wins. The program does the comparison, and the receipt links both prints with the source and signer count that backed them.",
  },
  {
    question: "How much do I win?",
    answer: "Each winning contract redeems for 1 tUSDC less the settlement fee; a losing contract pays 0; a void pays 0.5 per contract to both sides. Your cost is the book price you paid, so profit is payout minus cost.",
  },
  {
    question: "What wallet do I need?",
    answer: "Any Solana wallet that speaks the Wallet Standard — Phantom, Solflare, Backpack and the rest. Agari never holds a key.",
  },
  {
    question: "Is this real money?",
    answer: "No. Agari runs on Solana devnet with tUSDC from the venue's own faucet. Nothing here is worth anything off devnet, and there is no way to move it off.",
  },
  {
    question: "How does Agari ensure fair pricing?",
    answer: "It doesn't set prices at all. Every quote is read off the venue's open on-chain order book for your exact size, and orders go in immediate-or-cancel at a protective limit, so a fill can never cost more than the quote you confirmed.",
  },
  {
    question: "Can I sell a position before settlement?",
    answer: "Yes, until the Window locks. Cash out on an open bet sells it back to the book immediate-or-cancel, at the best bids there are right now and never below the floor it shows. If nobody is bidding it says there is no exit liquidity and nothing is sold. Once the Window locks a position can't be sold; it pays at settlement.",
  },
];
