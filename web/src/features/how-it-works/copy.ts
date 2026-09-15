/**
 * /how-it-works — the words. The page is Masayume's, section for section; every protocol fact under those headings
 * is Agari's (`anchor/programs/agari-events`, `services/ops/config/price-sources.json`), and two sections Masayume's
 * 24/7 venue had no use for — sessions and lanes, halts and voids — are added in its own grammar (D-081, D-093).
 */
export const HOW_IT_WORKS = {
  title: "How It Works",
  lead: "Call where a stock closes its Window. Trade UP or DOWN with tUSDC. Settle on a signed price, on-chain.",
  back: "Back to Markets",
  sections: {
    steps: "Getting Started",
    example: "Payout Example",
    sessions: "Sessions & Lanes",
    mechanics: "Key Mechanics",
    pricing: "How a Price Is Made",
    fees: "Fee Structure",
    settlement: "Settlement Process",
    asides: "Halts, Voids & Your Money",
    architecture: "On-Chain Architecture",
    faq: "FAQ",
  },
  /** The lead of the Agari-only section: stocks have a clock, and the clock is the product. */
  sessionsLead:
    "A stock exchange keeps hours, so the venue does too. Windows are listed in three lanes on the NYSE clock, and which lanes are on the board right now depends on the hour you are reading this.",
  sessionWordsTitle: "What the clock says",
  sessionWordsBody:
    "The session chip, the marquee and every card say the same word about the hour, with a countdown to the boundary that matters. Nothing is ever just “closed”.",
  /** Doc 05 §No fake-data: an editorial example is labelled as one, never shown as a live quote. */
  exampleTag: "Worked example — not a live quote",
  example: {
    up: "UP price",
    down: "DOWN price",
    max: "Max payout / contract",
    buy: "You buy",
    contracts: "100 UP @ 64¢ each",
    outcome: "TSLA closes at or above the line",
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
