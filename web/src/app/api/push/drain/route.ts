import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { drainPush } from "@/features/push/drain.server";

/**
 * One push drain, called by ops' `push-clock` actor every few seconds (S26.4). Gated by `PUSH_DRAIN_SECRET` as a bearer
 * token; with no secret configured the route refuses everything, so an unconfigured deployment can never be made to
 * send. One drain runs at a time per process: a caller that arrives mid-drain is told so and tries next tick.
 */
export const runtime = "nodejs";

const NO_STORE = { "cache-control": "no-store" };
let running = false;

function authorised(req: Request): boolean {
  const secret = process.env.PUSH_DRAIN_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401, headers: NO_STORE });
  if (running) return NextResponse.json({ busy: true }, { status: 409, headers: NO_STORE });
  running = true;
  try {
    return NextResponse.json(await drainPush(Date.now()), { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 300) : "drain failed" }, { status: 500, headers: NO_STORE });
  } finally {
    running = false;
  }
}
