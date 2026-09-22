import { isAddress } from "@agari/core/types";
import { NextResponse } from "next/server";
import { answer, DESK_ERRORS, loadDesk, readJson, refuse } from "@/features/desk/auth.server";

/**
 * `POST /api/desk/[owner]/opened { owner }`: the owner opened the whole record (one of Go live's two conditions).
 * Unsigned on purpose: it unlocks nothing on its own, since going live is the owner's own mainnet transaction.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ owner: string }> }) {
  const { owner } = await context.params;
  const loaded = await loadDesk(owner);
  if (loaded instanceof NextResponse) return loaded;
  if (!loaded.desk) return refuse(404, DESK_ERRORS.notFound);
  const body = (await readJson(req)) as { owner?: unknown } | null;
  if (!body || !isAddress(body.owner) || body.owner !== loaded.desk.owner) return refuse(403, DESK_ERRORS.notOwner);
  if (loaded.desk.recordOpenedAtSec === null) await loaded.store.markRecordOpened({ deskId: loaded.desk.id, nowSec: Math.floor(Date.now() / 1000) });
  return answer({ ok: true });
}
