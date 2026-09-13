import type { XStageHealth } from "@masayume/db";

/** An old success cannot keep a stopped worker looking available. */
export function relayStageLabel(stage: XStageHealth | null | undefined, nowMs: number): string {
  if (!stage) return "Not verified";
  if (nowMs - stage.checkedAtMs > 180_000 || stage.checkedAtMs > nowMs + 60_000) return "Status out of date";
  if (stage.state === "disabled") return "Disabled";
  if (stage.state === "error") return "Needs attention";
  if (stage.state === "idle") return "Standing by";
  return "Last check passed";
}
