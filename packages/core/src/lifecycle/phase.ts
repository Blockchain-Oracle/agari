import type { IndexedStatus } from "../types/market";
import { msToSec } from "../units/time";
import { noEntryCutoffSec } from "./headroom";
import { ONCHAIN_STATUS } from "./status";

export type MarketPhase =
  | "upcoming"
  | "pendingOpeningPrint"
  | "trading"
  | "noEntryBuffer"
  | "locked"
  | "settledUnclaimed"
  | "finalized"
  | "voided";

export interface PhaseInput {
  tradingStartSec: number;
  expirySec: number;
  intervalSec: number;
  openingPriceRaw: bigint | null;
  status: IndexedStatus;
  voided: boolean;
  finalized: boolean | null;
  /** Head-fresh on-chain status when known; it overrides the lagging indexer status. */
  onchainStatus?: number | null;
}

const ENTERABLE: ReadonlySet<MarketPhase> = new Set<MarketPhase>(["trading"]);

function timePhase(m: PhaseInput, nowSec: number): MarketPhase {
  if (nowSec >= m.expirySec) return "locked";
  if (nowSec >= noEntryCutoffSec(m.expirySec, m.intervalSec)) return "noEntryBuffer";
  if (nowSec < m.tradingStartSec) return "upcoming";
  if (m.openingPriceRaw === null) return "pendingOpeningPrint";
  return "trading";
}

function settledPhase(m: PhaseInput): MarketPhase {
  return m.finalized === true || m.status === "Finalized" ? "finalized" : "settledUnclaimed";
}

/** The single lifecycle function every surface derives from (AD-1). `nowMs` must come from the chain-corrected clock. */
export function phase(m: PhaseInput, nowMs: number): MarketPhase {
  const nowSec = msToSec(nowMs);
  const onchain = m.onchainStatus ?? null;
  if (onchain === ONCHAIN_STATUS.Voided || m.voided || m.status === "Voided") return "voided";
  if (onchain === ONCHAIN_STATUS.Resolved || m.status === "Resolved" || m.status === "Finalized") return settledPhase(m);
  if (onchain === ONCHAIN_STATUS.Locked || onchain === ONCHAIN_STATUS.Settling) return "locked";
  if (onchain === ONCHAIN_STATUS.Listed && nowSec < m.tradingStartSec) return "upcoming";
  return timePhase(m, nowSec);
}

export function isEnterable(p: MarketPhase): boolean {
  return ENTERABLE.has(p);
}

export function isSettled(p: MarketPhase): boolean {
  return p === "settledUnclaimed" || p === "finalized" || p === "voided";
}
