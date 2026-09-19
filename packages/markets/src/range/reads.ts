import { fetchMaybeExpiryBook, fetchMaybeProvider, fetchMaybeReserve, fetchMaybeRound } from "@agari/clients/agari-range";
import type { Reading } from "@agari/core/schemas";
import type { Address, MarketId } from "@agari/core/types";
import {
  bandProbE6, floorStake, quoteRange, sideProbRaw, RANGE_NOT_DEPLOYED,
  type RangeMode, type RangeParams, type RangeQuote, type RangeRefusal, type RangeReserveState,
  type RangeRound, type RangeRoundStatus, type RangeSide,
} from "@agari/core/range";
import { diagnosis } from "@agari/core/types";
import { fetchEncodedAccount } from "@solana/kit";
import { solana } from "../runtime/solana";
import { absent } from "../stub/product";
import { withReading } from "../provider/reading";
import { expiryBookAddress, kit, providerAddress, rangeProgramId, reserveAddress, roundAddress, vaultAddress } from "./deployment";
import { ReadingError } from "../errors/reading-error";
import { readMarket } from "../runtime/accounts";
import { nowMs } from "../provider/clock";
import type { RangeCapacity } from "./moonshot";
import type { RangeBand, RangePreview, RangeWindowBasis } from "./read";

/** The probability scale shared with the program (`ONE_RAW` in `agari-range`). */
const ONE_RAW = 1_000_000n;

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

/**
 * The basis the reserve would price a Window on right now: its opening print, the venue's own mark, and the
 * house σ the deployed reserve carries. Read from the same Market account the program reads, so a quote shown
 * here and the stake charged on chain come from one source.
 */
export function previewRangeBasis(marketId: MarketId): Promise<Reading<RangeWindowBasis>> {
  return withReading(`range:basis:${marketId}`, async () => {
    const [market, reserve] = await Promise.all([
      readMarket(marketId),
      fetchMaybeReserve(solana().rpc, kit(await reserveAddress())),
    ]);
    if (!market) throw new ReadingError(diagnosis("market-not-trading", `Window not found: ${marketId}`));
    if (!reserve.exists) throw new ReadingError(diagnosis("not-deployed", RANGE_NOT_DEPLOYED));
    const lastPrice = BigInt(market.data.lastPrice ?? 0);
    if (lastPrice <= 0n) throw new ReadingError(diagnosis("thin-book", "the venue has not traded this Window yet"));
    return {
      openingPrint: BigInt(market.data.open.price),
      // A YES tick in this engine is P(close ≥ open) in ten thousandths; the maths works in millionths.
      centerQE6: lastPrice * 100n,
      sigmaE8: reserve.data.params.sigmaE8,
    } satisfies RangeWindowBasis;
  });
}

/** The stake the reserve would charge for one band and payout, at the basis it would price on. */
export function previewRangeOpen(band: RangeBand, maxPayoutBase: bigint): Promise<Reading<RangePreview>> {
  return withReading(`range:preview:${band.marketId}:${band.side}:${maxPayoutBase}`, async () => {
    const basis = await previewRangeBasis(band.marketId);
    if (!basis.ok) throw new ReadingError(basis.error);
    const reserve = await fetchMaybeReserve(solana().rpc, kit(await reserveAddress()));
    if (!reserve.exists) throw new ReadingError(diagnosis("not-deployed", RANGE_NOT_DEPLOYED));
    const market = await readMarket(band.marketId);
    if (!market) throw new ReadingError(diagnosis("market-not-trading", `Window not found: ${band.marketId}`));
    const tauSec = Math.max(0, Number(market.data.expiry) - Math.floor(nowMs() / 1000));
    const inside = bandProbE6(basis.value.openingPrint, band.lowPrint, band.highPrint, basis.value.centerQE6, basis.value.sigmaE8, tauSec);
    const probRaw = sideProbRaw(inside, band.side, ONE_RAW);
    return {
      stakeBase: floorStake(maxPayoutBase, probRaw, ONE_RAW, reserve.data.params.marginBps),
      probRaw,
      openingPrint: basis.value.openingPrint,
      basis: { centerQE6: Number(basis.value.centerQE6), sigmaE8: Number(basis.value.sigmaE8), tauSec },
    } satisfies RangePreview;
  });
}

/** One priced band, the shape every range ticket reads. */
export function quoteRangeOnchain(band: RangeBand, mode: RangeMode, params: RangeParams, tauSec: number): Promise<Reading<RangeQuote>> {
  return withReading(`range:quote:${band.marketId}:${band.side}:${tauSec}`, async () => {
    const basis = await previewRangeBasis(band.marketId);
    if (!basis.ok) throw new ReadingError(basis.error);
    const result = quoteRange({
      openingPrint: basis.value.openingPrint,
      lowPrint: band.lowPrint,
      highPrint: band.highPrint,
      side: band.side,
      centerQE6: basis.value.centerQE6,
      sigmaE8: basis.value.sigmaE8,
      tauSec,
      mode,
      params,
      one: ONE_RAW,
      decimals: 6,
      nowMs: nowMs(),
    });
    // A refusal is the reserve's own answer, not a failed read: it is shown as the ticket's reason.
    if (!result.ok) throw new ReadingError(diagnosis(refusalKind(result.refusal.kind), `the reserve will not price this band: ${result.refusal.kind}`));
    return result.quote;
  });
}

function refusalKind(kind: RangeRefusal["kind"]): "no-liquidity" | "below-min-quantity" | "outside-band" | "reserve-cap" {
  if (kind === "long-shot" || kind === "near-certain") return "outside-band";
  if (kind === "over-payout-cap") return "reserve-cap";
  if (kind === "underpriced" || kind === "zero") return "below-min-quantity";
  return "no-liquidity";
}

/**
 * Whether the reserve would take another round settling at this boundary, and what already does.
 *
 * The per-expiry book is what the chain enforces (`OverExpiryCap`), so the ticket asks the same account rather
 * than estimating from the global figure — a card that says "room" where the chain says no is worse than no card.
 */
export function readRangeCapacity(houseLockedBase: bigint, expirySec: number): Promise<Reading<RangeCapacity>> {
  return withReading(`range:capacity:${expirySec}`, async () => {
    const [reserve, book] = await Promise.all([
      fetchMaybeReserve(solana().rpc, kit(await reserveAddress())),
      fetchMaybeExpiryBook(solana().rpc, kit(await expiryBookAddress(expirySec))),
    ]);
    if (!reserve.exists) return { fits: false, refusal: diagnosis("not-deployed", RANGE_NOT_DEPLOYED), lockedByExpiryBase: 0n };
    const lockedByExpiryBase = book.exists ? book.data.lockedBase : 0n;
    const cap = reserve.data.params.maxExpiryLockedBase;
    const fits = lockedByExpiryBase + houseLockedBase <= cap;
    return {
      fits,
      refusal: fits ? null : diagnosis("reserve-cap", `${lockedByExpiryBase + houseLockedBase} would pass the ${cap} this boundary may carry`),
      lockedByExpiryBase,
    } satisfies RangeCapacity;
  });
}
