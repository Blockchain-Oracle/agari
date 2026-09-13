import { isDbConfigured } from "@masayume/db";
import { NextResponse } from "next/server";
import { holdsPosition, mintToken, verifyJoinSignature } from "@/features/room/gate.server";
import { ROOM_ERRORS } from "@/features/room/copy";
import { ROOM_SIGNATURE_TTL_MS, roomJoinRequestSchema } from "@/features/room/protocol";

/**
 * Joining a Room: prove the wallet, then prove the bet.
 *
 * Both checks are here and not in the browser. The order matters only for cost —
 * the signature is cheap and local, the position is a chain read — but neither is
 * skippable, and a failure of either returns the same shape so the endpoint does
 * not become an oracle for which wallets hold what.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: ROOM_ERRORS.unavailable }, { status: 503 });

  const parsed = roomJoinRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: ROOM_ERRORS.badRequest }, { status: 400 });
  const { marketId, address, issuedAtMs, signature } = parsed.data;

  const now = Date.now();
  // A signature from the future is as suspect as a stale one.
  if (Math.abs(now - issuedAtMs) > ROOM_SIGNATURE_TTL_MS) {
    return NextResponse.json({ error: ROOM_ERRORS.staleSignature }, { status: 400 });
  }

  if (!(await verifyJoinSignature(marketId, address, issuedAtMs, signature))) {
    return NextResponse.json({ error: ROOM_ERRORS.badSignature }, { status: 401 });
  }

  let holds: boolean;
  try {
    holds = await holdsPosition(address, marketId);
  } catch {
    // The chain read failed. That is not "you have no bet" — saying so would lock a
    // bettor out and tell them the wrong reason.
    return NextResponse.json({ error: ROOM_ERRORS.gateUnreadable }, { status: 503 });
  }
  if (!holds) return NextResponse.json({ error: ROOM_ERRORS.noPosition }, { status: 403 });

  return NextResponse.json({ token: mintToken(address, marketId, now) });
}
