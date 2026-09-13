import type { XReceipt } from "@masayume/core/x";
import type { Mention } from "./transport";

export interface MentionCycleContext {
  getCursor(): Promise<string | null>;
  setCursor(id: string): Promise<void>;
  fetch(sinceId: string | null): Promise<Mention[]>;
  /** Includes durable acknowledgement lookup; lookup failure must stop cursor advancement. */
  isRelayReply(mention: Mention): Promise<boolean>;
  claim(receipt: XReceipt): Promise<boolean>;
  execute(mention: Mention): Promise<XReceipt>;
  receipt(id: string): Promise<XReceipt | null>;
  save(receipt: XReceipt): Promise<void>;
  canExecute?: () => Promise<boolean>;
}

/** Commands need durable receipts before cursor advance; the relay's own replies are not commands. */
export async function pollMentionCycle(ctx: MentionCycleContext): Promise<number> {
  const since = await ctx.getCursor();
  const mentions = await ctx.fetch(since);
  if (since === null) {
    await ctx.setCursor(mentions.at(-1)?.id ?? "0");
    return 0;
  }
  let processed = 0;
  for (const mention of mentions) {
    if (await ctx.isRelayReply(mention)) {
      await ctx.setCursor(mention.id);
      continue;
    }
    // Re-check between mentions too: the preceding order may have lost its broadcast response.
    if (ctx.canExecute && !await ctx.canExecute()) return processed;
    const initial: XReceipt = { mentionId: mention.id, authorId: mention.authorId, handle: mention.handle,
      wallet: null, grantId: null, marketId: null, side: null, stakeBase: null, status: "submitted",
      reason: null, txHash: null, instruction: mention.text, atMs: mention.createdAtMs };
    if (await ctx.claim(initial)) {
      let final: XReceipt;
      try { final = await ctx.execute(mention); }
      catch {
        const persisted = await ctx.receipt(mention.id);
        if (!persisted) throw new Error("Claimed X receipt could not be read");
        final = { ...persisted, status: "unknown", reason: "Execution needs checking before another instruction." };
      }
      await ctx.save(final);
      processed++;
    }
    await ctx.setCursor(mention.id);
  }
  return processed;
}
