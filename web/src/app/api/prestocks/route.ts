import { BASKET_SYMBOLS, PRE_IPO_SYMBOLS, type BasketSymbol, type PreIpoSymbol } from "@agari/core/market";
import { webEnv } from "@/lib/env";

/**
 * `GET /api/prestocks` (plan Step 5, D-100): the facts only PreStocks has, for the pre-IPO ticker pages — the token
 * price, the SPV's mark price, the premium of one over the other in basis points, and the weekly holder count. Prices
 * come from ops' `/prestocks/latest` (the same feed the lane settles on); holders from PreStocks' own `/api/stats`.
 * Each half fails alone: a page can show the premium without the holders and the other way round. Integers travel
 * as decimal strings; nothing here is a float.
 *
 * S19 (D-124): a basket symbol answers with ops' `kind: "basket"` row — its index in points × 10⁸, its movement and
 * its members' prices and moves from their frozen bases; a basket has no holders of its own.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATS_URL = "https://prestocks.com/api/stats";
const STATS_TTL_MS = 6 * 3_600_000;
const PRICES_TTL_MS = 30_000;

interface NameRow {
  tokenPriceE8: string;
  markPriceE8: string;
  premiumBps: number | null;
  fetchedAtSec: number;
  ageSec: number;
  fresh: boolean;
}
interface BasketRow {
  kind: "basket";
  indexE8: string;
  fetchedAtSec: number;
  ageSec: number;
  fresh: boolean;
  members: Array<{ symbol: string; weightBps: number; tokenPriceE8: string; moveBps: number | null }>;
}
type PriceRow = NameRow | BasketRow;
type FactsSymbol = PreIpoSymbol | BasketSymbol;
const FACTS_SYMBOLS: readonly FactsSymbol[] = [...PRE_IPO_SYMBOLS, ...BASKET_SYMBOLS];
interface HolderRow {
  /** The latest weekly holder count and the one four weeks earlier, when PreStocks reports them. */
  holders: number | null;
  holdersMonthAgo: number | null;
  week: string | null;
}
export type PreIpoFacts = Partial<PriceRow> & HolderRow;

let statsMemo: { atMs: number; rows: Record<string, HolderRow> } | null = null;
let pricesMemo: { atMs: number; rows: Record<string, PriceRow> } | null = null;

const isFactsSymbol = (s: string): s is FactsSymbol => (FACTS_SYMBOLS as readonly string[]).includes(s);

async function readStats(nowMs: number): Promise<Record<string, HolderRow>> {
  if (statsMemo && nowMs - statsMemo.atMs < STATS_TTL_MS) return statsMemo.rows;
  const response = await fetch(STATS_URL, { signal: AbortSignal.timeout(10_000), cache: "no-store", headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`stats ${response.status}`);
  const body = (await response.json()) as { holders?: Array<Record<string, unknown>> };
  const weeks = body.holders ?? [];
  const latest = weeks.at(-1) ?? {};
  const monthAgo = weeks.at(-5) ?? {};
  const rows: Record<string, HolderRow> = {};
  for (const symbol of PRE_IPO_SYMBOLS) {
    const now = latest[symbol];
    const then = monthAgo[symbol];
    rows[symbol] = {
      holders: typeof now === "number" && Number.isFinite(now) ? Math.trunc(now) : null,
      holdersMonthAgo: typeof then === "number" && Number.isFinite(then) ? Math.trunc(then) : null,
      week: typeof latest.week === "string" ? latest.week : null,
    };
  }
  statsMemo = { atMs: nowMs, rows };
  return rows;
}

async function readPrices(nowMs: number): Promise<Record<string, PriceRow>> {
  if (pricesMemo && nowMs - pricesMemo.atMs < PRICES_TTL_MS) return pricesMemo.rows;
  const base = webEnv.markets.priceFeedUrl;
  if (!base) throw new Error("NEXT_PUBLIC_PRICE_FEED_URL is not set");
  const response = await fetch(`${base.replace(/\/$/, "")}/prestocks/latest`, { signal: AbortSignal.timeout(5_000), cache: "no-store" });
  if (!response.ok) throw new Error(`prestocks/latest ${response.status}`);
  const rows = (await response.json()) as Record<string, PriceRow>;
  pricesMemo = { atMs: nowMs, rows };
  return rows;
}

export async function GET(request: Request) {
  const wanted = new URL(request.url).searchParams.get("symbol");
  const symbols: FactsSymbol[] = wanted ? (isFactsSymbol(wanted.toUpperCase()) ? [wanted.toUpperCase() as FactsSymbol] : []) : [...FACTS_SYMBOLS];
  if (symbols.length === 0) return Response.json({ error: "Not a PreStocks name or a basket." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const nowMs = Date.now();
  const [prices, holders] = await Promise.all([readPrices(nowMs).catch(() => null), readStats(nowMs).catch(() => null)]);
  if (!prices && !holders) return Response.json({ error: "PreStocks facts are unavailable just now." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  const out: Record<string, PreIpoFacts> = {};
  for (const symbol of symbols) out[symbol] = { ...(prices?.[symbol] ?? {}), ...(holders?.[symbol] ?? { holders: null, holdersMonthAgo: null, week: null }) };
  return Response.json(out, { headers: { "Cache-Control": `public, max-age=${PRICES_TTL_MS / 1000}` } });
}
