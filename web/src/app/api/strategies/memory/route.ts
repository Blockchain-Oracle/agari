import { isOk } from "@agari/core/schemas";
import { isDbConfigured, upsertSealedMemory } from "@agari/db";
import { getStrategy } from "@agari/markets/strategies";
import { NextResponse } from "next/server";
import { sealMemoryMessage, sealMemoryRequestSchema } from "@/features/strategies/memory-protocol";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";

const SIGNATURE_TTL_MS = 5 * 60_000;

/**
 * A creator seals what their agent has learned (the Memory Market, L-56). Two facts are checked here, not in the
 * browser: the signature is the creator's, over this exact title and body, and the creator is the strategy's
 * on-chain creator. The body is stored and never listed; only `memory/read` serves it.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no memory store on this deployment" }, { status: 503 });
  const parsed = sealMemoryRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { strategyId, creator, issuedAtMs, title, body, signature } = parsed.data;
  if (Math.abs(Date.now() - issuedAtMs) > SIGNATURE_TTL_MS) return NextResponse.json({ error: "stale signature" }, { status: 400 });

  const ok = await verifyWalletMessage({ text: sealMemoryMessage(strategyId, creator, issuedAtMs, title, body), signature, signer: creator });
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const strategy = await getStrategy(BigInt(strategyId));
  if (!isOk(strategy) || !strategy.value) return NextResponse.json({ error: "strategy unreadable" }, { status: 503 });
  if (strategy.value.creator !== creator) return NextResponse.json({ error: "not the creator" }, { status: 403 });

  await upsertSealedMemory(strategyId, creator, title, body);
  return NextResponse.json({ ok: true });
}
