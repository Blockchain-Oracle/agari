/** The Ticket's words — split from `copy.ts` for the 400-line rule; imported through `@/lib/copy` as before. */

export const TICKET = {
  title: "Your call",
  sideLabel: "Side",
  stakeLabel: "Stake",
  stakePlaceholder: "0.00",
  minStake: (floorText: string) => `Minimum stake ${floorText}`,
  chips: "Quick amounts",
  chipBelowMin: "below the minimum stake",
  enterStake: "Pick a side and enter a stake to see the exact deal.",
  cost: "Cost",
  payoutIfRight: (side: string) => `Payout if ${side} lands`,
  maxLoss: "Max loss",
  odds: "Odds",
  requoting: "requoting…",
  noLiquidity: "No liquidity at this size — nobody is on the other side right now.",
  partial: (fillableText: string) => `Fills up to ${fillableText} at this size — the rest stays in your wallet.`,
  creditNote: (creditText: string) => `${creditText} comes from your venue payout credit first.`,
  approvalNote: "Two signatures this first time: approve tUSDC, then your order.",
  advanced: (fromCadence: string, toCadence: string) =>
    `That ${fromCadence} Window closed for entries — moved you to the next ${toCadence} Window. Side and stake kept.`,
  buy: (side: string) => `Buy ${side} for`,
  buyPlain: "Buy",
  booked: (contractsText: string, side: string, avgPriceBps: number) => `Bought ${contractsText} ${side} contracts at ${Math.round(avgPriceBps / 100)}¢`,
  bookedPrefix: "Bought",
  bookedAt: "at",
  nothingFilled: "Nothing filled — the book moved before your order landed. Your stake was never taken.",
  requotePrefix: "The book moved — it now costs up to",
  requoteSuffix: "Confirm again to buy at the new price.",
  txLabel: "entry tx",
  syncing: "Syncing the chain clock…",
  gotIt: "Got it",
  close: "Close",
  /** The amount block (Ticket624Drawer L1046–1065). */
  amount: "Bet amount",
  amountAria: (symbol: string) => `Bet amount in ${symbol}`,
  balance: (amountText: string) => `Balance ${amountText}`,
  minimum: (floorText: string) => `Minimum ${floorText}.`,
  /** The quote strip (L1098–1116). */
  currentCost: "Current cost",
  ret: "Return",
  liveOdds: "Live market odds",
  enterAmount: "Enter an amount to quote",
  gettingQuote: "Getting live quote…",
  quoteFailed: (why: string) => `Quote failed: ${why}`,
  chance: (pct: number) => `${pct}% chance`,
  /** The reference says "Gas-free · settles on its own, right on the price." Ours is not gas-free, so the first half is left off. */
  footnote: "Settles on its own, right on the price.",
  /** Armed, the tap needs no wallet prompt — the nearest true thing to the reference's "Gas-free". */
  footnoteArmed: "Signed by your session key, no prompt · settles on its own, right on the price.",
  /** Public / Private (L1180–1220). */
  route: "Public or private",
  public: "Public",
  private: "Private",
  /** The account gates (L1124–1173). */
  gate: {
    connect: "Bets are placed from your wallet and winnings land back in it. Connect to place one.",
    topUp: "Top up to place this",
    holds: (have: string, symbol: string, source: string) => `${source} holds ${have} ${symbol}.`,
    need: (need: string, symbol: string) => `Add ${need} ${symbol} more to place this — grab test funds from the faucet if you're short.`,
    empty: "Grab test funds from the faucet to place one.",
    addMoney: "Add money",
  },
  sheetCta: (side: string) => `Your call · ${side}`,
  sheetCtaPlain: "Open your call",
  srCost: (costText: string) => `Cost ${costText}`,
} as const;

/**
 * Reference controls whose product is real but whose contract is not yet deployed.
 *
 * Both are Yosuku parity and both belong to Stage 5 (`RangeReserve`, and the
 * prefunded model that backs leverage). They stay where the reference puts them
 * and say exactly what is missing — omitting them would misrepresent the product,
 * and wiring them to an ordinary Up/Down order would misrepresent the trade.
 */
export const TICKET_PENDING = {
  modeLabel: "Bet type",
  modeDirection: "Up / Down",
  modeRange: "Range",
  rangePending: "Range bets settle against the RangeReserve contract, which is not deployed yet. Up / Down is live.",
  leverageLabel: "Leverage",
  leverageOne: "1×",
  leveragePending: (multiple: string) =>
    `${multiple} needs the prefunded reserve that backs leveraged payouts. It is not deployed yet, so every bet here is 1×.`,
  /** A live reserve whose ceiling sits below this chip — a different cause from "not deployed", so a different sentence. */
  leverageCapped: (multiple: string, ceiling: string) => `${multiple} is above this reserve's ceiling of ${ceiling}.`,
} as const;
