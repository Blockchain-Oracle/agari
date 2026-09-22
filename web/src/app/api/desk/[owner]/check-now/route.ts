import { deskCheckNowText } from "@agari/core/desk";
import { NextResponse } from "next/server";
import { answer, DESK_ERRORS, loadDesk, readJson, refuse, verifyOwner } from "@/features/desk/auth.server";
import { checkNowRequestSchema, DESK_CLUSTER } from "@/features/desk/protocol";

/** `POST /api/desk/[owner]/check-now`: "Look now." Once every ten minutes; the store says until when otherwise. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ owner: string }> }) {
  const { owner: key } = await context.params;
  const loaded = await loadDesk(key);
  if (loaded instanceof NextResponse) return loaded;
  if (!loaded.desk) return refuse(404, DESK_ERRORS.notFound);
  const parsed = checkNowRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return refuse(400, DESK_ERRORS.badRequest);
  const { owner, requestedAtIso, signature } = parsed.data;
  const nowMs = Date.now();
  const text = deskCheckNowText({ owner, cluster: DESK_CLUSTER, requestedAtIso });
  const refused = await verifyOwner({ owner, text, signature, desk: loaded.desk, signedAtIso: requestedAtIso, nowMs });
  if (refused) return refused;
  const result = await loaded.store.requestCheckNow({ deskId: loaded.desk.id, signer: owner, signature, nowSec: Math.floor(nowMs / 1000) });
  if (!result.ok) return answer({ ok: false, throttledUntilSec: result.throttledUntilSec }, 429);
  return answer({ ok: true });
}
