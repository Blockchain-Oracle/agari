import { isDbConfigured } from "@agari/db";
import { NextResponse } from "next/server";
import { mintToken } from "@/features/room/gate.server";
import { SOCIAL_ERRORS } from "@/features/social/copy";
import { clientIp, createRateGate } from "@/features/social/limits.server";
import { SOCIAL_SCOPE, SOCIAL_SIGNATURE_TTL_MS, SOCIAL_TOKEN_TTL_MS, socialSessionMessage, socialSessionRequestSchema, type SocialSession } from "@/features/social/protocol";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";

/**
 * Opening a social session: one ed25519 signature over `socialSessionMessage`, verified here, buys a token scoped
 * to "social" for an hour. Every follow and unfollow in that hour presents the token, so the wallet is asked once
 * (spec §1.6). The token is the room token's format with its own scope, so it can never open a Room.
 */
export const runtime = "nodejs";

const perIp = createRateGate([{ max: 10, windowMs: 60_000 }]);
const NO_STORE = { "cache-control": "no-store" };

export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: SOCIAL_ERRORS.unavailable }, { status: 503, headers: NO_STORE });
  const now = Date.now();
  if (!perIp(clientIp(req), now)) return NextResponse.json({ error: SOCIAL_ERRORS.tooFast }, { status: 429, headers: NO_STORE });

  const parsed = socialSessionRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: SOCIAL_ERRORS.badRequest }, { status: 400, headers: NO_STORE });
  const { address, issuedAtMs, signature } = parsed.data;

  // A signature from the future is as suspect as a stale one.
  if (Math.abs(now - issuedAtMs) > SOCIAL_SIGNATURE_TTL_MS) {
    return NextResponse.json({ error: SOCIAL_ERRORS.staleSignature }, { status: 400, headers: NO_STORE });
  }
  if (!(await verifyWalletMessage({ text: socialSessionMessage(address, issuedAtMs), signature, signer: address }))) {
    return NextResponse.json({ error: SOCIAL_ERRORS.badSignature }, { status: 401, headers: NO_STORE });
  }

  return NextResponse.json({ token: mintToken(address, SOCIAL_SCOPE, now), expiresAtMs: now + SOCIAL_TOKEN_TTL_MS } satisfies SocialSession, { headers: NO_STORE });
}
