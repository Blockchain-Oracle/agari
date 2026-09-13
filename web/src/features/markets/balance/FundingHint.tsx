import { Money } from "@/components/data";
import { BALANCE } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface FundingHintProps {
  creditBase: bigint;
  decimals: number;
  symbol?: string;
  className?: string;
}

/** The spent-first sentence the Ticket's funding note reuses; renders nothing when there is no credit to spend. */
export function FundingHint({ creditBase, decimals, symbol, className }: FundingHintProps) {
  if (creditBase <= 0n) return null;
  return (
    <span className={cn("type-caption text-ink-muted", className)}>
      <Money value={creditBase} decimals={decimals} symbol={symbol} /> {BALANCE.creditFirstHint}
    </span>
  );
}
