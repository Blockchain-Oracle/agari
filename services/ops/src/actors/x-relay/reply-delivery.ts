import type { XReceipt } from "@masayume/core/x";
import type { XReplyJob } from "@masayume/db";
import { createReplyPresentation, replyText, type ReplyPresentation } from "./reply-format";
import type { XTransport } from "./transport";

const OPERATION_DEADLINE_MS = 45_000;

/** A timeout cannot cancel a remote POST. The caller must treat it as ambiguous. */
async function withDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Reply operation timed out")), OPERATION_DEADLINE_MS); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export interface ReplyDeliveryStore {
  acquire(): Promise<XReplyJob | null>;
  receipt(mentionId: string): Promise<XReceipt | null>;
  beginPost(job: XReplyJob, text: string, mediaId: string | null): Promise<boolean>;
  sent(job: XReplyJob, replyId: string): Promise<void>;
  stop(job: XReplyJob, state: "unknown" | "failed", code: string): Promise<void>;
  markInterrupted(): Promise<number>;
}

export interface ReplyDeliveryContext {
  store: ReplyDeliveryStore;
  transport: XTransport;
  decimals: number;
  symbol: string;
  imagesEnabled: boolean;
  render: (presentation: ReplyPresentation) => Promise<Uint8Array>;
  log: (message: string) => void;
  health?: (state: "ok" | "idle" | "error" | "disabled") => Promise<void>;
}

/** Drain only completed receipts. There is deliberately no submitter or signer in this module. */
export async function deliverReplies(ctx: ReplyDeliveryContext, limit = 5): Promise<void> {
  if (!ctx.transport.reply) { await ctx.health?.("disabled"); return; }
  const interrupted = await ctx.store.markInterrupted();
  if (interrupted) ctx.log(`${interrupted} interrupted reply(s) need inspection; no automatic repost`);
  for (let i = 0; i < limit; i++) {
    const job = await ctx.store.acquire();
    if (!job) { await ctx.health?.("idle"); return; }
    let startedPost = false;
    try {
      const receipt = await ctx.store.receipt(job.mentionId);
      if (!receipt || receipt.status === "submitted") {
        await ctx.store.stop(job, "failed", "receipt-not-ready");
        continue;
      }
      const presentation = createReplyPresentation(receipt, ctx.decimals, ctx.symbol);
      const text = replyText(receipt, ctx.decimals, ctx.symbol);
      let mediaId: string | null = null;
      if (ctx.imagesEnabled && ctx.transport.uploadImage) {
        try {
          const png = await withDeadline(ctx.render(presentation));
          mediaId = await withDeadline(ctx.transport.uploadImage(png));
          if (!/^\d+$/.test(mediaId)) throw new Error("Invalid media id");
        } catch {
          mediaId = null;
          ctx.log(`reply ${job.mentionId}: image unavailable; using the same receipt as text`);
        }
      }
      // The database gate happens after media preparation. A stale render worker cannot post.
      if (!await ctx.store.beginPost(job, text, mediaId)) continue;
      startedPost = true;
      const replyId = await withDeadline(ctx.transport.reply(job.mentionId, text, mediaId ?? undefined));
      if (!replyId || !/^\d+$/.test(replyId)) throw new Error("X did not acknowledge the reply id");
      await ctx.store.sent(job, replyId);
      await ctx.health?.("ok");
      ctx.log(`reply ${job.mentionId}: published ${replyId}${mediaId ? " with image" : " as text"}`);
    } catch {
      // Even an acknowledgement-storage error is ambiguous: the public reply may already exist.
      await ctx.store.stop(job, startedPost ? "unknown" : "failed", startedPost ? "post-not-acknowledged" : "preparation-failed");
      await ctx.health?.("error");
      ctx.log(`reply ${job.mentionId}: ${startedPost ? "delivery needs inspection; no automatic repost" : "preparation failed"}`);
    }
  }
}

/** Independent of the financial poll: slow media and delivery errors cannot hold its busy gate. */
export function startReplyDelivery(ctx: ReplyDeliveryContext, intervalMs = 15_000): () => void {
  let busy = false;
  const cycle = async () => {
    if (busy) return;
    busy = true;
    try {
      await deliverReplies(ctx);
    } catch {
      ctx.log("reply delivery unavailable; the next delivery cycle will inspect persisted state");
      await ctx.health?.("error").catch(() => undefined);
    } finally {
      busy = false;
    }
  };
  void cycle();
  const timer = setInterval(() => void cycle(), intervalMs);
  return () => clearInterval(timer);
}
