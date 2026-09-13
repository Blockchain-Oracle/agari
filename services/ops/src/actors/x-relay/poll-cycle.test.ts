import type { XReceipt } from "@masayume/core/x";
import { describe, expect, it, vi } from "vitest";
import { pollMentionCycle, type MentionCycleContext } from "./poll-cycle";

function fixture() {
  const receipts = new Map<string, XReceipt>();
  const order: string[] = [];
  const ctx: MentionCycleContext = {
    getCursor: vi.fn(async () => "0"), setCursor: vi.fn(async id => { order.push(`cursor:${id}`); }),
    fetch: vi.fn(async () => [{ id: "1", authorId: "2", handle: "caller", text: "BTC UP 5 5m", createdAtMs: 1 }]),
    isRelayReply: vi.fn(async () => false),
    claim: vi.fn(async r => { if (receipts.has(r.mentionId)) return false; receipts.set(r.mentionId, r); return true; }),
    execute: vi.fn(async m => ({ ...receipts.get(m.id)!, status: "refused" as const })),
    receipt: vi.fn(async id => receipts.get(id) ?? null),
    save: vi.fn(async r => { receipts.set(r.mentionId, r); order.push(`save:${r.mentionId}`); }),
  };
  return { ctx, receipts, order };
}

describe("mention execution ownership and cursor", () => {
  it("skips relay receipts before claim and nonce checks, advancing only the cursor", async () => {
    const { ctx, receipts } = fixture();
    ctx.isRelayReply = vi.fn(async () => true);
    ctx.canExecute = vi.fn(async () => false);
    expect(await pollMentionCycle(ctx)).toBe(0);
    expect(ctx.setCursor).toHaveBeenCalledWith("1");
    expect(ctx.claim).not.toHaveBeenCalled(); expect(ctx.execute).not.toHaveBeenCalled();
    expect(ctx.canExecute).not.toHaveBeenCalled(); expect(ctx.save).not.toHaveBeenCalled();
    expect(receipts.size).toBe(0);
  });
  it("retains cursor and does not claim when the durable reply lookup fails", async () => {
    const { ctx } = fixture();
    ctx.isRelayReply = async () => { throw new Error("DB offline"); };
    await expect(pollMentionCycle(ctx)).rejects.toThrow("DB offline");
    expect(ctx.setCursor).not.toHaveBeenCalled(); expect(ctx.claim).not.toHaveBeenCalled();
  });
  it("continues past bot replies to own top-level commands and other users' reply commands", async () => {
    const { ctx } = fixture();
    const base = (await ctx.fetch("0"))[0]!;
    ctx.fetch = async () => [
      { ...base, id: "1", authorId: "99", replyTo: "10" },
      { ...base, id: "2", authorId: "99" },
      { ...base, id: "3", authorId: "55", replyTo: "10" },
    ];
    ctx.isRelayReply = async m => m.authorId === "99" && Boolean(m.replyTo);
    expect(await pollMentionCycle(ctx)).toBe(2);
    expect(vi.mocked(ctx.claim).mock.calls.map(([r]) => r.mentionId)).toEqual(["2", "3"]);
    expect(vi.mocked(ctx.setCursor).mock.calls).toEqual([["1"], ["2"], ["3"]]);
  });
  it("baselines first startup without claiming or executing historical mentions", async () => {
    const { ctx } = fixture(); ctx.getCursor = async () => null;
    await pollMentionCycle(ctx);
    expect(ctx.setCursor).toHaveBeenCalledWith("1");
    expect(ctx.claim).not.toHaveBeenCalled(); expect(ctx.execute).not.toHaveBeenCalled();
  });
  it("stores final state before advancing and never executes an existing claim twice", async () => {
    const { ctx, order } = fixture();
    await pollMentionCycle(ctx); await pollMentionCycle(ctx);
    expect(order).toEqual(["save:1", "cursor:1", "cursor:1"]);
    expect(ctx.execute).toHaveBeenCalledOnce();
  });
  it("preserves a durable wallet and broadcast hash when execution throws", async () => {
    const { ctx, receipts, order } = fixture();
    ctx.execute = async m => {
      receipts.set(m.id, { ...receipts.get(m.id)!, wallet: "0xwallet", txHash: `0x${"ab".repeat(32)}` });
      throw new Error("process-side receipt failure");
    };
    await pollMentionCycle(ctx);
    expect(receipts.get("1")).toMatchObject({ status: "unknown", wallet: "0xwallet", txHash: `0x${"ab".repeat(32)}` });
    expect(order).toEqual(["save:1", "cursor:1"]);
  });
  it("retains cursor on storage failure and never replays the claimed order on the next cycle", async () => {
    const { ctx } = fixture(); ctx.save = vi.fn(async () => { throw new Error("DB offline"); });
    await expect(pollMentionCycle(ctx)).rejects.toThrow("DB offline");
    expect(ctx.setCursor).not.toHaveBeenCalled();
    await pollMentionCycle(ctx);
    expect(ctx.execute).toHaveBeenCalledOnce();
  });
  it("does not claim any partial drain and stops nonce reuse between mentions", async () => {
    const { ctx } = fixture(); ctx.fetch = vi.fn(async () => { throw new Error("page failed"); });
    await expect(pollMentionCycle(ctx)).rejects.toThrow("page failed");
    expect(ctx.claim).not.toHaveBeenCalled(); expect(ctx.setCursor).not.toHaveBeenCalled();
    const f = fixture(); const one = (await f.ctx.fetch("0"))[0]!;
    f.ctx.fetch = async () => [one, { ...one, id: "2" }];
    f.ctx.canExecute = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect(await pollMentionCycle(f.ctx)).toBe(1);
    expect(f.ctx.setCursor).toHaveBeenCalledOnce(); expect(f.ctx.execute).toHaveBeenCalledOnce();
  });
});
