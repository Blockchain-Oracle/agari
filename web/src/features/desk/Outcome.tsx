import type { OutcomeColumn } from "@agari/core/desk";
import { RECORD } from "./copy-record";

const TONE: Record<OutcomeColumn, "acted" | "asked" | "quiet" | "stopped"> = {
  acted: "acted", acted_in_part: "acted", acted_by_override: "acted", would_have_acted: "acted",
  asked: "asked", nothing_to_do: "quiet", waited: "quiet", declined: "quiet",
  not_executed: "stopped", blocked_by_limit: "stopped", failed: "stopped",
};

/** One outcome as a mono chip: acted in vermilion, asked in the warning tone, quiet muted, stopped in the loss tone. */
export function Outcome({ outcome, practice }: { outcome: OutcomeColumn; practice?: boolean }) {
  return (
    <span className="dk-outcome" data-tone={TONE[outcome]}>
      {RECORD.outcome[outcome]}
      {practice ? ` · ${RECORD.list.practiceTag}` : ""}
    </span>
  );
}
