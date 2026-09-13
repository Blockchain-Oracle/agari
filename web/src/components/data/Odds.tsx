import { cn } from "@/lib/utils";
import { bpsToOddsCents } from "@masayume/core/units";

interface OddsProps {
  bps: number;
  className?: string;
}

export function Odds({ bps, className }: OddsProps) {
  const cents = bpsToOddsCents(bps);
  return (
    <span className={cn("numbers", className)} aria-label={`${cents} cents per dollar`}>
      {cents}¢
    </span>
  );
}
