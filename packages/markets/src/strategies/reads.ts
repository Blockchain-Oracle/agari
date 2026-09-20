import { fetchAllMaybeStrategy, fetchAllMaybeSubscription, fetchMaybeRegistry, fetchMaybeStrategy, getSubscriptionDecoder, type Strategy, type Subscription } from "@agari/clients/agari-strategy";
import type { Reading } from "@agari/core/schemas";
import type { StrategyRecord, StrategySubscription } from "@agari/core/strategies";
import type { Address, Hex } from "@agari/core/types";
import { getBase58Decoder, getBase64Encoder, getU64Encoder, type Base58EncodedBytes } from "@solana/kit";
import { nowSec } from "../provider/clock";
import { withReading } from "../provider/reading";
import { solana } from "../runtime/solana";
import { readGrantAccount, tickBaseOf } from "../vault/accounts";
import { kit, registryAddress, strategyAddress, strategyProgramId, subscriptionAddress } from "./deployment";

/** tUSDC, the venue's one collateral: the scale the envelope's price ceiling is reported on. */
const COLLATERAL_DECIMALS = 6;
/** `agari-vault`'s STRATEGY grant kind, the only one that can back a subscription. */
const GRANT_KIND_STRATEGY = 2;
/** `Subscription` is fixed-width: 8 discriminator + 8 + 32 + 32 + 8 + 8 + 1 + 1. `strategy_id` is its first field. */
const SUBSCRIPTION_BYTES = 98n;
const STRATEGY_ID_OFFSET = 8n;

const hex = (bytes: ArrayLike<number>) => `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;

/** A sealed strategy in core terms. An unsealed one is text still being written, which nobody can subscribe to. */
function recordOf(data: Strategy): StrategyRecord | null {
  if (!data.sealed) return null;
  return {
    strategyId: data.strategyId,
    creator: data.creator as string as Address,
    runner: data.runner as string as Address,
    specHash: hex(data.specHash),
    metadata: new TextDecoder().decode(new Uint8Array(data.metadata)),
    envelope: {
      maxStakePerTradeBase: data.envelope.maxStakePerTrade,
      maxDailySpendBase: data.envelope.maxDailySpend,
      maxOpenPositions: data.envelope.maxOpenPositions,
      maxPriceRaw: BigInt(data.envelope.maxPriceTicks) * tickBaseOf(COLLATERAL_DECIMALS),
    },
    feeBase: data.subscriptionFeeBase,
    active: data.active,
    createdAtSec: Number(data.createdAtSec),
    subscribers: data.subscribers,
    revision: data.revision,
  };
}

/** Every sealed strategy, oldest first. `null` inside the reading where no registry exists on this cluster. */
export function listStrategies(): Promise<Reading<StrategyRecord[] | null>> {
  return withReading("strategies:list", async () => {
    const registry = await fetchMaybeRegistry(solana().rpc, kit(await registryAddress()));
    if (!registry.exists) return null;
    const ids: bigint[] = [];
    for (let id = 1n; id < registry.data.nextStrategyId; id += 1n) ids.push(id);
    const accounts = await fetchAllMaybeStrategy(solana().rpc, await Promise.all(ids.map(async (id) => kit(await strategyAddress(id)))));
    return accounts.flatMap((account) => (account.exists ? [recordOf(account.data)] : [])).filter((record): record is StrategyRecord => record !== null);
  });
}

export function getStrategy(strategyId: bigint): Promise<Reading<StrategyRecord | null>> {
  return withReading(`strategies:one:${strategyId}`, async () => {
    const account = await fetchMaybeStrategy(solana().rpc, kit(await strategyAddress(strategyId)));
    return account.exists ? recordOf(account.data) : null;
  });
}

/**
 * Consent on record AND a grant the runner may act on now: the subscriber's, a strategy grant, to this runner, not
 * revoked and not expired. It is the program's own `eligible_grant` less the envelope, which was checked at subscribe.
 */
async function toSubscription(data: Subscription, runner: Address | null): Promise<StrategySubscription> {
  const grant = data.active ? await readGrantAccount(data.grantId) : null;
  const live = grant !== null
    && grant.owner === data.subscriber
    && grant.kind === GRANT_KIND_STRATEGY
    && (runner === null || (grant.actor as string) === runner)
    && grant.revoked === 0
    && BigInt(nowSec()) <= grant.expiresAtSec;
  return {
    strategyId: data.strategyId,
    subscriber: data.subscriber as string as Address,
    grantId: data.grantId,
    subscribedAtSec: Number(data.subscribedAtSec),
    active: data.active,
    live,
  };
}

async function runnerOf(strategyId: bigint): Promise<Address | null> {
  const account = await fetchMaybeStrategy(solana().rpc, kit(await strategyAddress(strategyId)));
  return account.exists ? (account.data.runner as string as Address) : null;
}

/** One wallet's consent records across the given strategies; a strategy it never subscribed to is simply absent. */
export function listSubscriptionsOf(wallet: Address, strategyIds: readonly bigint[]): Promise<Reading<StrategySubscription[]>> {
  return withReading(`strategies:subs:${wallet}:${strategyIds.join(",")}`, async () => {
    if (strategyIds.length === 0) return [];
    const accounts = await fetchAllMaybeSubscription(solana().rpc, await Promise.all(strategyIds.map(async (id) => kit(await subscriptionAddress(id, wallet)))));
    const found = accounts.flatMap((account) => (account.exists ? [account.data] : []));
    return Promise.all(found.map(async (data) => toSubscription(data, await runnerOf(data.strategyId))));
  });
}

/** Every Subscription account of one strategy, found by its `strategy_id` prefix rather than by paging wallets. */
async function subscriptionsOfStrategy(strategyId: bigint): Promise<Subscription[]> {
  const prefix = getBase58Decoder().decode(getU64Encoder().encode(strategyId)) as Base58EncodedBytes;
  const rows = await solana().rpc
    .getProgramAccounts(kit(strategyProgramId()), {
      encoding: "base64",
      filters: [{ dataSize: SUBSCRIPTION_BYTES }, { memcmp: { offset: STRATEGY_ID_OFFSET, bytes: prefix, encoding: "base58" } }],
    })
    .send();
  const decoder = getSubscriptionDecoder();
  return rows.map((row) => decoder.decode(getBase64Encoder().encode(row.account.data[0])));
}

/** The subscribers a runner may act for right now. */
export function listLiveSubscribers(strategyId: bigint): Promise<Reading<StrategySubscription[]>> {
  return withReading(`strategies:live:${strategyId}`, async () => {
    const [all, runner] = await Promise.all([subscriptionsOfStrategy(strategyId), runnerOf(strategyId)]);
    const subscriptions = await Promise.all(all.map((data) => toSubscription(data, runner)));
    return subscriptions.filter((subscription) => subscription.live);
  });
}

/** Everyone who ever subscribed; read `listSubscriptionsOf` for who still is. */
export async function listStrategySubscribers(strategyId: bigint): Promise<Address[]> {
  return (await subscriptionsOfStrategy(strategyId)).map((data) => data.subscriber as string as Address);
}
