import { fetchMaybeLeverageReserve, fetchMaybePosition, fetchMaybeProvider, fetchMaybeWindowBook, getPositionDecoder, getPositionSize, type Position } from "@agari/clients/agari-leverage";
import { isKnockable, knockoutLine, leverageStatusOf, markOverLevels, type LeverageMark, type LeverageParams, type LeveragePosition, type LeverageReserveState } from "@agari/core/leverage";
import type { ProviderShares } from "@agari/core/reserves";
import type { Reading } from "@agari/core/schemas";
import { diagnosis, type Address, type MarketId } from "@agari/core/types";
import { fetchEncodedAccount, getBase64Encoder, type Base58EncodedBytes } from "@solana/kit";
import { ReadingError } from "../errors/reading-error";
import { withReading } from "../provider/reading";
import { solana } from "../runtime/solana";
import { readBoostBook } from "./book";
import { custodyAddress, kit, leverageProgramId, positionAddress, providerAddress, reserveAddress, windowBookAddress } from "./deployment";

const BPS = 10_000n;
/** The SPL token account `amount` u64: custody's balance, which the reserve's value is measured against. */
const TOKEN_AMOUNT_OFFSET = 64;
/** `Position.owner` follows the 8-byte account discriminator. */
const OWNER_OFFSET = 8n;

export async function custodyBalance(): Promise<bigint> {
  const account = await fetchEncodedAccount(solana().rpc, kit(await custodyAddress()));
  if (!account.exists) return 0n;
  const view = new DataView(account.data.buffer, account.data.byteOffset, account.data.byteLength);
  return account.data.byteLength >= TOKEN_AMOUNT_OFFSET + 8 ? view.getBigUint64(TOKEN_AMOUNT_OFFSET, true) : 0n;
}

type RawParams = {
  maxLeverageBps: number; premiumBps: number; maintenanceBps: number; maxExposureBps: number; maxOpenPositions: number;
  minTimeLeftSec: number; minEntryPriceRaw: bigint; maxEntryPriceRaw: bigint; maxFrontedPerPositionBase: bigint; maxWindowFrontedBase: bigint;
};

export const paramsOf = (raw: RawParams): LeverageParams => ({ ...raw });

/** The reserve account with custody's balance beside it: the two reads every figure here is derived from. */
export async function readReserve() {
  const address = await reserveAddress();
  const [account, custody] = await Promise.all([fetchMaybeLeverageReserve(solana().rpc, kit(address)), custodyBalance()]);
  if (!account.exists) return null;
  const owed = account.data.userOwedBase;
  const liquidBase = custody > owed ? custody - owed : 0n;
  const openPositions = account.data.open.filter((slot) => slot.positionId !== 0n).length;
  return { address, data: account.data, custody, liquidBase, totalValueBase: liquidBase + account.data.outstandingBase, openPositions };
}

/** What the reserve has already fronted on one Window; zero when no boost has been opened there. */
export async function windowFrontedBase(marketId: MarketId): Promise<bigint> {
  const account = await fetchMaybeWindowBook(solana().rpc, kit(await windowBookAddress(marketId)));
  return account.exists ? account.data.frontedBase : 0n;
}

/**
 * The reserve's balance sheet, as the chain holds it.
 *
 * Liquid capital is custody's own token balance less what the reserve owes owners, so it is read from the token
 * account rather than a mirrored counter: a number the program derives cannot drift from the money. `null`, not an
 * error, when the reserve does not exist on this cluster.
 */
export function getLeverageReserveState(): Promise<Reading<LeverageReserveState | null>> {
  return withReading("leverage:reserve", async () => {
    if (!leverageProgramId()) return null;
    const reserve = await readReserve();
    if (!reserve) return null;
    const { data, liquidBase, totalValueBase } = reserve;
    return {
      deployment: { chainId: 0, leverageReserve: reserve.address, fromBlock: 0n },
      params: paramsOf(data.params),
      liquidBase,
      outstandingBase: data.outstandingBase,
      totalValueBase,
      utilizationBps: totalValueBase > 0n ? Number((data.outstandingBase * BPS) / totalValueBase) : 0,
      supplyShares: data.supplyShares,
      paused: data.paused,
      openPositions: reserve.openPositions,
      decimals: 6,
    } satisfies LeverageReserveState;
  });
}

