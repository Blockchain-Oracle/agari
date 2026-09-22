import { webEnv } from "@/lib/env";

/**
 * `GET /api/pyth-index` (S20, D-125): ops' `/pyth-index/latest`, memoised for 30 s — per pre-IPO name, whether the
 * venue's key may read Pyth's valuation index and, where it may, the index beside the PreStocks token price and how far
 * apart they sit in basis points. A denied feed has an entitlement entry and no row, and the hub omits its line. Bigints
 * travel as decimal strings; nothing here is a float. `?symbol=` narrows both maps to one name.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 30_000;

interface Body {
  entitlement: Record<string, unknown>;
  rows: Record<string, unknown>;
}

let memo: { atMs: number; body: Body } | null = null;

async function readOps(nowMs: number): Promise<Body> {
  if (memo && nowMs - memo.atMs < TTL_MS) return memo.body;
  const base = webEnv.markets.priceFeedUrl;
  if (!base) throw new Error("NEXT_PUBLIC_PRICE_FEED_URL is not set");
  const response = await fetch(`${base.replace(/\/$/, "")}/pyth-index/latest`, { signal: AbortSignal.timeout(5_000), cache: "no-store" });
  if (!response.ok) throw new Error(`pyth-index/latest ${response.status}`);
  const body = (await response.json()) as Partial<Body>;
  const shaped: Body = { entitlement: body.entitlement ?? {}, rows: body.rows ?? {} };
  memo = { atMs: nowMs, body: shaped };
  return shaped;
}

const pick = (map: Record<string, unknown>, symbol: string | null) => (symbol === null ? map : symbol in map ? { [symbol]: map[symbol] } : {});

export async function GET(request: Request) {
  const wanted = new URL(request.url).searchParams.get("symbol")?.toUpperCase() ?? null;
  try {
    const body = await readOps(Date.now());
    return Response.json({ entitlement: pick(body.entitlement, wanted), rows: pick(body.rows, wanted) }, { headers: { "Cache-Control": `public, max-age=${TTL_MS / 1000}` } });
  } catch {
    return Response.json({ error: "The Pyth index is unavailable just now." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
