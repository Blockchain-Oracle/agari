import type { FundingCheck } from "@masayume/markets";
import { formatBaseUnits } from "@masayume/core/units";
import { TICKET } from "@/lib/copy";

interface FundingNoteProps {
  funding: Extract<FundingCheck, { ok: true }>;
  decimals: number;
  symbol: string;
}

/** Where the escrow comes from (venue credit first, FR-5) and the one honest approval sentence (Approvals convention). */
export function FundingNote({ funding, decimals, symbol }: FundingNoteProps) {
  const lines = [
    funding.venueCreditUsedBase > 0n ? TICKET.creditNote(`${formatBaseUnits(funding.venueCreditUsedBase, decimals)} ${symbol}`) : null,
    funding.needsApproval ? TICKET.approvalNote : null,
  ].filter((line): line is string => line !== null);
  if (lines.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 type-caption text-ink-secondary">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
