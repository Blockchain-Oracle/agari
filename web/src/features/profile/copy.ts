/**
 * `/u/[address]` — a trader's public profile. Masayume has no profile page, so the frame is `/news`'s (live eyebrow,
 * two-tone headline, the Japanese line, one sentence) and the sections are Portfolio's own (record, reputation,
 * badges, open bets) with the reference's numbered section headers. Identity is the address, its hue and a verified
 * X handle only (Q-S13-7: no free-text names).
 */
export const PROFILE = {
  title: (short: string) => `${short} · Trader`,
  eyebrow: "Trader profile",
  eyebrowYou: "Your profile",
  headingJp: "取引者の記録。",
  intro: "A wallet's record on Agari, read from the chain's own index: every settled Window, the badges it earned and the calls still running.",
  followers: "Followers",
  following: "Following",
  x: "On X",
  xVerified: "verified link",
  /** A-3b: copy this wallet's calls as a strategy. */
  copyTrader: "Copy this trader",
  explorer: "Explorer ↗",
  copy: "Copy address",
  copied: "Copied",
  dash: "—",

  record: { number: "01", title: "Record", desc: "Settled Windows only, by the chain's settlement rule." },
  edge: {
    number: "02",
    title: "Edge",
    desc: "How the settled record was made, measured over the same Windows.",
    open: "Open edge report →",
    none: "The edge report fills in once Windows settle.",
  },
  calls: { number: "03", title: "Open calls", desc: "Positions on Windows still running, marked to the book.", none: "No calls running right now." },
  takes: { number: "04", title: "Takes", desc: "Signed calls this wallet posted, newest first.", none: "No takes posted yet." },
  failed: "This part of the profile couldn't be read just now. It retries on its own.",
} as const;
