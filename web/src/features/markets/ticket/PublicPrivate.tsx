"use client";

import { PRIVATE } from "@/features/private";
import { TICKET } from "@/lib/copy";

interface PublicPrivateProps {
  priv: boolean;
  onChange: (priv: boolean) => void;
  /** The desk is ready and the stake is under its cap; otherwise the tile is disabled and its title says why. */
  privateEnabled: boolean;
  privateTitle: string;
  /** The reference's small "retry" beside the control while the desk is unavailable. */
  retry: (() => void) | null;
}

/**
 * Public ⟷ Private (`Ticket624Drawer.tsx` L1180–1220): two tiles in a bordered tray, and one small retry
 * when the desk is not answering. "A control gets a label, not an essay" — the reference's own comment.
 * The three-way Wallet / Balance / Private control this replaced was ours; where the money comes from
 * within a public bet now sits with the account gate, as the reference keeps its account split there.
 */
export function PublicPrivate({ priv, onChange, privateEnabled, privateTitle, retry }: PublicPrivateProps) {
  return (
    <div className="tk-pp-row">
      <div className="tk-pp" role="group" aria-label={TICKET.route}>
        <button type="button" className="tk-pp-btn" aria-pressed={!priv} onClick={() => onChange(false)} data-cursor="hover">
          {TICKET.public}
        </button>
        <button
          type="button"
          className="tk-pp-btn tk-pp-btn--private"
          aria-pressed={priv}
          disabled={!privateEnabled && !priv}
          title={privateTitle}
          onClick={() => onChange(true)}
          data-cursor="hover"
        >
          {TICKET.private}
        </button>
      </div>
      {retry && (
        <button type="button" onClick={retry} className="tk-gate-quiet" data-cursor="hover">
          {PRIVATE.route.retry}
        </button>
      )}
    </div>
  );
}
