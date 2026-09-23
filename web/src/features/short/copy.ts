import { LEVERAGE_NOT_DEPLOYED } from "@agari/core/leverage";

/**
 * `/short` — A-1b, the inverse position.
 *
 * The reference has no short: its leverage is a chip inside the Up/Down ticket and a row in the portfolio's bet
 * list, which frames a boost as amplifying a call held to the bell. Nothing here overrides those words — the
 * ticket's chips and `LeverageBetRow` keep the reference's copy exactly. These are the words for the surface the
 * reference does not have, in the venue's own voice.
 *
 * The premium and the knock-out line are the reserve's parameters, not constants, so every sentence that names
 * one takes it from the reserve that is actually deployed.
 */
export const SHORT = {
  title: "Short",
  eyebrow: "Sell the fall · exit whenever",
  lede: "A short here is a Down position the reserve holds for you. It is marked against the book every second, you can close it at any time, and the most you can lose is what you put in.",
  sections: {
    open: { number: "01", title: "Open a short", desc: "Pick the stock, pick the window, size it. The reserve prices it against its own book before you sign." },
    positions: { number: "02", title: "Your shorts", desc: "What each one is worth right now, and how far it is from the line it knocks out at." },
    how: { number: "03", title: "How a short works here" },
  },

  picker: {
    stock: "What to short",
    window: "How long",
    noneTitle: "Nothing listed to short yet",
    noneBody: "Windows appear here as the venue lists them, with the time each one opens.",
    filterAria: "Show",
    filter: { all: "All", stock: "Stocks", allDay: "24/7" },
    cadenceAria: "Window length",
    kind: { stock: "Stock", preIpo: "Pre-IPO · 24/7", basket: "Basket · 24/7" },
    liveNow: "Live",
    opens: (when: string) => `Opens ${when}`,
    closed: "Closed",
    noQuotes: "no quotes",
    loading: "Reading the board…",
    /** The Down ask in cents: what a dollar of Down costs right now. */
    cost: (cents: number) => `${cents}¢`,
    costPending: "…",
    costNone: "—",
    costLabel: "Down",
    windows: (n: number) => (n === 1 ? "1 window" : `${n} windows`),
    left: "left",
  },

  ticket: {
    title: "Size the short",
    amount: "Your stake",
    max: "Max",
    wallet: (amount: string, symbol: string) => `${amount} ${symbol} in your wallet`,
    walletPending: "reading your balance…",
    connect: "Connect a wallet to open a short.",
    multiple: "Multiple",
    /** `owner_open` requires `leverage_bps > LEVERAGE_ONE_BPS`, so 1× is not a short the reserve will hold. */
    multipleHint: (premiumPct: string) => `The reserve fronts the rest of the position and charges ${premiumPct} on what it fronts. Your loss is still capped at your stake.`,
    pickWindow: "Pick a window first.",
    opensTitle: (name: string, when: string) => `${name} opens ${when}`,
    opensBody: "A short opens once its Window is trading. Until then you can schedule a plain Down call on this Window; it is placed the moment it opens.",
    scheduleDown: "Schedule a Down call",
    thinNone: "Nobody is offering Down on this Window right now.",
    thinSome: (max: string, symbol: string) => `The book takes up to about ${max} ${symbol} at this multiple.`,
    useMax: (max: string, symbol: string) => `Use ${max} ${symbol}`,
    thinExit: "The book could not take this position back whole, so the reserve will not open it. Try a smaller stake or a lower multiple.",
    enterAmount: "Enter a stake.",
    pricing: "Pricing against the book…",
    refused: "The reserve refused this short — see why above.",
    /** The chain sizes to the venue's lot, so the charge can be under the typed stake. */
    sized: (charged: string, symbol: string) => `Sized to the venue's lot: ${charged} ${symbol} is charged, the rest stays in your wallet.`,
    requote: (contracts: string) => `The book moved — your stake now buys ${contracts} contracts. Confirm again at the new size.`,
    paused: "The reserve is paused: no new shorts. Live ones still settle, close and knock out.",
    cells: { contracts: "Contracts", entry: "Entry", back: "Back if it falls" },
    knockNote: (line: string, symbol: string) => `Knocks out at ${line} ${symbol}.`,
    cta: (asset: string, x: number) => `Short ${asset} ${x}× for`,
    ctaPlain: "Short",
    busy: "Opening…",
    opened: (contracts: string, asset: string) => `Short open: ${contracts} contracts of ${asset} Down.`,
  },

  positions: {
    connect: "Connect a wallet to see your shorts.",
    empty: "No short open.",
    emptyBody: "Open one above and it appears here, marked against the book.",
    totals: (priced: number, live: number) => (priced === live ? `${live} open` : `${live} open · ${priced} priced`),
    staked: "Staked",
    worth: "Worth now",
    unpriced: "No bids to mark against",
    unpricedWhy: "The book cannot take the whole position right now, so there is no honest mark and no exit.",
    entry: "Entry",
    now: "Now",
    size: "Size",
    /** The number an owner acts on: how far the mark may fall before anyone may close the position. */
    drop: (pct: string) => `${pct} fall reaches the line`,
    atLine: "At the line — anyone may close this now",
    noLine: "No line · nothing fronted",
    line: (amount: string, symbol: string) => `line ${amount} ${symbol}`,
    close: "Close",
    closing: "Closing…",
    settle: "Settle",
    settling: "Settling…",
    claim: "Claim",
    claiming: "Claiming…",
    owed: (amount: string, symbol: string) => `${amount} ${symbol} waiting to be claimed`,
    settledTitle: "Closed shorts",
    result: { closed: "Closed", knockedOut: "Knocked out", won: "Won", lost: "Lost", settled: "Settled" },
    back: (amount: string, symbol: string) => `${amount} ${symbol} back`,
    nothingBack: "Nothing back",
    closedToast: (amount: string, symbol: string) => `Closed: ${amount} ${symbol} back to your wallet.`,
  },

  /** The three cards under §03. The premium and the line are the reserve's parameters, so they are passed in. */
  how: (premiumPct: string, maintenancePct: string) => [
    {
      n: "①",
      t: "A position, not a bet",
      d: "Shorting buys Down contracts and leaves them with the reserve. What they are worth moves with the book every second, and you can sell them back into it whenever you like — you do not have to wait for the bell.",
    },
    {
      n: "②",
      t: "The reserve fronts the rest",
      d: `The reserve puts up the rest of the position and charges ${premiumPct} on what it fronts. That premium is inside your stake, and your stake is the most you can lose.`,
    },
    {
      n: "③",
      t: "The line it knocks out at",
      d: `The reserve is repaid before you are, so once the book would pay less than ${maintenancePct} of what it fronted, anyone may close the position. Your card shows the fall that reaches that line. A void pays every contract half its face, so a short opened above 50¢ comes back short of its stake.`,
    },
  ],

  notDeployed: {
    eyebrow: "Inverse",
    title: "Short",
    body: "A Down position the reserve holds and marks against its own book, with a knock-out line and an exit at any time.",
    why: LEVERAGE_NOT_DEPLOYED,
    dependency: "the leverage reserve program",
  },
} as const;
