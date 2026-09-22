/**
 * One fetch per boundary for everything in the process that needs it (recording, archiving): RedStone refetches
 * every 3 s while a feed still lacks a signer until T + 60, every 30 s after that until T + 300 (a late fifth package
 * lets a primary record before its strict window ends), then freezes; Pyth caches the first answer that carries
 * every requested feed.
 */
import { isPythIndexFeed, type PythEntitlementStore } from "../../runtime/pyth-entitlement";
import { fetchPythAt, type PythBoundary } from "./hermes-fetch";
import { feedAt, fetchRedstoneAt, type GatewayResponse } from "./redstone-fetch";
import type { RelaySources } from "./sources";

const REFETCH_MS = 3_000;
/** After T + 60 a short signer set keeps being refetched, slower, until the widest strict window (300 s) has passed. */
const LATE_REFETCH_MS = 30_000;
const STRICT_MAX_SEC = 300;
const KEEP_SEC = 24 * 3600;
const PYTH_SPACING_MS = 1_000;
const PYTH_BACKOFF_MS = 5_000;
const PYTH_BACKOFF_MAX_MS = 60_000;

type RedstoneEntry = { response: GatewayResponse | null; lastTryMs: number; frozen: boolean; inflight: Promise<GatewayResponse | null> | null; error: string | null };
type PythEntry = { boundary: PythBoundary | null; lastTryMs: number; status: number; inflight: Promise<PythBoundary | null> | null; refusal: string | null };

export class BoundaryCache {
  private readonly redstoneByT = new Map<number, RedstoneEntry>();
  private readonly pythByKey = new Map<string, PythEntry>();
  /** Set once Hermes refuses the key on a trial feed (the trial ended): Pyth fetches stop. A valuation index never sets it (S20). */
  pythAuthFailed = false;
  /** Hermes REST pacing shared by recording and archiving: 1 s apart, backing off on HTTP 429. */
  private pythNotBeforeMs = 0;
  private pythBackoffMs = PYTH_BACKOFF_MS;

  constructor(
    private readonly sources: RelaySources,
    private readonly pythKey: string | undefined,
    /** The valuation indices' entitlement (S20, D-125); null refuses every index feed, so nothing gated is ever fetched by accident. */
    private readonly entitlement: PythEntitlementStore | null = null,
  ) {}

  /**
   * Why these feeds may not be asked of Hermes right now, or null (S20). A valuation index is fetched only while the
   * store says `entitled`, and only in a request of its own: a 403 on a mixed request would read as the key dying.
   */
  indexRefusal(feedIds: readonly string[]): string | null {
    const index = feedIds.filter(isPythIndexFeed);
    if (index.length === 0) return null;
    if (index.length !== feedIds.length) return "a valuation index is never fetched in the same request as a trial feed";
    const denied = index.find((id) => this.entitlement?.state(id) !== "entitled");
    if (denied === undefined) return null;
    const feed = this.entitlement?.feed(denied);
    return `${feed?.symbol ?? denied.slice(0, 8)} index not entitled${feed?.status ? ` (${feed.status}${feed.reason ? ` ${feed.reason}` : ""})` : ""}`;
  }

  private complete(response: GatewayResponse, tSec: number): boolean {
    return this.sources.redstoneFeeds.every((f) => (feedAt(response.text, f.feed, tSec, this.sources.redstoneSigners)?.packages.length ?? 0) >= this.sources.redstoneSignerCount);
  }

  /** The boundary's gateway response (possibly incomplete before T + 60), or null while none has been fetched. */
  async redstone(tSec: number): Promise<GatewayResponse | null> {
    const entry = this.redstoneByT.get(tSec) ?? { response: null, lastTryMs: 0, frozen: false, inflight: null, error: null };
    this.redstoneByT.set(tSec, entry);
    if (entry.frozen || entry.inflight) return entry.inflight ?? entry.response;
    const lateMs = entry.response && entry.response.fetchedAtMs / 1000 >= tSec + 60 ? LATE_REFETCH_MS : REFETCH_MS;
    if (entry.response && Date.now() - entry.lastTryMs < lateMs) return entry.response;
    entry.lastTryMs = Date.now();
    entry.inflight = fetchRedstoneAt(tSec, this.sources.gateways)
      .then((response) => {
        entry.response = response;
        entry.error = null;
        entry.frozen = this.complete(response, tSec) || response.fetchedAtMs / 1000 >= tSec + STRICT_MAX_SEC;
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
    const entry = this.pythByKey.get(key) ?? { boundary: null, lastTryMs: 0, status: 0, inflight: null, refusal: null };
    this.pythByKey.set(key, entry);
    if (entry.boundary) return entry.boundary;
    if (entry.inflight) return entry.inflight;
    // Refused before any request leaves: an unentitled index cannot answer 403 here, so `pythAuthFailed` cannot latch on it.
    entry.refusal = this.indexRefusal(ids);
    if (entry.refusal) return null;
    const indexOnly = ids.every(isPythIndexFeed);
    if (Date.now() - entry.lastTryMs < 2_000 || Date.now() < this.pythNotBeforeMs) return null;
    entry.lastTryMs = Date.now();
    this.pythNotBeforeMs = Date.now() + PYTH_SPACING_MS;
    entry.inflight = fetchPythAt(tSec, ids, this.pythKey)
      .then((result) => {
        if (!result.ok) {
          entry.status = result.status;
          // A refusal on an index-only request is that feed's entitlement, recorded in the store; on a trial feed it is the key.
          if (result.authFailed && indexOnly) for (const id of ids) this.entitlement?.markDenied(id, result.status);
          else if (result.authFailed) this.pythAuthFailed = true;
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

  /** The reason the last `pyth()` for these feeds was refused before fetching (S20), or null. */
  pythRefusal(tSec: number, feedIds: readonly string[]): string | null {
    return this.pythByKey.get(`${tSec}:${[...feedIds].sort().join(",")}`)?.refusal ?? null;
  }

  /** Drops boundaries older than a day. */
  prune(nowSec: number): void {
    for (const t of this.redstoneByT.keys()) if (t < nowSec - KEEP_SEC) this.redstoneByT.delete(t);
    for (const [key, entry] of this.pythByKey) if ((entry.boundary?.tSec ?? Number(key.split(":")[0])) < nowSec - KEEP_SEC) this.pythByKey.delete(key);
  }
}
