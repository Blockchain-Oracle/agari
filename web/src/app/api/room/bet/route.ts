import { addressSchema, marketIdSchema, signatureSchema } from "@agari/core/types";
import { hasBet, isDbConfigured, recordBettor } from "@agari/db";
import { parseMarketsEnv } from "@agari/markets";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ROOM_ERRORS } from "@/features/room/copy";

/**
 * The bettors registry's two doors.
 *
 * `GET ?marketId&address` answers "has this wallet ever bet on this Window" — the affordance the sheet needs
 * before it asks for a signature. `POST` records a seat, and only after this server has read the fill's own
 * transaction: it must have succeeded, and the wallet must be a signer or an indexed party of the engine's fill events.
 * A client cannot register itself with a hash that is not its own fill; the worst a spoofed hash can do is
 * register the wallet that really did bet.
 */
export const runtime = "nodejs";

const bodySchema = z.object({
  marketId: marketIdSchema,
  address: addressSchema,
  txHash: signatureSchema,
  route: z.enum(["wallet", "vault", "leverage", "private"]),
});

export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ configured: false, hasBet: null });
  const url = new URL(req.url);
  const marketId = url.searchParams.get("marketId");
  const address = url.searchParams.get("address");
  if (!marketId || !address) return NextResponse.json({ error: ROOM_ERRORS.badRequest }, { status: 400 });
  const env = parseMarketsEnv();
  const answer = await hasBet(env.chainId, marketId, address);
  return NextResponse.json({ configured: true, hasBet: answer });
}

export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: ROOM_ERRORS.unavailable }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: ROOM_ERRORS.badRequest }, { status: 400 });
  // The seat is recorded only after this server reads the fill's own transaction: it must have succeeded and the wallet
  // must be one of its signers or an indexed party (never re-cased: base58, D-010). That read is the Solana adapter's
  // (S4); until it exists the gate stays shut rather than trusting the client (D-015).
  return NextResponse.json({ error: ROOM_ERRORS.gateUnreadable, reason: "not-deployed" }, { status: 503 });
}
