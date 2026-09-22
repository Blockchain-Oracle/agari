import { checkMandate, deskMandateText, mandateFingerprint, mandateFromWire } from "@agari/core/desk";
import { NextResponse } from "next/server";
import { answer, DESK_ERRORS, loadDesk, readJson, refuse, verifyOwner } from "@/features/desk/auth.server";
import { DESK_CLUSTER, mandateRequestSchema } from "@/features/desk/protocol";

/**
 * `POST /api/desk/[owner]/mandate` (plan §5.4): a signed mandate. With no desk it creates a PRACTICE desk from
 * one signature and no transaction; with one it applies a new version (which cancels waiting approvals, C4). A
 * `test_read` trigger also asks the desk to check now, so the studio's first decision card appears. The signature
 * is over `deskMandateText` with the version the owner saw, so a mandate that moved under them is refused, not
 * silently replaced.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ owner: string }> }) {
  const { owner: key } = await context.params;
  const loaded = await loadDesk(key);
  if (loaded instanceof NextResponse) return loaded;
  const parsed = mandateRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return refuse(400, DESK_ERRORS.badRequest);
  const { owner, mandate, version, signature, signedAtIso, trigger, practiceCashE6 } = parsed.data;
  if (loaded.keyIsAddress && loaded.key !== owner) return refuse(403, DESK_ERRORS.notOwner);

  let parsedMandate;
  try {
    parsedMandate = mandateFromWire(mandate);
  } catch {
    return refuse(400, DESK_ERRORS.badRequest);
  }
  const problems = checkMandate(parsedMandate);
  if (problems.length > 0) return refuse(400, DESK_ERRORS.mandateProblems, { problems });
  const fingerprint = mandateFingerprint(parsedMandate);
  const expectedVersion = loaded.desk ? Number(loaded.desk.mandateVersion) + 1 : 1;
  if (version !== expectedVersion) return refuse(409, DESK_ERRORS.mandateVersion, { expectedVersion });

  const nowMs = Date.now();
  const text = deskMandateText({ owner, cluster: DESK_CLUSTER, version, fingerprint, signedAtIso });
  const refused = await verifyOwner({ owner, text, signature, desk: loaded.desk, signedAtIso, nowMs });
  if (refused) return refused;
  const nowSec = Math.floor(nowMs / 1000);

  let deskId: string;
  let created = false;
  if (!loaded.desk) {
    const desk = await loaded.store.createPracticeDesk({ owner, cluster: DESK_CLUSTER, mandateBody: mandate, fingerprint, signer: owner, signature, ...(practiceCashE6 ? { cashE6: BigInt(practiceCashE6) } : {}) });
    deskId = desk.id;
    created = true;
  } else {
    deskId = loaded.desk.id;
    await loaded.store.applyMandate({ deskId, body: mandate, fingerprint, signer: owner, signature, nowSec });
  }
  const check = trigger === "test_read" ? await loaded.store.requestCheckNow({ deskId, signer: owner, signature, nowSec }) : null;
  return answer({ ok: true, deskId, version, fingerprint, created, checkRequested: check?.ok ?? false, ...(check && !check.ok ? { throttledUntilSec: check.throttledUntilSec } : {}) });
}
