"use client";

import type { BlockerKind } from "@masayume/core/copy";
import { netClaimableSum } from "@masayume/core/claims";
import type { ClaimableRow } from "@masayume/core/types";
import { Money } from "@/components/data";
import { BlockedButton } from "@/components/states";
import { CLAIM } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { ClaimProgress } from "./ClaimProgress";
import { ClaimRow } from "./ClaimRow";
import type { ClaimRun } from "./types";

interface ClaimPlateProps {
  rows: readonly ClaimableRow[];
  decimals: number;
  run: ClaimRun;
  blocker: BlockerKind | null;
  onClaimAll: () => void;
  className?: string;
}

function highestFeeBps(rows: readonly ClaimableRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.feeBps), 0);
}

/** The accent-wash plate: one net figure (ink on the wash — vermilion never colors a number), the rows, one honest CTA. */
export function ClaimPlate({ rows, decimals, run, blocker, onClaimAll, className }: ClaimPlateProps) {
  const sum = netClaimableSum(rows);
  const items = run.status === "idle" ? undefined : run.items;

  return (
    <section
      aria-labelledby="claim-plate-title"
      className={cn("flex flex-col gap-4 rounded-(--claim-plate-radius) border border-(--claim-plate-border) bg-(--claim-plate-surface) p-4", className)}
    >
      <header className="flex flex-col gap-1">
        <h2 id="claim-plate-title" className="type-title text-ink">
          {CLAIM.title}
        </h2>
        <p className="type-caption text-ink-secondary">{CLAIM.waiting(rows.length)}</p>
      </header>

      {rows.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <Money value={sum} decimals={decimals} className="type-data-lg text-ink" />
          <span className="type-label-micro text-ink-secondary">
            {CLAIM.netLabel} · {CLAIM.feeNote(highestFeeBps(rows))}
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <ClaimRow key={row.marketId} row={row} items={items} />
          ))}
        </ul>
      )}

      {run.status !== "idle" && <ClaimProgress run={run} onRetry={rows.length > 0 ? onClaimAll : undefined} />}

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <BlockedButton blocker={blocker} onClick={onClaimAll} size="lg" className="w-full">
            {run.status === "done" ? CLAIM.retry : CLAIM.claimAll}
          </BlockedButton>
          <p className="type-caption text-ink-secondary">{CLAIM.oneSignatureEach}</p>
        </div>
      )}
    </section>
  );
}
