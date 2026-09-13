import type { Reading } from "@masayume/core/schemas";
import type { StrategyRecord, StrategySubscription } from "@masayume/core/strategies";
import type { Address } from "@masayume/core/types";
import type { PublicClient } from "viem";
import { MULTICALL3_ADDRESS } from "../chain";
import { strategyRegistryAbi } from "../contracts/strategy-registry.abi";
import { withReading } from "../provider/reading";
import { getClient } from "../runtime/read-runtime";
import { resolveRegistryDeployment } from "./deployment";

const PAGE = 100;
const MAX_STRATEGIES = 500;
const MAX_SUBSCRIBERS = 1_000;

/** Settlement cleanup must include every former subscriber, even after consent or grant ends. */
export async function listStrategySubscribers(strategyId: bigint): Promise<Address[]> {
  const contract = registryContract();
  if (!contract) return [];
  const client = viem();
  const total = Number(await client.readContract({ ...contract, functionName: "subscriberCountOf", args: [strategyId] }));
  const owners: Address[] = [];
  for (let offset = 0; offset < total; offset += PAGE) {
    const page = await client.readContract({ ...contract, functionName: "subscribersOf", args: [strategyId, BigInt(offset), BigInt(Math.min(PAGE, total - offset))] });
    owners.push(...page.map((owner) => owner.toLowerCase() as Address));
  }
  return owners;
}

type StrategyTuple = {
  creator: Address;
  runner: Address;
  specHash: `0x${string}`;
  metadata: string;
  envelope: { maxStakePerTrade: bigint; maxDailySpend: bigint; maxOpenPositions: number; maxPriceRaw: bigint };
  subscriptionFee: bigint;
  active: boolean;
  createdAtSec: bigint;
  subscribers: number;
  revision: number;
};

function viem(): PublicClient {
  return getClient().getViemClient() as PublicClient;
}

function registryContract() {
  const deployment = resolveRegistryDeployment();
  return deployment ? ({ address: deployment.strategyRegistry, abi: strategyRegistryAbi } as const) : null;
}

export function toStrategyRecord(strategyId: bigint, s: StrategyTuple): StrategyRecord {
  return {
    strategyId,
    creator: s.creator.toLowerCase() as Address,
    runner: s.runner.toLowerCase() as Address,
    specHash: s.specHash,
    metadata: s.metadata,
    envelope: {
      maxStakePerTradeBase: s.envelope.maxStakePerTrade,
      maxDailySpendBase: s.envelope.maxDailySpend,
      maxOpenPositions: s.envelope.maxOpenPositions,
      maxPriceRaw: s.envelope.maxPriceRaw,
    },
    feeBase: s.subscriptionFee,
    active: s.active,
    createdAtSec: Number(s.createdAtSec),
    subscribers: s.subscribers,
    revision: s.revision,
  };
}

/** Every published strategy, in publication order; null where no registry is deployed. */
export async function listStrategies(): Promise<Reading<StrategyRecord[] | null>> {
  return withReading("strategies", async () => {
    const contract = registryContract();
    if (!contract) return null;
    const client = viem();
    const count = Math.min(Number(await client.readContract({ ...contract, functionName: "strategyCount" })), MAX_STRATEGIES);
    const out: StrategyRecord[] = [];
    for (let start = 1; start <= count; start += PAGE) {
      const ids = Array.from({ length: Math.min(PAGE, count - start + 1) }, (_, i) => BigInt(start + i));
      const rows = await client.multicall({
        multicallAddress: MULTICALL3_ADDRESS,
        allowFailure: false,
        contracts: ids.map((id) => ({ ...contract, functionName: "strategyOf", args: [id] }) as const),
      });
      rows.forEach((row, i) => out.push(toStrategyRecord(ids[i] as bigint, row as StrategyTuple)));
    }
    return out;
  });
}

export async function getStrategy(strategyId: bigint): Promise<Reading<StrategyRecord | null>> {
  return withReading(`strategy:${strategyId}`, async () => {
    const contract = registryContract();
    if (!contract) return null;
    const row = await viem().readContract({ ...contract, functionName: "strategyOf", args: [strategyId] });
    return toStrategyRecord(strategyId, row as StrategyTuple);
  });
}

/** One wallet's subscriptions across every strategy, live-ness read from the registry's own view. */
export async function listSubscriptionsOf(wallet: Address, strategyIds: readonly bigint[]): Promise<Reading<StrategySubscription[]>> {
  return withReading(`subscriptions:${wallet}`, async () => {
    const contract = registryContract();
    if (!contract || strategyIds.length === 0) return [];
    const rows = await viem().multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: strategyIds.flatMap((id) => [
        { ...contract, functionName: "subscriptionOf", args: [id, wallet] } as const,
        { ...contract, functionName: "isSubscriptionLive", args: [id, wallet] } as const,
      ]),
    });
    const out: StrategySubscription[] = [];
    strategyIds.forEach((strategyId, i) => {
      const sub = rows[i * 2] as { grantId: bigint; subscribedAtSec: bigint; active: boolean };
      const live = rows[i * 2 + 1] as boolean;
      if (sub.subscribedAtSec === 0n) return;
      out.push({ strategyId, subscriber: wallet, grantId: sub.grantId, subscribedAtSec: Number(sub.subscribedAtSec), active: sub.active, live });
    });
    return out;
  });
}

/** Everyone the runner may act for right now: consent on record and a live grant to it. */
export async function listLiveSubscribers(strategyId: bigint): Promise<Reading<StrategySubscription[]>> {
  return withReading(`subscribers:${strategyId}`, async () => {
    const contract = registryContract();
    if (!contract) return [];
    const client = viem();
    const total = Math.min(Number(await client.readContract({ ...contract, functionName: "subscriberCountOf", args: [strategyId] })), MAX_SUBSCRIBERS);
    const wallets: Address[] = [];
    for (let offset = 0; offset < total; offset += PAGE) {
      const page = await client.readContract({ ...contract, functionName: "subscribersOf", args: [strategyId, BigInt(offset), BigInt(Math.min(PAGE, total - offset))] });
      wallets.push(...(page as readonly Address[]));
    }
    if (wallets.length === 0) return [];
    const rows = await client.multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: wallets.flatMap((w) => [
        { ...contract, functionName: "subscriptionOf", args: [strategyId, w] } as const,
        { ...contract, functionName: "isSubscriptionLive", args: [strategyId, w] } as const,
      ]),
    });
    return wallets
      .map((subscriber, i) => {
        const sub = rows[i * 2] as { grantId: bigint; subscribedAtSec: bigint; active: boolean };
        return { strategyId, subscriber: subscriber.toLowerCase() as Address, grantId: sub.grantId, subscribedAtSec: Number(sub.subscribedAtSec), active: sub.active, live: rows[i * 2 + 1] as boolean };
      })
      .filter((s) => s.live);
  });
}
