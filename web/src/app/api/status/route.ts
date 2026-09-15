import { ensureMarkets } from "@agari/markets";
import { NextResponse } from "next/server";
import { statusRun } from "@/features/status/run.server";
import { webEnv } from "@/lib/env";

/**
 * Dependency health, derived when asked — ported in shape from the reference's `/status`
 * page, which polls its predict server's own `/status`. There is no such server here, so
 * the route IS the probe: it reads the chain head, the index, ops' heartbeats and session,
 * the price feed, the faucet, the database and Sensei's credential and reports each as it
 * found it (proof-analytics.md §2.5). Concurrent requests share one run, and a run answers
 * for at most 10 s (`run.server.ts`), so a busy page never multiplies the RPC reads.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  // The app's own config (as `/api/index`): the reference's bare `parseMarketsEnv()` saw only defaults, so no ops base.
  ensureMarkets(webEnv.markets);
  const payload = await statusRun(webEnv.markets);
  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
