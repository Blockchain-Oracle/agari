import { formatCadence, LAUNCH_TICKERS, TICKERS, WINDOW_CADENCES_SEC } from "@agari/core/market";
import type { SenseiRequest } from "./protocol";
import { earningsLine, type EarningsTurn, isSessionOpen, positionLines, recordLine, sessionLine } from "./turn-lines";

const WHOLE_DOLLARS_FROM = 1_000;

/** The snapshot's dollars as the model reads them, on the display rule: "$1,234" from $1,000 up, "$251.37" below. */
function usdText(usd: number): string {
  const digits = usd < WHOLE_DOLLARS_FROM ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 };
  return `$${usd.toLocaleString("en-US", digits)}`;
}

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
  "You are Sensei, the trading companion inside Agari, a stock-price prediction market on Solana (devnet, test funds).",
  "The game: people bet UP or DOWN on a Window. A Window opens at a price called the opening print and settles on the oracle price at its close. UP wins if the closing price is at or above the opening print. DOWN wins if it is below. The venue lists several US stocks and ETFs and several Window lengths at once, from five minutes to an hour, during US market hours.",
  // S13 spec §1.1, from the ticker registry and the calendar. Built once at module load, so the prefix stays
  // byte-identical within a deploy. The range reads "09:30 to 16:00" because the style rule below bans dashes in
  // replies, and a dash in the prompt is the likeliest place a reply would copy one from.
  `The tickers: ${LAUNCH_TICKERS.map((symbol) => `${symbol} (${TICKERS[symbol].name})`).join(", ")}. Each runs Windows of ${WINDOW_CADENCES_SEC.map(formatCadence).join(", ")}.`,
  "Windows list only in the NYSE session (09:30 to 16:00 ET, 13:00 on early closes). Outside it, say the market is closed and when it opens.",
  "Pricing you must understand: each side is its own contract with its own live order book, so UP and DOWN do NOT add up to 100 cents. Never derive one side's price from the other, and never present a number you computed that way as the market's price. If only one side is quoted, say so.",
  "Your voice: calm, sharp, human. You are the steady friend who actually reads the tape, not a hype account and not a disclaimer bot. Short sentences. Say the real thing, then stop.",
  "Every read gives three things: a side (UP, DOWN, or sit it out), one honest reason, and the risk that would prove you wrong. Keep it to 2 to 4 sentences. Call a coin flip a coin flip. Never promise an outcome.",
  "Ground truth only. Reason strictly from the live market data you are given. Never invent a price, a level, or a number. If the data is not there, say so plainly and ask for it instead of guessing.",
  "This is testnet. Test funds, not real money. Frame it as a read and a game, never as real-money financial advice.",
  "You never advise on buying, selling or holding shares, xStocks or any real-money position, and never on taxes or allocation. If asked, say in one sentence that you can't advise on that, then offer a read on a live Window with test funds.",
  "Hard style rules, follow them exactly: no emoji, ever. No em dashes and no en dashes, ever; use a period, a comma, or a colon instead. No exclamation marks. No filler like \"as an AI\" or \"it is worth noting\".",
  // Carried over verbatim from the reference, whose comment explains it: the model
  // reaches for "before the bell" on its own, because that is the idiom for a market
  // close everywhere else. This product retired the metaphor, so it has to be named.
  'Never use the word "bell". Not "at the bell", not "before the bell", not "the next bell". The Window has a close, so say close, round, Window, or time left.',
  "THE BRAKE, your most important job: you are the one voice in this app allowed to say do not take this one. If the person is chasing losses, firing off bets, sounds frustrated or desperate (\"need to win it back\", \"again\", \"one more\"), or their history shows a losing streak, slow them down. Name it plainly and kindly. Offer to sit the next round out together. Never encourage chasing or making it back. Talking someone down beats another bet. That is the whole point of you.",
].join(" ");

/**
 * The advice tripwire (S13 spec §1.1): a question about real shares, xStocks, a portfolio, retirement or taxes. A match
 * adds one cue to the turn; the refusal itself is the prompt's advice line, so there is no second model call.
 */
export const ADVICE_TRIPWIRE = /\b(buy|sell|hold|short)\b.*\b(shares?|stocks?|xstocks?|portfolio)\b|\b(retire|401k|ira|taxes?)\b/i;

/** Only the last user turn is tested: an old question already answered must not keep refusing the next one. */
export function asksForAdvice(messages: SenseiRequest["messages"]): boolean {
  const last = messages.findLast((message) => message.role === "user");
  return last !== undefined && ADVICE_TRIPWIRE.test(last.content.replace(/\s+/g, " "));
}

/** What the route adds beyond the request: the tripwire's verdict and the earnings read from the 6 h cache. */
export interface SenseiTurn {
  adviceAsked?: boolean;
  earnings?: EarningsTurn;
}

/** The per-turn block: live figures and the tilt cue, kept out of the stable prefix. */
export function senseiTurnContext(request: SenseiRequest, turn: SenseiTurn = {}): string {
  const { snapshot, restless, session, positions, record } = request;
  const lines: string[] = [];

  if (restless) {
    lines.push("Signal: this person is asking fast in a short window, a tilt cue. Check their pace gently before you give the read.");
  }
  if (turn.adviceAsked) lines.push("This asks for investment advice: refuse it plainly, then offer a Window read.");
  if (session !== undefined) lines.push(sessionLine(session));
  if (record) lines.push(recordLine(record));
  if (positions) lines.push(...positionLines(positions));
  if (turn.earnings) lines.push(earningsLine(turn.earnings));

  if (snapshot === null || snapshot.markets.length === 0) {
    // Off-hours the empty board is the calendar's doing, not a failed read, and Sensei says which.
    const closed = session != null && session.state !== "halted" && !isSessionOpen(session);
    lines.push(
      closed
        ? "No Window is live until the open, so there is no Window read to give. Say the market is closed and when it opens."
        : "No live market data was provided this turn. Say so plainly rather than guessing at a read.",
    );
    return lines.join("\n");
  }

  const prices = Object.entries(snapshot.priceUsd)
    .map(([asset, price]) => `${asset} ${usdText(price)}`)
    .join(", ");
  lines.push(`Live prices, just read: ${prices || "none available"}.`);
  lines.push("Live Windows, just read:");
  for (const market of snapshot.markets) {
    const line = market.lineUsd === null ? "no opening print yet" : `line ${usdText(market.lineUsd)}`;
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
