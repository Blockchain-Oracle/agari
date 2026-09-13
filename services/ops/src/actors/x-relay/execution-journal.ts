import { AsyncLocalStorage } from "node:async_hooks";
import type { IntentJournal } from "@masayume/core/ports";
import { xRecordExecutionJournal } from "@masayume/db";

/** The shared order lane's journal writes directly onto the already-claimed mention. */
export function createXExecutionJournal(write = xRecordExecutionJournal) {
  const scope = new AsyncLocalStorage<string>();
  const journal: IntentJournal = {
    async record(entry) {
      const mentionId = scope.getStore();
      if (!mentionId || entry.kind !== "order") throw new Error("X order has no durable mention scope");
      const createdAtMs = Date.now();
      await write(mentionId, { executionActor: entry.wallet, intentRecordedAtMs: createdAtMs, journalState: "recorded", poolAddress: entry.pool });
      return { ...entry, id: mentionId, createdAtMs, state: "recorded" };
    },
    markSent: (id, hash) => write(id, { journalState: "sent" }, hash),
    markConfirmed: id => write(id, { journalState: "confirmed" }),
    markFailed: id => write(id, { journalState: "failed" }),
    markUnknown: id => write(id, { journalState: "unknown" }),
    // X recovery reads its durable receipt rows, not the generic pool-fill reconciler.
    listUnresolved: async () => [],
  };
  return { journal, forMention: <T>(mentionId: string, run: () => Promise<T>) => scope.run(mentionId, run) };
}
