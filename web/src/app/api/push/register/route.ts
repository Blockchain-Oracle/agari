import { createHash, randomBytes } from "node:crypto";
import { isDbConfigured, registerPushDevice, updatePushDevice } from "@agari/db";
import { NextResponse } from "next/server";
import { PUSH_ERRORS, PUSH_SIGNATURE_TTL_MS, pushRegisterMessage, pushRegisterSchema, pushUpdateSchema, type PushRegistration } from "@/features/push/protocol";
import { clientIp, createRateGate } from "@/features/social/limits.server";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";

/**
 * Phone push registration (S26.4). POST: the wallet signs `pushRegisterMessage` naming this install's Expo token; the
 * route verifies it, stores the install against that wallet and hands back a fresh device secret (only its hash is
 * kept). PATCH: the phone presents that secret to change which kinds it hears, or `kinds: null` to stop. The wallet
 * always comes from the signature, never from a body field, so no one can point their phone at someone else's news.
 */
export const runtime = "nodejs";

const perIp = createRateGate([{ max: 20, windowMs: 60_000 }]);
const NO_STORE = { "cache-control": "no-store" };
const hashOf = (secret: string) => createHash("sha256").update(secret).digest("hex");
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });

export async function POST(req: Request) {
  if (!isDbConfigured()) return fail(PUSH_ERRORS.unavailable, 503);
  const now = Date.now();
  if (!perIp(clientIp(req), now)) return fail(PUSH_ERRORS.tooFast, 429);

  const parsed = pushRegisterSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(PUSH_ERRORS.badRequest, 400);
  const { address, expoToken, platform, kinds, issuedAtMs, signature } = parsed.data;
  if (Math.abs(now - issuedAtMs) > PUSH_SIGNATURE_TTL_MS) return fail(PUSH_ERRORS.staleSignature, 400);
  if (!(await verifyWalletMessage({ text: pushRegisterMessage(address, expoToken, issuedAtMs), signature, signer: address }))) {
    return fail(PUSH_ERRORS.badSignature, 401);
  }

  const secret = randomBytes(32).toString("base64url");
  try {
    const device = await registerPushDevice({ expoToken, wallet: address, secretHash: hashOf(secret), platform, kinds, nowMs: now });
    if (!device) return fail(PUSH_ERRORS.unavailable, 503);
    return NextResponse.json({ wallet: device.wallet, kinds: device.kinds, secret } satisfies PushRegistration, { headers: NO_STORE });
  } catch {
    return fail(PUSH_ERRORS.unavailable, 503);
  }
}

export async function PATCH(req: Request) {
  if (!isDbConfigured()) return fail(PUSH_ERRORS.unavailable, 503);
  const now = Date.now();
  if (!perIp(clientIp(req), now)) return fail(PUSH_ERRORS.tooFast, 429);

  const parsed = pushUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(PUSH_ERRORS.badRequest, 400);
  const { expoToken, secret, kinds } = parsed.data;
  try {
    const device = await updatePushDevice({ expoToken, secretHash: hashOf(secret), kinds, nowMs: now });
    if (device === null) return fail(PUSH_ERRORS.unavailable, 503);
    if (device === "unknown") return fail(PUSH_ERRORS.unknownDevice, 404);
    return NextResponse.json({ wallet: device.wallet, kinds: kinds === null ? [] : device.kinds } satisfies PushRegistration, { headers: NO_STORE });
  } catch {
    return fail(PUSH_ERRORS.unavailable, 503);
  }
}
