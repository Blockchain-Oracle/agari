import type { SenseiMessage } from "./protocol";

/**
 * Sensei's surface copy — from `reference/yosuku/components/SenseiDock.tsx` L23–30, L61–67.
 *
 * The intro is rewritten for what this venue actually is (several assets, several
 * Window lengths, the user signs) and for what Sensei here can actually do: the
 * reference promises "tap a market below to trade, gas-free", which describes its
 * own embedded trade path and its own sponsorship. Neither is true here — Sensei
 * hands you to the ticket, and you sign.
 */
export const SENSEI_INTRO: SenseiMessage = {
  role: "assistant",
  content:
    "I'm Sensei. I read the live market with you and give you a straight call. UP, DOWN, or sit it out. Then act on it right here: pick a Window below and it opens in your ticket. Testnet, test funds only. I read and recommend, you place the trade.",
};

export const SENSEI_STARTERS = ["Read the current market", "Up or down on the next close?", "Is this a coin-flip?"] as const;

/** Short rotating questions the dock pops to invite a tap. */
export const SENSEI_TEASERS = ["Up or down?", "Coin-flip?", "Want a read?", "Which way?"] as const;

export const SENSEI_UI = {
  eyebrow: "Your trading assistant",
  title: "Sensei",
  beta: "beta",
  open: "Open Sensei, your trading assistant",
  ask: (teaser: string) => `Ask Sensei: ${teaser}`,
  close: "Close",
  placeholder: "Ask Sensei about the market…",
  send: "Ask",
  name: "Sensei",
  nameEmphasis: "AI",
  flat: "flat",
  left: "left",
  reading: "···",
  minute: (mins: number) => (mins < 1 ? "<1 min" : `${mins} min`),
  tradeHead: "Act on it",
  tradeSub: "opens your ticket",
  tradeHide: "Hide the trade cards",
  tradeEmpty: "No live Window to act on right now.",
  /** What a cents figure means, in place of the reference's payout multiple — which it derived from its own invented probability. */
  perDollar: "per $1",
  network: "Network error. Try again.",
} as const;

/**
 * The follow-up chips under a reply — `chipsFor`, reference L61–67, verbatim rules.
 *
 * They read the reply's own text to decide what to offer next, which is why the
 * sit-it-out branch comes first: when Sensei has just talked someone down, the
 * offered follow-ups must not be three ways to ask again.
 */
export function chipsFor(reply: string): readonly string[] {
  const text = reply.toLowerCase();
  if (/sit (this|it|the next|out)|coin.?flip|don'?t (take|bet)|skip it|take a breath|pause|tilt|no bet/.test(text)) {
    return ["Good call, skip it", "Show me another market", "Why sit out?"];
  }
  if (/\bup\b/.test(text) && /\bdown\b/.test(text)) return ["Why that side?", "What's the risk?", "What would flip it?"];
  if (/risk|thin|tight|lean|shakeout/.test(text)) return ["What would flip it?", "How much should I risk?", "Read the next market"];
  return ["Why?", "What's the risk?", "Read the next market"];
}
