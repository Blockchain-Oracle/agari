import { isAddress } from "@agari/core/types";
import { NextResponse } from "next/server";
import { answer, DESK_ERRORS, loadDesk, refuse } from "@/features/desk/auth.server";
import { toApproval, toGrade, toRecord, type DeskQueries } from "@/features/desk/desk.server";
import type { ActionWire, DecisionWire, ProofWire, RecordSummaryWire } from "@/features/desk/protocol";

/**
 * `GET /api/desk/[owner]/records/[seq]`: one decision in full (plan §5.9) with what its proof rests on: its own
 * transaction, or the later record whose transaction sealed it (with every record between, so the browser can
 * rebuild the links), or nothing yet, or never (a practice desk). The chain itself is asked from the browser.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** A quiet run longer than this is sealed by the daily checkpoint long before; the links stay bounded either way. */
const MAX_LINKS = 48;

async function proofFor(store: DeskQueries, deskId: string, deskAddress: string | null, r: RecordSummaryWire): Promise<ProofWire> {
  if (!deskAddress) return { kind: "practice" };
  if (!r.sealedBySig) return { kind: "unsealed", deskAddress };
  if (r.sealedSeq === null || r.sealedSeq === r.seq) return { kind: "own", signature: r.sealedBySig, deskAddress };
  const links: Array<{ seq: number; body: unknown }> = [];
  for (let seq = r.seq + 1; seq <= r.sealedSeq && links.length < MAX_LINKS; seq += 1) {
    const link = await store.getRecord({ deskId, seq });
    if (!link) break;
    links.push({ seq, body: link.record.body });
  }
  return { kind: "later", signature: r.sealedBySig, deskAddress, sealingSeq: r.sealedSeq, links };
}

export async function GET(req: Request, context: { params: Promise<{ owner: string; seq: string }> }) {
  const { owner, seq } = await context.params;
  const loaded = await loadDesk(owner);
  if (loaded instanceof NextResponse) return loaded;
  if (!loaded.desk) return refuse(404, DESK_ERRORS.notFound);
  const viewerParam = new URL(req.url).searchParams.get("viewer");
  const viewer = viewerParam && isAddress(viewerParam) && viewerParam === loaded.desk.owner ? "owner" : "visitor";
  if (viewer === "visitor" && !loaded.desk.sharePublic) return refuse(404, DESK_ERRORS.notShared);
  const n = Number(seq);
  if (!Number.isInteger(n) || n < 1) return refuse(400, DESK_ERRORS.badRequest);
  const full = await loaded.store.getRecord({ deskId: loaded.desk.id, seq: n });
  if (!full) return refuse(404, DESK_ERRORS.notFound);
  const record = { ...toRecord(full.record), body: full.record.body };
  const approvals = (await loaded.store.listApprovals({ deskId: loaded.desk.id })).map(toApproval);
  const actions: ActionWire[] = full.actions.map((a, i) => ({
    leg: Number(a.leg ?? i), kind: a.kind, status: a.status, signature: a.signature ?? a.txSignature ?? null,
    expectedOut: a.expectedOut === null || a.expectedOut === undefined ? null : String(a.expectedOut), actualOut: a.actualOut === null || a.actualOut === undefined ? null : String(a.actualOut),
    failureCode: a.failureCode ?? null, failureDetail: a.failureDetail ?? null,
  }));
  const body: DecisionWire = {
    record,
    actions,
    grade: full.grade ? toGrade(full.grade) : null,
    approval: approvals.find((a) => a.decisionSeq === n) ?? null,
    proof: await proofFor(loaded.store, loaded.desk.id, loaded.desk.address, record),
    viewer,
  };
  return answer(body);
}
