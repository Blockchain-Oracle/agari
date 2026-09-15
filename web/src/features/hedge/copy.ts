/** The hedge card's words (session-lanes.md §4, D-058). The foot is the honest part: devnet, test money, no protection. */
export const HEDGE = {
  eyebrow: "YOUR MAINNET xSTOCKS · READ-ONLY",
  /** "12.5 TSLAx ≈ $4,497 of TSLA exposure this weekend"; without a fresh spot the dollar figure is left out, never zero. */
  line: (tokens: string, exposure: string | null, underlying: string, horizon: string) =>
    exposure === null ? `${tokens} of ${underlying} exposure ${horizon}` : `${tokens} ≈ ${exposure} of ${underlying} exposure ${horizon}`,
  horizon: { weekend: "this weekend", session: "this session", overnight: "tonight" },
  cta: { gap: "Hedge the Monday Gap", down: "Hedge with Down" },
  stake: (amount: string, symbol: string) => `Opens the ticket with ${amount} ${symbol}, 10% of that exposure.`,
  foot: (token: string) => `Placed on Solana devnet with test tUSDC. It does not move, sell or protect your mainnet ${token}. Not investment advice.`,
  aria: (line: string) => `Hedge suggestion: ${line}`,
  dev: {
    title: "Hedge card",
    intro: "The holdings-aware hedge from canned holdings and Windows, then the live card for the connected wallet.",
    gap: "Gap trading — one TSLAx holding, Monday Gap hedge",
    session: "In session — TSLAx + TSLAon, Down on the 1h Window",
    token: "Weekend token lane — NVDAx, Down on the 24/7 Window",
    noPrice: "No fresh spot — shares only, no stake preset",
    none: "No verified holding, or no Window to hedge into — the card is absent",
    live: "Live — your wallet (mainnet read, devnet hedge)",
    liveEmpty: "Connect a wallet that holds TSLAx, NVDAx, SPYx, QQQx or their Ondo tokens to see the live card.",
  },
} as const;
