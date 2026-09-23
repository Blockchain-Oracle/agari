/**
 * `/baskets` (S19, D-124): five baskets, each a small group of PreStocks companies bet on together. Plain words
 * throughout: "cover", never "hedge"; "points", never dollars, for an index. A surface Masayume never had, so its
 * frame is the hub's and its words are its own (D-081).
 */
export const BASKETS_COPY = {
  title: "Baskets",
  headingJp: "束ねて賭ける。",
  intro: "A basket is a small group of companies bet on together. Each one is scored as an index that started at 1,000 points, read from PreStocks in one go, and its Window runs around the clock.",
  eyebrow: "PRE-IPO · 24/7",
  alwaysOpen: "Trading 24/7",
  card: {
    members: (names: string) => `${names}, weighted equally`,
    count: (n: number) => `${n} companies · equal weight`,
    loading: "Reading",
    week: (pct: string) => `${pct} this week`,
    weekNone: "Week not charted yet",
    noQuotes: "No quotes yet",
    index: "Index",
    noIndex: "—",
    moved: (rangePct: string, window: string) => `${rangePct} range · last ${window}`,
    quiet: "Not enough reads yet to say how it moved",
    window: (cadence: string) => `Live · ${cadence}`,
    noWindow: "No Window trading right now",
    up: "Up",
    down: "Down",
    unquoted: "—",
    predict: "Predict",
    cover: "Cover",
    hold: "Hold",
    coverWhy: {
      connect: "Connect a wallet to cover the members you hold",
      needsTwo: (held: number) => (held === 0 ? "Cover needs two or more members held" : "You hold one member; cover it on its own name"),
      noWindow: "Cover opens when a Window is trading",
      ready: (held: number, total: number) => `You hold ${held} of ${total} members`,
    },
    holdWhy: "A desk holds the basket for you with real money, inside your limits",
    aria: (name: string) => `${name} basket`,
  },
  foot: "Predict and Cover use test money on Solana devnet. Hold uses real money on Solana mainnet through a desk. Agari only looks at your wallet to see which members you hold. Not investment advice.",
  dev: {
    title: "Baskets",
    intro: "The composed mark at three sizes, a basket Window card trading and paused, the hero question in points, the source note for a basket and a pre-IPO name, the hub holding none and two members, and the /baskets card with and without a Window.",
    marks: "Composed mark — 16, 48 and 56 px discs (news, hub, cover card)",
    trading: "Basket Window — trading, quoted 54 / 48",
    paused: "Basket Window — paused, no signed source",
    hero: "Hero question — the line and the distance in points",
    source: "Source notes — a basket, then OPENAI-60m (no longer the Switchboard line)",
    hubNone: "Hub — a wallet holding no member",
    hubTwo: "Hub — a wallet holding both members, so the basket can be covered",
    indexCard: "/baskets card — a Window trading",
    indexCardNone: "/baskets card — no Window, no wallet",
  },
} as const;
