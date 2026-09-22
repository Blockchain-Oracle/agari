import type { ShareIssuer } from "@agari/core/market";

/**
 * The cover card's words (session-lanes.md §4, D-058; plain-language rewrite 2026-09-19, plan Step 2). Every string
 * says "cover" and "what you hold" — never "hedge" or "exposure" — because the owner could not follow the feature in its
 * own jargon, so a user never could. The foot is the honest part: devnet, test money, the wallet is only looked at.
 */
const ISSUER_WORD: Record<ShareIssuer, string> = { xstocks: "xSTOCKS", ondo: "ONDO TOKENS", prestocks: "PRESTOCKS" };

export const HEDGE = {
  /** "YOUR PRESTOCKS · READ-ONLY": the issuer of the largest holding names the row. */
  eyebrow: (issuer: ShareIssuer) => `YOUR ${ISSUER_WORD[issuer]} · READ-ONLY`,
  /** "12.5 TSLAx ≈ $4,497 of Tesla · cover it this weekend"; without a fresh price the dollar figure is left out, never zero. */
  line: (tokens: string, value: string | null, name: string, horizon: string) =>
    value === null ? `${tokens} of ${name} · cover it ${horizon}` : `${tokens} ≈ ${value} of ${name} · cover it ${horizon}`,
  horizon: { weekend: "this weekend", session: "this session", overnight: "tonight" },
  cta: { gap: "Cover the Monday Gap", down: "Cover with Down" },
  stake: (amount: string, symbol: string) => `Opens the ticket with ${amount} ${symbol}, 10% of what you hold.`,
  foot: (token: string) =>
    `Test money on Solana devnet. Agari only looks at your wallet: it never moves, sells or protects your real ${token}. Not investment advice.`,
  aria: (line: string) => `Cover suggestion: ${line}`,

  /** The card when there is no offer to make. It still says the feature exists, which the old blank never did. */
  teaser: {
    eyebrow: "COVER WHAT YOU HOLD",
    noWallet: { name: "Own a stock token?", line: "Connect your wallet and Agari shows what you hold, then offers a Down bet as cover." },
    reading: { name: "Reading your wallet…", line: "Looking for stock tokens. Nothing is moved and nothing is signed." },
    unreadable: { name: "Couldn't read your wallet", line: "The lookup failed this time. Your holdings are untouched; it retries in a minute." },
    noHolding: { name: "No stock tokens found", line: "Agari looks for xStocks, Ondo tokens and PreStocks such as OpenAI, Anthropic and SpaceX." },
    noWindow: (name: string) => ({ name: `You hold ${name}`, line: "Its next market is not open yet. You can cover it once one opens." }),
    calm: (name: string) => ({ name: `You hold ${name}`, line: "It has barely moved lately, so there is nothing to cover right now. A Down bet is offered only when it moves." }),
    foot: "Test money on Solana devnet. Agari only looks at your wallet: it never moves, sells or protects anything. Not investment advice.",
  },
  /** Sample holdings through the real picker, stamped so nobody mistakes them for a wallet. Never presets a stake. */
  example: {
    stamp: "EXAMPLE · NOT YOUR WALLET",
    show: "See an example",
    hide: "Back to your wallet",
    note: "Sample holdings, so you can see what the card does. None of this is yours.",
  },
  /** "Your stocks" on /portfolio (plan Step 4): every holding, both bets offered, in plain words. */
  stocks: {
    title: "Your stocks",
    intro: "The stock tokens in this wallet, read-only. Each one can be covered with a Down bet or added to with an Up bet, with test money.",
    cover: "Cover with Down",
    add: "Add with Up",
    none: "No open market for this right now",
    /** Plan §2: a name that has barely moved gets the truth, never a Down bet. */
    calm: (name: string, window: string) => `${name} has barely moved in the last ${window}. Nothing to cover right now.`,
    moved: (pct: string, window: string) => `Moved ${pct} high to low in the last ${window}`,
    empty: "No stock tokens found in this wallet. Agari looks for xStocks, Ondo tokens and PreStocks such as OpenAI, Anthropic and SpaceX.",
    foot: "Test money on Solana devnet. Agari only looks at your wallet: it never moves, sells or protects anything. Not investment advice.",
  },
  /** "Your baskets" under "Your stocks" (S19 A6): a basket two or more held members sit in, covered together. */
  baskets: {
    title: "Your baskets",
    intro: "A basket is a small group of companies bet on together. When you hold two or more of its members, one Down bet on the basket covers them together, with test money.",
    holds: (held: number, total: number, value: string | null) => `You hold ${held} of ${total} members${value ? ` ≈ ${value}` : ""}`,
    cover: "Cover the basket with Down",
    add: "Add with Up",
    none: "No basket Window is trading right now",
    calm: (name: string, window: string) => `${name} has barely moved in the last ${window}. Nothing to cover right now.`,
    one: "You hold one member of every basket. Cover it on its own name above.",
  },
  /** The Reels card (plan Step 7): the take card's grammar, both bets offered. */
  reel: {
    badge: "YOU HOLD IT",
    title: (name: string) => `You hold ${name}`,
    voice: "Worried it drops? Cover it with Down. Confident? Add to it with Up.",
    foot: "Both are Agari bets with test money. Read from your wallet only. Not investment advice.",
    aria: (name: string) => `You hold ${name}: cover it with Down or add with Up`,
  },
  /** The opt-in "tell me if it drops" bell (plan Step 8). Its message states a fact, never a forecast. */
  bell: {
    off: (name: string) => `Tell me if ${name} falls 3% within an hour`,
    on: (name: string) => `Watching ${name} · tell me if it falls 3% within an hour`,
    foot: "The bell watches while Agari is open in a tab. It rings as a browser notification if you allow one, otherwise as a message here.",
    fired: {
      title: (name: string, pct: string) => `${name} fell ${pct}% in the last hour`,
      body: (from: string, to: string) => `Was ${from}, now ${to}. You switched this bell on. Test money, not investment advice.`,
    },
  },
  /** One quiet message the first time a wallet is found to hold something, never repeated for that wallet. */
  noticed: {
    title: (name: string) => `We noticed you hold ${name}`,
    body: "You can cover it here with a Down bet. Test money, not advice.",
  },

  dev: {
    title: "Cover card",
    intro: "The holdings-aware cover from canned holdings and Windows, the states that show when there is no offer, the example, then the live card for the connected wallet.",
    gap: "Gap trading — one TSLAx holding, Monday Gap cover",
    session: "In session — TSLAx + TSLAon, Down on the 1h Window",
    token: "Weekend token lane — NVDAx, Down on the 24/7 Window",
    noPrice: "No fresh price — tokens only, no stake preset",
    preIpo: "Pre-IPO — 4.2 OPENAI PreStocks, Down on the 24/7 OpenAI Window (the TSLAx holding has no Window here)",
    basket: "Basket — 4.2 OPENAI + 2 ANTHROPIC held, Down on the 24/7 AI Labs Window, sized on both (S19)",
    baskets: "Your baskets — the /portfolio block for a wallet holding both AI Labs members, and one holding one",
    none: "No verified holding, or no Window to cover into — the picker returns null",
    teasers: "No offer — the four states the card shows instead of a blank",
    example: "Example mode — sample holdings through the real picker, stamped",
    stocks: "Your stocks — the /portfolio section from the sample holdings",
    reel: "Reels — the \"you hold this\" card woven into the feed",
    calm: "Calm names — SpaceX has barely moved, so no Down bet is offered; OpenAI moved, so both are",
    live: "Live — your wallet (mainnet read, devnet cover)",
    liveEmpty: "Connect a wallet that holds an xStock, an Ondo token or a PreStocks token (OPENAI, ANTHROPIC, SPACEX…) to see the live card.",
  },
} as const;
