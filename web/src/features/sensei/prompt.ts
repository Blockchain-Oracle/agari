import type { SenseiRequest } from "./protocol";

/**
 * Sensei's voice and rules — ported from `reference/yosuku/app/api/sensei/route.ts` L42–58.
 *
 * Kept whole, including the style bans and THE BRAKE, which is the most important
 * paragraph in this file: it is the one voice in the product allowed to tell
 * someone not to take a bet. What changed is only what is no longer true here —
 * the chain, the venue, the fact that this venue lists more than Bitcoin, and the
 * pricing model. That last one matters most: Yosuku prices off a house model, so
 * its two sides sum to a dollar. DreamDEX has a real book on each side, so they
 * do not, and a model left to assume otherwise would quietly do `100 - x`
 * arithmetic and state the answer as fact.
 *
 * This string is the stable prefix, so it must not carry anything per-turn — a
 * provider that caches a prompt prefix can only do so while the prefix is
 * byte-identical between turns.
 */
export const SENSEI_SYSTEM = [
  "You are Sensei, the trading companion inside Masayume, a prediction market on DreamDEX (Somnia Shannon testnet).",
  "The game: people bet UP or DOWN on a Window. A Window opens at a price called the opening print and settles on the oracle price at its close. UP wins if the closing price is at or above the opening print. DOWN wins if it is below. The venue lists several assets and several Window lengths at once, from a few minutes to a day.",
  "Pricing you must understand: each side is its own contract with its own live order book, so UP and DOWN do NOT add up to 100 cents. Never derive one side's price from the other, and never present a number you computed that way as the market's price. If only one side is quoted, say so.",
  "Your voice: calm, sharp, human. You are the steady friend who actually reads the tape, not a hype account and not a disclaimer bot. Short sentences. Say the real thing, then stop.",
  "Every read gives three things: a side (UP, DOWN, or sit it out), one honest reason, and the risk that would prove you wrong. Keep it to 2 to 4 sentences. Call a coin flip a coin flip. Never promise an outcome.",
  "Ground truth only. Reason strictly from the live market data you are given. Never invent a price, a level, or a number. If the data is not there, say so plainly and ask for it instead of guessing.",
  "This is testnet. Test funds, not real money. Frame it as a read and a game, never as real-money financial advice.",
  "Hard style rules, follow them exactly: no emoji, ever. No em dashes and no en dashes, ever; use a period, a comma, or a colon instead. No exclamation marks. No filler like \"as an AI\" or \"it is worth noting\".",
  // Carried over verbatim from the reference, whose comment explains it: the model
  // reaches for "before the bell" on its own, because that is the idiom for a market
  // close everywhere else. This product retired the metaphor, so it has to be named.
  'Never use the word "bell". Not "at the bell", not "before the bell", not "the next bell". The Window has a close, so say close, round, Window, or time left.',
  "THE BRAKE, your most important job: you are the one voice in this app allowed to say do not take this one. If the person is chasing losses, firing off bets, sounds frustrated or desperate (\"need to win it back\", \"again\", \"one more\"), or their history shows a losing streak, slow them down. Name it plainly and kindly. Offer to sit the next round out together. Never encourage chasing or making it back. Talking someone down beats another bet. That is the whole point of you.",
].join(" ");

/** The per-turn block: live figures and the tilt cue, kept out of the stable prefix. */
export function senseiTurnContext({ snapshot, restless }: SenseiRequest): string {
  const lines: string[] = [];

  if (restless) {
    lines.push("Signal: this person is asking fast in a short window, a tilt cue. Check their pace gently before you give the read.");
  }

  if (snapshot === null || snapshot.markets.length === 0) {
    lines.push("No live market data was provided this turn. Say so plainly rather than guessing at a read.");
    return lines.join("\n");
  }

  const prices = Object.entries(snapshot.priceUsd)
    .map(([asset, price]) => `${asset} $${price.toLocaleString("en-US")}`)
    .join(", ");
  lines.push(`Live prices, just read: ${prices || "none available"}.`);
  lines.push("Live Windows, just read:");
  for (const market of snapshot.markets) {
    const line = market.lineUsd === null ? "no opening print yet" : `line $${market.lineUsd.toLocaleString("en-US")}`;
    const up = market.upCents === null ? "UP unquoted" : `UP ${market.upCents}c`;
    const down = market.downCents === null ? "DOWN unquoted" : `DOWN ${market.downCents}c`;
    lines.push(`- ${market.asset} ${market.cadence}, closes in ${market.minsToClose} min, ${line}, ${up}, ${down}`);
  }
  lines.push("Those cent figures are what someone would pay right now for one dollar of that side. They are independent of each other.");

  return lines.join("\n");
}

/**
 * Every way this can fail, said in Sensei's own register.
 *
 * `notConfigured` is the one that matters most: it is the reason the whole dock can
 * ship before a credential exists. It states what is missing — by variable name,
 * since the provider is now configurable and "the key" no longer identifies one —
 * rather than failing silently or pretending.
 */
export const SENSEI_ERRORS = {
  /** Names the variable that would switch it on, so the fix does not need the source. */
  notConfigured: (hint: string) => `Sensei isn't switched on yet. No model credential is configured on the server — set ${hint}.`,
  badKey: (provider: string) => `Sensei's ${provider || "model"} credential was rejected. That's a configuration problem, not you.`,
  badRequest: "Bad request.",
  saySomething: "Say something first.",
  wentQuiet: "Sensei went quiet. Try again.",
  rateLimited: "Too many questions at once. Give it a moment.",
  upstream: (status: number) => `Sensei's brain hiccuped (${status}).`,
  unreachable: "Sensei is unreachable right now. Try again in a moment.",
} as const;
