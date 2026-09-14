/** StrategyRegistry on Solana is `agari-strategy` (S9). Until deployed: `null`/empty reads and refused writes. */
import type { PhaseListener, TxOutcome, IntentJournal } from "@agari/core/ports";
import type { Reading } from "@agari/core/schemas";
import { REGISTRY_NOT_DEPLOYED, type RegistryDeployment, type StrategyIntent, type StrategyRecord, type StrategySubscription } from "@agari/core/strategies";
import type { Address } from "@agari/core/types";
import { absent, refusedFor } from "../stub/product";
import type { VaultContracts } from "../vault/contracts";

export { downsample, readAgentContext } from "./agent-context";
export { openingOnFeedScale } from "./price-basis";

export interface StrategyTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

export const resolveRegistryDeployment = (_chainId?: number): RegistryDeployment | null => null;
/** `null` inside the reading where no registry is deployed (the page's CapabilityPending). */
export const listStrategies = (): Promise<Reading<StrategyRecord[] | null>> => absent(null);
export const getStrategy = (_strategyId: bigint): Promise<Reading<StrategyRecord | null>> => absent(null);
export const listSubscriptionsOf = (_wallet: Address, _strategyIds: readonly bigint[]): Promise<Reading<StrategySubscription[]>> => absent([]);
export const listLiveSubscribers = (_strategyId: bigint): Promise<Reading<StrategySubscription[]>> => absent([]);
export async function listStrategySubscribers(_strategyId: bigint): Promise<Address[]> {
  return [];
}

export async function submitStrategyTx(_ctx: StrategyTxContext, _intent: StrategyIntent, _onPhase?: PhaseListener): Promise<TxOutcome> {
  return refusedFor(REGISTRY_NOT_DEPLOYED);
}
