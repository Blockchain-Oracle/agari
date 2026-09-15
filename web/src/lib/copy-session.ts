/**
 * The closed-market words (S18 lane 18a, D-086/D-087): what every surface says when NYSE is not trading. Split from
 * `copy.ts` for the 400-line rule; the session word and phrase themselves come from core `session-words.ts`, so a
 * surface only ever adds the sentence around them.
 */
export const SESSION_COPY = {
  hero: {
    /** The question slot's label under the last price: "Last close · as of 16:00 ET". */
    lastClose: "Last close",
    asOf: (clock: string) => `as of ${clock} ET`,
    /** A moved extended-hours tick: "Pre-market · as of 08:12 ET · since close". */
    extended: { pre: "Pre-market", post: "After hours", live: "Live" },
    since: { close: "since close", prevClose: "since last close", open: "since the open" },
    source: "signed 5-minute archive",
    /** The chart's reference line: the previous close, or the session's open when the archive starts here. */
    prevCloseLine: "prev close",
    openLine: "open",
    rangeGroup: "History range",
    noHistory: (asset: string) => `No archived session for ${asset} yet — the first prints land at the next open.`,
    /** A price with no close to measure against yet (the archive starts with the next session). */
    noReference: "No previous close on record yet.",
    opensIn: "Opens in",
    closesIn: "Closes in",
    noClock: "—",
  },
  ticket: {
    readWire: "Read the wire",
    wireHref: (asset: string) => `/news?symbol=${asset}`,
    /** Under the placeholder: what to do while nothing can be called. */
    meanwhile: "Windows list before the open; the wire and the takes keep moving meanwhile.",
  },
  next: {
    /** The card's clock slot when the next open is unknown. */
    clock: "next",
    opensIn: (span: string) => `opens in ${span}`,
    first: (cadence: string, when: string) => `First ${cadence} Window opens ${when} ET`,
    lastClose: (price: string, clock: string) => `Last close ${price} · ${clock} ET`,
  },
  lanes: {
    closed: (phrase: string) => `${phrase}. Regular Windows roll from the open.`,
  },
  board: {
    closed: (phrase: string) => `${phrase}. The questions return with the first Window of the session.`,
    nextAction: "Read the wire",
  },
  marquee: {
    /** The session is known but no price reached the strip: never "loading" for a market that is simply shut. */
    noFeed: "NO PRICE FEED",
    loading: "LOADING",
    /** The tag on a last-close price that stands in for a live one. */
    close: "CLOSE",
    /** The session cell's labels: "OPENS IN · 1H 12M", "REOPENS · TUE 09:30 ET", "CLOSES IN · 2H 05M", else "NYSE · <word>". */
    opensIn: "OPENS IN",
    reopens: "REOPENS",
    closesIn: "CLOSES IN",
    nyse: "NYSE",
  },
  portfolio: {
    closed: (phrase: string) => `${phrase} — the first Windows list before the open.`,
    seeNext: "See what lists next",
  },
} as const;
