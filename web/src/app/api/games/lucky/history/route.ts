import type { Address } from "@masayume/core/types";
import { NextResponse } from "next/server";
import { luckyHistory } from "@/features/games/lucky/lucky-settle.server";

/**
 * `GET /api/games/lucky/history?address=0x…` — a wallet's spins, newest first, with the streak its settled
 * ones add up to. Reading it is what reconciles the open rows against the chain, so the answer is as
 * current as the venue is; `configured: false` is the honest answer on a deployment with no store.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return NextResponse.json({ error: "address required" }, { status: 400 });
  return NextResponse.json(await luckyHistory(address as Address));
}
