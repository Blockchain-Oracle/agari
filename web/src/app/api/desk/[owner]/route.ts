import { isAddress, type Address } from "@agari/core/types";
import { NextResponse } from "next/server";
import { answer, DESK_ERRORS, loadDesk, refuse } from "@/features/desk/auth.server";
import { operatorAddress, readChain } from "@/features/desk/chain.server";
import { assembleView } from "@/features/desk/desk.server";

/**
 * `GET /api/desk/[owner]?viewer=<address>`: the desk page in one answer (plan §5.7). `[owner]` is the owner's
 * address or the desk's id. The owner (the `viewer` that matches) reads everything; anyone else reads it only when
 * sharing is on, and never the notes. An address with no desk answers the studio's empty view. Without the desk
 * index (C4) the route says so with a 503, and the surfaces render from `/dev/desk` fixtures instead.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ owner: string }> }) {
  const { owner } = await context.params;
  const loaded = await loadDesk(owner);
  if (loaded instanceof NextResponse) return loaded;
  const viewerParam = new URL(req.url).searchParams.get("viewer");
  const viewerAddress = viewerParam && isAddress(viewerParam) ? viewerParam : null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (!loaded.desk) {
    if (!loaded.keyIsAddress) return refuse(404, DESK_ERRORS.notFound);
    const viewer = viewerAddress === loaded.key ? "owner" : "visitor";
    return answer(await assembleView({ store: loaded.store, desk: null, viewer, nowSec, chain: { state: null, error: null }, operator: operatorAddress() }));
  }
  const viewer = viewerAddress === loaded.desk.owner ? "owner" : "visitor";
  if (viewer === "visitor" && !loaded.desk.sharePublic) return refuse(404, DESK_ERRORS.notShared);
  const chain = loaded.desk.address ? await readChain(loaded.desk.owner as Address, nowSec) : { state: null, error: null };
  return answer(await assembleView({ store: loaded.store, desk: loaded.desk, viewer, nowSec, chain, operator: operatorAddress() }));
}
