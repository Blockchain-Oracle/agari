import { isDbConfigured, xLinkByAuthor, xLinkRevoke } from "@masayume/db";
import { NextResponse, type NextRequest } from "next/server";
import { X_ERRORS } from "@/features/x/copy";
import { readXGate, signatureFresh, verifyLinkSignature } from "@/features/x/gate.server";
import { xUnlinkRequestSchema } from "@/features/x/protocol";
import { X_SESSION_COOKIE } from "@/features/x/session.server";

export const dynamic = "force-dynamic";

function refuse(reason: string, status: number) {
  return NextResponse.json({ ok: false, reason }, { status });
}

/** Removes the X route only; the Trading Balance stays with the wallet. Signed by the bound wallet, as the reference requires. */
export async function POST(req: NextRequest) {
  const gate = await readXGate(req.nextUrl.origin);
  if (!gate.configured) return NextResponse.json({ ok: false, configured: false, missing: gate.missing });
  if (!isDbConfigured()) return refuse(X_ERRORS.storeUnavailable, 503);
  if (!gate.session) return refuse(X_ERRORS.signInFirst, 401);

  const parsed = xUnlinkRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return refuse(X_ERRORS.badRequest, 400);
  const { wallet, issuedAtMs, signature } = parsed.data;
  if (!signatureFresh(issuedAtMs, Date.now())) return refuse(X_ERRORS.staleSignature, 400);
  if (!(await verifyLinkSignature("unlink", gate.session.authorId, wallet, issuedAtMs, signature))) return refuse(X_ERRORS.signatureMismatch, 401);

  const existing = await xLinkByAuthor(gate.session.authorId);
  if (!existing || existing.wallet !== wallet.toLowerCase()) return refuse(X_ERRORS.notLinked, 409);
  if (!(await xLinkRevoke(gate.session.authorId, wallet))) return refuse(X_ERRORS.unlinkFailed, 502);

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(X_SESSION_COOKIE);
  return res;
}
