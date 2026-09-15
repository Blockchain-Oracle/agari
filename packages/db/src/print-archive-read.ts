/**
 * Reads `print_archive` rows `(source, feed, T)` for the relay's Gap RedStone open slots past the gateway's ≈ 24 h
 * history (session-lanes.md §1.5). Lane 6a owns this file; the package index re-exports all of it.
 */
import { getDb } from "./client";
import { ensureSchema } from "./migrate";
import type { PrintArchiveRow, PrintArchiveSource } from "./print-archive";

/**
 * Every archived row of `source` at boundary `boundarySec` for `feeds`, keyed by feed (a feed with no row is absent).
 * Null when no database is configured.
 */
export async function archivedAtBoundary(source: PrintArchiveSource, feeds: readonly string[], boundarySec: number): Promise<Map<string, PrintArchiveRow> | null> {
  const db = getDb();
  if (!db) return null;
  if (feeds.length === 0) return new Map();
  await ensureSchema();
  const rows = await db<Array<{ feed: string; payload: string; signers: number; price_e8: string; fetched_at_ms: string }>>`
    SELECT feed, payload, signers, price_e8, fetched_at_ms FROM print_archive
    WHERE source = ${source} AND boundary_sec = ${boundarySec} AND feed IN ${db([...feeds])}`;
  return new Map(
    rows.map((r) => [r.feed, { source, feed: r.feed, boundarySec, payload: r.payload, signers: r.signers, priceE8: r.price_e8, fetchedAtMs: Number(r.fetched_at_ms) }]),
  );
}
