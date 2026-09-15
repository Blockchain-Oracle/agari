import { addressSchema } from "@agari/core/types";
import { heliusMainnetUrl, HoldingsReadError, readHoldings } from "@agari/markets/holdings";
import { webEnv } from "@/lib/env";
import { admitIp, cachedHoldings, clientIp, OWNER_CACHE_MS } from "./gate";

/**
 * `GET /api/holdings?owner=<base58>` (session-lanes.md §4, D-058): the owner's verified mainnet xStocks and Ondo tokens,
 * read-only, with ScaledUiAmount applied in integers. The Helius key is read here, on the server, and the URL that
 * carries it never reaches a response or a log line.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refuse = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const owner = addressSchema.safeParse(new URL(request.url).searchParams.get("owner"));
  if (!owner.success) return refuse(400, "Invalid owner address.");
  const nowMs = Date.now();
  if (!admitIp(clientIp(request), nowMs)) return refuse(429, "Too many holdings reads — try again in a minute.");
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return refuse(503, "Holdings are unavailable on this deployment.");

  try {
    const body = await cachedHoldings(owner.data, nowMs, () =>
      readHoldings({ owner: owner.data, rpcUrl: heliusMainnetUrl(apiKey), priceFeedUrl: webEnv.markets.priceFeedUrl ?? null, nowSec: Math.floor(nowMs / 1000) }),
    );
    return Response.json(body, { headers: { "Cache-Control": `private, max-age=${OWNER_CACHE_MS / 1000}` } });
  } catch (error) {
    // HoldingsReadError messages are URL-free by construction; anything else is summarized, never echoed.
    console.error("api/holdings:", error instanceof HoldingsReadError ? error.message : error instanceof Error ? error.name : "unknown");
    return refuse(502, "Could not read mainnet holdings just now.");
  }
}
