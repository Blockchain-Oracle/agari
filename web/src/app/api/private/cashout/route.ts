import { privateCashoutRequestSchema, type PrivateClaim } from "@masayume/core/private";
import { toMarketId } from "@masayume/core/types";
import { cashOutPrivateBet, ClaimRefusedError, publicReason } from "@masayume/markets/private";
import { NextResponse } from "next/server";
import { getDesk } from "@/features/private/desk.server";

/**
 * Cash out a private bet, presented the claim and nothing else. The owner and every bet parameter live
 * INSIDE the signed bytes, so there is nothing here worth lying about: a forged or edited claim fails the
 * signature check against the key the contract pins.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const refuse = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const parsed = privateCashoutRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return refuse(400, "malformed private cash-out request");
  const desk = await getDesk().catch(() => null);
  if (!desk) return refuse(503, "no desk key is configured on this deployment (PRIVATE_DESK_PRIVATE_KEY)");
  try {
    const claim: PrivateClaim = { ...parsed.data.claim, marketId: toMarketId(parsed.data.claim.marketId) };
    return NextResponse.json(await cashOutPrivateBet(desk, claim, parsed.data.signature as `0x${string}`));
  } catch (error) {
    if (error instanceof ClaimRefusedError) return refuse(403, error.message);
    return refuse(502, publicReason(error instanceof Error ? error.message : String(error)));
  }
}
