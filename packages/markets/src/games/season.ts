import type { Reading } from "@masayume/core/schemas";
import type { Address, Hex } from "@masayume/core/types";
import { createWalletClient, http, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import masayume from "../addresses.masayume.json";
import { MULTICALL3_ADDRESS, SOMNIA_SHANNON, SOMNIA_SHANNON_ID } from "../chain";
import { seasonPrizePoolAbi } from "../contracts/season-prize-pool.abi";
import { withReading } from "../provider/reading";
import { getClient } from "../runtime/read-runtime";

/**
 * The season's prize escrow — `SeasonPrizePool` — read and paid out from one module, so exactly one
 * place knows its ABI (AD-10) and its one write lives where every chain write does (AD-3).
 */

interface Record {
  seasonPrizePool?: string;
  seasonPrizePoolFromBlock?: number | string;
}

const DEPLOYMENTS = (masayume as { deployments: globalThis.Record<string, Record> }).deployments;

export interface SeasonPoolDeployment {
  chainId: number;
  seasonPrizePool: Address;
  fromBlock: bigint;
}

/** Where the season's pool lives for a chain, or null when none is deployed there. */
export function resolveSeasonPoolDeployment(chainId: number = SOMNIA_SHANNON_ID): SeasonPoolDeployment | null {
  const record = DEPLOYMENTS[String(chainId)];
  const seasonPrizePool = record?.seasonPrizePool as Address | undefined;
  if (!seasonPrizePool) return null;
  return { chainId, seasonPrizePool, fromBlock: record?.seasonPrizePoolFromBlock !== undefined ? BigInt(record.seasonPrizePoolFromBlock) : 0n };
}

/** The pool as the chain holds it: what it escrows, what it was ever given, and whether it has paid. */
export interface SeasonPoolState {
  address: Address;
  seasonId: string;
  endsAtSec: number;
  admin: Address;
  balanceBase: bigint;
  depositedBase: bigint;
  distributed: boolean;
}

export async function getSeasonPool(): Promise<Reading<SeasonPoolState | null>> {
  return withReading("seasonPool", async () => {
    const deployment = resolveSeasonPoolDeployment();
    if (!deployment) return null;
    const contract = { address: deployment.seasonPrizePool, abi: seasonPrizePoolAbi } as const;
    const client = getClient().getViemClient() as PublicClient;
    const [seasonId, endsAtSec, admin, balance, deposited, distributed] = await client.multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: [
        { ...contract, functionName: "seasonId" },
        { ...contract, functionName: "endsAtSec" },
        { ...contract, functionName: "admin" },
        { ...contract, functionName: "balance" },
        { ...contract, functionName: "deposited" },
        { ...contract, functionName: "distributed" },
      ],
    });
    return {
      address: deployment.seasonPrizePool,
      seasonId: seasonId as string,
      endsAtSec: Number(endsAtSec),
      admin: (admin as string).toLowerCase() as Address,
      balanceBase: balance as bigint,
      depositedBase: deposited as bigint,
      distributed: distributed as boolean,
    };
  });
}

export interface DistributeSeasonInput {
  privateKey: Hex;
  rpcUrl: string;
  winners: readonly Address[];
  amountsBase: readonly bigint[];
  publicClient: PublicClient;
}

/**
 * The admin's one write: pay the winners and lock the pool. Simulated first, where viem decodes the
 * pool's own refusals (a second distribution, an over-spend, a mismatched list), then sent and waited on.
 */
export async function distributeSeasonPrizes({ privateKey, rpcUrl, winners, amountsBase, publicClient }: DistributeSeasonInput): Promise<Hex> {
  const deployment = resolveSeasonPoolDeployment();
  if (!deployment) throw new Error("no season prize pool is deployed on this network");
  const account = privateKeyToAccount(privateKey);
  const admin = createWalletClient({ account, chain: SOMNIA_SHANNON, transport: http(rpcUrl) });
  const { request } = await publicClient.simulateContract({
    address: deployment.seasonPrizePool,
    abi: seasonPrizePoolAbi,
    functionName: "distribute",
    args: [winners as Address[], amountsBase as bigint[]],
    account,
    chain: SOMNIA_SHANNON,
  });
  const hash = await admin.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  return hash;
}
