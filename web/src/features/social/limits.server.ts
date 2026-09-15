/**
 * In-memory request limits for the social and activity routes (spec §3: "limits in memory per instance"), in the
 * shape of `previewGate` (`features/strategies/preview.server.ts`). A limit per instance is a brake on a runaway
 * client, not an abuse wall; the stage owner can hide a row in SQL (Q-S13-4).
 */
export interface RateRule {
  max: number;
  windowMs: number;
}

/** Keys past this are swept of expired hits, so a crawl of distinct IPs cannot grow the map without bound. */
const SWEEP_AT = 5_000;

/** A sliding-window gate: `allow(key, now)` records the hit and answers true, or answers false and records nothing. */
export function createRateGate(rules: readonly RateRule[]) {
  const longestMs = Math.max(...rules.map((rule) => rule.windowMs));
  const hits = new Map<string, number[]>();

  function sweep(nowMs: number): void {
    for (const [key, times] of hits) {
      if (times.every((at) => nowMs - at >= longestMs)) hits.delete(key);
    }
  }

  return function allow(key: string, nowMs: number): boolean {
    if (hits.size > SWEEP_AT) sweep(nowMs);
    const recent = (hits.get(key) ?? []).filter((at) => nowMs - at < longestMs);
    const over = rules.some((rule) => recent.filter((at) => nowMs - at < rule.windowMs).length >= rule.max);
    if (!over) recent.push(nowMs);
    hits.set(key, recent);
    return !over;
  };
}

/** The caller's IP as the other limited routes read it (`api/strategies/preview/route.ts`). */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
