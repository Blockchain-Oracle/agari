/**
 * The folio's words — every claim on this deck is sourced, and the source is named
 * beside it here so a reviewer can check the sentence against the evidence.
 *
 * Sources: `docs/plan/00-plan.md` §0 (the hackathon, the user, the approved decisions),
 * `context/03-prediction-markets-and-stock-derivatives-landscape.md` §Announcement stats
 * (the 63% / 17% Allium figures Solana itself published), `scripts/deploy/addresses.devnet.json`
 * (the program ids and the 27 listed Series), `docs/plan/acceptance.md` (every devnet
 * signature on the proof slide), `services/ops/config/price-sources.json` (the three signed
 * sources), `docs/plan/decisions.md` D-084 (what is deferred and therefore says NOT LIVE),
 * D-088 (the call before the bell), `git log` (the builder).
 *
 * Identity: the deck names Masayume once, on the engine slide, because that slide is where
 * the lineage belongs — it is the one place in the product that says where this came from.
 */
export const PITCH = {
  brand: "agari",
  builtOn: "Built on Solana",
  prev: "prev",
  next: "next",
  slideLabel: (n: number) => `slide ${n}`,
  mock: "MOCK · ILLUSTRATIVE",
  concept: "CONCEPT",
  conceptNotLive: "CONCEPT · NOT LIVE",

  cover: {
    section: "COVER",
    h1a: "The bell rings.",
    h1b: "The market stays ",
    emph: "open",
    lead: "Call whether a stock closes its Window higher or lower than it opened. From the web, or the app you install from it. It settles on a signed price the program checks itself, and only you can cash out — your wallet signs every order.",
    leadStrong: "Live on Solana devnet.",
    pills: ["Live on devnet", "Web · PWA", "Built on Solana"],
    glanceTitle: "AT A GLANCE",
    glanceBadge: "LIVE ON DEVNET",
    rows: {
      betOn: ["You call", "Nine US names, up or down"],
      where: ["Where", "Web · installed PWA"],
      engine: ["Engine", "agari-events · our Anchor CLOB"],
      custody: ["Custody", "Non-custodial"],
      onboarding: ["Onboarding", "Any Solana wallet · faucet"],
      builtOn: "Built on",
      chain: "Solana",
    },
  },

  engine: {
    section: "THE ENGINE",
    kicker: "Built from Masayume's source",
    h1a: "We ported the product.",
    h1b: "We wrote the ",
    emph: "engine",
    lead: "Agari is a source-led port of Masayume, this builder's crypto prediction market on another chain: its shell, its ticket, its type and spacing, its words. What is underneath is new. Masayume rented a third party's exchange; here one Anchor program is the order book, the Windows, the signed prints and the settlement — written for this venue, deployed to devnet, and the only thing that decides an outcome.",
    panelTitle: "AGARI-EVENTS · THE ENGINE",
    panelBadge: "ON SOLANA DEVNET",
    rows: [
      ["Positions", "UP · DOWN, two sides of one book"],
      ["Pricing", "A fully on-chain CLOB"],
      ["Settlement", "The signed print at the close"],
      ["Who decides", "The program, from the print"],
      ["Held as", "A seat on the Window's ledger"],
      ["Chain", "Solana · about a second to final"],
    ] as const,
  },

  gap: {
    section: "THE PROBLEM",
    kicker: "A market that is shut most of the week",
    h1a: "The bell rings and",
    h1b: "everything goes ",
    emph: "dark",
    lead: "US exchanges trade 32.5 hours of the 168 in a week. Tokenised stock on Solana does not stop — 63% of its volume trades while those exchanges are closed, and 17% at the weekend. A holder who wants to change exposure at 9pm on a Sunday can only sell, and every venue built on stock hours is a blank screen when they look.",
  },

  edge: {
    section: "OUR EDGE",
    kicker: "Same market, better hours",
    h1a: "The winner wins on",
    emph: "experience",
    lead: "TikTok, WhatsApp, Instagram — all the same category. Experience decides who wins. Agari puts the Window at the front of your screen and keeps it there after the bell: a tap, a call resting for tomorrow's open, a room, a receipt. Non-custodial, so it is safe to be everywhere.",
    cells: [
      ["One tap", "a stake-first ticket, the real quote for your size"],
      ["After the bell", "the board never empties — rest a call at your price for the open"],
      ["The Room + Sensei", "callers only, gated by a chain read · a market read on Claude"],
      ["Receipts", "opening print, closing print, tx, signer count — clickable"],
    ] as const,
    live: "ALL FOUR LIVE TODAY",
  },

  x: {
    section: "DISTRIBUTION · X",
    kicker: "Next: where the crowd already is",
    h1a: "X is the tape.",
    h1b: "So we'll call ",
    emph: "there",
    lead: "Reply to a market post and the call is placed — that is a stage after this one, not this one. The design is already in the vault program: a grant that lets a relay open a position you own and nothing else, capped and revocable, so a bot near your money is safe. No Agari X account exists yet; creating one is the owner's call.",
    pills: ["After the deadline", "Un-drainable by design", "Not live"],
  },

  proof: {
    section: "PROOF",
    kicker: "Why these claims can be trusted",
    h1a: "Every claim is a",
    h1b: "transaction you can ",
    emph: "open",
    lead: "Prints from three signed sources, fills that mint a pair and fills that burn one, a cross-check settlement, both kinds of void, and the redemptions after them — each one sent to Solana devnet and written into the acceptance ledger with its explorer link, the failures beside the successes. This week's rows: five basket lanes settling hourly on devnet, and the desk rehearsed whole on a fork of Solana mainnet.",
    rowsTitle: "THIS WEEK · IN THE LEDGER",
    rowsBadge: "DEVNET · MAINNET FORK",
    rows: [
      ["Baskets", "5 Series listed · first Windows settled 20:00Z, 22 Sep"],
      ["AI Labs #0", "1,267.38 → 1,110.43 pts · DOWN · devnet"],
      ["The desk", "31/31 checks · Surfpool mainnet fork"],
      ["Refusals", "9 forced · every one a failed transaction"],
    ] as const,
    leftLabel: "CONFIRMED DEVNET TRANSACTIONS",
    leftSub: "prints, fills, settlements, voids and redeems · every one linked in docs/plan/acceptance.md",
    rightLabel: "CLAIMS WITHOUT A SIGNATURE",
    rightSub: "failed attempts are logged in the same ledger, next to the ones that worked",
    provenance: "VENUE · agari-events",
    status: "live health at /status",
  },

  onboard: {
    section: "ONBOARDING",
    kicker: "What it takes to get in today",
    h1a: "A wallet and a",
    h1b: "tap of the ",
    emph: "faucet",
    lead: "Connect any Solana wallet that speaks the Wallet Standard — Phantom, Solflare, Backpack — and choose Get test funds. A wallet short on SOL gets a little for fees first, then the venue mints its test tUSDC to you in one signature. A card on-ramp and social sign-in are a later stage, and they are labelled that way in the product too, never dressed up as live.",
    cells: [
      ["Faucet", "tUSDC · 100,000 a tap", "LIVE"],
      ["Wallet", "any Wallet Standard wallet · devnet", "LIVE"],
      ["Card or bank", "on-ramp", "LATER · NOT LIVE"],
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
    lead: "Sensei runs on Claude through the Vercel AI SDK, so the model is a setting rather than a code change. It reads the same live Windows and book the page already holds, explains a market in plain words, and says so when there is no edge. It never places a call — you do. Without a key it says exactly which variable would wake it.",
    panelTitle: "SENSEI · WHAT IT MAY DO",
    panelBadge: "LIVE",
    rows: [
      ["Read", "Live Windows + the book"],
      ["Explain", "A market read, in plain words"],
      ["Refuse", "No edge → it says so"],
      ["Execute", "Never — you place the call"],
      ["Agents · MCP", "LATER"],
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
    exact: "27",
    exactLabel: "Series listed on devnet — nine names × three cadences",
    exactSource: "scripts/deploy/addresses.devnet.json",
    partial: "partial day — the scan hit a paging cap",
    lead: "Counted live from the venue's own fill tape at /leaderboard, not self-reported. These are the venue's wallets, not only ours — Agari reads the whole tape and ranks it, so the number is honest about how small a devnet venue this age is.",
  },

  revenue: {
    section: "LONG-TERM REVENUE",
    kicker: "How this could pay, long term",
    h1a: "The fee is ",
    emph: "in the program",
    modelTitle: "THE MODEL",
    modelRows: [
      ["Rail", "Maker · taker · settlement skim"],
      ["Rate", "Per market, read from chain"],
      ["Set by", "The venue's admin key"],
      ["Status", "All three set to zero"],
    ] as const,
    seamTitle: "THE SEAM · IN CODE",
    seamBadge: "ZERO TODAY",
    seamRows: [
      ["Where", "agari-events · market config"],
      ["Today", "Zero on every Window"],
      ["Flip", "One admin instruction"],
      ["Creators", "Same seam · later"],
    ] as const,
    lead: "No projection, on purpose. The program already carries the fees a venue would charge — maker, taker, and a basis-point skim on winning contracts at redemption — and every one of them is zero here. The rate is read from chain at use time and printed on the receipt, so the number a caller was charged is the number the chain says. Turning it on is one admin instruction; until there is real flow, there is no honest figure to multiply.",
  },

  whySolana: {
    section: "TECHNICAL · WHY SOLANA",
    kicker: "Built on the Solana stack",
    h1a: "Only possible",
    h1b: "on ",
    emph: "Solana",
    lead: "A five-minute Window needs a fill to cost a fraction of a cent and a signed price to land in the very second it is about. The venue, the settlement, the prints and the positions are all on-chain and all in the shipped code: one read runtime over the indexer and the RPC, isolated signing sessions for writes.",
    panelTitle: "THE SOLANA STACK · IN CODE",
    panelBadge: "ALL ON-CHAIN",
    labels: {
      venue: "Venue",
      venueValue: "agari-events",
      settlement: "Settlement",
      settlementValue: "Same program · resolve + redeem",
      oracle: "Prints",
      oracleValue: "Pyth · RedStone · Switchboard",
      tokens: "Balance",
      tokensValue: "agari-vault",
      indexer: "Indexer",
      indexerValue: "Fill tape + RPC · about a second",
      gas: "Network fees",
      gasValue: "SOL on devnet",
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
    body: "The whole Solana port: an order-book program written for this venue, three signed price sources verified on-chain, the session lanes and the call before the bell, the Trading Balance, one shared read runtime and isolated signing sessions — and the product itself. Shipped to here.",
  },

  roadmap: {
    section: "ROADMAP",
    kicker: "Path to production",
    h1a: "Now. Next. ",
    emph: "Then",
    now: { tag: "NOW", title: "Devnet, live", body: "The venue program and its generated client, the ops crank that lists and settles, the stake-first ticket, the Trading Balance, Sensei and the Room, the always-on board and the call before the bell." },
    next: { tag: "NEXT", title: "The deferred stages", body: "The maker vault, agents and copy-trading, specialist tickets, the X rail and Blinks, and the games — every one a stage the ledger already names and dates." },
    then: { tag: "THEN", title: "Off devnet", body: "Real collateral, a licensed halt feed, and price policies that outlive a trial — the production oracle path is Chainlink Data Streams, already chosen." },
    foot: "EVERY NEXT ITEM IS A STAGE THE LEDGER ALREADY NAMES",
  },

  close: {
    section: "THE ASK",
    kicker: "The ask",
    h1a: "Only you can",
    emph: "cash out",
    lead: "One program is the book, the Windows, the prints and the settlement. Agari puts it where people already are — a tap, a reel, a room, a receipt, and a phone that keeps working after the bell. Non-custodial throughout, on Solana devnet.",
    ask: "Submitted to the Solana Stocklana hackathon, submissions closing 18 Sep 2026. Verify us live at",
  },
} as const;
