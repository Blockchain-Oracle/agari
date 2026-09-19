/**
 * PreStocks pre-IPO tokens (Stocklana bounty track, D-100): one keyless read of the public catalogue, the price source
 * behind Agari's Pre-IPO lane. A PreStocks token is an SPV claim on a private company, so a row carries two prices —
 * `markPrice`, the SPV's valuation of the company, and `tokenPrice`, what the token itself trades at on Solana. The lane
 * prints `tokenPrice`, the only one a holder can realise; `markPrice` rides along for the UI and for the divergence the
 * two show (OPENAI traded ~11% over its mark on 2026-09-18).
 *
 * Both are floored to 10⁻⁸ from the JSON source text, never through a float: OPENAI quotes 15 significant digits, more
 * than a double keeps exactly. PreStocks signs nothing and publishes no timestamp, so a venue that settles on this must
 * attest the number with its own key and stamp its own read time — which is why the Pre-IPO lane is `SOURCE.attested`
 * (prints.md §4.3) and why the README says the venue, not PreStocks, is what a Pre-IPO settlement trusts.
 * `ops/prints/index.ts` re-exports all of it.
 */
import { floorDecimalE8 } from "./jupiter";

export const PRESTOCKS_CATALOGUE_URL = "https://prestocks.com/api/prestocks";
/**
 * The latest a read may land after its boundary and still stand for that boundary's 60 s bar. The program bounds the
 * read only from below (the correction delay) and above by `now`, so 900 s of admission would accept a price read a
 * quarter of an hour late. Past this, the honest outcome is a void on a missing print, never a stale attestation.
 * Shared by the drive and the relay so the two can never disagree about what "on time" means.
 */
export const PRESTOCKS_MAX_LATE_SEC = 45;

/**
 * The 32-byte attested feed id `prestocks-v1:<SYMBOL>` (ASCII, zero-padded) as lower-case hex, the form `PrintSlot.feedIdHex`
 * carries. The attestor signs this id, so it names the source and its version; `deploy/venue-spec.ts` derives the bytes
 * it registers on chain from this same function.
 */
export function preStocksFeedHex(symbol: string): string {
  const ascii = `prestocks-v1:${symbol}`;
  if (ascii.length > 32) throw new Error(`feed id "${ascii}" exceeds 32 bytes`);
  const bytes = new Uint8Array(32);
  for (let i = 0; i < ascii.length; i++) bytes[i] = ascii.charCodeAt(i);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
/** The eight tokens the catalogue carried when the lane was built; the parser accepts whatever it actually returns. */
export const PRESTOCKS_KNOWN_SYMBOLS = ["ANDURIL", "ANTHROPIC", "FIGUREAI", "KALSHI", "NEURALINK", "OPENAI", "POLYMARKET", "SPACEX"] as const;

export interface PreStocksToken {
  symbol: string;
  name: string;
  /** The token's Solana mint (`contract_address`). */
  mint: string;
  /** `markPrice` × 10⁸, floored: the SPV's valuation of the private company. */
  markPriceE8: bigint;
  /** `tokenPrice` × 10⁸, floored: what the token itself trades at. The lane prints this one. */
  tokenPriceE8: bigint;
}

export interface PreStocksRead {
  tokens: Map<string, PreStocksToken>;
  /** The wall second the body arrived. The catalogue carries no timestamp, so the reader stamps its own. */
  fetchedAtSec: number;
  /** The `age` an intermediary cache claimed for the body, in seconds, when it sent one. `null` means it did not. */
  ageSec: number | null;
}

const PRICE_KEYS = new Set(["markPrice", "tokenPrice"]);

/** Parses the catalogue keeping both prices as their source text; a row Agari cannot price is simply absent. */
export function parsePreStocks(text: string): Map<string, PreStocksToken> {
  const rows = JSON.parse(text, function reviver(key, value, context?: { source?: string }) {
    return PRICE_KEYS.has(key) && typeof value === "number" && context?.source ? context.source : value;
  }) as unknown;
  if (!Array.isArray(rows)) throw new Error("the PreStocks catalogue is not an array");
  const out = new Map<string, PreStocksToken>();
  for (const row of rows as Array<Record<string, unknown>>) {
    const { symbol, name, contract_address: mint, markPrice, tokenPrice } = row;
    if (typeof symbol !== "string" || typeof mint !== "string") continue;
    if (typeof markPrice !== "string" || typeof tokenPrice !== "string") continue;
    // Two rows for one symbol (an SPV re-issue, a migrated mint, a staging row) must not silently resolve to whichever
    // came last: that is how a lane ends up printing a different instrument than the one it opened on.
    if (out.has(symbol)) throw new Error(`the PreStocks catalogue carries ${symbol} twice`);
    try {
      out.set(symbol, {
        symbol,
        name: typeof name === "string" ? name : symbol,
        mint,
        markPriceE8: floorDecimalE8(markPrice),
        tokenPriceE8: floorDecimalE8(tokenPrice),
      });
    } catch {
      // An exponent or a non-positive price is not a usable print; the symbol stays absent.
    }
  }
  return out;
}

/** One catalogue read. Throws on a non-200, a timeout or a body that prices nothing; the caller decides what a miss means. */
export async function fetchPreStocks(options: { url?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<PreStocksRead> {
  const { url = PRESTOCKS_CATALOGUE_URL, timeoutMs = 5_000, fetchImpl = fetch } = options;
  // A cache-buster and a no-cache request: a cached body would be stamped with a fresh read time, which is how a frozen
  // feed settles a Window on two identical prices with nothing reporting a failure.
  const bust = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  const headers = { accept: "application/json", "cache-control": "no-cache" };
  const response = await fetchImpl(bust, { signal: AbortSignal.timeout(timeoutMs), headers });
  if (!response.ok) throw new Error(`PreStocks ${url} answered ${response.status}`);
  const tokens = parsePreStocks(await response.text());
  if (tokens.size === 0) throw new Error("the PreStocks catalogue priced nothing");
  const age = Number(response.headers.get("age"));
  return { tokens, fetchedAtSec: Math.floor(Date.now() / 1000), ageSec: Number.isFinite(age) && response.headers.get("age") !== null ? age : null };
}

/** The one row a lane is about, or a thrown error naming what the catalogue did carry. */
export function requireToken(read: PreStocksRead, symbol: string): PreStocksToken {
  const token = read.tokens.get(symbol);
  if (!token) throw new Error(`PreStocks has no ${symbol} (it carried ${[...read.tokens.keys()].join(" ")})`);
  return token;
}
