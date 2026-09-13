import type { StaleReason } from "@masayume/core";
import { TriangleAlertIcon } from "lucide-react";
import { formatUtc } from "@masayume/core/units";
import { STALE_REASON_LABEL, staleLine } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface StaleTickProps {
  asOfMs: number;
  reason?: StaleReason;
  compact?: boolean;
  className?: string;
}

/** The previous value stays at full ink; this tick says how old it is. Announces once per transition. */
export function StaleTick({ asOfMs, reason = "refresh-failed", compact = false, className }: StaleTickProps) {
  const reasonLabel = STALE_REASON_LABEL[reason];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-1 whitespace-nowrap text-warning type-caption", className)}
    >
      <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
      {compact ? reasonLabel : staleLine(formatUtc(asOfMs, { withSeconds: false }), reasonLabel)}
    </span>
  );
}
