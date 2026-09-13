import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Money } from "@/components/data";
import { cn } from "@/lib/utils";

interface PoolRowProps {
  label: string;
  value: bigint;
  decimals: number;
  symbol?: string;
  maxDp?: number;
  note?: ReactNode;
  /** The note carries the warning in words; the color and icon only echo it. */
  warning?: boolean;
}

/** One labeled pool of money beneath the headline — listed, never summed into it (FR-5). */
export function PoolRow({ label, value, decimals, symbol, maxDp, note, warning = false }: PoolRowProps) {
  return (
    <div role="listitem" className="flex items-baseline justify-between gap-4 border-t border-hairline py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="type-caption text-ink-secondary">{label}</span>
        {note && <span className={cn("type-caption", warning ? "text-warning" : "text-ink-muted")}>{note}</span>}
      </div>
      <span className="flex shrink-0 items-center gap-1.5 type-data text-ink">
        {warning && <TriangleAlertIcon className="size-3.5 text-warning" aria-hidden="true" />}
        <Money value={value} decimals={decimals} symbol={symbol} maxDp={maxDp} />
      </span>
    </div>
  );
}
