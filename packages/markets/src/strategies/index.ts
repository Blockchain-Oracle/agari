/** StrategyRegistry on Solana is `agari-strategy` (S9): reads off the registry's own accounts, writes through the session's lane. */
import type { IntentJournal, PhaseListener, TxOutcome } from "@agari/core/ports";
import { REGISTRY_NOT_DEPLOYED, type RegistryDeployment, type StrategyIntent } from "@agari/core/strategies";
import type { Address } from "@agari/core/types";
import { refusedFor } from "../stub/product";
import type { VaultContracts } from "../vault/contracts";
import { strategyProgramId } from "./deployment";

export { downsample, readAgentContext } from "./agent-context";
export { openingOnFeedScale } from "./price-basis";
export { getStrategy, listLiveSubscribers, listStrategies, listStrategySubscribers, listSubscriptionsOf } from "./reads";
export { planRevision, STRATEGY_METADATA_MAX_BYTES } from "./writes";

export interface StrategyTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

/** The registry's address on this cluster, or null where `agari-strategy` is not configured. */
export function resolveRegistryDeployment(_chainId?: number): RegistryDeployment | null {
  const program = strategyProgramId();
  return program ? { chainId: 0, strategyRegistry: program, fromBlock: 0n } : null;
}

/**
 * The write without a session. A registry write goes through `MarketsSubmitter.submitTx`, which is bound to the
 * session's signer; this arm stays for a caller that has none, and refuses rather than pretend.
 */
export async function submitStrategyTx(_ctx: StrategyTxContext, _intent: StrategyIntent, _onPhase?: PhaseListener): Promise<TxOutcome> {
  return refusedFor(REGISTRY_NOT_DEPLOYED);
}
