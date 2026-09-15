/**
 * The social routes' limits (social-assistant.md §3): sliding windows held in memory, per instance, like the
 * strategies preview gate. They bound spam and chain reads; they are not an accounting of anything.
 */
export interface Limit {
  max: number;
  windowMs: number;
}

/** Past this many keys, entries with no hit inside the longest window are swept. */
const SWEEP_AT = 5_000;

export interface Limiter {
  /** Counts one hit for `key` and says whether it fits every limit; a refused hit is not counted. */
  take: (key: string, nowMs: number) => boolean;
}

export function createLimiter(limits: readonly Limit[]): Limiter {
  const longestMs = Math.max(...limits.map((limit) => limit.windowMs));
  const hits = new Map<string, number[]>();

  const sweep = (nowMs: number) => {
    for (const [key, times] of hits) if (nowMs - (times.at(-1) ?? 0) >= longestMs) hits.delete(key);
  };

  return {
    take(key, nowMs) {
      if (hits.size > SWEEP_AT) sweep(nowMs);
      const recent = (hits.get(key) ?? []).filter((at) => nowMs - at < longestMs);
      const fits = limits.every((limit) => recent.filter((at) => nowMs - at < limit.windowMs).length < limit.max);
      if (fits) recent.push(nowMs);
      hits.set(key, recent);
      return fits;
    },
  };
}

const MINUTE_MS = 60_000;

export const ROOM_LIMITS = {
  /** Joins: 10 per IP per minute (a join may cost two chain reads). */
  join: createLimiter([{ max: 10, windowMs: MINUTE_MS }]),
  /** Posts: 1 per wallet per 3 s and 20 per 10 min. */
  post: createLimiter([
    { max: 1, windowMs: 3_000 },
    { max: 20, windowMs: 10 * MINUTE_MS },
  ]),
  /** Registry writes: 6 per IP per minute (each may poll the index for 10 s). */
  bet: createLimiter([{ max: 6, windowMs: MINUTE_MS }]),
  /** Takes: 3 per wallet per minute and 30 per day. */
  take: createLimiter([
    { max: 3, windowMs: MINUTE_MS },
    { max: 30, windowMs: 24 * 60 * MINUTE_MS },
  ]),
} as const;

/** The caller's address as the edge reports it; `local` in development. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
