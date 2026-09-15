import type { HoldingsBody } from "@agari/markets/holdings";

/** session-lanes.md §4: 60 s per owner, 30 requests a minute per IP. In memory: nothing about an owner is stored. */
export const OWNER_CACHE_MS = 60_000;
const IP_WINDOW_MS = 60_000;
const IP_LIMIT = 30;
/** Bounds both maps so a scan of many owners or IPs can't grow the process without limit. */
const MAX_ENTRIES = 5_000;

const owners = new Map<string, { atMs: number; body: Promise<HoldingsBody> }>();
const ips = new Map<string, { startMs: number; count: number }>();

function trim<V>(map: Map<string, V>, keep: (value: V) => boolean): void {
  if (map.size < MAX_ENTRIES) return;
  for (const [key, value] of map) if (!keep(value)) map.delete(key);
  // Still full of live entries: drop the oldest insertions.
  for (const key of map.keys()) {
    if (map.size < MAX_ENTRIES) break;
    map.delete(key);
  }
}

/** True when this IP may make another request now. */
export function admitIp(ip: string, nowMs: number): boolean {
  trim(ips, (entry) => nowMs - entry.startMs < IP_WINDOW_MS);
  const entry = ips.get(ip);
  if (!entry || nowMs - entry.startMs >= IP_WINDOW_MS) {
    ips.set(ip, { startMs: nowMs, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= IP_LIMIT;
}

/** One read per owner per minute; concurrent callers share the in-flight read, and a failed read is not cached. */
export function cachedHoldings(owner: string, nowMs: number, read: () => Promise<HoldingsBody>): Promise<HoldingsBody> {
  const hit = owners.get(owner);
  if (hit && nowMs - hit.atMs < OWNER_CACHE_MS) return hit.body;
  trim(owners, (entry) => nowMs - entry.atMs < OWNER_CACHE_MS);
  const body = read();
  owners.set(owner, { atMs: nowMs, body });
  body.catch(() => {
    if (owners.get(owner)?.body === body) owners.delete(owner);
  });
  return body;
}

/** The first hop the platform wrote; locally there is none. */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
