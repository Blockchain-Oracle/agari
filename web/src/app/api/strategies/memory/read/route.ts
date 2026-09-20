import { isOk } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { isDbConfigured, readSealedMemory } from "@agari/db";
import { getStrategy, listSubscriptionsOf } from "@agari/markets/strategies";
import { NextResponse } from "next/server";
import { readMemoryMessage, readMemoryRequestSchema } from "@/features/strategies/memory-protocol";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";

const SIGNATURE_TTL_MS = 5 * 60_000;

/**
 * The gate of the Memory Market (L-56). A sealed memory is served to two wallets only: the strategy's on-chain
 * creator, and a wallet that holds an on-chain subscription to it. Subscribing is what pays the creator's fee
 * (`agari-strategy` moves it at `subscriber_subscribe`), so the chain is the record of who has paid and this route
 * keeps no list of its own. Unsubscribing closes the Subscription account, and with it the pass.
 *
 * Every failure to establish one of those two facts is a refusal: an unreadable chain never opens a memory.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: "no memory store on this deployment" }, { status: 503 });
  const parsed = readMemoryRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { strategyId, reader, issuedAtMs, signature } = parsed.data;
  if (Math.abs(Date.now() - issuedAtMs) > SIGNATURE_TTL_MS) return NextResponse.json({ error: "stale signature" }, { status: 400 });

  const ok = await verifyWalletMessage({ text: readMemoryMessage(strategyId, reader, issuedAtMs), signature, signer: reader });
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const id = BigInt(strategyId);
  const strategy = await getStrategy(id);
  if (!isOk(strategy) || strategy.stale || !strategy.value) return NextResponse.json({ error: "strategy unreadable" }, { status: 503 });

  if (strategy.value.creator !== reader) {
    const subscriptions = await listSubscriptionsOf(reader as Address, [id]);
    if (!isOk(subscriptions) || subscriptions.stale) return NextResponse.json({ error: "subscriptions unreadable" }, { status: 503 });
    const held = subscriptions.value.some((s) => s.strategyId === id && s.active);
    if (!held) return NextResponse.json({ error: "subscribe to read", feeBase: strategy.value.feeBase.toString() }, { status: 402 });
  }

  const memory = await readSealedMemory(strategyId);
  // Stored under another creator than the chain's: never served, whoever asks.
  if (!memory || memory.creator !== strategy.value.creator) return NextResponse.json({ error: "no sealed memory" }, { status: 404 });
  return NextResponse.json({ title: memory.title, body: memory.body, updatedAtMs: memory.updatedAtMs }, { headers: { "cache-control": "no-store" } });
}
