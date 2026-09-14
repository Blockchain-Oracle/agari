/** `GET /health` (venue-ops.md §2.3): every actor heartbeat; `ok` is false when one is failing or silent for max(5 min, 3 × its loop interval). */
import { heartbeats } from "../runtime/heartbeat";
import type { OpsEnv } from "../runtime/env";

const SILENT_MS = 5 * 60_000;
const FAILING = 3;

export function healthBody(env: OpsEnv | undefined, nowMs = Date.now()) {
  const actors = heartbeats();
  const ok = actors.every((a) => a.failures < FAILING && nowMs - (a.lastOkMs ?? a.startedMs) <= Math.max(SILENT_MS, 3 * a.everyMs));
  return { ok, cluster: env?.cluster ?? null, dryRun: env?.dryRun ?? null, nowMs, actors };
}

/** JSON with bigints as decimal strings. */
export const jsonText = (value: unknown) => JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));
