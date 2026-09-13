import { describe, expect, it } from "vitest";
import { createNonceQueue } from "./nonce-queue";

/**
 * The queue is what keeps one account from racing itself on the nonce, so its two
 * non-obvious properties are worth pinning: sends never overlap, and a failed send does not
 * wedge every send behind it.
 */
describe("nonce queue", () => {
  it("runs one task at a time even when they resolve out of order", async () => {
    const enqueue = createNonceQueue();
    const events: string[] = [];

    const slow = enqueue(async () => {
      events.push("a:start");
      await new Promise((r) => setTimeout(r, 20));
      events.push("a:end");
    });
    const fast = enqueue(async () => {
      events.push("b:start");
      events.push("b:end");
    });

    await Promise.all([slow, fast]);
    expect(events).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });

  it("keeps draining after a task rejects, and still rejects that task's caller", async () => {
    const enqueue = createNonceQueue();

    const failed = enqueue(async () => {
      throw new Error("reverted");
    });
    const after = enqueue(async () => "landed");

    await expect(failed).rejects.toThrow("reverted");
    await expect(after).resolves.toBe("landed");
  });
});
