"use client";

import { SESSION } from "./copy";
import type { SessionStatus } from "./view";

interface SessionChipProps {
  status: SessionStatus;
  onClick: () => void;
}

const LABEL: Record<SessionStatus, string> = {
  armed: SESSION.chip.on,
  disarmed: SESSION.chip.off,
  "grant-without-key": SESSION.chip.needsKey,
  expired: SESSION.chip.expired,
  loading: SESSION.chip.off,
  "not-deployed": SESSION.chip.off,
  "no-wallet": SESSION.chip.off,
};

const TITLE: Record<SessionStatus, string> = {
  armed: SESSION.chip.titleOn,
  disarmed: SESSION.chip.titleOff,
  "grant-without-key": SESSION.chip.titleNeedsKey,
  expired: SESSION.chip.titleExpired,
  loading: SESSION.chip.titleOff,
  "not-deployed": SESSION.notDeployed,
  "no-wallet": SESSION.chip.titleNoWallet,
};

/**
 * The "tap-trading on" chip (UX-DR17), in the reference's leverage-chip grammar. It never says
 * "on" for a grant this browser cannot sign for; disabled, its title says what is missing.
 */
export function SessionChip({ status, onClick }: SessionChipProps) {
  const disabled = status === "not-deployed" || status === "no-wallet" || status === "loading";
  return (
    <button
      type="button"
      className="tk-lev"
      aria-pressed={status === "armed"}
      disabled={disabled}
      title={TITLE[status]}
      aria-label={`${LABEL[status]} — ${TITLE[status]}`}
      onClick={onClick}
      data-cursor="hover"
    >
      {LABEL[status]}
    </button>
  );
}
