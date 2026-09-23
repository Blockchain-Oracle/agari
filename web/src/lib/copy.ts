export * from "@agari/core/copy";

/** Surface labels only — contract strings live in @agari/core/copy. */
export const NAV = {
  markets: "Markets",
  reels: "Reels",
  portfolio: "Portfolio",
} as const;

export const SECTIONS = {
  lanes: { index: "01", title: "Live windows" },
  hero: { index: "02", title: "The window" },
  ticket: { index: "03", title: "Your call" },
  /** The reference's own §02 header, verbatim (app/markets/page.tsx L879). */
  words: { index: "02", title: "Just ask", desc: "No chart to read. Will it be up? Just answer yes or no." },
} as const;

/** The §01 rail card — `Market624Card` in the reference. */
export const LANE_CARD = {
  openTicket: (asset: string) => `Open the ticket for this ${asset} Window`,
  oddsLive: "LIVE ODDS",
  oddsLoading: "READING THE BOOK…",
  closing: "CLOSING · NEXT ROUND SOON",
  priceLoading: "···",
  /** Labels the dashed rule on the card sparkline. */
  line: "line",
} as const;

export const WORD_BOARD = {
  reading: "reading the board…",
  between: "Between rounds. New questions open as the next Window does.",
  closes: (clock: string) => `closes ${clock}`,
  /** The two asks are independent contracts, so the bar is a stated derivation, never "the odds". */
  implied: (share: number) => `${share}% implied on Yes`,
  noLean: "no book on both sides yet",
  open: "Open",
} as const;

export const CONNECT = {
  connect: "Connect",
  connecting: "Connecting…",
  wrongChain: "Wrong network",
  disconnect: "Disconnect",
  connected: "Connected wallet",
} as const;

/** The account menu — the reference's rows (`Header.tsx` L337–363), nothing more. */
export const ACCOUNT_MENU = {
  open: "Open account menu",
  tradingAccount: "Trading account",
  wallet: "Wallet",
  portfolio: "Portfolio",
} as const;

export const BANNER = {
  wrongNetwork: (chainName: string) => `This app runs on ${chainName}.`,
  switchTo: (chainName: string) => `Switch to ${chainName}`,
  switching: "Switching…",
} as const;

export const FAUCET = {
  title: "Fuel up",
  intro: (amountText: string) => `Start with SOL for fees, then get ${amountText} test tUSDC for trading. One free signature covers both, and no starting balance is needed while funding is available.`,
  cta: (_amountText: string) => "Get test funds",
  minted: "Minted — your balance updates on its own",
  minting: "Adding test tUSDC…",
  gasTitle: "Get SOL for fees first",
  yourAddress: "Your address:",
  recheck: "I've got SOL — check again",
} as const;

export const WALLET_DEV = {
  connection: "Connection",
  balances: "Balances",
  faucet: "Faucet",
  signCheckTitle: "Signature check",
  signCheck: {
    connectFirst: "Connect a wallet to sign a check message.",
    intro: (cluster: string) => `Signs a short text naming this wallet and ${cluster}, then asks the server to verify it with ed25519.`,
    run: "Sign and verify",
    signing: "Waiting for your wallet…",
    exact: "exact text",
    tampered: "one byte changed",
    verified: "verified by the server",
    rejected: "rejected: the signature did not verify",
    rejectedAsExpected: "rejected, as it must be",
    brokenVerifier: "accepted: the verifier is broken",
    failed: (why: string) => `The check did not complete: ${why}`,
  },
  address: "address",
  chain: "chain",
  rightChain: "signs for this cluster",
  wrongChain: "not signing for this cluster",
  signer: "signer",
  signerBound: "bound to the markets session",
  noSigner: "not bound",
  connectFirst: "Connect a wallet to read balances.",
  spendable: "Spendable tUSDC",
  native: "SOL for fees",
  escrow: "Order escrow",
  credit: "Venue payout credit",
} as const;

export const DEV = {
  title: "Fixtures",
  intro: "Every card, receipt, and state from canned data — no wallet, no database.",
} as const;

