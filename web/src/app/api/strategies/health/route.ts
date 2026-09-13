import { NextResponse } from "next/server";
import { readHealth } from "@/features/strategies/registry.server";

/**
 * Runner health, re-derived on every request from the heartbeats the runner wrote itself — the
 * reference's `/api/desk/health`: a dead runner cannot answer "fine" on its own behalf, and a store
 * that cannot be reached answers "unknown", never alive.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "").split(",").filter((s) => /^\d+$/.test(s));
  return NextResponse.json(await readHealth(ids));
}
