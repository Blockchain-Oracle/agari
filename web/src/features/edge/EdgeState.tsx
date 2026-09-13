import type { ReactNode } from "react";
import { EDGE } from "./copy";

interface EdgeStateProps {
  eyebrow: string;
  title: string;
  copy: string;
  action?: ReactNode;
}

/** The reference's tall lined panel for every non-report state: connect, failed, nothing settled. */
export function EdgeState({ eyebrow, title, copy, action }: EdgeStateProps) {
  return (
    <div className="edge-state-panel">
      <div className="edge-state-inner">
        <div className="edge-eyebrow">{eyebrow}</div>
        <h2 className="edge-state-title">{title}</h2>
        <p className="edge-state-copy">{copy}</p>
        {action && <div className="edge-state-action-slot">{action}</div>}
      </div>
    </div>
  );
}

export function EdgeSkeleton() {
  return (
    <div className="edge-state-panel" role="status" aria-busy="true" aria-label={EDGE.states.reading}>
      <div className="edge-skeleton" />
    </div>
  );
}
