import { isDbConfigured, xLinkByAuthor, xLinkUpsert } from "@masayume/db";
import { NextResponse, type NextRequest } from "next/server";
import { X_ERRORS } from "@/features/x/copy";
import { readXGate, signatureFresh, toBinding, verifyLinkSignature } from "@/features/x/gate.server";
import { xBindRequestSchema } from "@/features/x/protocol";

export const dynamic = "force-dynamic";

function refuse(reason: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, reason, ...extra }, { status });
}

/**
 * Point the signed-in X account at the connected wallet, so a mention the relay reads resolves
 * to this person's own grant — the reference's `api/claim/x/link`. One live route per account:
 * an account already pointed at another wallet is refused with that wallet named, and only a
 * signature from that wallet (unlink) can move it.
 */
export async function POST(req: NextRequest) {
  const gate = await readXGate(req.nextUrl.origin);
  if (!gate.configured) return NextResponse.json({ ok: false, configured: false, missing: gate.missing });
  if (!isDbConfigured()) return refuse(X_ERRORS.storeUnavailable, 503);
  if (!gate.session) return refuse(X_ERRORS.signInFirst, 401);

  const parsed = xBindRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return refuse(X_ERRORS.badRequest, 400);
  const { wallet, issuedAtMs, signature } = parsed.data;
  if (!signatureFresh(issuedAtMs, Date.now())) return refuse(X_ERRORS.staleSignature, 400);
  if (!(await verifyLinkSignature("link", gate.session.authorId, wallet, issuedAtMs, signature))) return refuse(X_ERRORS.signatureMismatch, 401);

  const existing = await xLinkByAuthor(gate.session.authorId);
  if (existing && existing.wallet !== wallet.toLowerCase()) return refuse(X_ERRORS.alreadyLinkedOther, 409, { boundWallet: existing.wallet });

  const link = await xLinkUpsert({ authorId: gate.session.authorId, handle: gate.session.handle, wallet, signature, issuedAtMs });
  if (!link) return refuse(X_ERRORS.linkFailed, 502);
  return NextResponse.json({ ok: true, binding: toBinding(link) });
}
