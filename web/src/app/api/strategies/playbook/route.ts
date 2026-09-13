import { isOk } from "@masayume/core/schemas";
import { isDbConfigured, upsertPlaybook } from "@masayume/db";
import { getStrategy } from "@masayume/markets/strategies";
import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { playbookMessage, playbookRequestSchema } from "@/features/strategies/protocol";

const SIGNATURE_TTL_MS = 5 * 60_000;

/**
 * A creator publishes the plain-text notes behind a strategy. Two facts are checked here, not in
 * the browser: the signature is the creator's, and the creator is the strategy's on-chain creator.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no playbook store on this deployment" }, { status: 503 });
  const parsed = playbookRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { strategyId, creator, issuedAtMs, body, signature } = parsed.data;
  if (Math.abs(Date.now() - issuedAtMs) > SIGNATURE_TTL_MS) return NextResponse.json({ error: "stale signature" }, { status: 400 });

  const ok = await verifyMessage({ address: creator as `0x${string}`, message: playbookMessage(strategyId, creator, issuedAtMs, body), signature: signature as `0x${string}` }).catch(() => false);
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const strategy = await getStrategy(BigInt(strategyId));
  if (!isOk(strategy) || !strategy.value) return NextResponse.json({ error: "strategy unreadable" }, { status: 503 });
  if (strategy.value.creator !== creator.toLowerCase()) return NextResponse.json({ error: "not the creator" }, { status: 403 });

  await upsertPlaybook(strategyId, creator, body);
  return NextResponse.json({ ok: true });
}
