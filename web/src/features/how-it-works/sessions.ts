import { CalendarClockIcon, ClockIcon, MoonIcon, OctagonAlertIcon, ScaleIcon, WalletIcon, type LucideIcon } from "lucide-react";

/**
 * The facts Masayume's venue never had: a market clock.
 *
 * Masayume traded BTC and ETH, which never close, so its `/how-it-works` has no session, no lane and no halt. Agari
 * trades stocks, so the page keeps every Masayume section and adds two of its own in the same card grammar (D-081,
 * D-093): "Sessions & Lanes" after Getting Started, and "Halts, Voids & Your Money" after the Settlement Process.
 *
 * Sources, asserted rather than assumed: `docs/plan/specs/session-lanes.md` §1–§3 (the Gap and token lanes, halts,
 * voids), `services/ops/config/price-sources.json` (feeds, thresholds, the 25 bps band), `packages/core/src/copy/
 * session-words.ts` (D-087 words), `web/src/lib/copy-preopen.ts` (D-088, the promise verbatim), `packages/core/src/
 * market/halts.ts` (D-057 / Q-S6-9 labels), `packages/core/src/market/void-reason.ts` (the void line),
 * `web/src/features/session/copy.ts` (the Trading Balance and its caps).
 */

export interface Lane {
  name: string;
  clock: string;
  body: string;
  icon: LucideIcon;
}

/** The three lanes the venue lists, in board order (`packages/core/src/market/lanes.ts`: regular, gap, token). */
export const LANES: readonly Lane[] = [
  {
    name: "Regular",
    clock: "5m · 15m · 60m · NYSE hours",
    body: "Windows run back to back while US markets are open, 09:30 to 16:00 ET, Monday to Friday. A 5m Window opens on the five-minute mark and settles five minutes later; 15m and 60m run the same way on their own marks. The venue lists nothing outside the session, and an early close ends the lane early.",
    icon: ClockIcon,
  },
  {
    name: "Gap",
    clock: "Friday close → Monday open",
    body: "One Window a week across the weekend. Calls open at Friday's 16:00 ET close, the Window locks Sunday 20:00 ET, and it settles on Monday's first regular-session print at 09:30:00 ET — the opening print of the new session, not the opening cross.",
    icon: MoonIcon,
  },
  {
    name: "Token",
    clock: "24/7 · xStocks",
    body: "Tokenised stock on Solana — TSLAx, NVDAx, SPYx, QQQx — keeps trading when the exchange does not, so these Windows run every hour of every day on the same 5m, 15m and 60m cadences. They settle on the token's own signed quote, not the exchange's print.",
    icon: CalendarClockIcon,
  },
];

/** D-087: the session is a word and a countdown, everywhere. `sessionStateWord` is the one source of these. */
export const SESSION_WORDS: readonly [string, string][] = [
  ["Open", "the exchange is trading; Windows open and close on their marks"],
  ["Pre-market", "before 09:30 ET — listed Windows take calls, none of them fill"],
  ["After hours", "after 16:00 ET — the session is done and the next open is on the clock"],
  ["Weekend", "Saturday or Sunday; the Gap Window is the lane that is awake"],
  ["Holiday", "the exchange is shut for the day, and the chip says so by name"],
  ["Early close", "a half day — 13:00 ET — and the lane ends with it"],
];

/** D-088, the promise in the product's own words (`web/src/lib/copy-preopen.ts`). Nothing here is softened. */
export const PRE_OPEN = {
  title: "Calls before the bell",
  body: "The venue lists tomorrow's first Windows at tonight's close, so a call can be made while the market is shut. It rests post-only at your price: nothing fills before the open boundary, and if the book comes to you in the first minute after the bell, it fills at the price you set.",
  points: [
    "Your wallet signs. The stake is held from the moment it rests until it fills, you cancel, or it expires.",
    "An unfilled call expires 90 seconds after the bell by default and the stake returns as venue credit. Resting until the Window locks is opt-in.",
    "No fill is promised. The venue's maker, or any trader, may take a resting call at your price.",
    "The 0.25 tUSDC seat bond comes back once the Window settles, and an unfilled call loses nothing if the Window voids.",
  ],
} as const;

export interface BasisRow {
  source: string;
  detail: string;
}

/** `price-sources.json`: which signed source each Window settles on, and what the program checks before it counts. */
export const BASIS_ROWS: readonly BasisRow[] = [
  { source: "Pyth", detail: "a pull price for TSLA, QQQ and VOO, admitted at the boundary second with a confidence no wider than 50 bps" },
  { source: "RedStone", detail: "signed packages for the seven single names, counted only when at least 3 of the 5 configured signers agree" },
  { source: "Switchboard", detail: "the token lane's Surge quote, signed by at least 3 distinct oracles and no more than 20 slots old" },
  { source: "Cross-check", detail: "where a policy names a second source, both boundaries are compared; more than 25 bps apart and the Window voids" },
];

export interface Aside {
  title: string;
  body: string;
  icon: LucideIcon;
}

/** D-057 / Q-S6-9 wording, and the void line the verdict actually prints. */
export const ASIDES: readonly Aside[] = [
  {
    title: "Halts",
    body: "There is no licensed halt feed here, so a lane is halted when the signed price it settles on stops being printable. A Pyth tick wider than 50 bps, or an xStock the issuer has flagged, says “Trading halted”. A feed that has simply stopped — no Pyth tick for 15 s, a RedStone package older than 60 s, three failed token quotes — says “Signed price stale”. Either way the venue lists nothing new and the maker pulls its quotes. A halt never touches the chain, and it is never given as the reason a Window resolved.",
    icon: OctagonAlertIcon,
  },
  {
    title: "Voids",
    body: "If no reliable print lands inside the settlement window, the Window voids and both sides pay 0.5 — your stake back. The verdict says “Void — no reliable print, both sides pay 0.5”, and one line under it says why: a missing print names the source, the boundary and the deadline it passed; a cross-check divergence names the 0.25% band the two sources fell outside. Redemption credits the venue, the same as a win.",
    icon: ScaleIcon,
  },
  {
    title: "Your money",
    body: "Everything here is tUSDC on Solana devnet, minted by the venue's faucet — it is worth nothing anywhere else. A deposit into your Trading Balance lets a browser key tap inside caps you set, so a call costs a tap instead of a wallet prompt; that key can never withdraw, only your wallet can. Nothing on the server ever holds a key of yours.",
    icon: WalletIcon,
  },
];
