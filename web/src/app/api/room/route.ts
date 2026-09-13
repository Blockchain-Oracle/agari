import { insertComment, isDbConfigured, listComments } from "@masayume/db";
import { NextResponse } from "next/server";
import { ROOM_ERRORS } from "@/features/room/copy";
import { readToken } from "@/features/room/gate.server";
import { roomPostRequestSchema } from "@/features/room/protocol";

/**
 * Reading and posting in a Room. Both require a token minted by `/api/room/join`,
 * which is only issued to a wallet that proved its address and its position.
 *
 * Reading is gated too, as the reference's is — its threads are encrypted to the
 * room's members, so a non-member cannot read them either. Ours enforces that at
 * the endpoint instead of cryptographically, which is a weaker guarantee and one
 * worth naming: the server can read the thread, and the reference's cannot.
 */
export const runtime = "nodejs";

const PAGE = 100;

function unauthorized() {
  return NextResponse.json({ error: ROOM_ERRORS.notJoined }, { status: 401 });
}

export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: ROOM_ERRORS.unavailable }, { status: 503 });

  const url = new URL(req.url);
  const marketId = url.searchParams.get("marketId");
  const token = url.searchParams.get("token");
  if (!marketId || !token) return NextResponse.json({ error: ROOM_ERRORS.badRequest }, { status: 400 });

  const address = readToken(token, marketId, Date.now());
  if (!address) return unauthorized();

  const comments = await listComments(marketId, PAGE);
  if (comments === null) return NextResponse.json({ error: ROOM_ERRORS.unavailable }, { status: 503 });

  return NextResponse.json({
    comments: comments.map((comment) => ({
      id: comment.id,
      author: comment.author,
      body: comment.body,
      createdAtMs: comment.createdAtMs,
      mine: comment.author === address,
    })),
  });
}

export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: ROOM_ERRORS.unavailable }, { status: 503 });

  const parsed = roomPostRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: ROOM_ERRORS.badRequest }, { status: 400 });
  const { marketId, token, body } = parsed.data;

  // The author is taken from the token, never from the request body — a client that
  // could name its own author could post as anyone who ever joined.
  const address = readToken(token, marketId, Date.now());
  if (!address) return unauthorized();

  const comment = await insertComment(marketId, address, body);
  if (comment === null) return NextResponse.json({ error: ROOM_ERRORS.unavailable }, { status: 503 });

  return NextResponse.json({
    comment: { id: comment.id, author: comment.author, body: comment.body, createdAtMs: comment.createdAtMs, mine: true },
  });
}
