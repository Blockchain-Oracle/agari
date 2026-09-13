/**
 * Everything Lucky says.
 *
 * Two sentences here carry the mode's honesty and must never be softened. The draw is provable, and the
 * card says exactly what that proves — that the reels were not changed after the seed was committed —
 * and not what it does not: the Window was chosen from a hashed candidate set by a rule the server
 * followed, which is recorded, not proven. And the order is one real order at the LIVE quote: the reel
 * dealt a reach, the book decides the multiple, and when the two have parted the card says so before
 * anything is signed (`04-game-system.md` §Mode truth, `06-game-architecture.md` §/games/lucky).
 */
export const LUCKY = {
  eyebrow: "A live Window, drawn for you",
  title: "Lucky",
  intro:
    "Set a stake and spin. The reels draw an asset, a side and a reach from two seeds — one the server commits to before they move, one your browser adds after — and the deal shows the real quote on a live Window before one tap places one order.",

  stake: {
    label: "Stake",
    available: (amount: string) => `${amount} available`,
    placeholder: "0.00",
    minimum: (floor: string) => `The stake must be at least ${floor}.`,
    aria: (symbol: string) => `Stake in ${symbol}`,
    chips: "Quick amounts",
  },

  spin: {
    cta: "Spin",
    committing: "Sealing the seed…",
    spinning: "Spinning…",
    dealing: "Dealing…",
    again: "Spin again",
    connect: "Connect a wallet to spin",
    wrongChain: "Switch to Somnia Shannon to spin",
    noSigner: "Waiting for the wallet…",
    noStore: "This deployment has no games store, so a draw has nowhere to keep its seed.",
    failed: (why: string) => `The spin did not deal: ${why}`,
  },

  reels: {
    asset: "Asset",
    side: "Side",
    reach: "Reach",
    blank: "?",
    multiple: (m: number) => `${m}×`,
    /** Read out when the reels lock, so a screen reader hears the deal. */
    announce: (asset: string, side: string, m: number) => `Dealt ${asset}, ${side}, ${m} times.`,
  },

  deal: {
    title: "The deal",
    honesty: "One real order on the book, at the live quote below. It settles on the Window's own close like any other order; if the side is wrong the stake is lost.",
    proof: {
      label: "Provably drawn",
      commitment: "Commitment",
      serverSeed: "Server seed",
      clientSeed: "Your seed",
      nonce: (n: number, v: number) => `nonce ${n} · policy v${v}`,
      candidates: (n: number) => (n === 1 ? "1 candidate Window, hashed" : `${n} candidate Windows, hashed`),
      checking: "Checking the draw in this browser…",
      verified: "Checked here: the server seed hashes to the commitment, and the HMAC over both seeds replays this exact draw.",
      mismatch: "This browser could not reproduce the draw from the seeds. Do not place it.",
      unavailable: "This browser cannot run the check — it has no WebCrypto.",
      scope: "The commitment proves the reels were not changed after the seed was sealed. The Window was chosen by a rule over the hashed candidate set; that is recorded, not proven.",
    },
    window: {
      label: "Window",
      pair: (asset: string) => `${asset} / USD`,
      settlesIn: (clock: string) => `settles in ${clock}`,
      settling: "settling…",
      dealtAt: (multiple: string, cents: number) => `dealt at ${multiple} (${cents}¢)`,
      otherSide: (side: string, cents: number) => `${side} was ${cents}¢`,
      gone: "This Window has closed to entry. The deal cannot be placed.",
    },
    quote: {
      label: "Live quote",
      live: "Live market odds",
      requoting: "requoting…",
      getting: "Getting the live quote…",
      none: "No liquidity at this size right now.",
      offline: "The live book is not connected — the quote may be stale.",
      price: "Price",
      pays: "Pays",
      contracts: "Est. contracts",
      cost: "Cost",
      slippage: "Slippage cap",
      payout: "If right",
      drift: (dealt: string, live: string) =>
        `The live multiple is ${live}, not the ${dealt} the reel dealt — the book moved. Placing takes the live quote; the reach is the book's, not the reel's.`,
    },
    gas: {
      label: "Gas",
      wallet: "You sign once from your wallet and pay the gas in STT.",
      key: "Your session key places it with no prompt; the gas is the sponsor's.",
      fallback: (why: string) => `${why} You sign from your wallet and pay the gas.`,
    },
    place: (side: string) => `Place ${side} ·`,
    skip: "Skip this deal",
    skipping: "Recording…",
  },

  refused: {
    title: "No deal",
    noWindow: (asset: string, side: string, m: number) =>
      `The draw was fair — ${asset}, ${side}, ${m}× — but the venue has no live ${asset} Window the book could fill at this stake right now. Nothing was placed.`,
    unreadable: "The venue could not be read, so no Window could be chosen. Nothing was placed.",
    declined: "You skipped this deal. Nothing was placed.",
    laneRefused: "The order lane refused it before anything was sent. Nothing was taken.",
    nothingFilled: "The order landed but crossed nothing — the book moved first. Your stake was never taken.",
    reverted: "The transaction reverted. Nothing was taken.",
    gone: "The Window closed before the order could be placed. Nothing was taken.",
  },

  placed: {
    title: "Placed",
    booked: (contracts: string, side: string, cents: number) => `Bought ${contracts} ${side} contracts at ${cents}¢.`,
    measured: (contracts: string, cost: string, symbol: string) => `On the tape: ${contracts} contracts for ${cost} ${symbol}.`,
    notOnTape: "Not on the tape yet — your history keeps checking and will say what filled.",
    pending: "It settles when the Window closes. The result lands here and in your history.",
    unknownTitle: "Sent, no receipt yet",
    unknown: "The send did not come back with a receipt. Your history keeps checking the tape and will say what happened; nothing is assumed either way.",
    tx: "Transaction",
    portfolio: "See it in your portfolio",
  },

  result: {
    won: "You won",
    lost: "Missed",
    void: "Voided",
    cashedOut: "Cashed out",
    eyebrow: "Lucky",
    line: (asset: string, side: string, m: number) => `${asset} · ${side} · ${m}×`,
    pays: (contracts: string, symbol: string) => `pays ${contracts} ${symbol} before the settlement fee`,
    lostLine: (cost: string, symbol: string) => `${cost} ${symbol} staked`,
    voidLine: "the Window was voided — both sides pay their half",
    cashedLine: "closed on the book before the Window settled",
    streak: (n: number) => `Streak ${n}`,
    claim: "Collect it from your portfolio",
    close: "Close",
  },

  history: {
    title: "Your spins",
    connect: "Connect a wallet to see the spins it has made.",
    loading: "Reading your spins…",
    notConfigured: "This deployment has no games store, so there is no spin history to read here. Every placed order is still on chain.",
    empty: "No spins yet.",
    /** One word per state, in the row's verdict slot. Nothing here is a verdict the chain has not given. */
    results: {
      drawn: "not placed",
      placed: "placed",
      pending: "live",
      won: "won",
      lost: "lost",
      void: "void",
      "cashed-out": "cashed out",
      refused: "no deal",
      unknown: "unconfirmed",
    } as Record<string, string>,
    line: (asset: string, side: string, m: number) => `${asset} · ${side} · ${m}×`,
    undealt: "not dealt",
    stake: (amount: string, symbol: string) => `stake ${amount} ${symbol}`,
    cost: (amount: string, symbol: string) => `cost ${amount} ${symbol}`,
    contracts: (n: string) => `${n} contracts`,
    refusal: {
      "no-window": "no Window the book could fill",
      "venue-unreadable": "the venue could not be read",
      declined: "skipped",
      "lane-refused": "refused before sending",
      "nothing-filled": "crossed nothing",
      reverted: "reverted",
      "not-on-tape-yet": "not on the tape yet",
      "send-timed-out": "no receipt",
    } as Record<string, string>,
    streak: "Streak",
    best: "Best",
    tx: "tx",
  },

  board: {
    title: "Streaks",
    intro: "Settled spins only. A streak moves when the chain decides a Window, never before.",
    loading: "Reading the ladder…",
    empty: "Nobody has a settled spin yet.",
    notConfigured: "No games store here, so no ladder.",
    you: "you",
    spins: (n: number) => (n === 1 ? "1 settled" : `${n} settled`),
    now: "now",
    best: "best",
  },
} as const;
