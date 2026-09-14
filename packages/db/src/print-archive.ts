/**
 * `print_archive` reads and writes (schema-prints.ts). Append-only: a row is inserted once per
 * `(source, feed, boundary_sec)` and never updated, so a re-run of the relay inserts nothing new.
 */
import { getDb } from "./client";
import { ensureSchema } from "./migrate";

export type PrintArchiveSource = "pyth" | "redstone" | "switchboard" | "attested";

export interface PrintArchiveRow {
  source: PrintArchiveSource;
  feed: string;
  boundarySec: number;
  payload: string;
  signers: number;
  /** Decimal integer string, price × 10⁸. */
  priceE8: string;
  fetchedAtMs: number;
}

export interface PrintArchiveStat {
  source: PrintArchiveSource;
  feed: string;
  boundaries: number;
  firstSec: number;
  lastSec: number;
  /** Slowest `fetched_at − T`. */
  maxLagMs: number;
  /** Boundaries archived more than 60 s after T. */
  lateCount: number;
  minSigners: number;
}

/** Inserts what isn't there yet; returns how many rows were new. Null when no database is configured. */
export async function archivePrints(rows: readonly PrintArchiveRow[]): Promise<number | null> {
  const db = getDb();
  if (!db) return null;
  if (rows.length === 0) return 0;
  await ensureSchema();
  const values = rows.map((r) => ({
    source: r.source,
    feed: r.feed,
    boundary_sec: r.boundarySec,
    payload: r.payload,
    signers: r.signers,
    price_e8: r.priceE8,
    fetched_at_ms: r.fetchedAtMs,
  }));
  const inserted = await db`
    INSERT INTO print_archive ${db(values, "source", "feed", "boundary_sec", "payload", "signers", "price_e8", "fetched_at_ms")}
    ON CONFLICT (source, feed, boundary_sec) DO NOTHING
    RETURNING 1`;
  return inserted.length;
}

/** `"<feed>:<boundarySec>"` for every archived row of `source` with `fromSec ≤ T ≤ toSec`. */
export async function archivedKeys(source: PrintArchiveSource, fromSec: number, toSec: number): Promise<Set<string> | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<Array<{ feed: string; boundary_sec: string }>>`
    SELECT feed, boundary_sec FROM print_archive
    WHERE source = ${source} AND boundary_sec BETWEEN ${fromSec} AND ${toSec}`;
  return new Set(rows.map((r) => `${r.feed}:${Number(r.boundary_sec)}`));
}

/** One stored row, for the proof replay and fixtures. */
export async function archivedPrint(source: PrintArchiveSource, feed: string, boundarySec: number): Promise<PrintArchiveRow | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const [row] = await db<Array<{ payload: string; signers: number; price_e8: string; fetched_at_ms: string }>>`
    SELECT payload, signers, price_e8, fetched_at_ms FROM print_archive
    WHERE source = ${source} AND feed = ${feed} AND boundary_sec = ${boundarySec}`;
  return row ? { source, feed, boundarySec, payload: row.payload, signers: row.signers, priceE8: row.price_e8, fetchedAtMs: Number(row.fetched_at_ms) } : null;
}

/** Per source and feed since `fromSec`: counts, span, slowest fetch and late boundaries (the S3 prints gate). */
export async function printArchiveStats(fromSec: number): Promise<PrintArchiveStat[] | null> {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const rows = await db<Array<{ source: PrintArchiveSource; feed: string; n: number; first: string; last: string; max_lag: string; late: number; min_signers: number }>>`
    SELECT source, feed, count(*)::int AS n, min(boundary_sec) AS first, max(boundary_sec) AS last,
           max(fetched_at_ms - boundary_sec * 1000) AS max_lag,
           count(*) FILTER (WHERE fetched_at_ms - boundary_sec * 1000 > 60000)::int AS late,
           min(signers)::int AS min_signers
    FROM print_archive WHERE boundary_sec >= ${fromSec}
    GROUP BY source, feed ORDER BY source, feed`;
  return rows.map((r) => ({
    source: r.source,
    feed: r.feed,
    boundaries: r.n,
    firstSec: Number(r.first),
    lastSec: Number(r.last),
    maxLagMs: Number(r.max_lag),
    lateCount: r.late,
    minSigners: r.min_signers,
  }));
}
