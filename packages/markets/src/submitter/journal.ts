import type { IntentJournal, IntentRecord, IntentState } from "@masayume/core/ports";

export interface JournalRecord extends IntentRecord {
  failureReason?: string;
}

export interface IntentStore {
  load(): JournalRecord[];
  save(records: JournalRecord[]): void;
}

const MAX_RECORDS = 200;
const UNRESOLVED: ReadonlySet<IntentState> = new Set<IntentState>(["recorded", "sent", "unknown"]);

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** One journal over any store. Intent is recorded before send so a no-digest timeout is reconciled, never retried (AD-3). */
export function createJournal(store: IntentStore, nowMs: () => number = Date.now): IntentJournal {
  const update = (id: string, patch: Partial<JournalRecord>) => {
    store.save(store.load().map((record) => (record.id === id ? { ...record, ...patch } : record)));
  };

  return {
    async record(entry) {
      const record: JournalRecord = { ...entry, id: newId(), state: "recorded", createdAtMs: nowMs() };
      store.save([...store.load(), record].slice(-MAX_RECORDS));
      return record;
    },
    async markSent(id, txHash) {
      update(id, { state: "sent", txHash });
    },
    async markConfirmed(id) {
      update(id, { state: "confirmed" });
    },
    async markFailed(id, reason) {
      update(id, { state: "failed", failureReason: reason });
    },
    async markUnknown(id) {
      update(id, { state: "unknown" });
    },
    async listUnresolved(wallet) {
      const owner = wallet.toLowerCase();
      return store.load().filter((record) => record.wallet.toLowerCase() === owner && UNRESOLVED.has(record.state));
    },
  };
}
