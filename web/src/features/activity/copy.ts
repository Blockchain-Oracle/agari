import type { ActivityKind } from "./protocol";

/**
 * `/activity`, its rows and the lifecycle notifications. Masayume left notifications pending (Q-001), so the words
 * are ours, in the reference's voice: the page reads like `/news` (a live eyebrow, a two-tone headline, the Japanese
 * line, one sentence of intro), and each row says what happened in the plainest terms, with the money exact.
 */
export const ACTIVITY = {
  title: "Activity",
  live: "Updated live",
  heading: "Your",
  headingAccent: "Activity",
  headingJp: "取引の記録。",
  intro: "Fills, verdicts and payouts from the chain's own record, plus what the people you follow are calling.",
  tabs: { inbox: "Inbox", following: "Following" },
  tabsLabel: "Activity feeds",
  notifications: { enable: "Turn on notifications", on: "Notifications on", blocked: "Notifications blocked" },
  friends: { title: "Friends", desc: "The traders you follow, and you, on the same 24-hour board.", meta: "rolling 24h" },
  calls: { title: "Their calls", desc: "Fills, verdicts and takes from the wallets you follow, newest first." },
  connect: {
    title: "Connect a wallet to see its activity.",
    body: "The inbox reads your fills and settlements from the index. It needs no signature.",
    cta: "Connect",
  },
  loading: "Reading the index…",
  failed: "The activity feed couldn't be read just now. We'll try again automatically.",
  unavailable: "Activity needs the index store, and it isn't configured on this deployment.",
  empty: {
    inbox: "Nothing here yet. Your fills and verdicts land here as the chain records them.",
    following: "Follow traders from their profiles and their calls show up here.",
    followingQuiet: "The people you follow haven't made a call yet.",
    ticker: "No calls on this ticker yet.",
  },
  you: "you",

  tag: {
    fill: "Fill",
    "settled-win": "Won",
    "settled-loss": "Lost",
    voided: "Void",
    claimable: "Claim",
    "paid-automatically": "Paid auto",
    take: "Take",
    copied: "Copied",
  } satisfies Record<ActivityKind, string>,

  /** Row headlines. `window` is "TSLA 5m"; `money` is already formatted with its symbol. */
  row: {
    fill: (window: string, side: string, money: string | null) => `${window} · ${side} filled${money ? ` · ${money}` : ""}`,
    win: (window: string, money: string | null) => `${window} · Won${money ? ` ${money}` : ""}`,
    loss: (window: string, money: string | null) => `${window} · Lost${money ? ` ${money}` : ""}`,
    voided: (window: string, money: string | null) => `${window} · Voided${money ? ` · ${money} back` : ""}`,
    claimable: (window: string, money: string | null) => `${window} · ${money ?? "Winnings"} to claim`,
    paid: (window: string, money: string | null) => `${window} · Paid automatically${money ? ` · ${money}` : ""}`,
    take: (caption: string) => `“${caption}”`,
    takeNoNote: (window: string, side: string) => `${window} · called ${side}`,
    copied: (window: string) => `${window} · Copied`,
  },
  side: { up: "Up", down: "Down" },
  unknownWindow: "A Window",
} as const;

/** The in-tab lifecycle notifications (toast + system notification), one per event. */
export const LIFECYCLE = {
  fill: (window: string, side: string) => ({ title: `Filled on ${window}`, body: `Your ${side} call was filled.` }),
  win: (window: string, money: string | null) => ({ title: `${window} settled: you won`, body: money ? `Net ${money}.` : "The Window settled your way." }),
  winClaimable: (window: string, money: string | null) => ({
    title: `${window} settled: you won`,
    body: `${money ? `${money} to claim. ` : ""}Claim within 5 minutes or it's paid automatically.`,
  }),
  loss: (window: string, money: string | null) => ({ title: `${window} settled: you lost`, body: money ? `Net ${money}.` : "The Window settled the other way." }),
  voided: (window: string, money: string | null) => ({ title: `${window} was voided`, body: money ? `${money} comes back to you.` : "Your stake comes back to you." }),
  claimable: (window: string, money: string | null) => ({ title: `${money ?? "Winnings"} to claim`, body: `${window} settled. Claim it in Portfolio.` }),
  paid: (window: string, money: string | null) => ({ title: "Paid automatically", body: `${money ? `${money} from ` : ""}${window} reached your wallet.` }),
  copied: (window: string) => ({ title: `Copied on ${window}`, body: "A copy of your call was filled." }),
  more: (n: number) => ({ title: `${n} more ${n === 1 ? "update" : "updates"}`, body: "See them all in Activity." }),
} as const;
