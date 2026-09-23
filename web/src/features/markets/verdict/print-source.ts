import { formatEtClock } from "@agari/core/market";
import type { Resolution } from "@agari/core/types";
import { printSourceName } from "../price-source/source-label";

/**
 * "Pyth price at 16:00:00 ET", "RedStone price at 16:00:00 ET · single source", or null before the Window has settled.
 * `atSec` is the print's boundary: `expirySec` for the closing print that decides, the Window's start for the opening
 * one. Boundaries fall on whole minutes, so the seconds are always `:00`. Without a boundary the source stands alone.
 */
export function printSourceText(resolution: Pick<Resolution, "printSource" | "singleSource"> | null, atSec: number | null, asset: string | null): string | null {
  if (!resolution?.printSource) return null;
  // Every verdict names the signed source its prints came from (PD-1, D-003); a PreStocks asset's attested print is PreStocks'.
  const label = printSourceName(resolution.printSource, asset);
  const at = atSec === null ? label : `${label} price at ${formatEtClock(atSec)}:00 ET`;
  return resolution.singleSource ? `${at} · single source` : at;
}
