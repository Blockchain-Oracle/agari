import type { IntentJournal } from "@masayume/core/ports";
import { createJournal, type IntentStore, type JournalRecord } from "./journal";

export function createMemoryStore(): IntentStore {
  let records: JournalRecord[] = [];
  return {
    load: () => records,
    save: (next) => {
      records = next;
    },
  };
}

/** Process-local journal for scripts and ops actors. */
export function createMemoryJournal(nowMs?: () => number): IntentJournal {
  return createJournal(createMemoryStore(), nowMs);
}
