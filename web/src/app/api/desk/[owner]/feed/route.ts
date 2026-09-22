import { isAddress } from "@agari/core/types";
import { NextResponse } from "next/server";
import { answer, DESK_ERRORS, loadDesk, refuse } from "@/features/desk/auth.server";
import { outcomeColumnSchema, type FeedItemWire } from "@/features/desk/protocol";

/** `GET /api/desk/[owner]/feed?since=<seq>&viewer=`: what happened after `since`, for the watcher's toasts (plan §5.8). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ owner: string }> }) {
  const { owner } = await context.params;
  const loaded = await loadDesk(owner);
  if (loaded instanceof NextResponse) return loaded;
  if (!loaded.desk) return refuse(404, DESK_ERRORS.notFound);
  const url = new URL(req.url);
  const viewer = url.searchParams.get("viewer");
  if (!(viewer && isAddress(viewer) && viewer === loaded.desk.owner)) return refuse(403, DESK_ERRORS.notOwner);
  const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
  const rows = await loaded.store.deskFeedSince({ deskId: loaded.desk.id, sinceSeq: since });
  const items: FeedItemWire[] = rows.map((r) => {
    const outcome = outcomeColumnSchema.safeParse(r.outcome ?? null);
    return { kind: r.kind === "money" ? "money" : "record", seq: Number(r.seq), outcome: outcome.success ? outcome.data : null, summary: r.summary, atSec: Number(r.atSec) };
  });
  return answer({ items, latestSeq: items.reduce((max, i) => Math.max(max, i.seq), since) });
}
