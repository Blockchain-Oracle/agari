import { addressSchema } from "@agari/core/types";
import { getDb, proofStore } from "@agari/db";
import { after } from "next/server";
import { z } from "zod";
import { callerKey, callerPostsSince, recordCallerPost, refusal, REPLAY_QUOTA } from "@/features/proof/replay.server";

/**
 * `POST /api/proof/pyth { market, which }` (proof-analytics.md §2.6, Q-S5-1): re-post the archived Pyth update behind a
 * recorded print as `proof-replay`. The print, the archive, the integer preflight and the per-boundary claim are
 * checked before answering; the post runs after the response and the page polls `proofs/:market`. Never cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ market: addressSchema, which: z.union([z.literal(0), z.literal(1)]) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return refusal("bad-request", 400, "expected { market, which: 0 | 1 }");
  const db = getDb();
  const key = callerKey(request);
  if (!db || !key) return refusal("unavailable", 503, "proof replay is not configured on this deployment");

  // web3.js 1 and the receiver SDK load only here, on the first replay (the index and pages never import them).
  const proof = await import("@agari/markets/proof");
  const payerSecret = proof.proofReplaySecret(process.env);
  if (!payerSecret) return refusal("unavailable", 503, "proof replay is not configured on this deployment");
  const deps = { store: proofStore(db), rpcUrl: proof.proofReplayRpcUrl(process.env), payerSecret };

  try {
    const nowMs = Date.now();
    const sinceMs = nowMs - REPLAY_QUOTA.windowMs;
    if (callerPostsSince(key, sinceMs) >= REPLAY_QUOTA.perIp) return refusal("quota", 429, "replay quota for this connection is used up");
    const { boundaries } = await deps.store.activity(sinceMs, proof.POSTING_STALE_MS, nowMs);
    if (boundaries >= REPLAY_QUOTA.global) return refusal("quota", 429, "replay quota for this hour is used up");
    if ((await proof.balanceLamports(deps.rpcUrl, proof.keypairAddress(payerSecret))) < REPLAY_QUOTA.minPayerLamports) {
      return refusal("unavailable", 503, "the proof-replay payer is below its floor");
    }

    const step = await proof.prepareReplay(deps, parsed.data);
    if (step.kind === "refused") return refusal("no-print", 422, `nothing to replay: ${step.refusal.kind}`);
    if (step.kind !== "claimed") return Response.json({ state: step.kind === "already-verified" ? "verified" : "posting" }, { headers: { "cache-control": "no-store" } });
    recordCallerPost(key, nowMs);
    after(() => proof.postPreparedReplay(deps, step.prepared));
    return Response.json({ state: "posting", boundarySec: step.prepared.boundarySec }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch {
    // RPC and database errors can name endpoints; the response keeps only the fact.
    return refusal("failed", 503, "the replay could not start");
  }
}
