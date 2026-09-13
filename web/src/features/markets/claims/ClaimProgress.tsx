import { formatCadence } from "@masayume/core/copy";
import { OUTCOME_TO_SIDE } from "@masayume/core/types";
import { txUrl } from "@masayume/core/urls";
import { Hash, Money } from "@/components/data";
import { ErrorState } from "@/components/states";
import { CLAIM, diagnosisCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { progressCounts } from "./claim-run";
import type { ClaimItem, ClaimRun } from "./types";

interface ClaimProgressProps {
  run: ClaimRun;
  onRetry?: () => void;
  className?: string;
}

function headline(run: ClaimRun): string {
  const { total, confirmed, current } = progressCounts(run);
  if (run.status === "running") return current === null ? CLAIM.progress(1, total) : CLAIM.progress(current, total);
  return CLAIM.finished(confirmed, total);
}

function ItemLine({ item }: { item: ClaimItem }) {
  const failure = item.diagnosis && item.status !== "confirmed" ? diagnosisCopy(item.diagnosis.kind).headline : null;
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 type-caption text-ink-secondary">
      <span className="flex items-baseline gap-2">
        <span className="text-ink">
          {item.asset} · {formatCadence(item.intervalSec)} · {CLAIM.leg[OUTCOME_TO_SIDE[item.outcomeIdx]]}
        </span>
        <Money value={item.payoutBase} decimals={item.decimals} className="text-ink" />
      </span>
      <span className="flex items-baseline gap-2">
        <span className={cn(item.status === "claiming" && "text-accent", item.status === "confirmed" && "text-ink")}>{CLAIM.status[item.status]}</span>
        {item.txHash && <Hash value={item.txHash} href={txUrl(item.txHash)} className="text-ink" />}
        {failure && <span className="text-warning">{failure}</span>}
      </span>
    </li>
  );
}

/** Honest per-item progress: "claiming 2 of 4", then each item's own outcome — never one collapsed verdict (AD-15). */
export function ClaimProgress({ run, onRetry, className }: ClaimProgressProps) {
  const stoppedEarly = run.status === "done" && run.diagnosis !== null;
  return (
    <section className={cn("flex flex-col gap-3 rounded-md border border-hairline bg-surface-1 p-3", className)}>
      <p role="status" aria-live="polite" className="type-body-strong text-ink">
        {headline(run)}
      </p>
      <ul className="flex flex-col gap-1">
        {run.items.map((item) => (
          <ItemLine key={item.key} item={item} />
        ))}
      </ul>
      {stoppedEarly && run.diagnosis && (
        <div className="flex flex-col gap-2">
          <p className="type-caption text-ink-secondary">{CLAIM.stopped}</p>
          <ErrorState diagnosis={run.diagnosis} retry={onRetry} />
        </div>
      )}
    </section>
  );
}
