/** PrivateDesk reads. Until `agari-private` is deployed (S10): `null` desk, zero budget, not-deployed quotes. */
import { PRIVATE_NOT_DEPLOYED, type PrivateBudget, type PrivateDeployment, type PrivateDeskState, type PrivateQuote, type PrivateSlot } from "@agari/core/private";
import type { Reading } from "@agari/core/schemas";
import type { Address, Hash32, MarketId, Side } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import { absent, unavailableFor } from "../stub/product";

export {
  cashOutPrivateBet,
  ClaimRefusedError,
  createDeskClient,
  deskHealth,
  openPrivateBet,
  publicReason,
  type DeskClient,
  type DeskClientConfig,
  type DeskOpenInput,
} from "./desk";

export const resolvePrivateDeployment = (_env?: Partial<MarketsEnv>): PrivateDeployment | null => null;

/** What a private bet can spend: the balance, never more than the desk may spend. */
export function toPrivateBudget(balanceBase: bigint, allowanceBase: bigint): PrivateBudget {
  return { balanceBase, allowanceBase, spendableBase: allowanceBase < balanceBase ? allowanceBase : balanceBase };
}

export const getPrivateDeskState = (): Promise<Reading<PrivateDeskState | null>> => absent(null);
export const getPrivateBudget = (_owner: Address): Promise<Reading<PrivateBudget>> => absent(toPrivateBudget(0n, 0n));
export const getPrivateSlot = (_slotId: Hash32): Promise<Reading<PrivateSlot | null>> => absent(null);
export const sizePrivateForStake = (_marketId: MarketId, _side: Side, _stakeBase: bigint): Promise<Reading<PrivateQuote>> => unavailableFor(PRIVATE_NOT_DEPLOYED);
