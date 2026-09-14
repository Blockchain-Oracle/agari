import { TICKERS, TICKER_SYMBOLS, type TickerSymbol } from "../market/tickers";
import type { Side } from "../types/market";
import { oneUnit } from "../units/decimals";

/** Supported instructions: the Regular lane cadences (plan §2.2). The live venue decides which Windows are available now. */
export const X_CADENCES = { "5m": 300, "15m": 900, "1h": 3_600 } as const;
export type XCadence = keyof typeof X_CADENCES;

export type XAsset = TickerSymbol;
/** Every ticker by its symbol, and the company words people actually type. */
const NAME_WORDS: Record<string, TickerSymbol> = { tesla: "TSLA", nvidia: "NVDA", apple: "AAPL", microsoft: "MSFT", amazon: "AMZN", google: "GOOGL", alphabet: "GOOGL" };
const ASSETS: Record<string, XAsset> = { ...Object.fromEntries(TICKER_SYMBOLS.map((symbol) => [symbol.toLowerCase(), TICKERS[symbol].symbol])), ...NAME_WORDS };
/** Words that name an asset Agari does not list: refused as unknown rather than ignored. */
const UNLISTED_ASSET_RE = /^(btc|bitcoin|eth|ethereum|ether|sol|bnb|xrp|doge|ada|link|avax|coin|mstr|hood|amd|nflx)$/;
/** Side words the parser understands; everything maps onto the venue's two outcomes. */
const SIDES: Record<string, Side> = { up: "up", down: "down", long: "up", short: "down", yes: "up", no: "down", over: "up", under: "down" };
/** Units that may trail a stake and mean nothing more than "collateral". */
const UNITS = new Set(["usdc", "tusdc", "usd", "usdso", "$"]);

export type XRefusalReason =
  | "empty"
  | "no-side"
  | "two-sides"
  | "no-asset"
  | "unknown-asset"
  | "two-assets"
  | "no-stake"
  | "bad-stake"
  | "two-stakes"
  | "no-cadence"
  | "cadence-not-listed"
  | "two-cadences"
  | "unknown-token";

export interface XInstruction {
  side: Side;
  asset: XAsset;
  cadence: XCadence;
  intervalSec: number;
  stakeBase: bigint;
}

export type XParse = { ok: true; instruction: XInstruction } | { ok: false; reason: XRefusalReason; token?: string };

/** The one sentence the UI shows as the grammar. */
export const X_GRAMMAR = "@handle <ticker> <up|down> <stake> <5m|15m|1h>";
export const X_EXAMPLES = ["tsla up 5 15m", "nvda down $10 1h", "tesla long 25 5m"] as const;

const STAKE_RE = /^\$?(\d+(?:\.\d+)?)$/;
const CADENCE_RE = /^(\d+)(m|h|d)$/;

function stakeToBase(text: string, decimals: number): bigint | null {
  const [whole = "0", fraction = ""] = text.split(".");
  if (fraction.length > decimals) return null;
  return BigInt(whole) * oneUnit(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

/**
 * A mention becomes exactly one order or exactly one refusal. Tokens may come in any order;
 * a second side, asset, stake or cadence is ambiguity and refused rather than guessed, and
 * a token carrying digits that is not a stake or a listed cadence (e.g. "3x") is refused
 * too — the reference's leverage grammar has no meaning here. Plain words outside the
 * vocabulary ("please") are ignored.
 */
export function parseInstruction(text: string, options: { decimals: number }): XParse {
  const tokens = text
    .toLowerCase()
    .replace(/\b(\d+)\s*(?:minutes?|mins?)\b/g, "$1m")
    .replace(/\b(\d+)\s*(?:hours?|hrs?)\b/g, "$1h")
    .replace(/\b(\d+)\s*days?\b/g, "$1d")
    .replace(/\b24h\b/g, "1d")
    .replace(/[,;:!?()"']/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !t.startsWith("@") && !t.startsWith("#") && !t.startsWith("http"));
  if (tokens.length === 0) return { ok: false, reason: "empty" };

  let side: Side | null = null;
  let asset: XAsset | null = null;
  let cadence: XCadence | null = null;
  let stakeText: string | null = null;

  for (const token of tokens) {
    if (UNITS.has(token)) continue;
    const sideWord = Object.hasOwn(SIDES, token) ? SIDES[token] : undefined;
    if (sideWord) {
      if (side) return { ok: false, reason: "two-sides", token };
      side = sideWord;
      continue;
    }
    const assetWord = Object.hasOwn(ASSETS, token) ? ASSETS[token] : undefined;
    if (assetWord) {
      if (asset) return { ok: false, reason: "two-assets", token };
      asset = assetWord;
      continue;
    }
    const cadenceMatch = CADENCE_RE.exec(token);
    if (cadenceMatch) {
      if (!Object.hasOwn(X_CADENCES, token)) return { ok: false, reason: "cadence-not-listed", token };
      if (cadence) return { ok: false, reason: "two-cadences", token };
      cadence = token as XCadence;
      continue;
    }
    const stakeMatch = STAKE_RE.exec(token);
    if (stakeMatch) {
      if (stakeText !== null) return { ok: false, reason: "two-stakes", token };
      stakeText = stakeMatch[1] as string;
      continue;
    }
    if (/\d/.test(token) || UNLISTED_ASSET_RE.test(token)) {
      return { ok: false, reason: /\d/.test(token) ? "unknown-token" : "unknown-asset", token };
    }
  }

  if (!side) return { ok: false, reason: "no-side" };
  if (!asset) return { ok: false, reason: "no-asset" };
  if (stakeText === null) return { ok: false, reason: "no-stake" };
  if (!cadence) return { ok: false, reason: "no-cadence" };
  const stakeBase = stakeToBase(stakeText, options.decimals);
  if (stakeBase === null || stakeBase <= 0n) return { ok: false, reason: "bad-stake", token: stakeText };
  return { ok: true, instruction: { side, asset, cadence, intervalSec: X_CADENCES[cadence], stakeBase } };
}

/** The refusal in words a reply can carry. */
export function describeRefusal(reason: XRefusalReason, token?: string): string {
  const near = token ? ` ("${token}")` : "";
  switch (reason) {
    case "empty":
      return "the mention carried no instruction";
    case "no-side":
      return "say up or down";
    case "two-sides":
      return `one side only${near}`;
    case "no-asset":
      return "name the stock, such as tsla or nvda";
    case "unknown-asset":
      return `that stock is not listed here${near}`;
    case "two-assets":
      return `one asset per call${near}`;
    case "no-stake":
      return "say how much to stake";
    case "bad-stake":
      return `the stake must be a positive number${near}`;
    case "two-stakes":
      return `one stake per call${near}`;
    case "no-cadence":
      return "add a timeframe, such as 5m or 15m";
    case "cadence-not-listed":
      return `use a supported timeframe${near}: 5m, 15m or 1h`;
    case "two-cadences":
      return `one Window per call${near}`;
    case "unknown-token":
      return `could not read${near} — no leverage or extras here`;
  }
}
