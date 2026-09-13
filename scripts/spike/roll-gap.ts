import { runSpike, short } from "./lib/boot";
import { bullets, heading, table } from "./lib/markdown";
import { median } from "./lib/math";
import { cadenceLabel, intervalSecOf, isUpDown, type MarketRow } from "./lib/rounds";

const SAMPLE_ROWS = 100;

interface CadenceGaps {
  label: string;
  intervalSec: number;
  gapsSec: number[];
}

function groupBySeries(rows: MarketRow[]): Map<string, MarketRow[]> {
  const groups = new Map<string, MarketRow[]>();
  for (const row of rows.filter(isUpDown)) {
    const key = `${row.asset}:${intervalSecOf(row)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

function gapsOf(series: MarketRow[]): number[] {
  const sorted = [...series].sort((a, b) => Number(a.tradingStart) - Number(b.tradingStart));
  return sorted.slice(1).map((row, i) => Number(row.tradingStart) - Number((sorted[i] as MarketRow).expiry));
}

await runSpike(async ({ client, env }) => {
  const rows = await client.listPastBinaryMarkets({ venueId: env.venueId, limit: SAMPLE_ROWS });
  const byCadence = new Map<string, CadenceGaps>();
  for (const [, series] of groupBySeries(rows)) {
    const sample = series[0] as MarketRow;
    const label = cadenceLabel(sample);
    const entry = byCadence.get(label) ?? { label, intervalSec: intervalSecOf(sample), gapsSec: [] };
    entry.gapsSec.push(...gapsOf(series));
    byCadence.set(label, entry);
  }
  const cadences = [...byCadence.values()].filter((c) => c.gapsSec.length > 0).sort((a, b) => a.intervalSec - b.intervalSec);

  console.log(heading(1, `Roll gaps — venue ${short(env.venueId)} — ${rows.length} past rows — ${new Date().toISOString()}`));
  console.log(
    table(
      ["cadence", "n gaps", "min s", "median s", "max s", "gaps > 0"],
      cadences.map((c) => [c.label, c.gapsSec.length, Math.min(...c.gapsSec), median(c.gapsSec), Math.max(...c.gapsSec), c.gapsSec.filter((g) => g > 0).length]),
    ),
  );
  console.log(heading(2, "Pin"));
  console.log(bullets(cadences.map((c) => `ROLL_GAP_SEC[${c.label}] = ${median(c.gapsSec) ?? "—"} (a gap > 0 means a skipped window, not a roll delay)`)));
});
