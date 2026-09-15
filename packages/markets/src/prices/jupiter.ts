/**
 * Jupiter Price v3 for verified xStock mints (session-lanes.md §2.4–2.5): the token lane's chart spot and the attested
 * fallback's median of three samples. `usdPrice` is per UI token with the ScaledUiAmount multiplier applied (C:13 §5),
 * the lane's documented basis. Prices are floored to 10⁻⁸ from the JSON source text; no floats. Lane 6b owns this file;
 * `ops/prints/index.ts` re-exports all of it. Keyless `lite-api` allows 0.5 RPS; a key moves to `api.jup.ag`.
 */

export const JUPITER_LITE_PRICE_URL = "https://lite-api.jup.ag/price/v3";
export const JUPITER_KEYED_PRICE_URL = "https://api.jup.ag/price/v3";
/** The attested fallback samples at these offsets from T, all inside the bar `[T − 60, T]` (§2.5). */
export const JUPITER_SAMPLE_OFFSETS_SEC = [-40, -20, 0] as const;

export interface JupiterPrice {
  mint: string;
  /** `usdPrice` × 10⁸, floored. */
  usdPriceE8: bigint;
  /** The Solana block of the last swap Jupiter priced, when present. */
  blockId: number | null;
}

/** `"358.25471035690003"` → 35_825_471_035n. Refuses signs, exponents and non-positive results. */
export function floorDecimalE8(text: string): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!m) throw new Error(`not a plain positive decimal: "${text}"`);
  const value = BigInt(m[1]!) * 100_000_000n + BigInt((m[2] ?? "").slice(0, 8).padEnd(8, "0"));
  if (value <= 0n) throw new Error(`non-positive price "${text}"`);
  return value;
}

/** Parses a Price v3 body keeping every `usdPrice` as its source text; mints Jupiter omitted are simply absent. */
export function parseJupiterPrices(text: string): Map<string, JupiterPrice> {
  const body = JSON.parse(text, function reviver(key, value, context?: { source?: string }) {
    return key === "usdPrice" && typeof value === "number" && context?.source ? context.source : value;
  }) as Record<string, { usdPrice?: string; blockId?: number } | null>;
  const out = new Map<string, JupiterPrice>();
  for (const [mint, entry] of Object.entries(body)) {
    if (!entry || typeof entry.usdPrice !== "string") continue;
    try {
      out.set(mint, { mint, usdPriceE8: floorDecimalE8(entry.usdPrice), blockId: typeof entry.blockId === "number" ? entry.blockId : null });
    } catch {
      // An exponent or a non-positive price is not a usable print; the mint stays absent.
    }
  }
  return out;
}

export type JupiterFetchOptions = { apiKey?: string; signal?: AbortSignal; timeoutMs?: number };

/** One call for up to 50 mints. The API key (server-only) rides in a header and is never logged. */
export async function fetchJupiterPrices(mints: readonly string[], options: JupiterFetchOptions = {}): Promise<Map<string, JupiterPrice>> {
  if (mints.length === 0) return new Map();
  if (mints.length > 50) throw new Error(`Jupiter Price v3 takes at most 50 ids, got ${mints.length}`);
  const url = `${options.apiKey ? JUPITER_KEYED_PRICE_URL : JUPITER_LITE_PRICE_URL}?ids=${mints.join(",")}`;
  const res = await fetch(url, {
    headers: options.apiKey ? { "x-api-key": options.apiKey } : {},
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 5_000),
  });
  if (!res.ok) throw new Error(`Jupiter Price v3 HTTP ${res.status}`);
  return parseJupiterPrices(await res.text());
}

/** The attested median: the middle of three (or any odd count); an even count floors the mean of the two middle values. */
export function medianE8(values: readonly bigint[]): bigint {
  if (values.length === 0) throw new Error("median of nothing");
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2n;
}
