/**
 * The folio's words — every claim on this deck is sourced, and the source is named
 * beside it here so a reviewer can check the sentence against the evidence.
 *
 * Sources: `context/00-hackathon-brief.md` (window, chain, organisers),
 * `context/01-dreamdex-event-contracts.md` (ERC-6909, mint-a-pair, oracle settlement,
 * voids at 0.5, zero fees today), `context/04-dreamdex-platform-spot-http-ws.md` §10
 * (builder codes: spot-only, unverified on Event Contracts), `context/05-somnia-network-
 * and-ecosystem.md` (STT, faucets, sub-second finality — Somnia's own figure),
 * `docs/implementation/parity-ledger.md` §Fill projection (89 markets, 4 wallets, 61
 * exact), `docs/implementation/RESUME.md` (stages), `git log` (the builder).
 */
export const PITCH = {
  brand: "masayume",
  builtOn: "Built on Somnia",
  prev: "prev",
  next: "next",
  slideLabel: (n: number) => `slide ${n}`,
  mock: "MOCK · ILLUSTRATIVE",
  concept: "CONCEPT",
  conceptNotLive: "CONCEPT · NOT LIVE",

  cover: {
    section: "COVER",
    h1a: "The whole",
    h1b: "timeline is ",
    emph: "Vegas",
    lead: "Bet on whether Bitcoin or Ether closes above its opening print. From the web, or the app you install from it. It settles on the oracle, and only you can cash out — your wallet signs every order. Built on DreamDEX Event Contracts, on Somnia.",
    leadStrong: "Live on Shannon testnet.",
    pills: ["Live on testnet", "Web · PWA", "Built on Somnia"],
    glanceTitle: "AT A GLANCE",
    glanceBadge: "LIVE ON TESTNET",
    rows: {
      betOn: ["You bet on", "BTC or ETH, up or down"],
      where: ["Where", "Web · installed PWA"],
      engine: ["Engine", "DreamDEX Event Contracts"],
      custody: ["Custody", "Non-custodial"],
      onboarding: ["Onboarding", "Any EVM wallet · faucet"],
      builtOn: "Built on",
      chain: "Somnia",
    },
  },

  engine: {
    section: "THE ENGINE",
    kicker: "DreamDEX did the hard part",
    h1a: "We reinvented",
    h1b: "the way ",
    emph: "in",
    lead: "DreamDEX Event Contracts already redefined the prediction market: one fully on-chain order book per Window, UP and DOWN as the two sides of it, and the oracle's own print deciding the close — no committee. The mechanism is solved. Our job is the experience.",
    panelTitle: "DREAMDEX EVENT CONTRACTS · THE ENGINE",
    panelBadge: "ON SOMNIA",
    rows: [
      ["Positions", "UP · DOWN, YES/NO on one book"],
      ["Pricing", "A fully on-chain CLOB"],
      ["Settlement", "The oracle's print, at close"],
      ["Who decides", "The oracle hub, no committee"],
      ["Tokens", "ERC-6909 outcome tokens"],
      ["Chain", "Somnia · sub-second finality"],
    ] as const,
  },

  gap: {
    section: "THE GAP",
    kicker: "Powerful, but locked away",
    h1a: "A great market",
    h1b: "no one can ",
    emph: "reach",
    lead: "To use it you need a wallet, a gas token, and to read an order book. And the apps that make it easy hold your balance, so they can freeze you, or be prompt-injected into draining you. The best prediction market on-chain stays out of reach of normal people.",
  },

  edge: {
    section: "OUR EDGE",
    kicker: "Same market, better experience",
    h1a: "The winner wins on",
    emph: "experience",
    lead: "TikTok, WhatsApp, Instagram — all the same category. Experience decides who wins. Masayume brings the Window to the front of your screen: a tap, a reel, a room, a receipt. Non-custodial, so it is safe to be everywhere.",
    cells: [
      ["One tap", "a stake-first ticket, the real quote for your size"],
      ["The reel", "live Windows, swipe to the next"],
      ["The Room + Sensei", "bettors only, gated by a chain read · a market read on Claude"],
      ["Receipts", "opening print, closing print, tx, oracle graph — clickable"],
    ] as const,
    live: "ALL FOUR LIVE TODAY",
  },

  x: {
    section: "DISTRIBUTION · X",
    kicker: "Next: where the crowd already is",
    h1a: "X is Vegas.",
    h1b: "So we'll bet ",
    emph: "there",
    lead: "Reply to a market post and the bet is placed — that is the next stage, not this one. The design is in the architecture: an EventVault grant that lets a relay open a position you own and nothing else, so a bot near your money is safe. No Masayume X account exists yet; creating one is the owner's call.",
    pills: ["Stage 4", "Un-drainable by design", "Not live"],
  },

  proof: {
    section: "PROOF",
    kicker: "Why the numbers can be trusted",
    h1a: "It replays your fills.",
    h1b: "It matched the ",
    emph: "chain",
    lead: "History, P&L, Trader Edge and the leaderboard are one derivation: every fill a wallet made, replayed into a ledger per Window and settled by the chain's own rule. Before any of it was shown, it was checked against live ERC-6909 balances.",
    leftLabel: "SETTLED MARKETS CHECKED",
    leftSub: "across four active wallets · money exact on all of them",
    rightLabel: "MONEY MISMATCHES",
    rightSub: "61 balances matched exactly; 28 differed only by a leg already redeemed or burned",
    provenance: "VENUE · marketsCore",
    status: "live health at /status",
  },

  onboard: {
    section: "ONBOARDING",
    kicker: "What it takes to get in today",
    h1a: "A wallet and a",
    h1b: "tap of the ",
    emph: "faucet",
    lead: "Connect any EVM wallet and choose Get test funds. Eligible wallets receive a small STT top-up before confirming the venue’s test tUSDC mint. External STT faucets remain available when our allocation is unavailable. A card on-ramp and social sign-in are the next stage — they are labelled that way in the product too, never dressed up as live.",
    cells: [
      ["Faucet", "tUSDC · up to 10,000 per tap", "LIVE"],
      ["Wallet", "any EVM wallet · switch to Shannon", "LIVE"],
      ["Card or bank", "on-ramp", "NEXT · NOT LIVE"],
    ] as const,
  },

  mobile: {
    section: "MOBILE",
    kicker: "Users live in apps",
    h1a: "Where the users",
    emph: "are",
    lead: "People spend their time in apps, so the web app installs as one: the reel is phone-first, the bottom pill nav is the reference's, and the whole thing runs full-screen from the home screen. Native builds are blocked until native source exists — the ledger says so, and so does the download page.",
    pills: ["Installable PWA", "Phone-first reel", "Native: blocked"],
  },

  agents: {
    section: "AI AGENTS",
    kicker: "The next users are agents",
    h1a: "Sensei can read.",
    h1b: "It can't ",
    emph: "trade",
    lead: "Sensei runs on Claude through the Vercel AI SDK, so the model is a setting rather than a code change. It reads the same live Windows and book the page already holds, explains a market in plain words, and says so when there is no edge. It never places a trade — you do. Without a key it says exactly which variable would wake it.",
    panelTitle: "SENSEI · WHAT IT MAY DO",
    panelBadge: "LIVE",
    rows: [
      ["Read", "Live Windows + the book"],
      ["Explain", "A market read, in plain words"],
      ["Refuse", "No edge → it says so"],
      ["Execute", "Never — you place the trade"],
      ["Agents · MCP", "THEN"],
    ] as const,
  },

  demand: {
    section: "REAL USAGE",
    kicker: "Do not trust us, trust the chain",
    h1a: "Real usage, read live",
    h1b: "from the ",
    emph: "venue",
    reading: "reading the venue…",
    unavailable: "venue unreadable right now",
    wallets: "wallets ranked on the venue, last 24h",
    walletsSource: "/api/leaderboard · fill tape, replayed",
    calls: "Windows closed on the venue, last 24h",
    callsSource: "same reading · cached three minutes",
    exact: "61 of 89",
    exactLabel: "balances reconstructed exactly from fills",
    exactSource: "parity ledger · §Fill projection",
    partial: "partial day — the scan hit a paging cap",
    lead: "Counted live from the venue's fill tape at /leaderboard, not self-reported. These are the venue's wallets, not only ours — Masayume reads the whole tape and ranks it, so the number is honest about how small we are today.",
  },

  revenue: {
    section: "LONG-TERM REVENUE",
    kicker: "How this could pay, long term",
    h1a: "The rail is ",
    emph: "the venue's",
    modelTitle: "THE MODEL",
    modelRows: [
      ["Rail", "DreamDEX builder codes"],
      ["Rate", "Per pool, read at runtime"],
      ["Set by", "The venue, not us"],
      ["Status", "Not switched on here"],
    ] as const,
    seamTitle: "THE SEAM · IN CODE",
    seamBadge: "NO-OP TODAY",
    seamRows: [
      ["Hook", "AttributionHook · AD-11"],
      ["Today", "Returns nothing"],
      ["Flip", "One function, no retrofit"],
      ["Creators", "Same seam · Stage 4"],
    ] as const,
    lead: "No projection, on purpose. DreamDEX documents builder codes on its spot book — a per-fill fee the venue caps and credits to the app that routed the flow — and does not document them on Event Contracts; nothing here has verified them on an EC pool. The Submitter carries the attribution seam, wired to nothing. When the rail is real on this book, it is one function; until then there is no honest number to multiply.",
  },

  whySomnia: {
    section: "TECHNICAL · WHY SOMNIA",
    kicker: "Built on the Somnia stack",
    h1a: "Only possible",
    h1b: "on ",
    emph: "Somnia",
    lead: "The venue, the settlement rail, the oracle and the outcome tokens are all on-chain, and all in the shipped code: one read runtime over the indexer and the RPC, isolated signing sessions for writes.",
    panelTitle: "THE SOMNIA STACK · IN CODE",
    panelBadge: "ALL ON-CHAIN",
    labels: {
      venue: "Venue",
      venueValue: "DreamDEX EC",
      settlement: "Settlement",
      oracle: "Oracle",
      tokens: "Tokens",
      tokensValue: "ERC-6909",
      indexer: "Indexer",
      indexerValue: "GraphQL + RPC · sub-second",
      gas: "Gas",
      gasValue: "STT on Shannon",
    },
  },

  team: {
    section: "THE TEAM",
    kicker: "The team",
    h1a: "Built by a builder",
    h1b: "who ",
    emph: "ships",
    name: "Abubakr Jimoh",
    role: "Founder & full-stack builder",
    body: "The chain port over DreamDEX Event Contracts, the shared read runtime and isolated signing sessions, the fill projection verified against the chain, and the product itself — Yosuku's experience, source-led, on Somnia. Shipped to here.",
  },

  roadmap: {
    section: "ROADMAP",
    kicker: "Path to production",
    h1a: "Now. Next. ",
    emph: "Then",
    now: { tag: "NOW", title: "Testnet, live", body: "Stages 0–3 shipped: the Yosuku shell, one shared read runtime, the stake-first ticket, the reel, the Room, Sensei, the fill projection and the leaderboard." },
    next: { tag: "NEXT", title: "Balance + rails", body: "Stage 4: the Trading Balance vault, session trading without a prompt per tap, and the X rail behind an owner-only grant." },
    then: { tag: "THEN", title: "Products + games", body: "Stages 5–6: parlays and range on their own reserves, an Earn vault, and first-class games in the same product language." },
    foot: "EVERY NEXT ITEM IS A STAGE THE LEDGER ALREADY NAMES",
  },

  close: {
    section: "THE ASK",
    kicker: "The ask",
    h1a: "Only you can",
    emph: "cash out",
    lead: "DreamDEX built the engine. Masayume brings it to where people already are: a tap, a reel, a room, a receipt — and a phone. Non-custodial throughout, on Somnia's Shannon testnet.",
    ask: "Submitted to the Somnia × DreamDEX Event Contracts hackathon, window 25 Aug – 8 Sep 2026. Verify us live at /leaderboard and /status.",
  },
} as const;
