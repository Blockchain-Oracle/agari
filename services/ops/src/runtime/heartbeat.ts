/** In-process actor heartbeats: what `/health` serves and what the soak watches (venue-ops.md §2.3). */
export interface Heartbeat {
  actor: string;
  dryRun: boolean;
  startedMs: number;
  lastPassMs: number | null;
  /** When the running pass started; null between passes. The main watchdog exits the process on a stuck pass. */
  passStartedMs: number | null;
  lastOkMs: number | null;
  lastWhy: string;
  /** Consecutive failed passes. */
  failures: number;
  /** Actor-specific counters and lane states (e.g. paused lanes, lag). JSON-safe values only. */
  detail: Record<string, unknown>;
}

const beats = new Map<string, Heartbeat>();

export function registerHeartbeat(actor: string, dryRun: boolean): Heartbeat {
  const beat: Heartbeat = { actor, dryRun, startedMs: Date.now(), lastPassMs: null, passStartedMs: null, lastOkMs: null, lastWhy: "starting", failures: 0, detail: {} };
  beats.set(actor, beat);
  return beat;
}

export const heartbeats = (): Heartbeat[] => [...beats.values()];
