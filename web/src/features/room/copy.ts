/**
 * The Room's words — ported from `reference/yosuku/components/CommentRoom.tsx`.
 *
 * The reference's onboarding states each say one thing plainly: what this is, why
 * you cannot speak yet, and what would change that. That structure is kept; the
 * mechanics named in it are ours.
 */
export const ROOM = {
  eyebrow: "The room",
  qualifier: "bettors only",
  close: "Close",
  compose: "Say something",
  send: "Send",
  sending: "Sending…",
  join: "Join the room",
  joining: "Joining…",
  bet: "Place a bet to join",
  connect: "Connect wallet",
  empty: "No one has said anything yet. Go first.",
  remaining: (left: number) => `${left}`,

  states: {
    unavailable: {
      title: "The Room isn't connected yet.",
      body: "Comments need the social store, and it isn't configured on this deployment. Everything else on this Window works.",
    },
    connect: {
      title: "The Room is for people with a position.",
      body: "Connect your wallet and we'll check whether you're in this Window.",
    },
    locked: {
      title: "You need a position in this Window.",
      body: "The Room is bettors only, and the check is on-chain — not a setting we can wave. Take a side and it opens.",
    },
    joinable: {
      title: "You're in this Window.",
      body: "Sign once to prove the wallet is yours. It moves no funds and costs nothing.",
    },
  },

  /** A ticker's standing Room (`$TSLA`): everyone who ever traded one of its Windows. */
  ticker: {
    /** The sheet head's two segments. */
    window: "This Window",
    room: (symbol: string) => `$${symbol}`,
    switchLabel: "Which Room",
    title: (symbol: string) => `$${symbol} · every Window`,
    open: (symbol: string) => `$${symbol} Room`,
    locked: {
      title: (symbol: string) => `You need a position in a ${symbol} Window.`,
      body: "The Room is bettors only, and the check is on-chain — not a setting we can wave. Trade any Window of this stock and it opens.",
    },
    joinable: {
      title: (symbol: string) => `You've traded ${symbol}.`,
      body: "Sign once to prove the wallet is yours. It moves no funds and costs nothing.",
    },
  },
} as const;

/** Every way the endpoints refuse, said as the reason rather than as a status. */
export const ROOM_ERRORS = {
  unavailable: "The Room isn't connected yet — the social store isn't configured on this deployment.",
  badRequest: "That request didn't make sense.",
  staleSignature: "That signature has expired. Try joining again.",
  badSignature: "That signature doesn't match the wallet.",
  noPosition: "No position on this Window for that wallet. The Room is bettors only.",
  gateUnreadable: "Couldn't read your position from the chain just now, so the Room stayed shut. Try again in a moment.",
  notJoined: "Your Room session has expired. Join again to keep reading.",
  postFailed: "That didn't post. Try again.",
  rateLimited: "That's a lot at once. Give it a few seconds and try again.",
  notDeployed: "That route's positions aren't indexed yet, so the Room can't record them.",
} as const;