export const MARKETS = {
  title: "Markets",
  /** `/markets/<id>`'s own title and preview line, so a shared Window names itself rather than the whole board.
   *  The root layout appends `· Agari`, so the brand does not belong here. */
  windowTitle: (asset: string, cadence: string) => `${asset} ${cadence}`,
  windowDescription: (asset: string, cadence: string) => `Call ${asset} up or down on this ${cadence} Window.`,
  up: "UP",
  down: "DOWN",
  estimated: "estimated",
  volume: "vol",
  noBook: "no book",
  live: (n: number) => `${n} live`,
  trades: (n: number) => `${n} ${n === 1 ? "trade" : "trades"}`,
  fixedStrikeHidden: (n: number) => `${n} fixed-strike ${n === 1 ? "Window" : "Windows"} hidden — v1 lists up/down Windows only.`,
  noLiveWindows: { why: "No live Windows on this venue right now — Windows roll continuously, so this fills in as the next one opens." },
  ticketPlaceholder: { why: "Choose a Window and a side to open your call." },
  /** The market-session chip: the session word (core `sessionStateWord`, D-087), then the phrase's tail or a halt. */
  session: {
    aria: (state: string, label: string) => `Stock market ${state}: ${label}`,
    halted: "halted",
  },
  /** A ticker whose `/session` lane reads `paused:` lists nothing while the rest of its cadence runs. */
  paused: {
    noSource: "Paused: no signed price source",
    corporateAction: "Paused: corporate action",
    clock: "paused",
    why: (asset: string, cadence: string) => `No ${cadence} ${asset} Window opens until a signed print can settle it. The other tickers keep rolling.`,
  },
  /** The ticker picker over a lane that carries up to nine tickers. */
  tickers: {
    group: "Ticker",
    all: "All",
    none: (asset: string, cadence: string) => `No live ${cadence} ${asset} Window right now.`,
  },
  notes: {
    moved: "That page moved — here are the live Windows.",
    gone: "That Window is gone — showing the live Windows instead.",
    successor: (cadence: string) => `That ${cadence} Window settled — moved you to its successor.`,
  },
} as const;

export const HERO = {
  question: (asset: string) => `Will ${asset} close at or above its opening print?`,
  openingPrint: "opening print",
  livePrice: "live · spot",
  pendingPrint: "waiting for the opening print",
  pendingDistance: "No opening print yet — nothing to measure against.",
  noLivePrice: "No live price right now.",
  needs: { before: "needs", after: (side: string) => `for ${side}` },
  leading: (side: string) => `${side} is winning right now`,
  source: "Settles on signed Pyth/RedStone prints at open and close · chart follows spot",
  depthTitle: "Top of book",
  buyUp: "Buy UP",
  buyDown: "Buy DOWN",
  noDepth: "no resting offers",
  contracts: "contracts",
  chartLabel: (asset: string, opening: string, live: string) => `${asset} price: opening print ${opening}, live ${live}`,
  notFound: { why: "This window is gone.", nextAction: { label: "Pick a live window", href: "/markets" } },
  phase: {
    upcoming: "Opens soon",
    pendingOpeningPrint: "Waiting for the opening print",
    trading: "Trading",
    noEntryBuffer: "Closing — no new entries",
    locked: "Locked — waiting for the closing print",
    settledUnclaimed: "Settled",
    finalized: "Settled",
    voided: "Voided",
  },
  devTitle: "Hero market",
  devEmpty: { why: "No live window on this venue right now — come back when the next window opens." },
} as const;

/**
 * The hero-as-ticket head, ported from Yosuku's /markets.
 *
 * Yosuku asks "BTC holds above $77,800?" against a strike its model derives from
 * spot. Masayume's Windows settle at or above the **opening print**, so the print
 * is the line — the same question over a real on-chain number rather than a
 * derived one. Until the print exists there is no line, and the headline says so
 * by naming the pair instead of inventing a level.
 */
export const HERO_HEAD = {
  holdsAbove: (asset: string) => `${asset} holds above`,
  /** "TSLA · USD"; a basket (S19) pairs with "index", its unit being points. */
  pair: (asset: string, unit: "USD" | "index" = "USD") => `${asset} · ${unit}`,
  cadenceGroup: "Market length",
  betweenRounds: "Between rounds",
  settlesIn: "Settles in",
  noClock: "—",
  aboveLine: "above the UP line",
  needsForUp: "for UP to win",
  needs: "needs",
  room: "The Room",
  roomQualifier: "bettors only",
  /** Stage 3 stands the Room up on Postgres + realtime; the control is honest about that now. */
  roomPending: "The Room opens when the comment service is live — it is not connected yet.",
  settlesOnItsOwn: "Settles on its own the moment time's up",
  rampUp: "UP",
  noPrice: "—",
  betUp: "Bet UP",
  betDown: "Bet DOWN",
} as const;

