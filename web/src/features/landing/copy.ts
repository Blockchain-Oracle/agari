/**
 * `/` — the landing's words (L-11, D-093). Masayume never finished a landing page, so the layout is Agari's own; the
 * voice is Masayume's: short, declarative, no hype, and nothing claimed that the chain cannot show. Session words and
 * lane words come from core and `copy-session.ts`; this file only adds the sentences around them.
 */
export const LANDING = {
  meta: {
    title: "Agari · Up or Down on US stocks",
    description: "Call whether a US stock closes a Window higher or lower. Settled on Solana from the signed price print.",
  },
  hero: {
    eyebrow: "上がり · Stock Windows on Solana",
    titleLead: "Up or down.",
    titleEm: "Call the close.",
    line: "Pick a stock and a Window. Call Up or Down. It settles on the signed price print at the close, and only you can cash out.",
    primary: "Open markets",
    secondary: "How it works",
    dialLabel: (asset: string) => `${asset}, the last session and the live price`,
  },
  steps: {
    section: { index: "01", title: "A call in three steps", desc: "No chart to read. One question, one clock, one print." },
    items: [
      {
        kicker: "Pick",
        title: "Pick a Window",
        body: "A Window is a question with a clock: will the stock close higher than it opened, five, fifteen or sixty minutes from now?",
      },
      {
        kicker: "Call",
        title: "Make the call",
        body: "Up or Down, and a stake in test tUSDC. The price is the book's, and the fill lands on Solana.",
      },
      {
        kicker: "Settle",
        title: "See it settle",
        body: "At the close the program records the signed print and checks it against the open. The receipt links to both.",
      },
    ],
  },
  lanes: {
    section: { index: "02", title: "Three lanes", desc: "Each lane runs on its own clock." },
    reading: "Reading the session…",
    unknown: "The session is unreachable. The lanes list again when it answers.",
    notListed: "Not listed on devnet yet.",
    names: (n: number) => `${n} name${n === 1 ? "" : "s"}`,
    regular: {
      name: "Regular",
      clock: "5m · 15m · 1h on the NYSE clock",
      body: "Windows roll through the regular session, 09:30 to 16:00 ET, back to back.",
      open: (span: string) => `Open now · closes in ${span}`,
      first: (cadence: string, when: string) => `${cadence} from ${when} ET`,
    },
    gap: {
      name: "Gap",
      clock: "Friday close → Monday open",
      body: "One Window across the weekend: does Monday open above Friday's close?",
      next: (close: string, open: string) => `Next ${close} → ${open} ET`,
    },
    token: {
      name: "Token",
      clock: "24/7",
      body: "Tokenized shares trade through nights and weekends, so these Windows never wait for the bell.",
      open: (cadences: string) => `Open now · ${cadences}`,
    },
  },
  proof: {
    section: { index: "03", title: "Proof", desc: "Every address and every settled Window below opens on Solana Explorer." },
    program: "Program",
    venue: "Venue config",
    clusterLabel: "Cluster",
    cluster: "Solana devnet",
    settled: "Last settled Windows",
    reading: "Reading the index…",
    none: "No settled Window indexed yet. The first one lands at the next close.",
    outcome: { up: "Up won", down: "Down won", void: "Void" },
    closed: (when: string) => `closed ${when} ET`,
    explorer: "Explorer",
    explorerAria: (what: string) => `${what} on Solana Explorer`,
    printProof: "Print proof",
    unset: "not configured",
  },
  install: {
    eyebrow: "On your phone",
    title: "Install it from the browser.",
    line: "No store and no native build. Add Agari to your home screen and a call is one tap away.",
  },
  foot: {
    markets: "Markets",
    howItWorks: "How it works",
    download: "Get the app",
  },
} as const;

/**
 * The "not investment advice" line arrives from lane 15d (`ADVICE_COPY.notAdvice`, `@agari/core/copy`) at merge. Until
 * then the landing footer's advice slot renders nothing: the stage owner swaps this null for that import.
 */
export const LANDING_ADVICE_SLOT: string | null = null;
