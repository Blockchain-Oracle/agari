import type { VoidReason } from "@agari/core/types";

/**
 * `/proof` (S25): the feed of settled Windows the per-Window proof pages hang from. Masayume's `/status` frame again, so
 * the words carry the meaning: which print closed each Window, from which source, and where to read the proof.
 */
export const PROOF_FEED = {
  title: "Proof",
  section: { index: "00", title: "Proof", desc: "Every settled Window, newest first, with the prints that decided it." },
  intro:
    "A Window settles only on a signed print that the program checked when it was recorded. Each row is one Window: its opening and closing print, the source that signed them, and how it ended. Open a row for the signed bytes and the record transactions.",
  filters: "Filter by source",
  all: "All",
  tableTitle: (shown: number, total: number) => (shown === total ? `${total} Windows` : `${shown} of ${total} Windows`),
  loading: "Reading the settled Windows…",
  unreachable: "The index is unreachable. Every print is still on chain; this list returns when the index answers.",
  none: "No settled Window in the index yet. The first one lands at the next close.",
  noneFor: (source: string) => `None of the latest settled Windows closed on ${source}.`,
  more: (n: number) => `Show ${n} more`,
  closed: (when: string) => `closed ${when}`,
  outcome: { up: "Up won", down: "Down won", void: "Void" },
  voidReason: { "missing-print": "missing print", "cross-check-divergence": "cross-check" } satisfies Record<VoidReason, string>,
  noPrint: "—",
  open: "Proof →",
  sourceAria: (source: string) => `${source} feed, in a new tab`,
} as const;
