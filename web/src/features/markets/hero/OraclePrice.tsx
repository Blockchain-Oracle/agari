import { formatOracleRaw } from "@masayume/core/units";
import { cn } from "@/lib/utils";
import { ORACLE_SCALE } from "./units";

interface OraclePriceProps {
  /** Oracle cents scale (Story 1.4). */
  raw: bigint;
  /** Prefix the sign as text so direction never depends on color. */
  signed?: boolean;
  className?: string;
}

/** A dollar figure in the oracle's own scale — the numbers law applies (Plex Mono, tabular). */
export function OraclePrice({ raw, signed = false, className }: OraclePriceProps) {
  const magnitude = raw < 0n ? -raw : raw;
  const sign = raw < 0n ? "−" : signed && raw > 0n ? "+" : "";
  return (
    <span className={cn("numbers", className)}>
      {sign}${formatOracleRaw(magnitude, ORACLE_SCALE)}
    </span>
  );
}

export function oraclePriceText(raw: bigint | null): string {
  return raw === null ? "—" : `$${formatOracleRaw(raw, ORACLE_SCALE)}`;
}
