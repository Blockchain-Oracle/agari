import type { IntentRecord } from "@masayume/core/ports";
import type { Address } from "@masayume/core/types";
import { describe, expect, it } from "vitest";
import { createJournal } from "./journal";
import { createMemoryStore } from "./journal-memory";
import type { ReconcileVerdict } from "./reconcile";
import { RECOVERY_REASON, recoverUnresolved, UNVERIFIABLE_AFTER_MS } from "./recovery";

const WALLET = "0x1111111111111111111111111111111111111111" as Address;
const NOW = 1_700_000_000_000;

async function journalWith(entries: Array<{ summary: string; state: "recorded" | "unknown"; ageMs?: number }>) {
  let clock = NOW;
  const store = createMemoryStore();
  const journal = createJournal(store, () => clock);
  for (const entry of entries) {
    clock = NOW - (entry.ageMs ?? 0);
    const record = await journal.record({ kind: "order", wallet: WALLET, summary: entry.summary });
    if (entry.state === "unknown") await journal.markUnknown(record.id);
  }
  return { journal, store };
}

const bySummary = (verdicts: Record<string, ReconcileVerdict>) => async (_wallet: Address, record: IntentRecord) => {
  const verdict = verdicts[record.summary];
  if (!verdict) throw new Error(`no chain answer for ${record.summary}`);
  return verdict;
};

describe("recoverUnresolved", () => {
  it("moves each record only by the chain's answer, and fails the ones nobody can answer any more", async () => {
    const { journal, store } = await journalWith([
      { summary: "landed", state: "unknown" },
      { summary: "reverted", state: "unknown" },
      { summary: "absent", state: "recorded" },
      { summary: "fresh", state: "unknown" },
      { summary: "stale", state: "unknown", ageMs: UNVERIFIABLE_AFTER_MS + 1 },
      { summary: "throws", state: "unknown" },
    ]);
    const results = await recoverUnresolved(journal, WALLET, bySummary({ landed: "confirmed", reverted: "reverted", absent: "absent", fresh: "unknown", stale: "unknown" }), NOW);

    const outcomes = Object.fromEntries(results.map((r) => [r.record.summary, r.outcome]));
    expect(outcomes).toEqual({ landed: "landed", reverted: "reverted", absent: "absent", fresh: "pending", stale: "expired", throws: "error" });

    const states = Object.fromEntries(store.load().map((r) => [r.summary, [r.state, r.failureReason]]));
    expect(states.landed).toEqual(["confirmed", undefined]);
    expect(states.reverted).toEqual(["failed", RECOVERY_REASON.reverted]);
    expect(states.absent).toEqual(["failed", RECOVERY_REASON.absent]);
    expect(states.fresh).toEqual(["unknown", undefined]);
    expect(states.stale).toEqual(["failed", RECOVERY_REASON.expired]);
    expect(states.throws).toEqual(["unknown", undefined]);
  });
});
