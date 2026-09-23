/**
 * The desk's value over time (S22): one point per snapshot the runner took, oldest first, for the desk page's chart
 * and each holding's sparkline. Reads `desk_snapshots_desk_idx`; money stays in decimal strings.
 */
import type { Db } from "./client";
import { ensureSchema } from "./migrate";
import type { SnapshotHolding } from "./desk";

export interface SeriesPoint {
  atSec: number;
  totalE6: string;
  /** Each held name's token price at that snapshot, `symbol → priceE8`. */
  prices: Record<string, string>;
}

export function deskSeriesQueries(db: Db) {
  const ready = () => ensureSchema();
  return {
    /** The newest `limit` snapshots, returned oldest first. */
    async snapshotSeries(deskId: string, limit = 720): Promise<SeriesPoint[]> {
      await ready();
      const rows = await db<{ taken_at_sec: string; total_e6: string; holdings: SnapshotHolding[] }[]>`
        SELECT taken_at_sec, total_e6, holdings FROM desk_snapshots WHERE desk_id = ${deskId}::uuid ORDER BY taken_at_sec DESC LIMIT ${limit}`;
      return rows.reverse().map((r) => ({
        atSec: Number(r.taken_at_sec),
        totalE6: r.total_e6,
        prices: Object.fromEntries((r.holdings ?? []).filter((h) => h.priceE8).map((h) => [h.symbol, h.priceE8])),
      }));
    },
  };
}
