/**
 * `/demo` — ported from `reference/yosuku/app/demo/page.tsx`.
 *
 * The reference's structure is kept line for line; every claim is rewritten to what
 * this product actually does on Somnia. Two of its promises do not hold here and are
 * not repeated: bets are not gas-free (the wallet pays STT — there is no sponsor), and
 * there is no native mobile build (the web app installs as a PWA). Nothing here names
 * an X handle; social account setup is described in its own guide.
 */
export const DEMO = {
  title: "Demo",
  video: {
    title: "Masayume — official demo",
    description: "Watch the official Masayume demo: markets, games, and agents on Somnia Shannon testnet.",
    watchUrl: "https://youtu.be/tJ__aXds1dE",
    embedUrl: "https://www.youtube-nocookie.com/embed/tJ__aXds1dE?playsinline=1&rel=0",
    coverUrl: "https://masayume.app/demo/official-demo-cover.jpg",
  },
  bar: {
    brand: "MASAYUME",
    sub: "/ demo",
    pitch: "pitch",
    stats: "stats",
    open: "open the app",
  },
  hero: {
    eyebrow: "live demo",
    headline: "See Masayume ",
    headlineSerif: "work.",
    videoLabel: "▶ official demo · 3:23 · Shannon testnet",
    lead: "The consumer front door to on-chain prediction markets — one tap, non-custodial, on the web and as an installable app. Full feature breakdown and verifiable on-chain proofs below.",
    open: "Open the app",
    stats: "View live stats",
    pitch: "See the pitch",
  },
  traction: {
    reading: "reading the venue…",
    failed: "the venue read is unavailable right now",
    wallets: (n: string) => `${n} wallets ranked`,
    calls: (n: string) => `${n} closed calls`,
    period: (period: string) => `last ${period}`,
    partial: "partial day",
    live: "live on Somnia Shannon testnet",
  },
  sections: {
    tap: {
      kicker: "01 · the ritual",
      headline: "One tap. ",
      headlineSerif: "That's the whole thing.",
      body: "Pick a side, see exactly what you'd win for your size, tap. The price is the order book's, the settlement is the oracle's, and the receipt is a transaction you can open. Non-custodial: only you can cash out.",
      link: "try a live market",
    },
    reel: {
      kicker: "02 · the reel",
      headline: "A feed of live Windows, ",
      headlineSerif: "like short-form video.",
      body: "Swipe through live Windows across every cadence the venue lists, with community takes woven between them. Any call is one tap from a position.",
      link: "open the reel",
    },
    social: {
      kicker: "03 · social by default",
      headline: "The Room, and a ",
      headlineSerif: "second opinion.",
      body: "Every Window has a Room — bettors only, and the gate is a chain read, not a setting. Sensei reads the same market stream the page holds and says what it sees, or says plainly when it has no key.",
      room: "open a Window's Room",
      sensei: "ask Sensei",
    },
    depth: {
      kicker: "04 · real depth, still non-custodial",
      headline: "A real venue under the ",
      headlineSerif: "simple front door.",
      cards: {
        book: {
          title: "Order-book pricing",
          body: "A fully on-chain CLOB. Your size is quoted against resting liquidity, and every fill is a transaction.",
        },
        receipts: {
          title: "Settlement receipts",
          body: "Opening print, closing print, settlement tx and the oracle's own graph — every line on the receipt is a link.",
        },
        edge: {
          title: "Trader Edge & the board",
          body: "One replay of your fills feeds history, P&L, Trader Edge and the leaderboard — verified against chain balances before it shipped.",
        },
      },
      proven: "proven on-chain",
    },
    verify: {
      kicker: "05 · don't trust it. verify it.",
      headline: "Real actions. ",
      headlineSerif: "Open receipts.",
      body: "Follow Masayume's strategy publication, bounded permission, copy subscription, and Moonshot purchase on the Shannon explorer.",
      readOn: (wallet: string, date: string) => `Masayume testnet wallet ${wallet} · successful receipts verified on ${date}. These record completed actions, not current permission or settled winnings.`,
      contracts: "The contracts every Window runs on",
    },
  },
  close: {
    headline: "The front door is ",
    headlineSerif: "open.",
    footer: "Masayume · prediction markets on Somnia, made usable by people.",
  },
  frame: {
    caption: (date: string) => `captured from the live testnet product · ${date}`,
    markets: "Masayume's live market: the question, the chart, and the ticket beside it",
    reel: "The reel: one live Window per card, swiped like short-form video",
    sensei: "Sensei open over the live market, reading the same stream the page holds",
  },
  /** Every screenshot under /public/demo was taken on this day, from the running product. */
  capturedOn: "2026-09-02",
} as const;
