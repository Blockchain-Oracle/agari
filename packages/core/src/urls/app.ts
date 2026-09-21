import { isMarketId, toMarketId, type MarketId } from "../types/ids";
import type { Side } from "../types/market";

export const MARKET_PARAM = "m";
export const DIRECTION_PARAM = "dir";

export interface MarketsSearch {
  marketId: MarketId | null;
  dir: Side | null;
}

function query(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

/** Deep-link grammar: /markets?m=<marketId>&dir=up|down (UX-DR21). */
export function marketDeepLink(input: { origin?: string; marketId: MarketId; dir?: Side }): string {
  return `${input.origin ?? ""}/markets?${query({ [MARKET_PARAM]: input.marketId, [DIRECTION_PARAM]: input.dir })}`;
}

/** The path form of the same address, `/markets/<id>`: what a shared link and a receipt hand out. */
export function marketPath(marketId: MarketId): string {
  return `/markets/${marketId}`;
}

/**
 * The Market a `/markets/<id>` path names, or null for `/markets` and anything that is not a Market address.
 *
 * Both forms are the same address (UX-DR21): `?m=` is the grammar the page writes back as you move around, and the
 * path is the one that can carry its own link preview, because a redirect hands the crawler the target's card.
 */
export function marketIdFromPath(pathname: string | null | undefined): MarketId | null {
  const match = /^\/markets\/([^/?#]+)\/?$/.exec(pathname ?? "");
  const id = match?.[1] ? decodeURIComponent(match[1]) : null;
  return id !== null && isMarketId(id) ? toMarketId(id) : null;
}

export function reelsDeepLink(input: { origin?: string; marketId: MarketId }): string {
  return `${input.origin ?? ""}/reels?${query({ [MARKET_PARAM]: input.marketId })}`;
}

/** Accepts a URLSearchParams-like object or Next's parsed searchParams record. */
type SearchInput = { get(name: string): string | null } | Record<string, string | string[] | undefined>;

function readParam(params: SearchInput, key: string): string | null {
  if (typeof (params as { get?: unknown }).get === "function") return (params as { get(name: string): string | null }).get(key);
  const value = (params as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function parseMarketsSearch(params: SearchInput): MarketsSearch {
  const rawMarket = readParam(params, MARKET_PARAM);
  const rawDir = readParam(params, DIRECTION_PARAM);
  return {
    marketId: rawMarket && isMarketId(rawMarket) ? toMarketId(rawMarket) : null,
    dir: rawDir === "up" || rawDir === "down" ? rawDir : null,
  };
}
