import { COMPOSER_PERMANENCE } from "@masayume/core/copy";

/**
 * The take's words — ported from `reference/yosuku/components/TakeReelCard.tsx` and
 * `TakeComposer624.tsx`. The reference's provenance line names Walrus and Suiscan;
 * ours names what actually holds a take here: the wallet's signature, verifiable
 * against the author's address.
 */
export const TAKES = {
  pill: "Take",
  postAria: "Post a take",
  anon: "anon",
  backed: "✓ position",
  openCall: "open call",
  window: (cadence: string) => `${cadence} Window`,
  noNote: "No note. The call speaks for itself.",
  signed: "◆ signed by the wallet",
  verify: "verify ↗",
  room: "the Room ↗",
  otherSide: "Take the other side →",
  seeWindow: "See how it closed →",
  /** The call chip: `▲ UP · BTC over $64,316` (reference `callParts`). */
  over: (asset: string, line: string) => `${asset} over ${line}`,
  under: (asset: string, line: string) => `${asset} under ${line}`,
  noLine: (asset: string) => `${asset} vs the opening print`,

  composer: {
    title: "Post a take",
    close: "Close",
    /** The reference: "Your words go on Walrus (free) · your call, on-chain." */
    where: "Your words are stored by Masayume · your call, signed by your wallet.",
    up: "▲ Up",
    down: "▼ Down",
    range: "◆ Range",
    rangePending: "Range calls land with RangeReserve (Stage 5)",
    line: "Line",
    lineNote: "the opening print — the number this Window settles against",
    linePending: "waiting for the opening print",
    spot: (price: string) => `spot ${price}`,
    horizon: "Horizon",
    noWindows: "no live Windows right now",
    captionPlaceholder: "Why this call? (optional)",
    calling: "You're calling",
    noMarket: "no live Window",
    post: "Post take",
    posting: "Posting…",
    connect: "Connect a wallet",
    noLiveMarket: "No live Window for this horizon",
    posted: "Take posted",
    permanence: COMPOSER_PERMANENCE,
    unavailable: {
      title: "Takes aren't connected yet.",
      body: "Posting a take needs the social store, and it isn't configured on this deployment. The reel still carries every live Window.",
    },
  },
} as const;

/** Every way the endpoints refuse, said as the reason rather than as a status. */
export const TAKE_ERRORS = {
  unavailable: "Takes aren't connected yet — the social store isn't configured on this deployment.",
  badRequest: "That request didn't make sense.",
  staleSignature: "That signature has expired. Try posting again.",
  badSignature: "That signature doesn't match the wallet.",
  noWindow: "That Window isn't on the venue.",
  windowClosed: "That Window has already closed — a take is a call on a live one.",
  gateUnreadable: "Couldn't read your position from the chain just now, so the take wasn't posted. Try again in a moment.",
  postFailed: "That didn't post. Try again.",
} as const;
