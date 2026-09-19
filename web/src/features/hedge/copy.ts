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
    empty: "No stock tokens found in this wallet. Agari looks for xStocks, Ondo tokens and PreStocks such as OpenAI, Anthropic and SpaceX.",
    foot: "Test money on Solana devnet. Agari only looks at your wallet: it never moves, sells or protects anything. Not investment advice.",
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
    none: "No verified holding, or no Window to cover into — the picker returns null",
    teasers: "No offer — the four states the card shows instead of a blank",
    example: "Example mode — sample holdings through the real picker, stamped",
    stocks: "Your stocks — the /portfolio section from the sample holdings",
    live: "Live — your wallet (mainnet read, devnet cover)",
    liveEmpty: "Connect a wallet that holds an xStock, an Ondo token or a PreStocks token (OPENAI, ANTHROPIC, SPACEX…) to see the live card.",
  },
} as const;
