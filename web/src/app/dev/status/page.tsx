import type { Metadata } from "next";
import { SectionHeader } from "@/components/chrome";
import { StatusBanner, StatusTable } from "@/features/status/StatusRows";
import { STATUS_FIXTURES } from "./fixtures";

export const metadata: Metadata = { title: "Status fixtures" };

/** `/dev/status`: the status report in the three states the S5 gate names, rendered by the page's own components. */
export default function DevStatusPage() {
  return (
    <div className="container status-page">
      {STATUS_FIXTURES.map((fixture, index) => (
        <section key={fixture.key} className="status-report">
          <SectionHeader index={String(index + 1).padStart(2, "0")} title={fixture.title} eyebrow={fixture.key} />
          <StatusBanner payload={fixture.payload} />
          <StatusTable pipelines={fixture.payload.pipelines} sessionLabel={fixture.payload.session?.label ?? null} />
        </section>
      ))}
    </div>
  );
}
