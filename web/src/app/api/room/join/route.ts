import { isDbConfigured } from "@agari/db";
import { NextResponse } from "next/server";
import { admittingStep, GateUnreadableError, mintToken, verifyJoinSignature } from "@/features/room/gate.server";
import { ROOM_ERRORS } from "@/features/room/copy";
import { clientIp, ROOM_LIMITS } from "@/features/room/limits.server";
import { ROOM_SIGNATURE_TTL_MS, roomJoinRequestSchema } from "@/features/room/protocol";
import { parseRoomId } from "@/features/room/room-id";

/**
 * Joining a Room: prove the wallet, then prove the bet.
 *
 * Both checks are here and not in the browser. The order matters only for cost —
 * the signature is cheap and local, the gate reads the registry, the index and at
 * worst the chain — but neither is skippable, and a failure of either returns the
 * same shape so the endpoint does not become an oracle for which wallets hold what.
 */
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

function refuse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function POST(req: Request) {
  if (!isDbConfigured()) return refuse(ROOM_ERRORS.unavailable, 503);
  if (!ROOM_LIMITS.join.take(clientIp(req), Date.now())) return refuse(ROOM_ERRORS.rateLimited, 429);

  const parsed = roomJoinRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return refuse(ROOM_ERRORS.badRequest, 400);
  const { marketId, address, issuedAtMs, signature } = parsed.data;
  const room = parseRoomId(marketId);
  if (!room) return refuse(ROOM_ERRORS.badRequest, 400);

  const now = Date.now();
  // A signature from the future is as suspect as a stale one.
  if (Math.abs(now - issuedAtMs) > ROOM_SIGNATURE_TTL_MS) return refuse(ROOM_ERRORS.staleSignature, 400);
  if (!(await verifyJoinSignature(room.roomId, address, issuedAtMs, signature))) return refuse(ROOM_ERRORS.badSignature, 401);

  let step: Awaited<ReturnType<typeof admittingStep>>;
  try {
    step = await admittingStep(address, room.roomId);
  } catch (cause) {
    // A source failed and none said yes. That is not "you have no bet" — saying so
    // would lock a bettor out and tell them the wrong reason.
    if (!(cause instanceof GateUnreadableError)) throw cause;
    console.warn(`[room] join ${room.roomId} ${address}: unreadable at ${cause.step}`);
    return refuse(ROOM_ERRORS.gateUnreadable, 503);
  }
  if (!step) return refuse(room.kind === "ticker" ? ROOM_ERRORS.noTickerPosition : ROOM_ERRORS.noPosition, 403);

  // Which step admitted is the one fact worth keeping about a join: it says whether the registry, the index or
  // the chain is doing the work. Public data (index positions), so the wallet may be named.
  console.info(`[room] join ${room.roomId} ${address}: admitted by ${step}`);
  return NextResponse.json({ token: mintToken(address, room.roomId, now), step }, { headers: NO_STORE });
}
