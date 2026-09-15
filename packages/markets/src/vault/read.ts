/**
 * The Trading Balance reads behind the port (tap-trading.md §1.1; Masayume `vault/read.ts`): the owner's balances and
 * live grant per kind, the vault's holdings on one Window, and a grant by id. No deployment → the port's honest null
 * and zeros; an owner who never opened an account reads zeros and no grants.
 */
import { GRANT_KINDS, VAULT_NOT_DEPLOYED, type GrantKind, type VaultGrant, type VaultHoldings, type VaultSnapshot } from "@agari/core/vault";
import type { Reading } from "@agari/core/schemas";
import type { Address, OnchainSnapshot } from "@agari/core/types";
import { withReading } from "../provider/reading";
import { readMarket, readSeries, readVenueStatic } from "../runtime/accounts";
import { notDeployedError } from "../stub/not-deployed";
import { NO_GRANT, readGrantAccount, readVaultAccount, sideOf, slotOf, tickBaseOf, toVaultGrant } from "./accounts";
import { loadVaultDeployment } from "./deployment";

export { resolveVaultDeployment, loadVaultDeployment } from "./deployment";
export { recoverVaultExecution, type RecoveredVaultExecution, type VaultExecutionEvidence } from "./recovery";

/** The Trading Balance and the live grant per kind: the account, then its live grants, in two batched reads. */
export async function getVaultSnapshot(wallet: Address): Promise<Reading<VaultSnapshot | null>> {
  return withReading(`vault:${wallet}`, async () => {
    const deployment = await loadVaultDeployment();
    if (!deployment) return null;
    const [account, venue] = await Promise.all([readVaultAccount(wallet), readVenueStatic()]);
    const grants: Record<GrantKind, VaultGrant | null> = { session: null, executor: null, strategy: null };
    if (account) {
      const tickBase = tickBaseOf(venue.decimals);
      const live = GRANT_KINDS.map((kind, i) => ({ kind, id: account.activeGrants[i] ?? NO_GRANT })).filter(({ id }) => id !== NO_GRANT);
      const read = await Promise.all(live.map(({ id }) => readGrantAccount(id)));
      live.forEach(({ kind }, i) => {
        const grant = read[i];
        grants[kind] = grant ? toVaultGrant(grant, tickBase) : null;
      });
    }
    return {
      deployment,
      account: {
        availableBase: account?.available ?? 0n,
        privateAvailableBase: account?.privateAvailable ?? 0n,
        totalDepositedBase: account?.totalDeposited ?? 0n,
        totalWithdrawnBase: account?.totalWithdrawn ?? 0n,
      },
      grants,
      decimals: venue.decimals,
    };
  });
}

/**
 * The outcome contracts the vault holds for the wallet on one Window and which grant opened each side:
 * `upRaw = yes_lots × lot_base`. A Window whose Market is gone has no live slot to read (the crank needs it alive).
 */
export async function getVaultHoldings(wallet: Address, onchain: OnchainSnapshot): Promise<Reading<VaultHoldings>> {
  return withReading(`vaultHoldings:${wallet}:${onchain.marketId}`, async () => {
    const empty: VaultHoldings = { marketId: onchain.marketId, upRaw: 0n, downRaw: 0n, upGrantId: NO_GRANT, downGrantId: NO_GRANT };
    if (!(await loadVaultDeployment())) return empty;
    const [account, market] = await Promise.all([readVaultAccount(wallet), readMarket(onchain.marketId)]);
    const slot = slotOf(account, onchain.marketId);
    if (!slot || !market) return empty;
    const { lotBase } = await readSeries(market.data.series);
    const up = sideOf(slot, 0);
    const down = sideOf(slot, 1);
    return { marketId: onchain.marketId, upRaw: up.lots * lotBase, downRaw: down.lots * lotBase, upGrantId: up.grantId, downGrantId: down.grantId };
  });
}

/** One grant as the vault records it; replaced and revoked grants stay readable for attribution. Throws when absent. */
export async function getVaultGrant(grantId: bigint): Promise<VaultGrant> {
  if (!(await loadVaultDeployment())) throw notDeployedError(VAULT_NOT_DEPLOYED);
  const [grant, venue] = await Promise.all([readGrantAccount(grantId), readVenueStatic()]);
  if (!grant) throw new Error(`agari-vault has no grant #${grantId}`);
  return toVaultGrant(grant, tickBaseOf(venue.decimals));
}
