import { fetchMaybeParlayReserve, fetchMaybeParlayTicket, fetchMaybeProvider } from "@agari/clients/agari-parlay";
import { parlayLegStatusOf, parlayStatusOf, type ParlayLeg, type ParlayParams, type ParlayReserveState, type ParlayTicket } from "@agari/core/parlay";
import type { ProviderShares } from "@agari/core/reserves";
import type { Reading } from "@agari/core/schemas";
import type { Address, MarketId } from "@agari/core/types";
import { fetchEncodedAccount } from "@solana/kit";
import { withReading } from "../provider/reading";
import { solana } from "../runtime/solana";
import { kit, parlayProgramId, providerAddress, reserveAddress, ticketAddress, vaultAddress } from "./deployment";

const BPS = 10_000n;
/** The SPL token account `amount` u64: the vault's balance, which provider equity is measured against. */
const TOKEN_AMOUNT_OFFSET = 64;

async function vaultBalance(vault: Address): Promise<bigint> {
  const account = await fetchEncodedAccount(solana().rpc, kit(vault));
  if (!account.exists) return 0n;
  const view = new DataView(account.data.buffer, account.data.byteOffset, account.data.byteLength);
  return account.data.byteLength >= TOKEN_AMOUNT_OFFSET + 8 ? view.getBigUint64(TOKEN_AMOUNT_OFFSET, true) : 0n;
}

type RawParams = {
  marginBps: number; maxExposureBps: number; correlationBps: number; maxSpreadTicks: number; maxLegs: number;
  minRestSlots: number; minTimeLeftSec: number; maxPayoutCapBase: bigint; maxExpiryLockedBase: bigint;
  minCombinedProbRaw: bigint; priceDepthRaw: bigint;
};

export function paramsOf(raw: RawParams): ParlayParams {
  return {
    marginBps: raw.marginBps,
    maxExposureBps: raw.maxExposureBps,
    correlationBps: raw.correlationBps,
    maxLegs: raw.maxLegs,
    maxPayoutCapBase: raw.maxPayoutCapBase,
    maxExpiryLockedBase: raw.maxExpiryLockedBase,
    minCombinedProbRaw: raw.minCombinedProbRaw,
    priceDepthRaw: raw.priceDepthRaw,
    maxSpreadTicks: raw.maxSpreadTicks,
    minRestSlots: raw.minRestSlots,
    minTimeLeftSec: raw.minTimeLeftSec,
  };
}

/**
 * The reserve's balance sheet, as the chain holds it.
 *
 * Provider equity is the vault's own token balance less what the reserve owes ticket owners, so it is read from
 * the token account rather than a mirrored counter: a number the program derives cannot drift from the money.
 * `null`, not an error, when the reserve does not exist on this cluster.
 */
export function getParlayReserveState(): Promise<Reading<ParlayReserveState | null>> {
  return withReading("parlay:reserve", async () => {
    if (!parlayProgramId()) return null;
    const address = await reserveAddress();
    const account = await fetchMaybeParlayReserve(solana().rpc, kit(address));
    if (!account.exists) return null;

    const balance = await vaultBalance(await vaultAddress());
    const escrow = account.data.userEscrowBase;
    const locked = account.data.lockedBase;
    const equity = balance > escrow ? balance - escrow : 0n;
    return {
      deployment: { chainId: 0, parlayReserve: address, fromBlock: 0n },
      params: paramsOf(account.data.params),
      liquidBase: equity > locked ? equity - locked : 0n,
      lockedBase: locked,
      totalValueBase: equity,
      utilizationBps: equity > 0n ? Number((locked * BPS) / equity) : 0,
      supplyShares: account.data.supplyShares,
      paused: account.data.paused,
      decimals: 6,
    } satisfies ParlayReserveState;
  });
}

type RawLeg = { market: string; isUp: boolean; status: unknown; expirySec: bigint; resolvedAtSec: bigint; priceRaw: bigint };
type RawTicket = {
  owner: string; parlayId: bigint; status: unknown; legCount: number; wonCount: number; legs: RawLeg[];
  openedAtSec: bigint; lastExpirySec: bigint; stakeBase: bigint; maxPayoutBase: bigint; houseLockedBase: bigint; combinedProbRaw: bigint;
};

