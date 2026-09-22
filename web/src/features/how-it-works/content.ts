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
      "Each Window is a stock — TSLA, NVDA, AAPL and six more — on a cadence lane the venue lists: 5m, 15m and 1h through the session, the overnight Gap, and the 24/7 token lane. A basket, a small group of pre-IPO companies bet on together, runs on that 24/7 lane too, scored as an index in points rather than a price. The line is the opening print, the signed price recorded at the open of the round.",
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
    answer: "tUSDC, the test collateral the venue mints on Solana devnet. Choose Get test funds from the header or Portfolio: eligible wallets receive a little SOL for fees first, then the tUSDC mint. External SOL faucets are available if needed.",
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

/**
 * Baskets (S19, D-124) and the desk (S21, D-126). Sources: `packages/core/src/market/baskets.ts` (the index in points,
 * base 1,000 at frozen bases, one read of every member), `docs/plan/specs/desk.md` §0 (the promise), §4.5 (the
 * program's checks in order), §8 (needs, the pre-gate, timing, the grade), `packages/core/src/desk/{needs,pregate,
 * timing,gate,record}.ts`, `services/ops/src/actors/desk-runner/` (the wake and its order). These tables run under the
 * desk's banned-word test (`features/desk/copy.test.ts`): no promise, "cover" never "hedge", "mark" for the premium.
 */

export const BASKETS = {
  body: "A basket is a small group of pre-IPO companies followed together: AI Labs (OpenAI, Anthropic), Frontier AI, Prediction Markets, Defense & Space, and All PreStocks. Each is scored as one equal-weight index in points, base 1,000 at prices frozen when the basket was listed, computed from one PreStocks read of every member. A basket Window is an ordinary one-hour Window on the 24/7 lane: UP if the index closes at or above its opening print, DOWN below. If any member is missing from the read, the Window voids rather than settle on a mixture.",
  uses: [
    ["Predict", "an Up/Down Window on the index, with test money"],
    ["Cover", "hold two or more members and one Down bet covers the basket, sized at 10% of what you hold"],
    ["Hold", "a desk keeps the basket for you, with real money on Solana mainnet, inside limits you set"],
  ] as const satisfies readonly [string, string][],
} as const;

export type DeskStepKind = "arithmetic" | "ai" | "program";

export interface DeskStep {
  step: string;
  label: string;
  desc: string;
  /** Which kind of work the step is: plain arithmetic, the one model call, or the program on Solana. */
  kind: DeskStepKind;
}

/** The order the desk works in on every wake; nine of the ten steps are arithmetic, and one is a question. */
export const DESK_STEPS: readonly DeskStep[] = [
  { step: "1", label: "It wakes", kind: "arithmetic", desc: "Every hour on the hour, around the clock, and also when money arrives, when a held company moves 3% within an hour, or when you press Check now. Every wake ends in a written decision, even when nothing was done." },
  { step: "2", label: "It reconciles", kind: "arithmetic", desc: "It compares the chain's sequence number and sealed head with its own record before trusting either. Money that arrived from outside re-bases the loss limit; a holding PreStocks has paused or frozen stops the desk." },
  { step: "3", label: "It values the desk", kind: "arithmetic", desc: "Cash plus every priced holding, at the half-hour average of the venue's own attested prices. A holding with no price is listed, never valued at zero, and never traded." },
  { step: "4", label: "It checks your loss limit", kind: "arithmetic", desc: "If the desk is worth more than your limit below its baseline, it stops everything and tells you. Nothing else runs that hour." },
  { step: "5", label: "It finds what drifted", kind: "arithmetic", desc: "Which holdings sit further from their target than you allow, and at least 5.5% because a trade costs about 1.1% each way. Sales first, then buys, largest drift first; a buy never takes cash below your cash target." },
  { step: "6", label: "It runs the pre-gate", kind: "arithmetic", desc: "Eleven rules that can stop a candidate before any question is asked: the desk is not active, the name is not allowed, the venue's price is missing or stale, the name is above your premium ceiling, there is no quote at your size, the quote is more than 8% from the venue's price, the price is moving fast, transfers are paused, the account is frozen, the route is too large, or it did the same thing minutes ago." },
  { step: "7", label: "It asks one question", kind: "ai", desc: "Timing, and only timing: given the evidence, do the whole action now, part of it (25, 50 or 75%), wait, or decline? The answer must fit a strict shape; a promise, a forbidden word or a malformed answer is thrown away and the desk does nothing that hour. The model never chooses what to hold, and never more than the candidate it was shown." },
  { step: "8", label: "It runs the limits check", kind: "arithmetic", desc: "Plain arithmetic that mirrors the program, rounding included: your caps, the floor on what must come back, the premium ceiling, a gap of at most 3% from the price's own average and a cost of at most 2.5%. What the chain would refuse is never sent." },
  { step: "9", label: "It writes first, then acts", kind: "program", desc: "The record is written and fingerprinted before anything moves. A practice desk moves its paper ledger at the quote net of PreStocks' 1% fee. A live desk posts the venue's attested price, then sends the buy or sell; the program on Solana checks its own list in order and seals the fingerprint in the same transaction, or refuses the whole thing." },
  { step: "10", label: "It grades itself a day later", kind: "arithmetic", desc: "The timing it chose against acting at once, from the hourly prices since. Under 0.25% is “no real difference”. Neutral both ways, never a win stamp." },
];

/** What the `agari-desk` program checks on chain, whatever the desk decided (`desk.md` §0, §4.5). */
export const DESK_PROGRAM_ENFORCES: readonly [string, string][] = [
  ["Your money", "only you can withdraw, and only to your own wallet's account of that mint"],
  ["Caps", "a cap per action and a cap per fixed 24-hour window, counted on chain"],
  ["Names", "only the companies you allowed can be bought; a disallowed one can still be sold"],
  ["The reference", "a venue-attested price no older than 15 minutes, or nothing trades"],
  ["The premium", "a buy may not pay more than your ceiling above the PreStocks mark, or above Pyth's valuation index if you require it"],
  ["The band", "at least 92% of the fair amount must come back, or the transaction fails"],
  ["Exact spend", "the desk's balance must change by exactly the amount sent, and a desk account slipped into the route fails the trade"],
  ["The record", "every action, the did-nothing checkpoint included, advances a sealed hash chain in the same transaction"],
];

/** The promise's other half: what no instruction, mode or model answer can make the desk do. */
export const DESK_NEVER: readonly [string, string][] = [
  ["Withdraw", "it has no instruction that pays anyone but you"],
  ["Choose what you hold", "the basket, the weights and the cash sleeve are yours; it decides only when"],
  ["Trade past a limit", "the chain refuses it before any money moves, whatever the desk decided"],
  ["Act on a stale price", "no fresh attested reference, no trade"],
  ["Spend in practice", "a practice desk moves a paper ledger and never sends a transaction"],
  ["Promise a return", "its words are checked against a banned list before they reach you"],
  ["Hide a quiet check", "every “nothing to do” is written down; those are the proof it was awake"],
];
