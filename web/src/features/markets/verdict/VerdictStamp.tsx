import type { VerdictOutcome } from "@masayume/core/types";
import { verdictStrings } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface VerdictStampProps {
  outcome: VerdictOutcome;
  size?: "hero" | "compact";
  className?: string;
}

/** Color law: vermilion belongs to 正夢 alone; a loss is printed in neutral ink, a void in muted ink. */
const STAMP_INK: Record<VerdictOutcome, string> = {
  win: "text-(--verdict-stamp-win-ink)",
  loss: "text-(--verdict-stamp-loss-ink)",
  void: "text-(--verdict-stamp-void-ink)",
};

/** The pressed stamp: kanji with romaji and translation always beneath it, so the verdict never depends on reading Japanese or on color. */
export function VerdictStamp({ outcome, size = "hero", className }: VerdictStampProps) {
  const strings = verdictStrings(outcome);
  return (
    <div className={cn("stamp-press inline-flex flex-col items-start", className)}>
      <span lang="ja" className={cn(size === "hero" ? "type-stamp-hero" : "type-stamp", STAMP_INK[outcome])}>
        {strings.kanji}
      </span>
      <span className="type-label-micro normal-case text-ink-secondary">
        <span lang="ja-Latn">{strings.romaji}</span> · {strings.translation}
      </span>
    </div>
  );
}
