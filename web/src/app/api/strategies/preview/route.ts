import { NextResponse } from "next/server";
import { STRATEGIES } from "@/features/strategies/copy";
import { dryReadAgent, previewGate } from "@/features/strategies/preview.server";
import { agentPreviewRequestSchema } from "@/features/strategies/protocol";

/**
 * The studio's "Dry read": one real model call on a live Window with the draft's brief, through the
 * same decide step the runner uses. Nothing is sent and nothing is stored — it shows the creator
 * what their agent would say and what the gate would do with it. Rate-limited, because every click
 * costs the house a model call.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const refuse = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const parsed = agentPreviewRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return refuse(400, STRATEGIES.studio.agent.dry.badRequest);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const gate = previewGate(ip, Date.now());
  if (!gate.ok) return refuse(429, gate.error);
  try {
    const outcome = await dryReadAgent(parsed.data, Date.now());
    return outcome.ok ? NextResponse.json(outcome.body) : refuse(outcome.status, outcome.error);
  } catch (error) {
    console.error("strategies/preview:", error);
    return refuse(502, STRATEGIES.studio.agent.dry.unreadable);
  }
}
