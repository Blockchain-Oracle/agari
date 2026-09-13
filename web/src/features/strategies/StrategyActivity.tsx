import type { RunnerHealth } from "@masayume/core/strategies";
import type { VaultGrant } from "@masayume/core/vault";
import { strategyActivityOf } from "./activity";
import type { CopyState } from "./lifecycle";
import { ago } from "./names";

/** A fresh wallet constraint and the strategy-wide report, alongside the separate consent label. */
export function StrategyActivity({ state, grant, health, nowMs }: {
  state: CopyState; grant: VaultGrant | null; health: RunnerHealth | null; nowMs: number;
}) {
  const activity = strategyActivityOf({ state, grant, health, nowMs });
  return <div className="copy-progress mt-3" aria-label="Strategy operation">
    <strong>Operation · {activity.label}</strong>
    <p>{activity.detail}</p>
    {activity.positions && <p>{activity.positions}</p>}
    <p className="mt-3">{activity.heartbeat}</p>
    {health?.why && <details className="mt-2">
      <summary className="cursor-pointer">Runner report{health.lastTickMs !== null && ` · ${ago(Math.min(health.lastTickMs, nowMs), nowMs)}`}</summary>
      <p className="mt-2">{health.why}</p>
      <p>This report covers the strategy across its subscribers.</p>
    </details>}
  </div>;
}
