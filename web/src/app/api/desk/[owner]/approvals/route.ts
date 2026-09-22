import { deskApprovalText } from "@agari/core/desk";
import { NextResponse } from "next/server";
import { answer, DESK_ERRORS, loadDesk, readJson, refuse, verifyOwner } from "@/features/desk/auth.server";
import { toApproval } from "@/features/desk/desk.server";
import { approvalRequestSchema, DESK_CLUSTER } from "@/features/desk/protocol";

/**
 * `POST /api/desk/[owner]/approvals`: Approve or Decline one waiting request (plan §5.7 "Needs you"). The text the
 * wallet signed is rebuilt from the STORED request (its record's fingerprint, its words, its expiry), so a signature
 * approves exactly one request and nothing else, and an expired one is refused before any signature is checked.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ owner: string }> }) {
  const { owner: key } = await context.params;
  const loaded = await loadDesk(key);
  if (loaded instanceof NextResponse) return loaded;
  if (!loaded.desk) return refuse(404, DESK_ERRORS.notFound);
  const parsed = approvalRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return refuse(400, DESK_ERRORS.badRequest);
  const { owner, approvalId, answer: reply, signature } = parsed.data;
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const waiting = (await loaded.store.listApprovals({ deskId: loaded.desk.id, open: true })).map(toApproval).find((a) => a.id === approvalId);
  if (!waiting || waiting.status !== "open" || waiting.expiresAtSec <= nowSec) return refuse(409, DESK_ERRORS.approvalGone);
  const text = deskApprovalText({ owner, cluster: DESK_CLUSTER, decisionSeq: waiting.decisionSeq, decisionHash: waiting.decisionHash, answer: reply, summary: waiting.summary, expiresAtIso: new Date(waiting.expiresAtSec * 1000).toISOString() });
  const refused = await verifyOwner({ owner, text, signature, desk: loaded.desk, nowMs });
  if (refused) return refused;
  await loaded.store.answerApproval({ deskId: loaded.desk.id, approvalId, answer: reply, signer: owner, signature, nowSec });
  return answer({ ok: true });
}
