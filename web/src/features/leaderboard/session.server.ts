import { z } from "zod";

/** The session a `session` board covers, as ops agrees it (`GET /session` `calendar.recent`, S3). */
export interface BoardSession {
  /** ET trading date, `YYYY-MM-DD`. */
  date: string;
  openSec: number;
  closeSec: number;
}

const OPS_TIMEOUT_MS = 5_000;
const sessionSchema = z.object({ date: z.string(), openSec: z.number(), closeSec: z.number() });
const bodySchema = z.object({ calendar: z.object({ recent: z.array(sessionSchema) }).nullable() });

/**
 * The latest session that has opened: today's once the bell rings, otherwise the previous one (Q-S5-4). Throws when
 * ops can't say, so the route answers its failed state instead of ranking a guessed session.
 */
export async function latestSession(opsBase: string | undefined, nowSec: number): Promise<BoardSession> {
  if (!opsBase) throw new Error("NEXT_PUBLIC_PRICE_FEED_URL is not set; the session board has no ops calendar");
  const response = await fetch(`${opsBase}/session`, { cache: "no-store", signal: AbortSignal.timeout(OPS_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`ops /session answered ${response.status}`);
  const body = bodySchema.parse(await response.json());
  const opened = (body.calendar?.recent ?? []).filter((s) => s.openSec <= nowSec);
  const latest = opened.reduce<BoardSession | null>((best, s) => (best === null || s.openSec > best.openSec ? s : best), null);
  if (!latest) throw new Error("ops /session lists no session that has opened");
  return { date: latest.date, openSec: latest.openSec, closeSec: latest.closeSec };
}
