import { describe, expect, it, vi } from "vitest";
import { createXExecutionJournal } from "./execution-journal";

const actor = `0x${"11".repeat(20)}` as const;
describe("durable X journal association", () => {
  it("records the mention before send and persists its hash through later bookkeeping states", async () => {
    const write = vi.fn(async () => {});
    const execution = createXExecutionJournal(write);
    const record = await execution.forMention("123", () => execution.journal.record({ kind: "order", wallet: actor, summary: "fixture" }));
    expect(record.id).toBe("123");
    expect(write.mock.calls[0]).toEqual(["123", expect.objectContaining({ journalState: "recorded", executionActor: actor })]);
    const hash = `0x${"ab".repeat(32)}` as const;
    await execution.journal.markSent(record.id, hash);
    await execution.journal.markUnknown(record.id);
    expect(write.mock.calls[1]).toEqual(["123", { journalState: "sent" }, hash]);
    expect(write.mock.calls[2]).toEqual(["123", { journalState: "unknown" }]);
  });

  it("refuses an unassociated order and propagates storage failure before broadcast", async () => {
    const write = vi.fn(async () => { throw new Error("store unavailable"); });
    const execution = createXExecutionJournal(write);
    const entry = { kind: "order" as const, wallet: actor, summary: "fixture" };
    await expect(execution.journal.record(entry)).rejects.toThrow("no durable mention scope");
    expect(write).not.toHaveBeenCalled();
    await expect(execution.forMention("123", () => execution.journal.record(entry))).rejects.toThrow("store unavailable");
  });
});
