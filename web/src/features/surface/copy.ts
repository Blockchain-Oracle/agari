import { HERO } from "@/lib/copy";

/**
 * `/surface` — the reference's page (`reference/yosuku/app/surface/page.tsx`) reads a parametric SVI
 * volatility surface back off Sui. DreamDEX prices every Window on a live order book and exposes no
 * such model, so doc 03 §Surface keeps the route and its analytical density and swaps the content
 * for the venue's real structures: the top of the book, its depth, slippage across stake sizes, and
 * the term structure across the asset's live expiries. The words below say what the figures are.
 */
export const SURFACE = {
  crumbRoot: "Masayume",
  crumb: "Surface",
  title: "Market Surface",
  intro: {
    lead: "Every Masayume Window is priced by a ",
    em: "live order book on DreamDEX",
    rest: " — resting bids and asks, not a volatility model. The ticket uses one number, the top of that book; here you can read the whole structure back: how deep each side is, what a bigger stake would really pay, and how every live expiry of the asset is priced right now. Every figure is the chain's own book; nothing is estimated.",
  },
  chips: {
    assets: "Asset",
    windows: "Window",
  },
  reading: "reading the book…",
  noLive: "No live Windows right now — the surface fills in when the next Window opens.",
  sections: {
    book: { number: "01", title: "The book" },
    depth: { number: "02", title: "Depth", desc: "Resting size at each price on the UP book: bids on the left, asks on the right." },
    slippage: { number: "03", title: "Slippage", desc: "What a stake really buys, walking the asks the way the venue fills a taker." },
    term: { number: "04", title: "Term structure", desc: (asset: string) => `How every live ${asset} Window is priced right now, nearest close first.` },
    meta: {
      book: (asset: string, cadence: string) => `${asset} · ${cadence}`,
      levels: (n: number) => `${n} level${n === 1 ? "" : "s"}`,
      windows: (n: number) => `${n} live Window${n === 1 ? "" : "s"}`,
    },
  },
  tiles: {
    opening: "Opening print",
    pendingPrint: "waiting for the print",
    spot: (spot: string) => `spot ${spot}`,
    leading: (side: string) => `${side} is winning`,
    noSpot: "no live price",
    up: { mid: "UP · mid", ask: "UP · ask", bid: "UP · bid", none: "UP" },
    bidAsk: (bid: string, ask: string) => `bid ${bid} · ask ${ask}`,
    crossedUp: (bid: string, ask: string) => `bid ${bid} over ask ${ask} — crossed`,
    noBids: (ask: string) => `ask ${ask} · no bids resting`,
    noAsks: (bid: string) => `bid ${bid} · no asks resting`,
    empty: "no resting orders",
    hydrating: "…",
    spread: "Spread",
    spreadOfMid: (pct: string) => `${pct}% of the mid`,
    oneSided: "one-sided book — no spread to read",
    crossed: "crossed",
    /** Seen live while a maker re-lays its ladder near the close (context/48); the resting orders did not match each other. */
    crossedWhy: "best bid above best ask — these resting orders did not match each other; a taker still fills at the ask",
    close: "Closes in",
  },
  depth: {
    hydrating: "reading the book…",
    empty: "no resting orders on this Window yet",
    bids: "bids",
    asks: "asks",
    contracts: (n: string) => `${n} contracts`,
    mid: (price: string) => `mid ${price}`,
    crossed: "crossed",
  },
  ladder: {
    side: (side: string) => `Buy ${side}`,
    stake: "Stake",
    avg: "Avg price",
    vsTop: "vs top",
    contracts: "Contracts",
    pays: "Pays if right",
    fill: "Fill",
    full: "full",
    beyond: "beyond the visible book",
    nothing: "nothing to buy",
    loading: "reading the book…",
    empty: (side: string) => `No ${side} offers resting — nothing to price.`,
    lot: (lot: string) => `sized to the venue's lot of ${lot} contracts`,
    fee: (bps: number) => (bps === 0 ? "no settlement fee on this venue" : `after the ${bps} bps settlement fee`),
    unguarded: "The ticket caps its own order's cost; this ladder shows the book itself, unguarded.",
  },
  term: {
    oneWindow: "one live Window — a curve needs two",
    reading: "reading the books…",
    unpriced: "no book has a resting order yet",
    basis: { mid: "mid", ask: "ask", bid: "bid", crossed: "ask · crossed book" } as const,
    crossed: "crossed",
    columns: { window: "Window", closes: "Closes in", print: "Opening print", up: "UP", down: "DOWN", spread: "Spread", depth: "Bids / asks", state: "State" },
    pick: (cadence: string) => `Read the ${cadence} Window`,
    unavailable: "unavailable",
    point: (cadence: string, price: string, basis: string) => `${cadence} · UP ${price} (${basis})`,
  },
  /** The settlement basis, in the hero's own words — the one price that decides a Window. */
  basis: HERO.source,
  devTitle: "Surface",
} as const;
