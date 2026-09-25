/** The `/desk` entry's words (S22): for a visitor, or a wallet with no desk yet. */
export const ENTRY = {
  eyebrow: "THE DESK · PRACTICE FIRST",
  title: "A desk holds a basket of PreStocks for you.",
  body: "You choose what it holds and the limits. It decides only when, and writes down every check.",
  start: "Create your desk",
  yours: "Your desk",
  see: "See a shared desk",
  noWallet: "No wallet needed until the last step.",
  stepsAria: "How a desk works",
  steps: [
    { title: "Pick a basket", body: "Five ready-made groups, or your own mix." },
    { title: "Set the limits", body: "Per action, per day, and how far above its mark it may pay." },
    { title: "Watch every check", body: "Every check lands on the record, the quiet ones too." },
  ],
  limits: { perAction: (usd: string) => `${usd} per action`, daily: (usd: string) => `${usd} a day`, premium: (pct: string) => `≤ ${pct} over its mark` },
  preview: {
    kicker: "A shared desk",
    open: "Open this desk",
    total: "Total value",
    latest: "Latest check",
    unavailable: "The shared desk could not be read right now.",
    checks: (n: number) => `${n} ${n === 1 ? "check" : "checks"} on the record`,
  },
  notConfiguredTitle: "The desk is not available here",
  notSharedTitle: "This desk is private",
} as const;
