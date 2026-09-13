import { afterEach, describe, expect, it, vi } from "vitest";
import type { XReceipt } from "@masayume/core/x";
import { deliverReplies, startReplyDelivery, type ReplyDeliveryContext } from "./reply-delivery";

const receipt: XReceipt = {
  mentionId: "123", authorId: "456", handle: "caller", wallet: null, grantId: null,
  marketId: null, side: "up", stakeBase: "5000000", bookedCostBase: "3000000",
  status: "filled", reason: null, txHash: `0x${"a".repeat(64)}`, instruction: "BTC UP 5 5m", atMs: 1,
};

function fixture() {
  const state = { value: "pending", order: [] as string[] };
  const job = { mentionId: "123", lease: "lease-one" };
  const ctx: ReplyDeliveryContext = {
    decimals: 6, symbol: "tUSDC", imagesEnabled: true, log: vi.fn(),
    render: vi.fn(async () => new Uint8Array([1, 2, 3])),
    transport: {
      describe: () => "test", fetchMentions: vi.fn(async () => []),
      authenticatedAuthorId: vi.fn(async () => "999"),
      uploadImage: vi.fn(async () => { state.order.push("upload"); return "789"; }),
      reply: vi.fn(async () => { state.order.push("post"); return "999"; }),
    },
    store: {
      markInterrupted: vi.fn(async () => 0),
      acquire: vi.fn(async () => {
        if (state.value !== "pending") return null;
        state.value = "preparing";
        return job;
      }),
      receipt: vi.fn(async () => receipt),
      beginPost: vi.fn(async () => { state.order.push("persist-post"); state.value = "posting"; return true; }),
      sent: vi.fn(async () => { state.value = "sent"; }),
      stop: vi.fn(async (_job, value) => { state.value = value; }),
    },
  };
  return { ctx, state, job };
}

describe("reply delivery without financial execution", () => {
  afterEach(() => vi.useRealTimers());
  it("persists the prepared payload before one image reply, including after another cycle", async () => {
    const { ctx, state, job } = fixture();
    await deliverReplies(ctx);
    await deliverReplies(ctx);
    expect(state.order).toEqual(["upload", "persist-post", "post"]);
    expect(ctx.store.beginPost).toHaveBeenCalledWith(job, expect.stringContaining("Spent 3 tUSDC"), "789");
    expect(ctx.transport.reply).toHaveBeenCalledWith("123", expect.stringContaining("/tx/0x"), "789");
    expect(ctx.store.sent).toHaveBeenCalledWith(job, "999");
    expect(ctx.transport.reply).toHaveBeenCalledTimes(1);
  });

  it.each(["render", "upload", "bad-media-id"])("falls back before posting if %s fails", async (failure) => {
    const { ctx, state } = fixture();
    if (failure === "render") ctx.render = vi.fn(async () => { throw new Error("bad image"); });
    if (failure === "upload") ctx.transport.uploadImage = vi.fn(async () => { throw new Error("upload timeout"); });
    if (failure === "bad-media-id") ctx.transport.uploadImage = vi.fn(async () => "");
    await deliverReplies(ctx);
    expect(state.value).toBe("sent");
    expect(ctx.transport.reply).toHaveBeenCalledTimes(1);
    expect(ctx.transport.reply).toHaveBeenCalledWith("123", expect.stringContaining("Spent 3 tUSDC"), undefined);
  });

  it.each(["timeout", "missing-id", "ack-storage"])("never reposts after ambiguous %s", async (failure) => {
    const { ctx, state, job } = fixture();
    if (failure === "timeout") ctx.transport.reply = vi.fn(async () => { throw new Error("response lost"); });
    if (failure === "missing-id") ctx.transport.reply = vi.fn(async () => null);
    if (failure === "ack-storage") ctx.store.sent = vi.fn(async () => { throw new Error("db unavailable"); });
    await deliverReplies(ctx);
    await deliverReplies(ctx);
    expect(state.value).toBe("unknown");
    expect(ctx.transport.reply).toHaveBeenCalledTimes(1);
    expect(ctx.store.stop).toHaveBeenCalledWith(job, "unknown", "post-not-acknowledged");
  });

  it("does not let an expired preparation lease post", async () => {
    const { ctx } = fixture();
    ctx.store.beginPost = vi.fn(async () => false);
    await deliverReplies(ctx);
    expect(ctx.transport.reply).not.toHaveBeenCalled();
  });

  it("does not post an initial instruction placeholder", async () => {
    const { ctx, state } = fixture();
    ctx.store.receipt = vi.fn(async (): Promise<XReceipt> => ({ ...receipt, status: "submitted" }));
    await deliverReplies(ctx);
    expect(state.value).toBe("failed");
    expect(ctx.transport.reply).not.toHaveBeenCalled();
  });

  it("supports text-only operation without rendering or uploading", async () => {
    const { ctx } = fixture();
    ctx.imagesEnabled = false;
    await deliverReplies(ctx);
    expect(ctx.render).not.toHaveBeenCalled();
    expect(ctx.transport.uploadImage).not.toHaveBeenCalled();
    expect(ctx.transport.reply).toHaveBeenCalledOnce();
  });

  it("does not claim delivery work when posting is disabled", async () => {
    const { ctx } = fixture();
    ctx.transport.reply = null;
    await deliverReplies(ctx);
    expect(ctx.store.acquire).not.toHaveBeenCalled();
    expect(ctx.store.markInterrupted).not.toHaveBeenCalled();
  });

  it("falls back to text after an upload hangs beyond the outer deadline", async () => {
    vi.useFakeTimers();
    const { ctx, state } = fixture();
    ctx.transport.uploadImage = vi.fn(() => new Promise<string>(() => {}));
    const delivery = deliverReplies(ctx);
    await vi.advanceTimersByTimeAsync(45_000);
    await delivery;
    expect(state.value).toBe("sent");
    expect(ctx.transport.reply).toHaveBeenCalledWith("123", expect.any(String), undefined);
  });

  it("does not repost when a hung POST acknowledges after the outer deadline", async () => {
    vi.useFakeTimers();
    const { ctx, state } = fixture();
    let acknowledge!: (id: string) => void;
    ctx.transport.reply = vi.fn(() => new Promise<string>(resolve => { acknowledge = resolve; }));
    const delivery = deliverReplies(ctx);
    await vi.advanceTimersByTimeAsync(45_000);
    await delivery;
    expect(state.value).toBe("unknown");
    acknowledge("999");
    await deliverReplies(ctx);
    expect(ctx.transport.reply).toHaveBeenCalledOnce();
    expect(ctx.store.sent).not.toHaveBeenCalled();
  });

  it("starts without awaiting a hung upload and never overlaps delivery cycles", async () => {
    vi.useFakeTimers();
    const { ctx } = fixture();
    ctx.transport.uploadImage = vi.fn(() => new Promise<string>(() => {}));
    const stop = startReplyDelivery(ctx, 1_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ctx.store.acquire).toHaveBeenCalledOnce();
    stop();
    await vi.advanceTimersByTimeAsync(45_000);
  });

  it("contains store errors and permits a later independent delivery cycle", async () => {
    vi.useFakeTimers();
    const { ctx } = fixture();
    vi.mocked(ctx.store.markInterrupted).mockRejectedValueOnce(new Error("db offline"));
    const stop = startReplyDelivery(ctx, 1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    stop();
    expect(ctx.transport.reply).toHaveBeenCalledOnce();
    expect(ctx.log).toHaveBeenCalledWith(expect.stringContaining("reply delivery unavailable"));
  });
});
