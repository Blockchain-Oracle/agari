import { NextResponse } from "next/server";

/**
 * `GET /api/games/occupancy` — who is waiting, answered without a wallet and without a signature.
 *
 * The duel used to show a player nothing at all until they had connected a wallet and signed a message,
 * so the one question that decides whether to bother — is anyone else here? — could only be answered by
 * paying a signature to find out. That is backwards: occupancy is a property of the room, not of a
 * wallet, and the room already broadcasts the same count to everyone standing in a queue.
 *
 * It is proxied rather than fetched from the browser for two reasons. The room listens on a loopback
 * address in development and on a private one in deployment, so a browser cannot reach it; and this
 * keeps the room's URL — which is also where a credential would be presented — out of the page.
 *
 * A room that is down is not an error here. "No room configured" and "the room did not answer" are both
 * simply an absent count, because a lobby that shows a red box when a background service restarts is
 * worse than one that shows nothing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The room's HTTP listener is the WebSocket one; the URL is given as `ws://` and read as `http://`. */
function occupancyUrl(): string | null {
  const raw = process.env.GAME_ROOM_PUBLIC_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = "/occupancy";
    return url.toString();
  } catch {
    return null;
  }
}

/** Short, because a lobby count is worth nothing stale and the room is one hop away. */
const TIMEOUT_MS = 1_500;

export async function GET() {
  const url = occupancyUrl();
  if (!url) return NextResponse.json({ reachable: false, queues: [], pairing: 0, online: 0 });

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ reachable: false, queues: [], pairing: 0, online: 0 });
    const body = (await response.json()) as Record<string, unknown>;
    return NextResponse.json({ reachable: true, ...body });
  } catch {
    return NextResponse.json({ reachable: false, queues: [], pairing: 0, online: 0 });
  }
}
