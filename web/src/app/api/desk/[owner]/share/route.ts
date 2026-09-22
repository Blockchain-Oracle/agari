import { NextResponse } from "next/server";
import { answer, DESK_ERRORS, loadDesk, readJson, refuse, verifyOwner } from "@/features/desk/auth.server";
import { deskShareText, shareRequestSchema } from "@/features/desk/protocol";

/** `POST /api/desk/[owner]/share { on }`: the read-only link on or off (plan §5.11). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ owner: string }> }) {
  const { owner: key } = await context.params;
  const loaded = await loadDesk(key);
  if (loaded instanceof NextResponse) return loaded;
  if (!loaded.desk) return refuse(404, DESK_ERRORS.notFound);
  const parsed = shareRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return refuse(400, DESK_ERRORS.badRequest);
  const { owner, on, signedAtIso, signature } = parsed.data;
  const refused = await verifyOwner({ owner, text: deskShareText({ owner, on, signedAtIso }), signature, desk: loaded.desk, signedAtIso, nowMs: Date.now() });
  if (refused) return refused;
  await loaded.store.setSharePublic({ deskId: loaded.desk.id, on });
  return answer({ ok: true, on, id: loaded.desk.id });
}
