import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiagnosticRunner } from "./diagnostic-runner";

afterEach(() => vi.useRealTimers());

describe("bounded status diagnostics", () => {
  it("shares concurrent reads but does not cache a completed healthy result", async () => {
    const diagnose = createDiagnosticRunner();
    let resolve!: (value: number) => void;
    const read = vi.fn(() => new Promise<number>((done) => { resolve = done; }));
    const first = diagnose("indexer", ({ step }) => step("venue discovery", read));
    const second = diagnose("indexer", ({ step }) => step("venue discovery", read));
    await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(1);
    resolve(4);
    expect((await first).value).toBe(4);
    expect((await second).value).toBe(4);
    expect((await diagnose("indexer", ({ step }) => step("venue discovery", async () => 5))).value).toBe(5);
  });

  it("keeps an outstanding timed-out read deduplicated and names its stage", async () => {
    vi.useFakeTimers();
    const diagnose = createDiagnosticRunner(100);
    let finish!: () => void;
    const read = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const first = diagnose("indexer", ({ step }) => step("venue discovery", read));
    const rejected = expect(first).rejects.toMatchObject({ stage: "venue discovery", elapsedMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    await expect(diagnose("indexer", ({ step }) => step("venue discovery", read))).rejects.toThrow("still awaiting");
    expect(read).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(1);
    expect((await diagnose("indexer", ({ step }) => step("live Windows", async () => 1))).value).toBe(1);
  });

  it("shares one budget across stages and never launches another after timeout", async () => {
    vi.useFakeTimers();
    const diagnose = createDiagnosticRunner(100);
    let finish!: () => void;
    const next = vi.fn(async () => 1);
    const result = diagnose("indexer", async ({ step }) => {
      await step("venue discovery", () => new Promise<void>((resolve) => { finish = resolve; }));
      return step("live Windows and opening prices", next);
    });
    const rejected = expect(result).rejects.toThrow("venue discovery: timed out");
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    finish();
    await vi.advanceTimersByTimeAsync(1);
    expect(next).not.toHaveBeenCalled();
  });
});
