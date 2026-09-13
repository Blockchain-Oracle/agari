"use client";

import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { SectionHeader } from "@/components/chrome";
import { STATUS } from "./copy";
import { StatusBanner, StatusTable } from "./StatusRows";
import { useStatus } from "./useStatus";

/**
 * `/status` — ported from `reference/yosuku/app/status/page.tsx`.
 *
 * The reference asks its predict server for pipeline lags; there is no such server here, so
 * `/api/status` makes the reads itself, at request time, and the page shows exactly what came
 * back: the chain head, the indexer's live windows, how old each price print is, and whether
 * the optional capabilities (the social store, Sensei) are connected on this deployment.
 * Three states, as the reference has them: loading, unreachable, and the report.
 */
export function StatusScreen() {
  const reading = useStatus();

  return (
    <div className="container status-page">
      <SectionHeader index={STATUS.section.index} title={STATUS.section.title} />

      {reading === null && (
        <div className="status-holding" role="status" aria-busy="true">
          <RefreshCwIcon className="status-holding-icon animate-spin" aria-hidden />
          <p className="status-holding-text">{STATUS.loading}</p>
        </div>
      )}

      {reading !== null && !reading.ok && (
        <div className="status-holding" role="alert">
          <AlertTriangleIcon className="status-holding-icon warn" aria-hidden />
          <p className="status-holding-text">{STATUS.unreachable}</p>
        </div>
      )}

      {reading?.ok && (
        <div className="status-report">
          <StatusBanner payload={reading.value} />
          <StatusTable pipelines={reading.value.pipelines} />
          <p className="status-checked">{STATUS.lastChecked(new Date(reading.value.checkedAtMs).toLocaleTimeString())}</p>
        </div>
      )}
    </div>
  );
}
