import { createHash } from "node:crypto";

/** proof-analytics.md §2.6 quotas: ≤ 20 posts an hour across the deployment, ≤ 3 per IP, never below 0.02 SOL. */
export const REPLAY_QUOTA = {
  windowMs: 60 * 60_000,
  global: 20,
  perIp: 3,
  minPayerLamports: 20_000_000n,
} as const;

export type ReplayRefusalCode = "quota" | "unavailable" | "failed" | "bad-request" | "no-print";

export function refusal(code: ReplayRefusalCode, status: number, error: string): Response {
  return Response.json({ error, code }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * The caller's IP as the faucet trusts it (`faucet-config.server.ts`): Vercel's edge header, a fixed key in local
 * development, and nothing elsewhere (an untrusted forwarded header must not buy a fresh quota). Stored only hashed.
 */
export function callerKey(request: Request): string | null {
  const ip = process.env.VERCEL === "1" ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : process.env.NODE_ENV !== "production" ? "local-development" : null;
  return ip ? createHash("sha256").update(`agari-proof-replay:${ip}`).digest("hex") : null;
}

/** Posts per caller in the last hour, per process: the global quota is the database's, which every instance shares. */
const recent = new Map<string, number[]>();

export function callerPostsSince(key: string, sinceMs: number): number {
  const kept = (recent.get(key) ?? []).filter((ms) => ms >= sinceMs);
  if (kept.length === 0) recent.delete(key);
  else recent.set(key, kept);
  return kept.length;
}

export function recordCallerPost(key: string, atMs: number): void {
  recent.set(key, [...(recent.get(key) ?? []), atMs]);
}