/**
 * The reel, ported from Yosuku's /reels.
 *
 * Same card, same words where they still hold. Two of them could not be carried
 * over as written: the reference asks about a strike derived from spot, and the
 * line here is the opening print (as on /markets); and its cadence words are a
 * fixed 1m/5m/1h table, while lanes here are whatever the venue actually lists,
 * so `formatCadence` names the round instead.
 */
export const REELS = {
  title: "Reels",
  settlesOn: (asset: string) => `${asset} · settles on the price`,
  round: (cadence: string, closesAt: string) => `${cadence} round · closes ${closesAt}`,
  closesIn: "closes in",
  noClock: "—",
  holdsAbove: (asset: string) => `Will ${asset} be above`,
  noLine: "—",
  livePrice: "live price",
  versusLine: "vs line",
  chartHolding: "loading the chart…",
  swipeToRead: "swipe to this market to read it live",
  closing: "closing. the next round is already rolling",
  up: "UP",
  down: "DOWN",
  reading: "reading the market…",
  betweenRounds: "between rounds. a new one rolls on the next cadence.",
  noVenue: "no live venue to read right now.",
  swipeHint: "Swipe up for the next market",
  /** Off-hours the reel below the closed card is takes alone. */
  swipeTakes: "Swipe up for the latest takes",
  /** The right-rail pill (reference L321–330): icon + label, opens the composer. */
  take: "Take",
  postTake: "Post a take",
} as const;

/**
 * Portfolio, ported from Yosuku's /portfolio.
 *
 * The reference's structural claim is that the page has no headline — "the nav
 * already says where you are, and the thing people open this page for is the
 * number" — so the balance is the header and the bets sit under it.
 */
export const PORTFOLIO = {
  title: "Portfolio",
  openBets: (n: number) => `${n} open`,
  settled: (n: number) => `${n} to collect`,
  betsTitle: "Your bets",
  /** The two tabs of Yosuku's own portfolio spec (§Section 4): the live list and the settled one. */
  tabs: { open: "Open", history: "History" },
  noBets: "No bets yet.",
  firstCall: "make your first call",
  /** A wallet with settled Windows behind it has bet before: its empty Open tab is not a first-call prompt. */
  nothingOpen: "Nothing open right now.",
  nextCall: "make your next call",
  live: "Live",
  settling: "Settling",
  left: "left",
  stake: "Staked",
  value: "Worth now",
  bothSides: "UP + DOWN",
  toMarkets: "Go to Markets",
  collectTitle: "To collect",
  recordTitle: "Your record",
} as const;

/** Under every paged list: the owner's "next" (2026-09-04) in place of an endless scroll. */
export const PAGER = {
  aria: "Pages",
  prev: "← Prev",
  next: "Next →",
  range: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
} as const;

export const BALANCE = {
  title: "Your money",
  spendable: "Spendable",
  headlineNote: "what you can bet right now — nothing else is added in",
  poolsLabel: "Other pools of your money",
  rows: { escrow: "Order escrow", credit: "Venue payout credit", gas: "SOL for fees" },
  escrowNote: "locked in your resting orders until they fill or you cancel",
  creditFirst: "spent first on your next buy in its window",
  creditFirstHint: "of venue credit is spent first on your next buy",
  gasLow: "below the fee reserve — the next write needs more SOL",
  connect: { why: "Connect a wallet to see your money: one spendable number, every other pool labeled beneath it." },
  devTitle: "Balance plate",
  fixtures: {
    zero: "Zero wallet",
    funded: "Funded wallet",
    pools: "Escrow + venue credit",
    stale: "Stale — last good kept, as-of tick",
    error: "First read failed",
    loading: "Nothing known yet",
    live: "Live — connected wallet",
  },
} as const;

export { CLAIM, VERDICT_UI } from "./copy-verdict";
export { LANE_STATE } from "./copy-lanes";
export { TICKET, TICKET_PENDING } from "./copy-ticket";
export { PREOPEN } from "./copy-preopen";
