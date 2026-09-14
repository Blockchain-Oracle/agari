/**
 * Fetch and decode (plan §4 indexer steps 2–4): one signature → an `IdxTransaction` the store can write, with the
 * Series of any newly opened Window recorded first so its Market row can carry the ticker and cadence.
 */
import type { IdxTransaction, IndexWriter } from "@agari/db";
import { decodeTransactionEvents, type IndexerRpc } from "@agari/markets/ops/indexer";
import type { Log } from "../../runtime";

export interface IndexerStats {
  txs: number;
  events: number;
  /** Seconds from block time to commit, for the newest live transaction. */
  lastLagSec: number | null;
  maxLagSec: number;
  subscription: "connecting" | "connected" | "reconnecting" | "stopped";
  gapsFilled: number;
  dropped: number;
  rebuilt: number;
}

export interface IndexerContext {
  rpc: IndexerRpc;
  writer: IndexWriter;
  programId: string;
  eventAuthority: string;
  /** Lowest slot a cursor-less walk reads back to (the program's deploy slot). */
  startSlot: number;
  log: Log;
  stats: IndexerStats;
  seriesSeen: Set<string>;
  /** Markets with a `seq` hole → when it was first seen (ms). */
  gaps: Map<string, number>;
}

const NULL_RETRIES = 6;
const NULL_RETRY_MS = 1_500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The transaction for `signature`, decoded. A failed transaction needs no fetch. Returns null when the node still
 * doesn't have it after a few retries (the caller leaves it for the next walk).
 */
export async function fetchTransaction(ctx: IndexerContext, info: { signature: string; slot: number; blockTimeSec: number | null; failed: boolean }): Promise<IdxTransaction | null> {
  if (info.failed) return { signature: info.signature, slot: info.slot, blockTimeSec: info.blockTimeSec, failed: true, events: [] };
  for (let attempt = 0; attempt < NULL_RETRIES; attempt++) {
    const raw = await ctx.rpc.transaction(info.signature);
    if (raw) {
      const decoded = decodeTransactionEvents(raw, ctx.programId, ctx.eventAuthority);
      await ensureSeries(ctx, decoded);
      return decoded;
    }
    await sleep(NULL_RETRY_MS);
  }
  return null;
}

async function ensureSeries(ctx: IndexerContext, tx: IdxTransaction): Promise<void> {
  const wanted = [
    ...new Set(tx.events.filter((e) => e.name === "WindowOpened").map((e) => String(e.data.series)).filter((s) => !ctx.seriesSeen.has(s))),
  ];
  if (wanted.length === 0) return;
  const known = await ctx.writer.knownSeries(wanted);
  const missing = wanted.filter((s) => !known.has(s));
  const infos = (await ctx.rpc.seriesInfo(missing)).filter((s) => s !== null);
  await ctx.writer.upsertSeries(infos);
  for (const s of [...known, ...infos.map((i) => i.series)]) ctx.seriesSeen.add(s);
}
