import {
  AGARI_MAKER_PROGRAM_ADDRESS, fetchMaybeMakerVault, fetchMaybeProvider, fetchMaybeWindowBook,
  findCustodyPda, findVaultPda,
} from "@agari/clients/agari-maker";
import type { MakerDeployment, MakerParams, MakerVaultState, MakerWindowView } from "@agari/core/maker";
import type { Reading } from "@agari/core/schemas";
import type { Address, MarketId } from "@agari/core/types";
import { fetchEncodedAccount, getAddressEncoder, getProgramDerivedAddress, type Address as KitAddress } from "@solana/kit";
import { withReading } from "../provider/reading";
import { peekClient } from "../runtime/read-runtime";
import { solana } from "../runtime/solana";

const kit = (value: string) => value as KitAddress;
/** The SPL token account `amount` u64 — idle custody, which total value is measured from. */
const TOKEN_AMOUNT_OFFSET = 64;
const BPS = 10_000n;
const ONE = 1_000_000n;

export function makerProgramId(): Address {
  return peekClient()?.makerProgramId ?? (AGARI_MAKER_PROGRAM_ADDRESS as string as Address);
}

async function custodyBalance(): Promise<bigint> {
  const [custody] = await findCustodyPda({ programAddress: kit(makerProgramId()) });
  const account = await fetchEncodedAccount(solana().rpc, custody);
  if (!account.exists || account.data.byteLength < TOKEN_AMOUNT_OFFSET + 8) return 0n;
  const view = new DataView(account.data.buffer, account.data.byteOffset, account.data.byteLength);
  return view.getBigUint64(TOKEN_AMOUNT_OFFSET, true);
}

export async function windowBookAddress(marketId: MarketId): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: kit(makerProgramId()),
    seeds: [new TextEncoder().encode("window"), getAddressEncoder().encode(kit(marketId))],
  });
  return pda as string as Address;
}

export async function providerAddress(wallet: Address): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: kit(makerProgramId()),
    seeds: [new TextEncoder().encode("provider"), getAddressEncoder().encode(kit(wallet))],
  });
  return pda as string as Address;
}

function paramsOf(raw: {
  maxExposureBps: number; minSpreadTicks: number; minPriceTicks: number; maxPriceTicks: number;
  maxQuantityLots: bigint; maxWindowDeployedBase: bigint; maxOpenWindows: number; minTimeLeftSec: number;
}): MakerParams {
  return {
    maxExposureBps: raw.maxExposureBps,
    minSpreadRaw: BigInt(raw.minSpreadTicks),
    minPriceRaw: BigInt(raw.minPriceTicks),
    maxPriceRaw: BigInt(raw.maxPriceTicks),
    maxQuantityRaw: raw.maxQuantityLots,
    maxWindowDeployedBase: raw.maxWindowDeployedBase,
    maxOpenWindows: raw.maxOpenWindows,
    minTimeLeftSec: raw.minTimeLeftSec,
  };
}

export const resolveMakerDeployment = (): MakerDeployment | null => {
  const program = makerProgramId();
  return program ? { chainId: 0, marketMakerVault: program, fromBlock: 0n } : null;
};

/**
 * The vault's balance sheet.
 *
 * Total value is idle custody plus what the venue holds, so a provider's claim does not move when the maker
 * quotes — only when a Window settles for or against the vault. Custody is read from the token account itself
 * rather than a mirrored counter: a number the program keeps beside the money can drift from it.
 */
export function getMakerVaultState(): Promise<Reading<MakerVaultState | null>> {
  return withReading("maker:vault", async () => {
    const [address] = await findVaultPda({ programAddress: kit(makerProgramId()) });
    const account = await fetchMaybeMakerVault(solana().rpc, address);
    if (!account.exists) return null;
    const custody = await custodyBalance();
    const deployed = account.data.deployedBase;
    const total = custody + deployed;
    const shares = account.data.supplyShares;
    return {
      deployment: { chainId: 0, marketMakerVault: address as string as Address, fromBlock: 0n },
      params: paramsOf(account.data.params),
      maker: account.data.maker as string as Address,
      paused: account.data.paused,
      liquidBase: custody,
      deployedBase: deployed,
      totalValueBase: total,
      sharePriceRaw: shares > 0n ? (total * ONE) / shares : ONE,
      utilizationBps: total > 0n ? Number((deployed * BPS) / total) : 0,
      supplyShares: shares,
      openWindows: [],
      decimals: 6,
    } satisfies MakerVaultState;
  });
}

function viewOf(marketId: MarketId, data: {
  escrowOutBase: bigint; escrowBackBase: bigint; mergedBase: bigint; payoutBase: bigint;
  openedAtSec: bigint; settledAtSec: bigint; quoteCount: number; settled: boolean;
}): MakerWindowView {
  const deployed = data.escrowOutBase - data.escrowBackBase - data.mergedBase - data.payoutBase;
  return {
    marketId,
    escrowOutBase: data.escrowOutBase,
    escrowBackBase: data.escrowBackBase,
    mergedBase: data.mergedBase,
    payoutBase: data.payoutBase,
    openedAtSec: Number(data.openedAtSec),
    settledAtSec: data.settledAtSec > 0n ? Number(data.settledAtSec) : null,
    quoteCount: data.quoteCount,
    settled: data.settled,
    yesRaw: 0n,
    noRaw: 0n,
    deployedBase: deployed > 0n ? deployed : 0n,
    realizedBase: data.settled
      ? data.escrowBackBase + data.mergedBase + data.payoutBase - data.escrowOutBase
      : null,
  };
}

/** One Window's book, for the Earn table. */
export function getMakerWindow(marketId: MarketId): Promise<Reading<MakerWindowView | null>> {
  return withReading(`maker:window:${marketId}`, async () => {
    const account = await fetchMaybeWindowBook(solana().rpc, kit(await windowBookAddress(marketId)));
    return account.exists ? viewOf(marketId, account.data) : null;
  });
}

/** A provider's shares and what they are worth at the vault's current value. */
export function getMakerSharesOf(wallet: Address): Promise<Reading<{ shares: bigint; worthBase: bigint }>> {
  return withReading(`maker:shares:${wallet}`, async () => {
    const [vaultPda] = await findVaultPda({ programAddress: kit(makerProgramId()) });
    const [position, vault] = await Promise.all([
      fetchMaybeProvider(solana().rpc, kit(await providerAddress(wallet))),
      fetchMaybeMakerVault(solana().rpc, vaultPda),
    ]);
    if (!position.exists || !vault.exists || vault.data.supplyShares === 0n) return { shares: 0n, worthBase: 0n };
    const total = (await custodyBalance()) + vault.data.deployedBase;
    return { shares: position.data.shares, worthBase: (position.data.shares * total) / vault.data.supplyShares };
  });
}
