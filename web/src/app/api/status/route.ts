import { ensureMarkets, parseMarketsEnv } from "@masayume/markets";
import { NextResponse } from "next/server";
import { probeIndexer, probePrice, probeRpc, probeSensei, probeStore } from "@/features/status/probes.server";
import { HEALTHY_LAG_SEC, type StatusPayload, type StatusPipeline } from "@/features/status/protocol";

/**
 * Dependency health, derived when asked — ported in shape from the reference's `/status`
 * page, which polls its predict server's own `/status`. There is no such server here, so
 * the route IS the probe: it reads the chain head, the indexer, the price feed, the social
 * store and Sensei's credential at request time and reports each as it found it. Nothing
 * is cached, because a status page that remembers a healthy answer is worse than none.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function overallOf(pipelines: StatusPipeline[], maxLagSec: number | null): StatusPayload["overall"] {
  const required = pipelines.filter((pipeline) => !pipeline.optional);
  if (!required.some((pipeline) => pipeline.ok)) return "unreachable";
  const allOk = required.every((pipeline) => pipeline.ok);
  return allOk && (maxLagSec ?? 0) < HEALTHY_LAG_SEC ? "healthy" : "degraded";
}

export async function GET() {
  const env = parseMarketsEnv();
  ensureMarkets(env);
  const checkedAtMs = Date.now();

  // The price probes need the lane set to know which assets are live, so they chain off the
  // indexer; the chain head and the store are read alongside.
  const [rpc, market, store] = await Promise.all([
    probeRpc(),
    probeIndexer(env).then(async (indexer) => ({ ...indexer, prices: await Promise.all(indexer.assets.map((asset) => probePrice(asset, checkedAtMs))) })),
    probeStore(),
  ]);
  const pipelines: StatusPipeline[] = [rpc.pipeline, market.pipeline, ...market.prices, store, probeSensei()];

  const lagging = pipelines.filter((pipeline) => pipeline.ok && pipeline.lagSec !== null);
  const worst = lagging.reduce<StatusPipeline | null>((max, pipeline) => (max === null || pipeline.lagSec! > max.lagSec! ? pipeline : max), null);
  const maxLagSec = worst?.lagSec ?? null;

  const payload: StatusPayload = {
    checkedAtMs,
    overall: overallOf(pipelines, maxLagSec),
    maxLagSec,
    maxLagPipeline: worst?.label ?? null,
    blockNumber: rpc.blockNumber,
    pipelines,
  };
  return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
}
