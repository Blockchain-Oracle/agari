/**
 * `/demo` — ported from `reference/yosuku/app/demo/page.tsx`.
 *
 * The reference's structure is kept line for line; every claim is rewritten to what Agari does on Solana devnet.
 * Two of the reference's promises do not hold here and are not repeated: calls are not gas-free by default (the
 * wallet pays SOL; the faucet tops a short wallet up), and there is no native mobile build (the web app installs
 * as a PWA). The video is honest about not existing yet (D-097), and nothing here names an X handle.
 */
export const DEMO = {
  title: "Demo",
  video: {
    title: "Agari — demo",
    description: "Call whether a US stock closes its Window up or down, settled on a signed price on Solana devnet — and every claim a transaction you can open.",
    caption: "Markets on the NYSE clock, the call before the bell, and a settlement you can audit. Recorded on the running product.",
    pendingEyebrow: "● not recorded yet",
    pendingTitle: "Recording Wed 16 Sep during NYSE hours",
    pendingCaption: "The walkthrough is captured on the live product after the 09:30 ET bell, so it shows Windows trading rather than a closed board. Until then, everything it would show is below, as transactions you can open.",
  },
  bar: {
    brand: "AGARI",
    sub: "/ demo",
    pitch: "pitch",
    stats: "stats",
    open: "open the app",
  },
  hero: {
    eyebrow: "live demo",
    headline: "See Agari ",
    headlineSerif: "work.",
    videoLabel: "▶ demo · Solana devnet",
    videoLabelPending: "● recording wed 16 sep · nyse hours",
    lead: "Up or down on a US stock, settled on a signed price the program checks itself — one tap, non-custodial, on the web and as an installable app, and still open after the bell. Full feature breakdown and verifiable on-chain proofs below.",
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
    live: "live on Solana devnet",
  },
  sections: {
    tap: {
      kicker: "01 · the ritual",
      headline: "One tap. ",
      headlineSerif: "That's the whole thing.",
      body: "Pick a side, see exactly what you'd win for your size, tap. The price is the order book's, the settlement is the signed print's, and the receipt is a transaction you can open. When the market is shut, the same ticket rests a call at your price for the open. Non-custodial: only you can cash out.",
      link: "try a market",
    },
    reel: {
      kicker: "02 · the reel",
      headline: "A feed of Windows, ",
      headlineSerif: "like short-form video.",
      body: "Swipe through Windows across every lane the venue lists — the session's 5m, 15m and 60m, the weekend Gap, the 24/7 token lane — with community takes woven between them. Any call is one tap from a position.",
      link: "open the reel",
    },
    social: {
      kicker: "03 · social by default",
      headline: "The Room, and a ",
      headlineSerif: "second opinion.",
      body: "Every Window has a Room — callers only, and the gate is a chain read, not a setting. Sensei reads the same market stream the page holds and says what it sees, or says plainly when it has no key.",
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
          body: "A fully on-chain CLOB written for this venue. Your size is quoted against resting liquidity, an UP and a DOWN buy can mint a fresh pair, and every fill is a transaction.",
        },
        receipts: {
          title: "Settlement receipts",
          body: "Opening print, closing print, their source and signer count, and the settlement tx — every line on the receipt is a link, and a void names its reason.",
        },
        edge: {
          title: "Trader Edge & the board",
          body: "One replay of the venue's fill tape feeds history, P&L, Trader Edge and the leaderboard, and a redemption is the chain paying out exactly what the tape says it owes.",
        },
      },
      proven: "proven on-chain",
    },
    verify: {
      kicker: "05 · don't trust it. verify it.",
      headline: "Real actions. ",
      headlineSerif: "Open receipts.",
      body: "One Window's whole life on devnet — listed, funded, ordered, filled, printed, settled and paid — and a void beside it. Every receipt opens on Solana Explorer.",
      readOn: (wallet: string, date: string) => `Agari devnet · sent by the drive wallet ${wallet} and the venue's own deployer, roller and faucet keys · verified on ${date}. These record completed actions, not current balances.`,
      pending: "Not configured in this build: program links appear once the agari-events address is set.",
      contracts: "The programs every Window runs on",
    },
  },
  close: {
    headline: "The front door is ",
    headlineSerif: "open.",
    footer: "Agari · stock prediction Windows on Solana, open after the bell.",
  },
  frame: {
    caption: (date: string) => `captured from the running devnet product · ${date}`,
    markets: "Agari's market board after the close: the last price, the next session on the clock, and the ticket beside it",
    reel: "The reel after the close: the next session on the clock, with the latest takes a swipe away",
    sensei: "Sensei open over the market, reading the same stream the page holds",
  },
  /** Every screenshot under /public/demo was taken on this day, from the running product. */
  capturedOn: "2026-09-15",
} as const;
