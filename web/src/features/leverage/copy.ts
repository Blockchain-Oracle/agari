/**
 * The Ticket's leverage — the reference's own words (`Ticket624Drawer.tsx` L1074–1090: the 1×/2×/3× chips and
 * "L× can knock out before expiry."; `BetPlacedCard.tsx` L123: the caveat on The Call). Verbatim again since
 * 2026-09-04: the 21st.dev breakdown card was reverted on the user's call.
 */
export const LEVERAGE = {
  label: "Leverage",
  /** The chips' title when a boost can be placed — the owner's ask (2026-09-04): say what the multiple is. */
  boostHint: "Leverage: the reserve fronts the rest of the position. Your loss is capped at your stake, and a boost can knock out before expiry.",
  multiple: (x: number) => `${x}×`,
  /** The reference: "Private bets are placed at 1x." Ours: a boost is bought by the reserve, so it takes the wallet route. */
  lockedForRoute: "Boosts are placed from the wallet. Choose Wallet to bet at 2× or 3×.",
  /** The reference's exact title on the chips under a private bet (`Ticket624Drawer.tsx` L1080). */
  lockedForPrivate: "Private bets are placed at 1x.",
  paused: "The leverage reserve is paused: no new boosts. Live ones still settle, cash out and knock out.",
  strip: {
    exposure: "Exposure",
    /** The reference's exact sentence under the quote strip. */
    knockout: (x: number) => `${x}× can knock out before expiry.`,
    sized: (charged: string, symbol: string) => `Sized to the venue's lot: ${charged} ${symbol} is charged, the rest stays in your wallet.`,
    requote: (contracts: string) => `The book moved — your stake now buys ${contracts} contracts. Confirm again at the new size.`,
  },
  cta: {
    buy: (side: string, x: number) => `Buy ${side} ${x}× for`,
  },
  bets: {
    boosted: (x: number) => `${x}× boosted`,
    staked: "Staked",
    yours: "Yours now",
    line: (line: string) => `knocks out at ${line}`,
    knockable: "at the knock-out line — anyone may close it now",
    unpriced: "no bids to mark against",
    cashOut: "Cash out",
    cashingOut: "Cashing out…",
    settle: "Settle",
    settling: "Settling…",
    knockedOut: "Knocked out",
    closed: "Cashed out",
    won: "Won",
    lost: "Lost",
    settled: "Settled",
    paid: (amount: string, symbol: string) => `paid ${amount} ${symbol}`,
    nothingBack: "nothing back",
    history: "Boosts, settled",
    cashedOut: (amount: string, symbol: string) => `Cashed out: ${amount} ${symbol} back to your wallet.`,
    settledToast: "Settled. Whatever the contracts paid is in your wallet, the reserve repaid first.",
  },
  devTitle: "Leverage",
} as const;
