/**
 * The cockpit's own words (S22, D-127): tab names, the value hero, the gauges and the rule badges. Everything the
 * S21 page already said stays in `copy.ts` and is read from there.
 */
export const COCKPIT_TABS = ["overview", "holdings", "activity", "rules"] as const;
export type CockpitTab = (typeof COCKPIT_TABS)[number];

export const COCKPIT = {
  deskOf: (basket: string) => `${basket} desk`,
  ownMix: "Your own mix",
  tabsAria: "The desk",
  tabs: { overview: "Overview", holdings: "Holdings", activity: "Activity", rules: "Rules" } satisfies Record<CockpitTab, string>,
  actionsAria: "Desk actions",
  more: "More",
  hero: {
    ranges: { "1d": "1D", "1w": "1W", all: "All" } as const,
    rangesAria: "Chart range",
    rangeMove: { "1d": "today", "1w": "this week", all: "since the first check" } as const,
    chartAria: "The desk's value at every check",
    emptyTitle: "Waiting for its first check",
    oneCheck: "The line starts at the second check.",
  },
  check: {
    title: "Next check",
    practice: "Practice checks",
    live: "On Solana mainnet",
  },
  overview: {
    latest: "Latest decision",
    open: "Open the decision",
    noneYet: "No decision yet",
    allocation: "Allocation",
    now: "Now",
    target: "Target",
    ringsAria: "Outer ring: what the desk holds now. Inner ring: the mandate's target.",
    cash: "Cash",
    limits: "Limits in use",
    spent: "Spent today",
    premium: "Highest premium",
    premiumNone: "No name priced",
    drawdown: "From its baseline",
    down: (pct: string) => `${pct} down`,
    up: "at or above",
    stopAt: (pct: string) => `stop at ${pct}`,
    ceiling: (pct: string) => `ceiling ${pct}`,
  },
  holdings: {
    tokens: (amount: string, symbol: string) => `${amount} ${symbol}`,
    now: "Now",
    target: "Target",
    week: "Price, recent checks",
    cashTitle: "USDC",
    cashName: "Cash in the desk",
  },
  rules: {
    title: "Rules",
    program: "Enforced on-chain",
    code: "Enforced by the desk",
    basket: "The basket",
    promise: "The promise",
    edit: "Edit",
  },
  activity: { whole: "See the whole record →" },
} as const;
