import { fetchMaybeProvider, fetchMaybeReserve, fetchMaybeRound } from "@agari/clients/agari-range";
import type { Reading } from "@agari/core/schemas";
import type { Address, MarketId } from "@agari/core/types";
import type { RangeParams, RangeReserveState, RangeRound, RangeRoundStatus, RangeSide } from "@agari/core/range";
import { fetchEncodedAccount } from "@solana/kit";
import { solana } from "../runtime/solana";
import { absent } from "../stub/product";
import { withReading } from "../provider/reading";
import { kit, providerAddress, rangeProgramId, reserveAddress, roundAddress, vaultAddress } from "./deployment";

/** The SPL token account `amount` u64 — the vault's balance, which provider equity is measured against. */
const TOKEN_AMOUNT_OFFSET = 64;

async function vaultBalance(vault: Address): Promise<bigint> {
  const account = await fetchEncodedAccount(solana().rpc, kit(vault));
  if (!account.exists) return 0n;
  const view = new DataView(account.data.buffer, account.data.byteOffset, account.data.byteLength);
  return account.data.byteLength >= TOKEN_AMOUNT_OFFSET + 8 ? view.getBigUint64(TOKEN_AMOUNT_OFFSET, true) : 0n;
}

const BPS = 10_000n;

function paramsOf(raw: {
  marginBps: number; maxExposureBps: number; minCenterQE6: number; maxCenterQE6: number;
  minProbRaw: bigint; maxProbRaw: bigint; minTimeLeftSec: number; maxHorizonSec: number;
  staleAfterSec: number; maxPayoutCapBase: bigint; sigmaE8: bigint; maxExpiryLockedBase: bigint;
}): RangeParams {
  return {
    marginBps: raw.marginBps,
    maxExposureBps: raw.maxExposureBps,
    minCenterQE6: raw.minCenterQE6,
    maxCenterQE6: raw.maxCenterQE6,
    minProbRaw: raw.minProbRaw,
    maxProbRaw: raw.maxProbRaw,
    minTimeLeftSec: raw.minTimeLeftSec,
    maxHorizonSec: raw.maxHorizonSec,
    staleAfterSec: raw.staleAfterSec,
    maxPayoutCapBase: raw.maxPayoutCapBase,
    sigmaE8: raw.sigmaE8,
    maxExpiryLockedBase: raw.maxExpiryLockedBase,
  };
}

/**
 * The reserve's balance sheet, as the chain holds it.
 *
 * Provider equity is the vault's own token balance less what the reserve owes round owners, so it is read from the
 * token account rather than a mirrored counter: a number the program derives cannot drift from the money.
 * `null` — not an error — when the program is not deployed on this cluster, which is what keeps `/games/range`
 * honest without pretending the read failed.
 */
export function getRangeReserveState(): Promise<Reading<RangeReserveState | null>> {
  return withReading("range:reserve", async () => {
    const program = rangeProgramId();
    if (!program) return null;
    const address = await reserveAddress();
    const account = await fetchMaybeReserve(solana().rpc, kit(address));
    if (!account.exists) return null;

    const vault = await vaultAddress();
    const balance = await vaultBalance(vault);
    const escrow = account.data.userEscrowBase;
    const locked = account.data.lockedBase;
    const equity = balance > escrow ? balance - escrow : 0n;
    const liquid = equity > locked ? equity - locked : 0n;
    return {
      deployment: { chainId: 0, rangeReserve: address, fromBlock: 0n },
      params: paramsOf(account.data.params),
      liquidBase: liquid,
      lockedBase: locked,
      totalValueBase: equity,
      utilizationBps: equity > 0n ? Number((locked * BPS) / equity) : 0,
      supplyShares: account.data.supplyShares,
      paused: account.data.paused,
      decimals: 6,
    } satisfies RangeReserveState;
  });
}

const STATUSES: readonly RangeRoundStatus[] = ["live", "won", "lost", "void", "claimed"];

