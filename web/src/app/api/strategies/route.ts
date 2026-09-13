import { NextResponse } from "next/server";
import { STRATEGIES } from "@/features/strategies/copy";
import { readStrategies } from "@/features/strategies/registry.server";

/** The desk's catalogue: registry state joined with the runner's receipts and heartbeats, cached briefly. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readStrategies());
  } catch (error) {
    console.error("strategies:", error);
    return NextResponse.json({ error: STRATEGIES.errors.read }, { status: 503 });
  }
}
