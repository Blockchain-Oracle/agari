import { formatCadence } from "@agari/core/copy";
import { OUTCOME_TO_SIDE, type ClaimLeg, type ClaimableRow, type VoidDetail } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { Hash, Money, UtcTime } from "@/components/data";
import { CLAIM, diagnosisCopy } from "@/lib/copy";
import { webEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import { itemKey } from "./claim-run";
import type { ClaimItem } from "./types";
import { useVoidLine } from "./void-line";

interface ClaimRowProps {
  row: ClaimableRow;
  /** Live per-leg outcomes from a run in progress; absent when idle. */
  items?: readonly ClaimItem[];
  className?: string;
  /** A void's reason when the caller holds it (`/dev` fixtures); omitted, the row reads its Window's result. */
  voidDetail?: VoidDetail | null;
}

/** Under a void's kind line: why it voided (session-lanes.md §3.2), read only for a void row. */
function VoidReason({ row, given }: { row: ClaimableRow; given: VoidDetail | null | undefined }) {
  const line = useVoidLine(row.marketId, row.kind === "void", given);
  return line ? <span className="type-caption text-ink-muted">{line}</span> : null;
}

function LegLine({ row, leg, item }: { row: ClaimableRow; leg: ClaimLeg; item: ClaimItem | undefined }) {
  const status = item?.status ?? "pending";
  const failure = item?.diagnosis && status !== "confirmed" ? diagnosisCopy(item.diagnosis.kind).headline : null;
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 type-caption text-ink-secondary">
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-ink">{CLAIM.leg[OUTCOME_TO_SIDE[leg.outcomeIdx]]}</span>
        <Money value={leg.amountRaw} decimals={row.decimals} maxDp={2} />
        <span>{CLAIM.contracts}</span>
        <span aria-hidden="true">→</span>
        <Money value={leg.payoutBase} decimals={row.decimals} className="text-ink" />
      </span>
      <span className="flex items-baseline gap-2">
        <span className={cn(status === "confirmed" && "text-ink")}>{item ? CLAIM.status[status] : CLAIM.status.pending}</span>
        {item?.txHash && <Hash value={item.txHash} href={txUrl(item.txHash, webEnv.markets.cluster)} className="text-ink" />}
        {failure && <span className="text-warning">{failure}</span>}
      </span>
    </li>
  );
}

/** One settled Window: a void is ONE row whose two legs share the Window's one redemption; a Vault credit reads as a withdrawal. */
export function ClaimRow({ row, items, className, voidDetail }: ClaimRowProps) {
  const cadence = formatCadence(row.intervalSec);
  const timeLabel = row.settledAtMs === null ? CLAIM.closed : CLAIM.settled;
  const timeMs = row.settledAtMs ?? secToMs(row.expirySec);

  return (
    <li className={cn("flex flex-col gap-2 rounded-md border border-hairline bg-surface-1 p-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="type-body-strong text-ink">
            {row.asset} · {cadence}
          </span>
          <span className="type-caption text-ink-secondary">
            {CLAIM.kind[row.kind]} · {timeLabel} <UtcTime ms={timeMs} withSeconds={false} />
          </span>
          {row.kind === "void" && <VoidReason row={row} given={voidDetail} />}
        </div>
        <Money value={row.netPayoutBase} decimals={row.decimals} className="type-data-lg text-ink" />
      </div>
      <ul className="flex flex-col gap-1">
        {row.legs.map((leg) => (
          <LegLine key={leg.outcomeIdx} row={row} leg={leg} item={items?.find((item) => item.key === itemKey(row.marketId))} />
        ))}
      </ul>
    </li>
  );
}
