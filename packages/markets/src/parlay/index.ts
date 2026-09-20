/** ParlayReserve on Solana is `agari-parlay` (S10a): reads off the reserve's own accounts, writes through the session's lanes. */
import { PARLAY_NOT_DEPLOYED, type ParlayDeployment, type ParlayIntent } from "@agari/core/parlay";
import type { PhaseListener } from "@agari/core/ports";
import type { MarketsEnv } from "../env";
import { refusedFor } from "../stub/product";
import { parlayProgramId } from "./deployment";
import type { ParlayOpenOutcome, ParlayTxContext } from "./types";

export { getParlay, getParlayReserveState, getParlaySharesOf, listParlaysOf } from "./reads";
export { quoteParlayOnchain } from "./quote";
export type { ParlayOpenOutcome, ParlayTxContext } from "./types";

/** The reserve's address on this cluster, or null where `agari-parlay` is not configured. */
export function resolveParlayDeployment(_env?: Partial<MarketsEnv>): ParlayDeployment | null {
  const program = parlayProgramId();
  return program ? { chainId: 0, parlayReserve: program, fromBlock: 0n } : null;
}

/**
 * The open without a session. A ticket is opened through `MarketsSubmitter.submitParlayOpen`, which is bound to
 * the session's signer; this arm stays for a caller that has none, and refuses rather than pretend.
 */
export async function submitParlayOpen(_ctx: ParlayTxContext, _intent: Extract<ParlayIntent, { kind: "parlay-open" }>, _onPhase?: PhaseListener): Promise<ParlayOpenOutcome> {
  return refusedFor(PARLAY_NOT_DEPLOYED);
}
