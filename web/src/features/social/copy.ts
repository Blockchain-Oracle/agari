/**
 * Follows and the Friends board, in the Room's voice (`features/room/copy.ts`): each state says what this is, why a
 * control cannot act yet, and what would change that. Masayume has no follow graph (its games spec names Friends as
 * new scope), so the words are ours; the tone is the reference's.
 */
export const SOCIAL = {
  follow: "Follow",
  following: "Following",
  unfollow: "Unfollow",
  working: "Signing…",
  saving: "Saving…",
  connect: "Connect to follow",
  self: "This is you",
  unavailable: "Follows aren't connected on this deployment.",
  followers: (n: number) => (n === 1 ? "follower" : "followers"),
  followingCount: "following",
  followLabel: (short: string) => `Follow ${short}`,
  unfollowLabel: (short: string) => `Unfollow ${short}`,

  friends: {
    connect: "Connect a wallet to see the people you follow on the board.",
    none: {
      headline: "You don't follow anyone yet.",
      body: "Open a trader's profile from the board, the Room or a take and press Follow. They show up here.",
    },
    quiet: {
      headline: "None of the people you follow closed a call in the last 24 hours.",
      body: "The board ranks settled profit, so friends appear once their bets settle.",
    },
    loading: "Reading the board…",
    you: "You",
    strip: { left: (n: number) => `FRIENDS · ${n}`, center: "LAST 24 HOURS · PROFIT", right: "CLOSED CALLS" },
    cellMeta: (calls: number, winRate: number) => `${calls} calls · ${winRate}% wins`,
  },
} as const;

/** Every way the social routes refuse, said as the reason rather than as a status. */
export const SOCIAL_ERRORS = {
  unavailable: "Follows aren't connected yet — the social store isn't configured on this deployment.",
  badRequest: "That request didn't make sense.",
  staleSignature: "That signature has expired. Try again.",
  badSignature: "That signature doesn't match the wallet.",
  notSignedIn: "Your social session has expired. Sign again to keep following.",
  self: "You can't follow yourself.",
  tooFast: "That's a lot of follows in a minute. Give it a moment.",
  writeFailed: "That didn't save. Try again.",
} as const;
