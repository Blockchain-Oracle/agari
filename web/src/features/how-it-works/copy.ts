/**
 * /how-it-works — the words. Ported from `reference/yosuku/app/how-it-works/page.tsx`,
 * with every protocol fact rewritten for DreamDEX Event Contracts on Somnia. The section
 * labels and their order are the reference's; the mechanics named under them are ours.
 */
export const HOW_IT_WORKS = {
  title: "How It Works",
  lead: "Predict where the price closes. Trade UP or DOWN with tUSDC. Settle on-chain.",
  back: "Back to Markets",
  sections: {
    steps: "Getting Started",
    example: "Payout Example",
    mechanics: "Key Mechanics",
    pricing: "How a Price Is Made",
    fees: "Fee Structure",
    settlement: "Settlement Process",
    architecture: "On-Chain Architecture",
    faq: "FAQ",
  },
  /** Doc 05 §No fake-data: an editorial example is labelled as one, never shown as a live quote. */
  exampleTag: "Worked example — not a live quote",
  example: {
    up: "UP price",
    down: "DOWN price",
    max: "Max payout / contract",
    buy: "You buy",
    contracts: "100 UP @ 64¢ each",
    outcome: "BTC closes above the line",
    get: "You get",
    payout: "100 tUSDC",
    profit: "(+36 tUSDC before the settlement fee)",
  },
  formula: {
    identity: "price(DOWN) = 1 − price(UP)",
    cost: "cost = contracts × price",
    payout: "payout if right = contracts × 1.00",
  },
  cta: {
    title: "Ready to predict?",
    body: "Get test tUSDC, pick a side, and see if you can beat the book.",
    action: "Go to Markets",
  },
} as const;
