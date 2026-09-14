/**
 * One fetch per boundary for everything in the process that needs it (recording, archiving): RedStone refetches
 * every 3 s while a feed still lacks a signer and T + 60 hasn't passed, then freezes; Pyth caches the first answer
 * that carries every requested feed.
 */
import { fetchPythAt, type PythBoundary } from "./hermes-fetch";
import { feedAt, fetchRedstoneAt, type GatewayResponse } from "./redstone-fetch";
import type { RelaySources } from "./sources";

const REFETCH_MS = 3_000;
const COMPLETE_BY_SEC = 60;
const KEEP_SEC = 24 * 3600;
const PYTH_SPACING_MS = 1_000;
const PYTH_BACKOFF_MS = 5_000;
const PYTH_BACKOFF_MAX_MS = 60_000;

type RedstoneEntry = { response: GatewayResponse | null; lastTryMs: number; frozen: boolean; inflight: Promise<GatewayResponse | null> | null; error: string | null };
type PythEntry = { boundary: PythBoundary | null; lastTryMs: number; status: number; inflight: Promise<PythBoundary | null> | null };

export class BoundaryCache {
  private readonly redstoneByT = new Map<number, RedstoneEntry>();
  private readonly pythByKey = new Map<string, PythEntry>();
  /** Set once Hermes refuses the key (the trial ended): Pyth fetches stop. */
  pythAuthFailed = false;
  /** Hermes REST pacing shared by recording and archiving: 1 s apart, backing off on HTTP 429. */
  private pythNotBeforeMs = 0;
  private pythBackoffMs = PYTH_BACKOFF_MS;

  constructor(
    private readonly sources: RelaySources,
    private readonly pythKey: string | undefined,
  ) {}

  private complete(response: GatewayResponse, tSec: number): boolean {
    return this.sources.redstoneFeeds.every((f) => (feedAt(response.text, f.feed, tSec, this.sources.redstoneSigners)?.packages.length ?? 0) >= this.sources.redstoneSignerCount);
  }

  /** The boundary's gateway response (possibly incomplete before T + 60), or null while none has been fetched. */
  async redstone(tSec: number): Promise<GatewayResponse | null> {
    const entry = this.redstoneByT.get(tSec) ?? { response: null, lastTryMs: 0, frozen: false, inflight: null, error: null };
    this.redstoneByT.set(tSec, entry);
    if (entry.frozen || entry.inflight) return entry.inflight ?? entry.response;
    if (entry.response && Date.now() - entry.lastTryMs < REFETCH_MS) return entry.response;
    entry.lastTryMs = Date.now();
    entry.inflight = fetchRedstoneAt(tSec, this.sources.gateways)
      .then((response) => {
        entry.response = response;
        entry.error = null;
        entry.frozen = this.complete(response, tSec) || response.fetchedAtMs / 1000 >= tSec + COMPLETE_BY_SEC;
        return response;
      })
      .catch((error: unknown) => {
        entry.error = error instanceof Error ? error.message : String(error);
        return entry.response;
      })
      .finally(() => (entry.inflight = null));
    return entry.inflight;
  }

  redstoneError(tSec: number): string | null {
    return this.redstoneByT.get(tSec)?.error ?? null;
  }

  /** Hermes at T for exactly these feeds; null while unavailable (retried at most every 2 s). */
  async pyth(tSec: number, feedIds: readonly string[]): Promise<PythBoundary | null> {
    if (!this.pythKey || this.pythAuthFailed) return null;
    const ids = [...feedIds].sort();
    const key = `${tSec}:${ids.join(",")}`;
    const entry = this.pythByKey.get(key) ?? { boundary: null, lastTryMs: 0, status: 0, inflight: null };
    this.pythByKey.set(key, entry);
    if (entry.boundary) return entry.boundary;
    if (entry.inflight) return entry.inflight;
    if (Date.now() - entry.lastTryMs < 2_000 || Date.now() < this.pythNotBeforeMs) return null;
    entry.lastTryMs = Date.now();
    this.pythNotBeforeMs = Date.now() + PYTH_SPACING_MS;
    entry.inflight = fetchPythAt(tSec, ids, this.pythKey)
      .then((result) => {
        if (!result.ok) {
          entry.status = result.status;
          if (result.authFailed) this.pythAuthFailed = true;
          if (result.status === 429) {
            this.pythNotBeforeMs = Date.now() + this.pythBackoffMs;
            this.pythBackoffMs = Math.min(this.pythBackoffMs * 2, PYTH_BACKOFF_MAX_MS);
          }
          return null;
        }
        this.pythBackoffMs = PYTH_BACKOFF_MS;
        const have = new Set(result.boundary.parsed.map((p) => p.feedIdHex));
        if (!ids.every((id) => have.has(id))) return null;
        entry.boundary = result.boundary;
        return entry.boundary;
      })
      .finally(() => (entry.inflight = null));
    return entry.inflight;
  }

  /** True while Hermes pacing or a 429 backoff holds new requests. */
  pythThrottled(): boolean {
    return Date.now() < this.pythNotBeforeMs;
  }

  pythStatus(tSec: number, feedIds: readonly string[]): number {
    return this.pythByKey.get(`${tSec}:${[...feedIds].sort().join(",")}`)?.status ?? 0;
  }

  /** Drops boundaries older than a day. */
  prune(nowSec: number): void {
    for (const t of this.redstoneByT.keys()) if (t < nowSec - KEEP_SEC) this.redstoneByT.delete(t);
    for (const [key, entry] of this.pythByKey) if ((entry.boundary?.tSec ?? Number(key.split(":")[0])) < nowSec - KEEP_SEC) this.pythByKey.delete(key);
  }
}
