import { deployedOf, realizedOf, type MakerParams, type MakerVaultState, type MakerWindowBook, type MakerWindowView } from "@masayume/core/maker";
import type { Reading } from "@masayume/core/schemas";
import { toMarketId, type Address, type MarketId } from "@masayume/core/types";
import type { PublicClient } from "viem";
import { MULTICALL3_ADDRESS } from "../chain";
import { getCollateral } from "../collateral";
import { marketMakerVaultAbi } from "../contracts/market-maker-vault.abi";
import { withReading } from "../provider/reading";
import { getClient, getMakerDeployment } from "../runtime/read-runtime";

const BPS = 10_000n;
const ZERO = "0x0000000000000000000000000000000000000000";

type BookTuple = { escrowOut: bigint; escrowBack: bigint; merged: bigint; payout: bigint; openedAtSec: bigint; settledAtSec: bigint; quoteCount: number; settled: boolean };
/** The public `params` getter flattens the struct into a tuple, in declaration order. */
type ParamsTuple = readonly [number, bigint, bigint, bigint, bigint, bigint, number, number];

function viem(): PublicClient {
  return getClient().getViemClient() as PublicClient;
}

function vaultContract() {
  const deployment = getMakerDeployment();
  return deployment ? ({ address: deployment.marketMakerVault, abi: marketMakerVaultAbi } as const) : null;
}

export function toMakerParams(p: ParamsTuple): MakerParams {
  return {
    maxExposureBps: p[0],
    minSpreadRaw: p[1],
    minPriceRaw: p[2],
    maxPriceRaw: p[3],
    maxQuantityRaw: p[4],
    maxWindowDeployedBase: p[5],
    maxOpenWindows: p[6],
    minTimeLeftSec: p[7],
  };
}

export function toMakerBook(marketId: MarketId, b: BookTuple): MakerWindowBook {
  return {
    marketId,
    escrowOutBase: b.escrowOut,
    escrowBackBase: b.escrowBack,
    mergedBase: b.merged,
    payoutBase: b.payout,
    openedAtSec: Number(b.openedAtSec),
    settledAtSec: b.settledAtSec === 0n ? null : Number(b.settledAtSec),
    quoteCount: b.quoteCount,
    settled: b.settled,
  };
}

/** The vault's sheet, tunables and open Windows in one multicall; null where no vault is deployed. */
export async function getMakerVaultState(): Promise<Reading<MakerVaultState | null>> {
  return withReading("makerVault", async () => {
    const deployment = getMakerDeployment();
    const contract = vaultContract();
    if (!deployment || !contract) return null;
    const [params, maker, paused, liquid, deployed, supplyShares, sharePrice, open] = await viem().multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: [
        { ...contract, functionName: "params" },
        { ...contract, functionName: "maker" },
        { ...contract, functionName: "paused" },
        { ...contract, functionName: "liquid" },
        { ...contract, functionName: "totalDeployed" },
        { ...contract, functionName: "supplyShares" },
        { ...contract, functionName: "sharePriceRaw" },
        { ...contract, functionName: "openWindows" },
      ],
    });
    const totalValueBase = liquid + deployed;
    return {
      deployment,
      params: toMakerParams(params as ParamsTuple),
      maker: maker.toLowerCase() === ZERO ? null : (maker.toLowerCase() as Address),
      paused,
      liquidBase: liquid,
      deployedBase: deployed,
      totalValueBase,
      sharePriceRaw: sharePrice,
      utilizationBps: totalValueBase === 0n ? 0 : Number((deployed * BPS) / totalValueBase),
      supplyShares,
      openWindows: open.map((id) => toMarketId(id)),
      decimals: getCollateral().decimals,
    };
  });
}

async function viewsByIds(ids: readonly MarketId[]): Promise<MakerWindowView[]> {
  const contract = vaultContract();
  if (!contract || ids.length === 0) return [];
  const rows = await viem().multicall({
    multicallAddress: MULTICALL3_ADDRESS,
    allowFailure: false,
    contracts: ids.flatMap((id) => [
      { ...contract, functionName: "bookOf", args: [id as `0x${string}`] } as const,
      { ...contract, functionName: "inventoryOf", args: [id as `0x${string}`] } as const,
    ]),
  });
  return ids.map((id, i) => {
    const book = toMakerBook(id, rows[i * 2] as BookTuple);
    const [yes, no] = rows[i * 2 + 1] as readonly [bigint, bigint];
    return { ...book, yesRaw: yes, noRaw: no, deployedBase: deployedOf(book), realizedBase: realizedOf(book) };
  });
}

/** Every Window the vault is quoting or holding inventory on, with its flow and its live inventory. */
export async function listMakerOpenWindows(): Promise<Reading<MakerWindowView[]>> {
  return withReading("makerOpen", async () => {
    const contract = vaultContract();
    if (!contract) return [];
    const open = await viem().readContract({ ...contract, functionName: "openWindows" });
    return viewsByIds(open.map((id) => toMarketId(id)));
  });
}

/** The vault's Windows, newest first, paged — settled ones carry their realized result. */
export async function listMakerHistory(limit = 20, offset = 0): Promise<Reading<MakerWindowView[]>> {
  return withReading(`makerHistory:${offset}:${limit}`, async () => {
    const contract = vaultContract();
    if (!contract) return [];
    const client = viem();
    const total = Number(await client.readContract({ ...contract, functionName: "windowCount" }));
    if (total === 0) return [];
    const end = Math.max(0, total - offset);
    const start = Math.max(0, end - limit);
    if (end <= start) return [];
    const page = await client.readContract({ ...contract, functionName: "windowsAt", args: [BigInt(start), BigInt(end - start)] });
    const views = await viewsByIds(page.map((id) => toMarketId(id)));
    return views.reverse();
  });
}

/** A supplier's shares and what they are worth of the vault's total value right now. */
export async function getMakerSharesOf(wallet: Address): Promise<Reading<{ shares: bigint; worthBase: bigint }>> {
  return withReading(`makerShares:${wallet}`, async () => {
    const contract = vaultContract();
    if (!contract) return { shares: 0n, worthBase: 0n };
    const [shares, supplyShares, totalValue] = await viem().multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: [
        { ...contract, functionName: "sharesOf", args: [wallet] },
        { ...contract, functionName: "supplyShares" },
        { ...contract, functionName: "totalValue" },
      ],
    });
    return { shares, worthBase: supplyShares === 0n ? 0n : (shares * totalValue) / supplyShares };
  });
}

/** The first open Window past its expiry and unsettled, or null — what a withdrawal has to crank first. */
export async function getMakerUnsettledExpired(): Promise<Reading<MarketId | null>> {
  return withReading("makerUnsettled", async () => {
    const contract = vaultContract();
    if (!contract) return null;
    const id = await viem().readContract({ ...contract, functionName: "unsettledExpired" });
    return BigInt(id) === 0n ? null : toMarketId(id);
  });
}