function legOf(raw: RawLeg): ParlayLeg {
  return {
    marketId: raw.market as MarketId,
    side: raw.isUp ? "up" : "down",
    status: parlayLegStatusOf(Number(raw.status)),
    expirySec: Number(raw.expirySec),
    resolvedAtSec: raw.resolvedAtSec > 0n ? Number(raw.resolvedAtSec) : null,
    priceRaw: raw.priceRaw,
  };
}

function ticketOf(raw: RawTicket): ParlayTicket {
  return {
    parlayId: raw.parlayId,
    owner: raw.owner as Address,
    status: parlayStatusOf(Number(raw.status)),
    legCount: raw.legCount,
    wonCount: raw.wonCount,
    openedAtSec: Number(raw.openedAtSec),
    lastExpirySec: Number(raw.lastExpirySec),
    stakeBase: raw.stakeBase,
    maxPayoutBase: raw.maxPayoutBase,
    houseLockedBase: raw.houseLockedBase,
    combinedProbRaw: raw.combinedProbRaw,
    legs: raw.legs.map(legOf),
  };
}

export function getParlay(parlayId: bigint): Promise<Reading<ParlayTicket | null>> {
  return withReading(`parlay:ticket:${parlayId}`, async () => {
    if (!parlayProgramId()) return null;
    const account = await fetchMaybeParlayTicket(solana().rpc, kit(await ticketAddress(parlayId)));
    return account.exists ? ticketOf(account.data) : null;
  });
}

/**
 * One wallet's tickets, newest first. Ticket ids are sequential from the reserve, so they are found by walking ids
 * down from the next one rather than by a `getProgramAccounts` scan on every poll; the walk is bounded by `LOOKBACK`.
 */
const LOOKBACK = 64;

export function listParlaysOf(wallet: Address): Promise<Reading<ParlayTicket[]>> {
  return withReading(`parlay:tickets:${wallet}`, async () => {
    if (!parlayProgramId()) return [];
    const reserve = await fetchMaybeParlayReserve(solana().rpc, kit(await reserveAddress()));
    if (!reserve.exists) return [];
    const newest = reserve.data.nextParlayId - 1n;
    const oldest = newest > BigInt(LOOKBACK) ? newest - BigInt(LOOKBACK) + 1n : 1n;
    const ids: bigint[] = [];
    for (let id = newest; id >= oldest; id -= 1n) ids.push(id);
    const tickets = await Promise.all(ids.map(async (id) => {
      const account = await fetchMaybeParlayTicket(solana().rpc, kit(await ticketAddress(id)));
      return account.exists ? ticketOf(account.data) : null;
    }));
    return tickets.filter((ticket): ticket is ParlayTicket => ticket !== null && ticket.owner === wallet);
  });
}

/** A provider's shares and what they are worth at the reserve's current equity. */
export function getParlaySharesOf(wallet: Address): Promise<Reading<ProviderShares>> {
  return withReading(`parlay:shares:${wallet}`, async () => {
    if (!parlayProgramId()) return { shares: 0n, worthBase: 0n, suppliedBase: 0n, withdrawnBase: 0n };
    const [position, reserve] = await Promise.all([
      fetchMaybeProvider(solana().rpc, kit(await providerAddress(wallet))),
      fetchMaybeParlayReserve(solana().rpc, kit(await reserveAddress())),
    ]);
    const counters = position.exists ? { suppliedBase: position.data.suppliedBase, withdrawnBase: position.data.withdrawnBase } : { suppliedBase: 0n, withdrawnBase: 0n };
    if (!position.exists || !reserve.exists || reserve.data.supplyShares === 0n) return { shares: 0n, worthBase: 0n, ...counters };
    const balance = await vaultBalance(await vaultAddress());
    const equity = balance > reserve.data.userEscrowBase ? balance - reserve.data.userEscrowBase : 0n;
    return { shares: position.data.shares, worthBase: (position.data.shares * equity) / reserve.data.supplyShares, ...counters };
  });
}
