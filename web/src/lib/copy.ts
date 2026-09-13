export * from "@masayume/core/copy";

/** Surface labels only — contract strings live in @masayume/core/copy. */
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
} as const;

export const CONNECT = {
  connect: "Connect",
  connecting: "Connecting…",
  wrongChain: "Wrong network",
  disconnect: "Disconnect",
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
  intro: (amountText: string) => `Start with STT for gas, then claim ${amountText} test tUSDC for trading. No starting balance is needed while gas funding is available.`,
  cta: (_amountText: string) => "Get test funds",
  minted: "Minted — your balance updates on its own",
  minting: "Minting…",
  gasTitle: "Get STT for gas first",
  yourAddress: "Your address:",
  recheck: "I've got STT — check again",
} as const;

export const WALLET_DEV = {
  connection: "Connection",
  balances: "Balances",
  faucet: "Faucet",
  address: "address",
  chain: "chain",
  rightChain: "on Somnia Shannon",
  wrongChain: "not on Somnia Shannon",
  signer: "signer",
  signerBound: "bound to the venue SDK",
  noSigner: "not bound",
  connectFirst: "Connect a wallet to read balances.",
  spendable: "Spendable tUSDC",
  native: "STT for gas",
  escrow: "Order escrow",
  credit: "Venue payout credit",
} as const;

export const DEV = {
  title: "Fixtures",
  intro: "Every card, receipt, and state from canned data — no wallet, no database.",
} as const;

export const MARKETS = {
  title: "Markets",
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
  notes: {
    moved: "That page moved — here are the live Windows.",
    gone: "That Window is gone — showing the live Windows instead.",
    successor: (cadence: string) => `That ${cadence} Window settled — moved you to its successor.`,
  },
} as const;

export const HERO = {
  question: (asset: string) => `Will ${asset} close at or above its opening print?`,
  openingPrint: "opening print",
  livePrice: "live · feed EMA",
  pendingPrint: "waiting for the opening print",
  pendingDistance: "No opening print yet — nothing to measure against.",
  noLivePrice: "No live price right now.",
  needs: { before: "needs", after: (side: string) => `for ${side}` },
  leading: (side: string) => `${side} is winning right now`,
  source: "Settles on the Prophecy oracle median · chart follows the feed EMA",
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
  pair: (asset: string) => `${asset} · USD`,
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
  rows: { escrow: "Order escrow", credit: "Venue payout credit", gas: "STT for gas" },
  escrowNote: "locked in your resting orders until they fill or you cancel",
  creditFirst: "spent first on your next buy in its window",
  creditFirstHint: "of venue credit is spent first on your next buy",
  gasLow: "below the gas envelope — the next write needs more STT",
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

export const VERDICT_UI = {
  title: "Verdict",
  netPnl: "Net P&L",
  paidOut: "Paid out",
  costUnknown: "No entry cost on record for this wallet — showing the payout.",
  legs: "Your legs",
  contracts: "contracts",
  payout: "payout",
  receiptTitle: "Settlement receipt",
  window: "Window",
  openingPrint: "Opening print",
  closingPrint: "Closing print",
  settlementTx: "Settlement tx",
  pendingTx: "landing on chain…",
  oracleGraph: "Oracle graph",
  question: (id: string) => `question ${id}`,
  noQuestion: "not on record",
  settling: "the closing print lands a few seconds after expiry.",
  noPosition: { why: "You held nothing in this window — nothing to stamp." },
  connect: { why: "Connect a wallet to see your verdict." },
  notFound: { why: "This window is gone.", nextAction: { label: "Pick a live window", href: "/markets" } },
  /** The claim card's words — reference `ClaimWinnings.tsx`; the footnote states our fact, not its keeper's. */
  claim: {
    notThisTime: "Not this time",
    lossBody: "The Window closed on the other side of your line.",
    youWon: "You won",
    claimed: "Claimed",
    profit: "Profit",
    ret: "return",
    stake: "Stake",
    payout: "Payout",
    collect: "Collect it now",
    collecting: "Collecting…",
    paid: "Paid to your wallet",
    foot: "Redemption is a call you sign. The payout waits in the venue until you do.",
  },
  devTitle: "Verdict moment",
  devEyebrow: "?m=<marketId> stamps a live window for the connected wallet",
  fixtures: {
    win: "Win — 正夢 in vermilion; the P&L figure is the only green",
    loss: "Loss — 逆夢 in neutral ink; a fact, not a scare",
    void: "Void — 無効; no reliable print, both sides pay 0.5",
    both: "Both sides held — one card, net P&L, both legs listed",
  },
} as const;

export const CLAIM = {
  claimable: "claimable",
  claimAll: "Claim all",
  retry: "Claim the rest",
  title: "Claim everything",
  pageIntro: "Winnings are claimed, never sent. Each redemption is one signature, paid to your wallet only.",
  waiting: (n: number) => (n === 0 ? "Nothing waiting right now" : `${n} settled ${n === 1 ? "Window" : "Windows"} waiting`),
  netLabel: "net of the settlement fee",
  feeNote: (bps: number) => (bps === 0 ? "fee 0% — read from chain" : `fee ${(bps / 100).toString()}% — read from chain`),
  oneSignatureEach: "One signature per redemption — the venue has no batch claim, so each item reports its own outcome.",
  contracts: "contracts",
  closed: "closed",
  settled: "settled",
  kind: {
    win: "Win",
    void: "Void — no reliable print, both sides pay 0.5",
    "vault-credit": "Vault credit — withdrawal",
  },
  leg: { up: "UP leg", down: "DOWN leg" },
  status: {
    pending: "waiting",
    claiming: "claiming…",
    confirmed: "claimed",
    reverted: "reverted — nothing moved",
    unknown: "unknown — check the explorer",
  },
  progress: (current: number, total: number) => `claiming ${current} of ${total}`,
  finished: (claimed: number, total: number) => (claimed === total ? `Claimed ${claimed} of ${total}` : `${claimed} of ${total} claimed — the rest stayed put`),
  stopped: "Stopped early — every remaining item is untouched.",
  receipt: {
    title: "Claim receipt",
    figureLabel: "Paid to your wallet",
    settlement: "settlement tx",
    oracle: "Oracle Graph",
    pending: "…",
    settlementDegraded: "settlement tx not indexed yet — redemption tx only",
    oracleDegraded: "oracle question unknown — raw tx only",
  },
  empty: { why: "Nothing to claim — winnings land here the moment a Window you're in settles." },
  disconnected: { why: "Connect a wallet to see what's waiting for it." },
  dev: {
    title: "Claim-all plate",
    intro: "Canned rows for every claim state, then the live plate for the connected wallet.",
    plate: "Plate, idle",
    progress: "Mid-run — one reverted, one signing",
    receipt: "Success receipt",
    live: "Live — your wallet",
  },
} as const;

export { TICKET, TICKET_PENDING } from "./copy-ticket";
