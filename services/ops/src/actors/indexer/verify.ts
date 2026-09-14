/**
 * `verify-index` (venue-ops.md §9): an independent chain walk (every program signature back to the deploy slot, each
 * transaction fetched and decoded afresh, nothing read from the database) compared with what the index holds at or
 * below the same head slot. Fills, Windows opened and resolved, events per name, transactions and failed ones.
 */
import { getDb, indexReader } from "@agari/db";
import { AGARI_EVENTS_PROGRAM_ID, createIndexerRpc, decodeTransactionEvents, eventAuthorityOf, walkSignatures } from "@agari/markets/ops/indexer";

export interface VerifyInput {
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  startSlot: number;
  rps?: number;
  log?: (line: string) => void;
}

export interface VerifyReport {
  ok: boolean;
  headSlot: number | null;
  chain: Record<string, number>;
  index: Record<string, number>;
  mismatches: string[];
  /** `behindSlots` works on any cluster; the block-time figures only where block times are real (devnet, not Surfpool). */
  lag: { behindSlots: number | null; chainLastBlockTimeSec: number | null; indexLastBlockTimeSec: number | null; behindSec: number | null; ageSec: number | null };
}

export async function verifyIndex(input: VerifyInput): Promise<VerifyReport> {
  const log = input.log ?? (() => undefined);
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  const rpc = await createIndexerRpc({ rpcUrl: input.rpcUrl, rpcSubscriptionsUrl: input.rpcSubscriptionsUrl, rps: input.rps ?? 3 });
  const authority = await eventAuthorityOf();
  const sigs = await walkSignatures(rpc, AGARI_EVENTS_PROGRAM_ID, { stopBelowSlot: input.startSlot });
  const headSlot = sigs[0]?.slot ?? null;
  log(`chain walk: ${sigs.length} signatures since slot ${input.startSlot}, head slot ${headSlot ?? "-"}; decoding…`);

  const byName: Record<string, number> = {};
  let fills = 0;
  let failed = 0;
  let unavailable = 0;
  for (const [i, info] of sigs.entries()) {
    if (info.failed) {
      failed += 1;
      continue;
    }
    const raw = await rpc.transaction(info.signature);
    if (!raw) {
      unavailable += 1;
      continue;
    }
    for (const e of decodeTransactionEvents(raw, AGARI_EVENTS_PROGRAM_ID, authority).events) {
      byName[e.name] = (byName[e.name] ?? 0) + 1;
      if (e.name === "OrderExecuted" && Array.isArray(e.data.fills)) fills += e.data.fills.length;
    }
    if ((i + 1) % 50 === 0) log(`  decoded ${i + 1}/${sigs.length}`);
  }
  const chain: Record<string, number> = {
    txs: sigs.length,
    failedTxs: failed,
    unavailableTxs: unavailable,
    fills,
    windowsOpened: byName.WindowOpened ?? 0,
    windowsResolved: byName.WindowResolved ?? 0,
    ...Object.fromEntries(Object.entries(byName).map(([k, v]) => [`event:${k}`, v])),
  };

  const reader = indexReader(db);
  const counts = headSlot === null ? null : await reader.countsThrough(headSlot);
  const indexByName = (counts?.by_name ?? {}) as Record<string, number>;
  const index: Record<string, number> = {
    txs: Number(counts?.txs ?? 0),
    failedTxs: Number(counts?.failed_txs ?? 0),
    fills: Number(counts?.fills ?? 0),
    windowsOpened: Number(counts?.windows_opened ?? 0),
    windowsResolved: Number(counts?.windows_resolved ?? 0),
    marketsWithGaps: Number(counts?.markets_with_gaps ?? 0),
    duplicateEvents: Number(counts?.duplicate_events ?? 0),
    ...Object.fromEntries(Object.entries(indexByName).map(([k, v]) => [`event:${k}`, v])),
  };

  const mismatches: string[] = [];
  const keys = new Set([...Object.keys(chain), ...Object.keys(index)].filter((k) => !["unavailableTxs", "marketsWithGaps", "duplicateEvents"].includes(k)));
  for (const key of keys) if ((chain[key] ?? 0) !== (index[key] ?? 0)) mismatches.push(`${key}: chain ${chain[key] ?? 0} ≠ index ${index[key] ?? 0}`);
  if (unavailable > 0) mismatches.push(`${unavailable} transaction(s) unavailable from the RPC during the walk`);
  if (index.marketsWithGaps) mismatches.push(`${index.marketsWithGaps} Market(s) with seq gaps`);
  if (index.duplicateEvents) mismatches.push(`${index.duplicateEvents} duplicate event key(s)`);

  const chainLast = sigs[0]?.blockTimeSec ?? null;
  const indexLast = counts?.last_block_time_sec ? Number(counts.last_block_time_sec) : null;
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    ok: mismatches.length === 0,
    headSlot,
    chain,
    index,
    mismatches,
    lag: {
      behindSlots: headSlot !== null && counts?.last_slot ? headSlot - Number(counts.last_slot) : null,
      chainLastBlockTimeSec: chainLast,
      indexLastBlockTimeSec: indexLast,
      behindSec: chainLast !== null && indexLast !== null ? chainLast - indexLast : null,
      ageSec: indexLast !== null ? nowSec - indexLast : null,
    },
  };
}

/** Ends the database pool `verifyIndex` used, so a CLI can exit. */
export async function closeVerifyDb(): Promise<void> {
  await getDb()?.end();
}
