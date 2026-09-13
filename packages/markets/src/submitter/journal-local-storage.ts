import type { IntentJournal } from "@masayume/core/ports";
import { createJournal, type IntentStore, type JournalRecord } from "./journal";
import { createMemoryStore } from "./journal-memory";

export const INTENT_JOURNAL_KEY = "masayume.intents.v1";

// bigint never survives JSON; any future bigint field serializes as a decimal string.
const replacer = (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);

function isRecord(value: unknown): value is JournalRecord {
  return typeof value === "object" && value !== null && typeof (value as JournalRecord).id === "string";
}

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function createLocalStorageStore(storage: Storage): IntentStore {
  return {
    load() {
      try {
        const parsed: unknown = JSON.parse(storage.getItem(INTENT_JOURNAL_KEY) ?? "[]");
        return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
      } catch {
        return [];
      }
    },
    save(records) {
      try {
        storage.setItem(INTENT_JOURNAL_KEY, JSON.stringify(records, replacer));
      } catch {
        // quota or privacy mode: journaling degrades silently; the write itself is unaffected
      }
    },
  };
}

/** Browser journal; falls back to memory where storage is unavailable (SSR, privacy mode). */
export function createLocalStorageJournal(nowMs?: () => number): IntentJournal {
  const storage = storageOrNull();
  return createJournal(storage ? createLocalStorageStore(storage) : createMemoryStore(), nowMs);
}