function roundOf(data: {
  owner: string; market: string; roundId: bigint; status: unknown; isInside: boolean;
  openingPrint: bigint; lowPrint: bigint; highPrint: bigint; closingPrint: bigint;
  stakeBase: bigint; maxPayoutBase: bigint; houseLockedBase: bigint; probRaw: bigint;
  openedAtSec: bigint; settledAtSec: bigint; expirySec: bigint;
}): RangeRound {
  const status = STATUSES[Number(data.status)] ?? "live";
  return {
    roundId: data.roundId,
    owner: data.owner as Address,
    status,
    side: (data.isInside ? "inside" : "outside") satisfies RangeSide,
    marketId: data.market as MarketId,
    oracleQuestionId: 0n,
    expirySec: Number(data.expirySec),
    openedAtSec: Number(data.openedAtSec),
    settledAtSec: data.settledAtSec > 0n ? Number(data.settledAtSec) : null,
    openingPrint: data.openingPrint,
    lowPrint: data.lowPrint,
    highPrint: data.highPrint,
    closingPrint: status === "live" ? null : data.closingPrint,
    stakeBase: data.stakeBase,
    maxPayoutBase: data.maxPayoutBase,
    houseLockedBase: data.houseLockedBase,
    probRaw: data.probRaw,
  };
}

export function getRange(roundId: bigint): Promise<Reading<RangeRound | null>> {
  return withReading(`range:round:${roundId}`, async () => {
    if (!rangeProgramId()) return null;
    const account = await fetchMaybeRound(solana().rpc, kit(await roundAddress(roundId)));
    return account.exists ? roundOf(account.data) : null;
  });
}

/**
 * One wallet's rounds, newest first.
 *
 * Round ids are sequential from the reserve, so the wallet's rounds are found by walking ids down from the next one
 * rather than by a `getProgramAccounts` scan: the scan is a filtered full-table read on every poll, and the walk is
 * bounded by `LOOKBACK`. A wallet with older rounds than that reads them from its own history, not from here.
 */
const LOOKBACK = 64;

export function listRangesOf(wallet: Address): Promise<Reading<RangeRound[]>> {
  return withReading(`range:rounds:${wallet}`, async () => {
    if (!rangeProgramId()) return [];
    const reserve = await fetchMaybeReserve(solana().rpc, kit(await reserveAddress()));
    if (!reserve.exists) return [];
    const newest = reserve.data.nextRoundId - 1n;
    const oldest = newest > BigInt(LOOKBACK) ? newest - BigInt(LOOKBACK) + 1n : 1n;
    const ids: bigint[] = [];
    for (let id = newest; id >= oldest; id -= 1n) ids.push(id);
    const rounds = await Promise.all(ids.map(async (id) => {
      const account = await fetchMaybeRound(solana().rpc, kit(await roundAddress(id)));
      return account.exists ? roundOf(account.data) : null;
    }));
    return rounds.filter((round): round is RangeRound => round !== null && round.owner === wallet);
  });
}

/** A provider's shares and what they are worth at the reserve's current equity. */
export function getRangeSharesOf(wallet: Address): Promise<Reading<{ shares: bigint; worthBase: bigint }>> {
  return withReading(`range:shares:${wallet}`, async () => {
    if (!rangeProgramId()) return { shares: 0n, worthBase: 0n };
    const [position, reserve] = await Promise.all([
      fetchMaybeProvider(solana().rpc, kit(await providerAddress(wallet))),
      fetchMaybeReserve(solana().rpc, kit(await reserveAddress())),
    ]);
    if (!position.exists || !reserve.exists || reserve.data.supplyShares === 0n) return { shares: 0n, worthBase: 0n };
    const balance = await vaultBalance(await vaultAddress());
    const equity = balance > reserve.data.userEscrowBase ? balance - reserve.data.userEscrowBase : 0n;
    return { shares: position.data.shares, worthBase: (position.data.shares * equity) / reserve.data.supplyShares };
  });
}

export const rangeAbsent = absent;
