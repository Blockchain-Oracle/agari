/**
 * The earnings calendar (session-lanes.md §3.3): Finnhub `/calendar/earnings` 14 days ahead, once per 6 h, into
 * `deps.events.setEarnings`. `FINNHUB_API_KEY` is server-only and redacted. Lane 6c owns this file; this foundation
 * stub registers the actor and fetches nothing, so `/session.earnings` stays null ("unknown", not "none").
 */
import { runActor, type VenueDeps } from "../runtime";

const PASS_MS = 6 * 60 * 60_000;

export async function startEarnings(deps: VenueDeps): Promise<{ stop: () => void }> {
  const { stop } = runActor({ name: "earnings", log: deps.log, dryRun: false, everyMs: PASS_MS, pass: async () => ({ why: "paused: lane not built (6c)" }) });
  return { stop };
}
