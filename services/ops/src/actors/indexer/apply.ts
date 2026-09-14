/**
 * Writes and gap handling (plan §4 indexer step 5): every write reports the Markets it touched, a `(market, seq)` hole
 * is noted, and a hole still open after a grace period triggers a per-Market signature backfill.
 */
import type { IdxCommitment, IdxCursor, IdxTransaction, WriteResult } from "@agari/db";
import { walkSignatures } from "@agari/markets/ops/indexer";
import { errorText } from "../../runtime";
import { fetchTransaction, type IndexerContext } from "./decode";

/** Live transactions can land out of order for a moment; only a hole older than this is backfilled. */
const GAP_GRACE_MS = 15_000;

export async function applyTransaction(ctx: IndexerContext, tx: IdxTransaction, options: { commitment: IdxCommitment; cursor?: IdxCursor }): Promise<WriteResult> {
  const result = await ctx.writer.writeTransaction(tx, options);
  if (!result.inserted) return result;
  ctx.stats.txs += 1;
  ctx.stats.events += tx.events.length;
  ctx.stats.rebuilt += result.rebuilt.length;
  if (result.rebuilt.length > 0) ctx.log(`rebuilt ${result.rebuilt.length} Market(s) after an out-of-order event: ${result.rebuilt.join(" ")}`);
  const now = Date.now();
  for (const gap of await ctx.writer.gaps(result.markets)) if (!ctx.gaps.has(gap.market)) ctx.gaps.set(gap.market, now);
  return result;
}

/** Backfills every Market whose hole outlived the grace period from that Market's own signatures. */
export async function fillGaps(ctx: IndexerContext, finalizedSlot: number): Promise<number> {
  const due = [...ctx.gaps].filter(([, firstSeenMs]) => Date.now() - firstSeenMs >= GAP_GRACE_MS).map(([market]) => market);
  if (due.length === 0) return 0;
  const open = new Map((await ctx.writer.gaps(due)).map((g) => [g.market, g]));
  let fetched = 0;
  for (const market of due) {
    const gap = open.get(market);
    if (!gap) {
      ctx.gaps.delete(market);
      continue;
    }
    try {
      const sigs = (await walkSignatures(ctx.rpc, market)).reverse();
      const known = await ctx.writer.known(sigs.map((s) => s.signature));
      for (const info of sigs) {
        if (known.has(info.signature)) continue;
        const tx = await fetchTransaction(ctx, info);
        if (!tx) continue;
        await applyTransaction(ctx, tx, { commitment: info.slot <= finalizedSlot ? "finalized" : "confirmed" });
        fetched += 1;
      }
      const still = await ctx.writer.gaps([market]);
      if (still.length === 0) {
        ctx.gaps.delete(market);
        ctx.stats.gapsFilled += 1;
        ctx.log(`gap filled on ${market}: seq ${gap.have}/${gap.maxSeq} → complete (${fetched} transaction(s) fetched)`);
      } else {
        ctx.gaps.set(market, Date.now());
        ctx.log(`gap persists on ${market}: ${still[0]!.have} of ${still[0]!.maxSeq} seqs after a Market backfill`);
      }
    } catch (error) {
      ctx.log(`gap backfill failed on ${market}: ${errorText(error)}`);
    }
  }
  return fetched;
}
