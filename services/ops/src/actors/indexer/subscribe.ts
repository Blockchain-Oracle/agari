/**
 * The live path (plan §4 indexer steps 1, 8): `logsSubscribe` on the program; each confirmed signature is fetched,
 * decoded and written `confirmed` in arrival order. A dropped socket reconnects after a cursor backfill.
 */
import { errorText } from "../../runtime";
import { applyTransaction } from "./apply";
import { backfillOnce } from "./backfill";
import { fetchTransaction, type IndexerContext } from "./decode";

const RECONNECT_MS = 3_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs until `signal` aborts. Never throws. */
export async function runSubscription(ctx: IndexerContext, signal: AbortSignal): Promise<void> {
  const queue: Array<{ signature: string; failed: boolean; slot: number; seenMs: number }> = [];
  let draining = false;

  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0 && !signal.aborted) {
        const item = queue.shift()!;
        const known = await ctx.writer.known([item.signature]);
        if (known.has(item.signature)) continue;
        const tx = await fetchTransaction(ctx, { signature: item.signature, slot: item.slot, blockTimeSec: null, failed: item.failed });
        if (!tx) {
          ctx.log(`live ${item.signature.slice(0, 12)}…: not available yet; the next walk picks it up`);
          continue;
        }
        const result = await applyTransaction(ctx, tx, { commitment: "confirmed" });
        if (result.inserted && tx.blockTimeSec !== null) {
          const lag = Math.max(0, Date.now() / 1000 - tx.blockTimeSec);
          ctx.stats.lastLagSec = Math.round(lag * 10) / 10;
          ctx.stats.maxLagSec = Math.max(ctx.stats.maxLagSec, ctx.stats.lastLagSec);
        }
      }
    } catch (error) {
      ctx.log(`live apply failed: ${errorText(error)}`);
    } finally {
      draining = false;
    }
  };

  while (!signal.aborted) {
    try {
      ctx.stats.subscription = "connecting";
      const stream = ctx.rpc.subscribeMentions(
        ctx.programId,
        (signature, failed, slot) => {
          queue.push({ signature, failed, slot, seenMs: Date.now() });
          void drain();
        },
        signal,
        () => (ctx.stats.subscription = "connected"),
      );
      await stream;
    } catch (error) {
      if (signal.aborted) break;
      ctx.stats.subscription = "reconnecting";
      ctx.log(`logs subscription dropped: ${errorText(error)}; backfilling from the cursor, then resubscribing`);
    }
    if (signal.aborted) break;
    await sleep(RECONNECT_MS);
    try {
      await backfillOnce(ctx);
    } catch (error) {
      ctx.log(`reconnect backfill failed: ${errorText(error)}`);
    }
  }
  ctx.stats.subscription = "stopped";
}
