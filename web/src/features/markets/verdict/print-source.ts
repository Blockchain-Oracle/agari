import type { PrintSource, Resolution } from "@agari/core/types";

/** Every verdict names the signed source its prints came from (PD-1, D-003). */
const PRINT_SOURCE_LABEL: Record<PrintSource, string> = {
  pyth: "Pyth",
  redstone: "RedStone",
  switchboard: "Switchboard",
  attested: "demo data (attested)",
};

/** "Pyth", "RedStone · single source", or null before the Window has settled. */
export function printSourceText(resolution: Pick<Resolution, "printSource" | "singleSource"> | null): string | null {
  if (!resolution?.printSource) return null;
  const label = PRINT_SOURCE_LABEL[resolution.printSource];
  return resolution.singleSource ? `${label} · single source` : label;
}
