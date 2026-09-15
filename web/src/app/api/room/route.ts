import { insertComment, isDbConfigured, listComments } from "@agari/db";
import { NextResponse } from "next/server";
import { ROOM_ERRORS } from "@/features/room/copy";
import { readToken } from "@/features/room/gate.server";
import { ROOM_LIMITS } from "@/features/room/limits.server";
import { roomPostRequestSchema } from "@/features/room/protocol";
import { parseRoomId } from "@/features/room/room-id";

/**
 * Reading and posting in a Room. Both require a token minted by `/api/room/join`,
 * which is only issued to a wallet that proved its address and its bet.
 *
 * Reading is gated too, as the reference's is — its threads are encrypted to the
 * room's members, so a non-member cannot read them either. Ours enforces that at
 * the endpoint instead of cryptographically, which is a weaker guarantee and one
 * worth naming: the server can read the thread, and the reference's cannot.
 */
export const runtime = "nodejs";

const PAGE = 100;
const NO_STORE = { "Cache-Control": "no-store" };

function refuse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

export async function GET(req: Request) {
  if (!isDbConfigured()) return refuse(ROOM_ERRORS.unavailable, 503);

  const url = new URL(req.url);
  const room = parseRoomId(url.searchParams.get("marketId") ?? "");
  const token = url.searchParams.get("token");
  if (!room || !token) return refuse(ROOM_ERRORS.badRequest, 400);

  const address = readToken(token, room.roomId, Date.now());
  if (!address) return refuse(ROOM_ERRORS.notJoined, 401);

  const comments = await listComments(room.roomId, PAGE);
  if (comments === null) return refuse(ROOM_ERRORS.unavailable, 503);

  return NextResponse.json(
    {
      comments: comments.map((comment) => ({
        id: comment.id,
        author: comment.author,
        body: comment.body,
        createdAtMs: comment.createdAtMs,
        mine: comment.author === address,
      })),
    },
    { headers: NO_STORE },
  );
}

export async function POST(req: Request) {
  if (!isDbConfigured()) return refuse(ROOM_ERRORS.unavailable, 503);

  const parsed = roomPostRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return refuse(ROOM_ERRORS.badRequest, 400);
  const room = parseRoomId(parsed.data.marketId);
  if (!room) return refuse(ROOM_ERRORS.badRequest, 400);

  // The author is taken from the token, never from the request body — a client that
  // could name its own author could post as anyone who ever joined.
  const now = Date.now();
  const address = readToken(parsed.data.token, room.roomId, now);
  if (!address) return refuse(ROOM_ERRORS.notJoined, 401);
  if (!ROOM_LIMITS.post.take(address, now)) return refuse(ROOM_ERRORS.rateLimited, 429);

  const comment = await insertComment(room.roomId, address, parsed.data.body);
  if (comment === null) return refuse(ROOM_ERRORS.unavailable, 503);

  return NextResponse.json(
    { comment: { id: comment.id, author: comment.author, body: comment.body, createdAtMs: comment.createdAtMs, mine: true } },
    { headers: NO_STORE },
  );
}
