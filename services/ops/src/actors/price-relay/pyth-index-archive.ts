/**
 * The valuation indices' archive (S20, D-125): every 5-minute boundary of the last 23 hours, around the clock (the
 * index has no session), for each feed the store says the key is entitled to, one fetch per pass in a request of its
 * own. A denied feed is never asked: today this archives nothing and costs nothing. Rows land in `print_archive` under
 * `pyth:<index hex>`, which the valuation lane's chart and proof replay read.
 */
import { archivedKeys, archivePrints } from "@agari/db";
import type { PythEntitlementStore } from "../../runtime/pyth-entitlement";
import type { BoundaryCache } from "./boundary-cache";
import { pythRows } from "./pyth-archive";

const STEP_SEC = 300;
const PER_PASS = 1;

export interface IndexArchiveResult {
  rows: number;
  missing: number;
  notes: string[];
}

const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(5, 16).replace("T", " ") + "Z";

/** Every 5-minute boundary in `[fromSec, toSec]`, newest first (the live one leads). */
export function indexBoundaries(fromSec: number, toSec: number): number[] {
  const out: number[] = [];
  for (let t = Math.floor(toSec / STEP_SEC) * STEP_SEC; t >= fromSec; t -= STEP_SEC) out.push(t);
  return out;
}

export async function archiveIndexFeeds(input: {
  store: PythEntitlementStore | null | undefined;
  cache: BoundaryCache;
  fromSec: number;
  toSec: number;
  unavailable: Set<string>;
}): Promise<IndexArchiveResult> {
  const feeds = input.store?.entitled() ?? [];
  if (feeds.length === 0 || input.cache.pythThrottled()) return { rows: 0, missing: 0, notes: [] };
  const times = indexBoundaries(input.fromSec, input.toSec);
  if (times.length === 0) return { rows: 0, missing: 0, notes: [] };
  const have = (await archivedKeys("pyth", times.at(-1)!, times[0]!)) ?? new Set<string>();
  const missing = times.flatMap((t) => feeds.filter((f) => !have.has(`${f.feedIdHex}:${t}`) && !input.unavailable.has(`pyth:${f.feedIdHex}:${t}`)).map((f) => ({ t, f })));
  const notes: string[] = [];
  let rows = 0;
  for (const { t, f } of missing.slice(0, PER_PASS)) {
    const boundary = await input.cache.pyth(t, [f.feedIdHex]);
    if (!boundary) {
      const status = input.cache.pythStatus(t, [f.feedIdHex]);
      if (status === 404 && input.toSec - t > 3600) input.unavailable.add(`pyth:${f.feedIdHex}:${t}`);
      notes.push(`pyth index ${f.symbol} ${iso(t)}: ${input.cache.pythRefusal(t, [f.feedIdHex]) ?? `not available${status ? ` (HTTP ${status})` : ""}`}`);
      continue;
    }
    rows += (await archivePrints(pythRows(boundary, have))) ?? 0;
  }
  return { rows, missing: missing.length, notes };
}
