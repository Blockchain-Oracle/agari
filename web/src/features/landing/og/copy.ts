/**
 * The words on link previews (L-23, Y-14): the landing's own lines, cut to what a card can carry. The face is Sora
 * SemiBold: it has the minus sign, the middle dot and the em dash, but no kanji and no arrows, so none reach a card
 * (satori would otherwise try to fetch a fallback face at request time).
 */
export const OG_COPY = {
  site: {
    alt: "Agari: call whether a US stock closes a Window up or down, settled on Solana from the signed price print.",
    eyebrow: "Stock Windows on Solana",
    line: "Settled on the signed price print.",
  },
  honesty: "Solana devnet · test tUSDC",
  ticker: {
    /** The route's static `alt`: one image route serves every ticker, so the line names none. */
    routeAlt: "A stock on Agari: its mark, its name and its last close.",
    eyebrow: "Ticker",
    lastClose: (clock: string) => `Last close · ${clock} ET`,
    noPrice: "Up or Down Windows on the NYSE clock.",
  },
  market: {
    alt: "An Up or Down Window on Agari",
    eyebrow: "Window",
    question: "Up or Down?",
    closesAt: (when: string) => `Closes ${when} ET`,
    closedAt: (when: string) => `Closed ${when} ET`,
    unknown: "This Window is not in the index.",
  },
} as const;
