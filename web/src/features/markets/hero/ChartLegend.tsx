import { HERO } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { OraclePrice } from "./OraclePrice";

interface ChartLegendProps {
  /** The asset the figures are about (S19): a basket reads in points. */
  asset?: string;
  openingRaw: bigint | null;
  latestRaw: bigint | null;
}

function Swatch({ dashed = false }: { dashed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block w-5 border-t-2", dashed ? "border-dashed border-ink-muted" : "border-solid border-ink-secondary")}
    />
  );
}

/** Solid swatch once the print exists; dashed while pending — the legend is the "line" until there is a level to draw. */
export function ChartLegend({ openingRaw, latestRaw, asset = "" }: ChartLegendProps) {
  return (
    <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 type-caption text-ink-secondary">
      <div className="flex items-center gap-2">
        <Swatch dashed={openingRaw === null} />
        <dt>{openingRaw === null ? HERO.pendingPrint : HERO.openingPrint}</dt>
        {openingRaw !== null && (
          <dd className="text-ink">
            <OraclePrice raw={openingRaw} asset={asset} />
          </dd>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="inline-block w-5 border-t-2 border-solid border-ink" />
        <dt>{HERO.livePrice}</dt>
        <dd className="text-ink">{latestRaw === null ? "—" : <OraclePrice raw={latestRaw} asset={asset} />}</dd>
      </div>
    </dl>
  );
}
