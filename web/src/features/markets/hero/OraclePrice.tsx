import { formatOracleRaw } from "@agari/core/units";
import { cn } from "@/lib/utils";
import { isBasketAsset, ORACLE_SCALE, POINTS_UNIT } from "./units";

interface OraclePriceProps {
  /** Oracle cents scale (Story 1.4). */
  raw: bigint;
  /** Prefix the sign as text so direction never depends on color. */
  signed?: boolean;
  className?: string;
  /** The asset the figure is about (S19): a basket's figure is in points, never dollars. */
  asset?: string;
}

/** A dollar figure in the oracle's own scale — the numbers law applies (Plex Mono, tabular). */
export function OraclePrice({ raw, signed = false, className, asset = "" }: OraclePriceProps) {
  const magnitude = raw < 0n ? -raw : raw;
  const sign = raw < 0n ? "−" : signed && raw > 0n ? "+" : "";
  const points = isBasketAsset(asset);
  return (
    <span className={cn("numbers", className)}>
      {sign}
      {points ? "" : "$"}
      {formatOracleRaw(magnitude, ORACLE_SCALE)}
      {points ? ` ${POINTS_UNIT}` : ""}
    </span>
  );
}

export function oraclePriceText(raw: bigint | null, asset = ""): string {
  if (raw === null) return "—";
  return isBasketAsset(asset) ? `${formatOracleRaw(raw, ORACLE_SCALE)} ${POINTS_UNIT}` : `$${formatOracleRaw(raw, ORACLE_SCALE)}`;
}
