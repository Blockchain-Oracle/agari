import { addressSchema, type Address } from "@agari/core/types";
import { counts, follow, followees, isDbConfigured, unfollow } from "@agari/db";
import { NextResponse } from "next/server";
import { readToken } from "@/features/room/gate.server";
import { SOCIAL_ERRORS } from "@/features/social/copy";
import { createRateGate } from "@/features/social/limits.server";
import { followWriteSchema, SOCIAL_SCOPE, type FollowsPayload, type FollowWriteResult } from "@/features/social/protocol";

/**
 * The follow graph over `game_follows` (spec §1.6, §3). Reading is public — who follows whom is as visible as a
 * take — and rides a 10 s shared cache. Writing needs the social session token; the follower is the token's wallet,
 * never a body field, so a client cannot follow on another wallet's behalf.
 */
export const runtime = "nodejs";

const perWallet = createRateGate([{ max: 30, windowMs: 60_000 }]);
const NO_STORE = { "cache-control": "no-store" };

async function payloadOf(wallet: Address): Promise<FollowsPayload | null> {
  const [following, tally] = await Promise.all([followees(wallet), counts(wallet)]);
  if (following === null || tally === null) return null;
  return { configured: true, wallet, following: following as Address[], counts: tally };
}

export async function GET(req: Request) {
  const wallet = addressSchema.safeParse(new URL(req.url).searchParams.get("wallet"));
  if (!wallet.success) return NextResponse.json({ error: SOCIAL_ERRORS.badRequest }, { status: 400, headers: NO_STORE });
  if (!isDbConfigured()) {
    const empty: FollowsPayload = { configured: false, wallet: wallet.data, following: [], counts: { followers: 0, following: 0 } };
    return NextResponse.json(empty, { headers: NO_STORE });
  }
  try {
    const payload = await payloadOf(wallet.data);
    if (!payload) return NextResponse.json({ error: SOCIAL_ERRORS.unavailable }, { status: 503, headers: NO_STORE });
    return NextResponse.json(payload, { headers: { "cache-control": "public, s-maxage=10" } });
  } catch {
    return NextResponse.json({ error: SOCIAL_ERRORS.unavailable }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: SOCIAL_ERRORS.unavailable }, { status: 503, headers: NO_STORE });
  const parsed = followWriteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: SOCIAL_ERRORS.badRequest }, { status: 400, headers: NO_STORE });

  const now = Date.now();
  const follower = readToken(parsed.data.token, SOCIAL_SCOPE, now);
  const valid = follower === null ? null : addressSchema.safeParse(follower);
  if (!valid?.success) return NextResponse.json({ error: SOCIAL_ERRORS.notSignedIn }, { status: 401, headers: NO_STORE });
  const { followee } = parsed.data;
  if (valid.data === followee) return NextResponse.json({ error: SOCIAL_ERRORS.self }, { status: 400, headers: NO_STORE });
  if (!perWallet(valid.data, now)) return NextResponse.json({ error: SOCIAL_ERRORS.tooFast }, { status: 429, headers: NO_STORE });

  try {
    const wrote = parsed.data.follow ? await follow(valid.data, followee) : await unfollow(valid.data, followee);
    const [mine, theirs] = await Promise.all([payloadOf(valid.data), counts(followee)]);
    if (wrote === null || !mine || !theirs) return NextResponse.json({ error: SOCIAL_ERRORS.unavailable }, { status: 503, headers: NO_STORE });
    return NextResponse.json({ follower: mine, followee: { wallet: followee, counts: theirs } } satisfies FollowWriteResult, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: SOCIAL_ERRORS.writeFailed }, { status: 503, headers: NO_STORE });
  }
}
