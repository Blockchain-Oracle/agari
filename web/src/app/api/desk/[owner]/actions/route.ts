import { NextResponse } from "next/server";
import { answer, DESK_ERRORS, loadDesk, readJson, refuse, verifyOwner } from "@/features/desk/auth.server";
import { deskOwnerActionText, ownerActionRequestSchema } from "@/features/desk/protocol";

/**
 * `POST /api/desk/[owner]/actions { kind: "sell_all" | "close" }`: the two things the owner asks the DESK to do,
 * because only the operator can sell through the program (plan §5.5). The owner's own withdrawals never come here:
 * they are the owner's mainnet transactions. Beyond the C4 contract (`requestOwnerAction`): refused with a 501
 * until the index carries it, and the card says so.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ owner: string }> }) {
  const { owner: key } = await context.params;
  const loaded = await loadDesk(key);
  if (loaded instanceof NextResponse) return loaded;
  if (!loaded.desk) return refuse(404, DESK_ERRORS.notFound);
  const parsed = ownerActionRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return refuse(400, DESK_ERRORS.badRequest);
  const { owner, kind, signedAtIso, signature } = parsed.data;
  const nowMs = Date.now();
  const refused = await verifyOwner({ owner, text: deskOwnerActionText({ owner, kind, signedAtIso }), signature, desk: loaded.desk, signedAtIso, nowMs });
  if (refused) return refused;
  if (!loaded.store.requestOwnerAction) return refuse(501, DESK_ERRORS.notSupported);
  await loaded.store.requestOwnerAction({ deskId: loaded.desk.id, kind, signer: owner, signature, nowSec: Math.floor(nowMs / 1000) });
  return answer({ ok: true, kind });
}
