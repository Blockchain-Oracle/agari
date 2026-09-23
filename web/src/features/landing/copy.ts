import { ADVICE_COPY } from "@agari/core/copy";

/**
 * `/` — the landing's words. Session words and lane words come from core and
 * `copy-session.ts`; this file adds the sentences around them.
 */
export const LANDING = {
  meta: {
    title: "Agari · Own the stock. Call the move.",
    description: "Trade Up or Down Windows on US stocks, cover PreStocks you hold, and inspect the signed price print behind every settlement on Solana.",
  },
  hero: {
    eyebrow: "Solana stock markets",
    titleLead: "Own the stock.",
    titleEm: "Call the move.",
    line: "Trade an Up or Down Window, cover a stock you hold, and inspect the price print that settled it.",
    primary: "Open markets",
    secondary: "How it works",
    docs: "Read the docs →",
    paths: "Predict  ·  Cover  ·  Hold",
    folioLeft: "Agari / Prediction exchange",
    folioRight: "Solana stock markets",
  },
  /** S25: the band under the hero, naming the two data sources the venue settles on, each with its own count and proof. */
  builtOn: {
    label: "Built on",
    since: "since 11 Sep",
    reading: "Counting settled Windows…",
    unread: "The index is not answering; the count returns when it does.",
    proof: "Latest print proof →",
    prestocks: {
      name: "PreStocks",
      figure: "Windows settled on PreStocks prices",
      what: (names: string, baskets: number) => {
        const groups = baskets > 0 ? `${baskets} basket${baskets === 1 ? "" : "s"}` : "";
        return `${[names, groups].filter(Boolean).join(" and ")}, 24/7. Each price read from PreStocks, signed by Agari and verified on chain.`;
      },
    },
    pyth: {
      name: "Pyth",
      figure: "Windows settled on Pyth prices",
      what: (names: string) => `${names}. Each Pyth update verified on chain before the print is recorded.`,
    },
  },
  steps: {
    section: { index: "01", title: "A call in three steps", desc: "No chart to read. One question, one clock, one print." },
    items: [
      {
        kicker: "Pick",
        title: "Pick a Window",
        body: "A Window is a question with a clock: will the stock close higher than it opened, five, fifteen or sixty minutes from now?",
        art: [{ word: "5m" }, { word: "15m" }, { word: "1h" }],
      },
      {
        kicker: "Call",
        title: "Make the call",
        body: "Up or Down, and a stake in test tUSDC. The price is the book's, and the fill lands on Solana.",
        art: [{ word: "Up", tone: "up" }, { word: "Down", tone: "down" }],
      },
      {
        kicker: "Settle",
        title: "See it settle",
        body: "At the close the program records the signed print and checks it against the open. The receipt links to both.",
        art: [{ word: "open print" }, { word: "close print" }, { word: "settled", tone: "accent" }],
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
      first: (cadence: string, when: string) => `${cadence} from ${when}`,
    },
    gap: {
      name: "Gap",
      clock: "Friday close → Monday open",
      body: "One Window across the weekend: does Monday open above Friday's close?",
      next: (close: string, open: string) => `Next ${close} → ${open}`,
    },
    token: {
      name: "Token",
      clock: "24/7",
      body: "Tokenized shares trade through nights and weekends, so these Windows never wait for the bell.",
      open: (cadences: string) => `Open now · ${cadences}`,
    },
  },
  /** Plan Step 6 (D-100): the case for covering a stock token you already own, in plain words, beside the card itself. */
  cover: {
    section: { index: "03", title: "Cover what you hold", desc: "Own a stock token? Protect it without selling it." },
    paragraphs: [
      "Tokenized stocks trade on Solana around the clock: Tesla and Nvidia as xStocks, and private companies like OpenAI, Anthropic and SpaceX as PreStocks. Until now, a holder who feared a drop had two choices: sell, or hope.",
      "Agari adds a third. Connect the wallet the tokens sit in and Agari reads it, only reads it, and offers a Down bet on that name as cover. If the price falls, the bet pays and softens the loss. If it rises, the bet costs a little and the tokens are worth more.",
      "Hold two or more of the same basket, a small group of companies bet on together such as OpenAI and Anthropic, and one Down bet on the basket covers them at once.",
    ],
    story: "In May 2026 the OpenAI token fell 39% in a week after OpenAI and Anthropic disputed the tokens, and there was too little liquidity for everyone to sell. A holder with a Down bet would have been paid as it fell.",
    note: "On devnet with test money, so this shows how the cover works rather than protecting real money. Not investment advice. Every token you hold is listed on your",
    portfolio: "Portfolio page →",
    cta: "See it on Markets",
  },
  /** S21 (plan §5.2): the desk, the one place real money moves, in plain words beside its promise. */
  desk: {
    section: { index: "04", title: "Let a desk hold it", desc: "You decide what to own. The desk decides only when." },
    paragraphs: [
      "A basket is a small group of companies you follow together. Predict it with test money, cover the members you hold, or let a desk hold it for you with real money on Solana mainnet, inside limits you set.",
      "The desk wakes every hour, on the hour, around the clock. It reads real PreStocks prices and real Jupiter quotes, asks one AI question about timing, and writes down what it did, including every time it did nothing. The program on Solana enforces the money limits whatever it decides.",
      "It starts in practice: everything real except spending money. Six practice checks and the record opened, then Go live is one mainnet transaction, and money goes straight to an account only you can withdraw from.",
    ],
    story: "Every decision has a Check it button: your browser recomputes the record's fingerprint and compares it with the one Solana holds, in the same transaction as the trade.",
    note: "Practice desks need no tokens, no mainnet and no eligibility.",
    open: "Open your desk →",
    fixtures: "Every state, from fixtures →",
    promise: [
      "It is your account: only you can withdraw, and only to your wallet.",
      "It stays inside your limits, and the program itself enforces the money limits.",
      "It always explains itself, including every time it does nothing.",
      "The record cannot be quietly changed: its fingerprint is on Solana in the same transaction as the trade.",
      "You can stop it at any moment: Pause, Withdraw, Close.",
    ],
    worstCase: "Worst case, in one sentence: if the desk's key were ever stolen, the thief could only make bad trades, at most your daily limit a day, until you pause.",
  },
  proof: {
    section: { index: "05", title: "Proof", desc: "Every address and every settled Window below opens on Solana Explorer." },
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
    nav: "Agari pages",
    markets: "Markets",
    howItWorks: "How it works",
    download: "Get the app",
    docs: "Docs",
  },
} as const;

/**
 * The "not investment advice" line (`ADVICE_COPY.notAdvice`, lane 15d), wired into the landing footer at the S15 merge.
 * Null would hide the footer's advice paragraph.
 */
export const LANDING_ADVICE_SLOT: string | null = ADVICE_COPY.notAdvice;
