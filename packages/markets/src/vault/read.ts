import type { Reading } from "@masayume/core/schemas";
import type { Address, OnchainSnapshot } from "@masayume/core/types";
import { grantKindOf, GRANT_KINDS, type GrantKind, type VaultGrant, type VaultHoldings, type VaultSnapshot } from "@masayume/core/vault";
import type { PublicClient } from "viem";
import { MULTICALL3_ADDRESS } from "../chain";
import { getCollateral } from "../collateral";
import { eventVaultAbi } from "../contracts/event-vault.abi";
import { withReading } from "../provider/reading";
import { getClient, getVaultDeployment } from "../runtime/read-runtime";

type GrantTuple = {
  owner: Address;
  actor: Address;
  kind: number;
  revoked: boolean;
  expiresAtSec: bigint;
  spentDay: bigint;
  openPositions: number;
  caps: { maxStakePerTrade: bigint; maxDailySpend: bigint; maxOpenPositions: number; maxPriceRaw: bigint };
  budget: bigint;
  spentToday: bigint;
};

function viem(): PublicClient {
  return getClient().getViemClient() as PublicClient;
}

export function toVaultGrant(grantId: bigint, g: GrantTuple): VaultGrant {
  return {
    grantId,
    owner: g.owner.toLowerCase() as Address,
    actor: g.actor.toLowerCase() as Address,
    kind: grantKindOf(g.kind),
    revoked: g.revoked,
    expiresAtSec: Number(g.expiresAtSec),
    spentDay: Number(g.spentDay),
    spentTodayBase: g.spentToday,
    openPositions: g.openPositions,
    caps: {
      maxStakePerTradeBase: g.caps.maxStakePerTrade,
      maxDailySpendBase: g.caps.maxDailySpend,
      maxOpenPositions: g.caps.maxOpenPositions,
      maxPriceRaw: g.caps.maxPriceRaw,
    },
    budgetBase: g.budget,
  };
}

/** Historical grants remain readable after replacement/revocation for position attribution. */
export async function getVaultGrant(grantId: bigint): Promise<VaultGrant> {
  const deployment = getVaultDeployment();
  if (!deployment) throw new Error("EventVault is not deployed");
  const grant = await viem().readContract({ address: deployment.eventVault, abi: eventVaultAbi, functionName: "grantOf", args: [grantId] });
  return toVaultGrant(grantId, grant);
}

/** The Trading Balance and the live grant per kind, in two batched reads; null where no vault is deployed. */
export async function getVaultSnapshot(wallet: Address): Promise<Reading<VaultSnapshot | null>> {
  return withReading(`vault:${wallet}`, async () => {
    const deployment = getVaultDeployment();
    if (!deployment) return null;
    const contract = { address: deployment.eventVault, abi: eventVaultAbi } as const;
    const client = viem();
    const [account, sessionId, executorId, strategyId] = await client.multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: [
        { ...contract, functionName: "accountOf", args: [wallet] },
        { ...contract, functionName: "activeGrantOf", args: [wallet, 0] },
        { ...contract, functionName: "activeGrantOf", args: [wallet, 1] },
        { ...contract, functionName: "activeGrantOf", args: [wallet, 2] },
      ],
    });
    const ids = [sessionId, executorId, strategyId];
    const live = ids.map((id, i) => ({ kind: GRANT_KINDS[i] as GrantKind, id })).filter(({ id }) => id !== 0n);
    const tuples = live.length
      ? await client.multicall({
          multicallAddress: MULTICALL3_ADDRESS,
          allowFailure: false,
          contracts: live.map(({ id }) => ({ ...contract, functionName: "grantOf", args: [id] }) as const),
        })
      : [];
    const grants: Record<GrantKind, VaultGrant | null> = { session: null, executor: null, strategy: null };
    live.forEach(({ kind, id }, i) => {
      grants[kind] = toVaultGrant(id, tuples[i] as GrantTuple);
    });
    return {
      deployment,
      account: {
        availableBase: account.available,
        privateAvailableBase: account.privateAvailable,
        totalDepositedBase: account.totalDeposited,
        totalWithdrawnBase: account.totalWithdrawn,
      },
      grants,
      decimals: getCollateral().decimals,
    };
  });
}

/** Outcome tokens the vault holds for the wallet on one Window; zeros without a vault, never an error. */
export async function getVaultHoldings(wallet: Address, onchain: OnchainSnapshot): Promise<Reading<VaultHoldings>> {
  return withReading(`vaultHoldings:${wallet}:${onchain.marketId}`, async () => {
    const deployment = getVaultDeployment();
    const empty: VaultHoldings = { marketId: onchain.marketId, upRaw: 0n, downRaw: 0n, upGrantId: 0n, downGrantId: 0n };
    if (!deployment) return empty;
    const contract = { address: deployment.eventVault, abi: eventVaultAbi } as const;
    const [upRaw, downRaw, upGrantId, downGrantId] = await viem().multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: [
        { ...contract, functionName: "positionOf", args: [wallet, onchain.yesId] },
        { ...contract, functionName: "positionOf", args: [wallet, onchain.noId] },
        { ...contract, functionName: "positionGrantOf", args: [wallet, onchain.yesId] },
        { ...contract, functionName: "positionGrantOf", args: [wallet, onchain.noId] },
      ],
    });
    return { marketId: onchain.marketId, upRaw, downRaw, upGrantId, downGrantId };
  });
}
