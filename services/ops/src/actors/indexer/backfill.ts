/**
 * The cursor walk (plan §4 indexer steps 1, 6–9): every program signature newer than the cursor, applied oldest first.
 * Transactions at or below the finalized slot land (or are promoted) `finalized`, and the cursor advances with them in
 * the same DB transaction. A confirmed row that a complete walk no longer lists at a finalized slot was dropped: it is
 * deleted and its Markets rebuilt. With no cursor, the walk reads back to the deploy slot (full rebuild after truncate).
 */
import type { IdxCursor } from "@agari/db";
import { walkSignatures, type SignatureInfo } from "@agari/markets/ops/indexer";
import { applyTransaction, fillGaps } from "./apply";
import { fetchTransaction, type IndexerContext } from "./decode";

export interface BackfillResult {
  walked: number;
  fetched: number;
  promoted: number;
  dropped: number;
  gapFetched: number;
  finalizedSlot: number;
  cursorSlot: number | null;
  /** False when a transaction wasn't available yet, so the walk stopped before the head. */
  complete: boolean;
}

async function backfillPass(ctx: IndexerContext): Promise<BackfillResult> {
  const finalizedSlot = await ctx.rpc.finalizedSlot();
  const before = await ctx.writer.cursor(ctx.programId);
  const sigs: SignatureInfo[] = (
    await walkSignatures(ctx.rpc, ctx.programId, before ? { until: before.signature } : { stopBelowSlot: ctx.startSlot })
  ).reverse();
  const known = await ctx.writer.known(sigs.map((s) => s.signature));
  let fetched = 0;
  let promoted = 0;
  let complete = true;
  let cursor: IdxCursor | null = null;
  let promote: string[] = [];

  const flush = async () => {
    if (promote.length === 0 && !cursor) return;
    await ctx.writer.promote(promote, cursor);
    promoted += promote.length;
    promote = [];
  };

  for (const info of sigs) {
    const final = info.slot <= finalizedSlot;
    const nextCursor = final ? { program: ctx.programId, slot: info.slot, signature: info.signature } : undefined;
    const have = known.get(info.signature);
    if (have) {
      if (final && have === "confirmed") promote.push(info.signature);
      if (nextCursor) cursor = nextCursor;
      continue;
    }
    const tx = await fetchTransaction(ctx, info);
    if (!tx) {
      complete = false;
      break;
    }
    await flush();
    await applyTransaction(ctx, tx, { commitment: final ? "finalized" : "confirmed", ...(nextCursor ? { cursor: nextCursor } : {}) });
    cursor = null;
    fetched += 1;
  }
  await flush();

  let dropped = 0;
  if (complete) {
    const walked = new Set(sigs.map((s) => s.signature));
    const floor = before ? before.slot : ctx.startSlot - 1;
    const stale = (await ctx.writer.confirmedBetween(floor, finalizedSlot)).filter((r) => !walked.has(r.signature));
    if (stale.length > 0) {
      const statuses = await ctx.rpc.signatureStatuses(stale.map((s) => s.signature));
      const gone = stale.filter((_, i) => statuses[i] === null).map((s) => s.signature);
      const nowFinal = stale.filter((_, i) => statuses[i]?.status === "finalized").map((s) => s.signature);
      if (nowFinal.length > 0) await ctx.writer.promote(nowFinal, null);
      if (gone.length > 0) {
        const markets = await ctx.writer.dropTransactions(gone);
        ctx.stats.dropped += gone.length;
        ctx.log(`dropped ${gone.length} transaction(s) the cluster no longer has; rebuilt ${markets.length} Market(s)`);
      }
      dropped = gone.length;
      promoted += nowFinal.length;
    }
  }
  const gapFetched = await fillGaps(ctx, finalizedSlot);
  const after = await ctx.writer.cursor(ctx.programId);
  return { walked: sigs.length, fetched, promoted, dropped, gapFetched, finalizedSlot, cursorSlot: after?.slot ?? null, complete };
}

const inflight = new WeakMap<IndexerContext, Promise<BackfillResult>>();

/** One walk at a time per indexer: a caller arriving mid-walk shares the running one. */
export function backfillOnce(ctx: IndexerContext): Promise<BackfillResult> {
  const running = inflight.get(ctx);
  if (running) return running;
  const walk = backfillPass(ctx).finally(() => inflight.delete(ctx));
  inflight.set(ctx, walk);
  return walk;
}