function positionOf(raw: Position): LeveragePosition {
  return {
    positionId: raw.positionId,
    owner: raw.owner as string as Address,
    status: leverageStatusOf(Number(raw.status)),
    side: raw.outcome === 0 ? "up" : "down",
    leverageBps: raw.leverageBps,
    marketId: raw.market as string as MarketId,
    openedAtSec: Number(raw.openedAtSec),
    expirySec: Number(raw.expirySec),
    exitedAtSec: raw.exitedAtSec > 0n ? Number(raw.exitedAtSec) : null,
    quantityRaw: raw.lots * raw.lotBase,
    stakeBase: raw.stakeBase,
    frontedBase: raw.frontedBase,
    premiumBase: raw.premiumBase,
    entryPriceRaw: raw.entryPriceRaw,
    proceedsBase: raw.proceedsBase,
    reclaimedBase: raw.reclaimedBase,
    returnedBase: raw.returnedBase,
    owedBase: raw.owedBase,
  };
}

export async function readPosition(positionId: bigint): Promise<Position | null> {
  const account = await fetchMaybePosition(solana().rpc, kit(await positionAddress(positionId)));
  return account.exists ? account.data : null;
}

export function getLeveragePosition(positionId: bigint): Promise<Reading<LeveragePosition | null>> {
  return withReading(`leverage:position:${positionId}`, async () => {
    if (!leverageProgramId()) return null;
    const raw = await readPosition(positionId);
    return raw ? positionOf(raw) : null;
  });
}

/** One wallet's positions, newest first: every Position account whose `owner` is this wallet, whatever its state. */
export function listLeveragePositionsOf(wallet: Address): Promise<Reading<LeveragePosition[]>> {
  return withReading(`leverage:positions:${wallet}`, async () => {
    if (!leverageProgramId()) return [];
    const rows = await solana().rpc
      .getProgramAccounts(kit(leverageProgramId()), {
        encoding: "base64",
        filters: [{ dataSize: BigInt(getPositionSize()) }, { memcmp: { offset: OWNER_OFFSET, bytes: wallet as string as Base58EncodedBytes, encoding: "base58" } }],
      })
      .send();
    const decoder = getPositionDecoder();
    return rows
      .map((row) => positionOf(decoder.decode(getBase64Encoder().encode(row.account.data[0]))))
      .sort((a, b) => (a.positionId < b.positionId ? 1 : -1));
  });
}

/** Every live position, from the reserve's own open table: what a keeper watches. */
export function listLeverageOpenPositions(): Promise<Reading<LeveragePosition[]>> {
  return withReading("leverage:open", async () => {
    if (!leverageProgramId()) return [];
    const reserve = await readReserve();
    if (!reserve) return [];
    const ids = reserve.data.open.map((slot) => slot.positionId).filter((id) => id !== 0n);
    const found = await Promise.all(ids.map(readPosition));
    return found.filter((raw): raw is Position => raw !== null).map(positionOf);
  });
}

/** A provider's shares and what they are worth at the reserve's current value. */
export function getLeverageSharesOf(wallet: Address): Promise<Reading<ProviderShares>> {
  return withReading(`leverage:shares:${wallet}`, async () => {
    if (!leverageProgramId()) return { shares: 0n, worthBase: 0n, suppliedBase: 0n, withdrawnBase: 0n };
    const [provider, reserve] = await Promise.all([fetchMaybeProvider(solana().rpc, kit(await providerAddress(wallet))), readReserve()]);
    const counters = provider.exists ? { suppliedBase: provider.data.suppliedBase, withdrawnBase: provider.data.withdrawnBase } : { suppliedBase: 0n, withdrawnBase: 0n };
    if (!provider.exists || !reserve || reserve.data.supplyShares === 0n) return { shares: 0n, worthBase: 0n, ...counters };
    return { shares: provider.data.shares, worthBase: (provider.data.shares * reserve.totalValueBase) / reserve.data.supplyShares, ...counters };
  });
}

/**
 * What the book would pay for a position right now, against its knock-out line.
 *
 * Marked as the chain marks it: over rested depth only, the whole position. `knockable` is true only when that
 * depth takes every contract and the mark is under the line, which is exactly when `public_knock_out` succeeds.
 */
export function getLeverageMark(positionId: bigint): Promise<Reading<LeverageMark>> {
  return withReading(`leverage:mark:${positionId}`, async () => {
    const [raw, reserve] = await Promise.all([readPosition(positionId), readReserve()]);
    if (!raw || !reserve) throw new ReadingError(diagnosis("not-settled", `no position ${positionId}`));
    const position = positionOf(raw);
    const book = await readBoostBook(position.marketId, position.side);
    const { markBase, filledRaw } = markOverLevels(book.exitRested, position.side === "down", book.one, position.quantityRaw);
    const maintenanceBps = reserve.data.params.maintenanceBps;
    return {
      markBase,
      filledRaw,
      lineBase: knockoutLine(position.frontedBase, maintenanceBps),
      knockable: position.status === "live" && filledRaw >= position.quantityRaw && isKnockable(markBase, position.frontedBase, maintenanceBps),
    };
  });
}
