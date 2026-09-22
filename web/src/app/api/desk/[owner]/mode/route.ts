import type { Address } from "@agari/core/types";
import { NextResponse } from "next/server";
import { answer, DESK_ERRORS, loadDesk, readJson, refuse, verifyOwner } from "@/features/desk/auth.server";
import { chainMatches } from "@/features/desk/chain.server";
import { deskModeText, modeRequestSchema } from "@/features/desk/protocol";

/**
 * `POST /api/desk/[owner]/mode`: the index's copy of the desk's mode, after the owner's mainnet transaction set it.
 * With `attach`, Go live's last step: the practice row becomes a live desk at the PDA the owner just opened, and the
 * server confirms on mainnet that a desk for this owner exists at that address with that operator before it
 * believes the signature. Only a live desk changes mode; a practice desk goes live through `attach`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ owner: string }> }) {
  const { owner: key } = await context.params;
  const loaded = await loadDesk(key);
  if (loaded instanceof NextResponse) return loaded;
  if (!loaded.desk) return refuse(404, DESK_ERRORS.notFound);
  const parsed = modeRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return refuse(400, DESK_ERRORS.badRequest);
  const { owner, mode, signedAtIso, signature, attach } = parsed.data;
  const nowMs = Date.now();
  const refused = await verifyOwner({ owner, text: deskModeText({ owner, mode, signedAtIso, attach }), signature, desk: loaded.desk, signedAtIso, nowMs });
  if (refused) return refused;
  if (attach) {
    if (mode === "practice") return refuse(400, DESK_ERRORS.badRequest);
    const matches = await chainMatches(owner as Address, attach.address, attach.operator, Math.floor(nowMs / 1000));
    if (matches === false) return refuse(409, DESK_ERRORS.chainMismatch);
    if (matches === null) return refuse(502, "the chain could not be read to confirm the desk; try again");
    await loaded.store.attachLiveDesk({ deskId: loaded.desk.id, address: attach.address, operator: attach.operator, mode });
    return answer({ ok: true, mode, address: attach.address });
  }
  if (!loaded.desk.address) return refuse(409, DESK_ERRORS.practiceOnly);
  await loaded.store.setDeskMode({ deskId: loaded.desk.id, mode });
  return answer({ ok: true, mode });
}
