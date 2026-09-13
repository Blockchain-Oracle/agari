import { AlertTriangleIcon, CheckCircleIcon } from "lucide-react";
import { STATUS } from "./copy";
import { lagTone, type StatusPayload, type StatusPipeline } from "./protocol";

/** The overall banner — reference L60–85: one line of verdict, the worst lag, and the chain head. */
export function StatusBanner({ payload }: { payload: StatusPayload }) {
  const healthy = payload.overall === "healthy";
  return (
    <div className="status-banner" data-healthy={healthy}>
      {healthy ? <CheckCircleIcon className="status-banner-icon" aria-hidden /> : <AlertTriangleIcon className="status-banner-icon" aria-hidden />}
      <div>
        <div className="status-banner-title">{healthy ? STATUS.healthy : STATUS.degraded}</div>
        <div className="status-banner-sub">
          {payload.maxLagSec !== null && payload.maxLagPipeline ? STATUS.maxLag(payload.maxLagSec, payload.maxLagPipeline) : STATUS.noLag}
        </div>
      </div>
      <div className="status-checkpoint">
        <div className="status-checkpoint-label">{STATUS.checkpoint}</div>
        <div className="status-checkpoint-value">{payload.blockNumber === null ? STATUS.noBlock : payload.blockNumber.toLocaleString("en-US")}</div>
      </div>
    </div>
  );
}

function PipelineRow({ pipeline }: { pipeline: StatusPipeline }) {
  const notConfigured = pipeline.optional && !pipeline.configured;
  return (
    <div className="status-row">
      <span className="status-dot" data-tone={lagTone(pipeline)} aria-hidden />
      <span className="status-row-label">{pipeline.label}</span>
      <span className="status-row-lag">
        {pipeline.lagSec !== null ? STATUS.lag(pipeline.lagSec) : pipeline.latencyMs !== null ? STATUS.latency(pipeline.latencyMs) : "—"}
      </span>
      <span className="status-row-detail" title={pipeline.detail}>
        {pipeline.detail}
      </span>
      {notConfigured && <span className="status-chip">{STATUS.optional}</span>}
    </div>
  );
}

/** The pipeline table — reference L87–122, one row per dependency with the lag dot ladder. */
export function StatusTable({ pipelines }: { pipelines: StatusPipeline[] }) {
  return (
    <div className="status-table">
      <div className="status-table-head">
        <h3 className="status-table-title">{STATUS.tableTitle(pipelines.length)}</h3>
      </div>
      <div className="status-table-body">
        {pipelines.map((pipeline) => (
          <PipelineRow key={pipeline.id} pipeline={pipeline} />
        ))}
      </div>
    </div>
  );
}
