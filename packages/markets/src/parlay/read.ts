import {
  floorStake,
  hasSharedInstant,
  maxPayoutForStake,
  multiplierMilli,
  parlayLegStatusOf,
  parlayStatusOf,
  productProb,
  type ParlayLegInput,
  type ParlayMode,
  type ParlayParams,
  type ParlayQuote,
  type ParlayReserveState,
  type ParlayTicket,
} from "@masayume/core/parlay";
import { err, ok, type Reading } from "@masayume/core/schemas";
import { diagnosis, OUTCOME_TO_SIDE, SIDE_TO_OUTCOME, toMarketId, type Address, type OutcomeIdx } from "@masayume/core/types";
import { oneUnit } from "@masayume/core/units";
import type { PublicClient } from "viem";
import { MULTICALL3_ADDRESS } from "../chain";
import { getCollateral } from "../collateral";
import { parlayReserveAbi } from "../contracts/parlay-reserve.abi";
import { nowMs } from "../provider/clock";
import { withReading } from "../provider/reading";
import { getClient, getParlayDeployment } from "../runtime/read-runtime";
import { diagnoseParlay } from "./errors";

const PAGE = 50;
const MAX_TICKETS = 500;
const BPS = 10_000n;

type ParlayTuple = {
  owner: Address;
  status: number;
  legCount: number;
  wonCount: number;
  openedAtSec: bigint;
  lastExpirySec: bigint;
  stake: bigint;
  maxPayout: bigint;
  houseLocked: bigint;
  combinedProbRaw: bigint;
};

type LegTuple = { marketId: `0x${string}`; outcomeIdx: number; status: number; expirySec: bigint; resolvedAtSec: bigint; priceRaw: bigint };

/** The public `params` getter flattens the struct into a tuple, in declaration order. */
type ParamsTuple = readonly [number, number, number, number, bigint, bigint, bigint, bigint];

function viem(): PublicClient {
  return getClient().getViemClient() as PublicClient;
}

function reserveContract() {
  const deployment = getParlayDeployment();
  return deployment ? ({ address: deployment.parlayReserve, abi: parlayReserveAbi } as const) : null;
}

export function toParlayParams(p: ParamsTuple): ParlayParams {
  return {
    marginBps: p[0],
    maxExposureBps: p[1],
    correlationBps: p[2],
    maxLegs: p[3],
    maxPayoutCapBase: p[4],
    maxExpiryLockedBase: p[5],
    minCombinedProbRaw: p[6],
    priceDepthRaw: p[7],
  };
}

export function toParlayTicket(parlayId: bigint, p: ParlayTuple, legs: readonly LegTuple[]): ParlayTicket {
  return {
    parlayId,
    owner: p.owner.toLowerCase() as Address,
    status: parlayStatusOf(p.status),
    legCount: p.legCount,
    wonCount: p.wonCount,
    openedAtSec: Number(p.openedAtSec),
    lastExpirySec: Number(p.lastExpirySec),
    stakeBase: p.stake,
    maxPayoutBase: p.maxPayout,
    houseLockedBase: p.houseLocked,
    combinedProbRaw: p.combinedProbRaw,
    legs: legs.map((leg) => ({
      marketId: toMarketId(leg.marketId),
      side: OUTCOME_TO_SIDE[leg.outcomeIdx as OutcomeIdx],
      status: parlayLegStatusOf(leg.status),
      expirySec: Number(leg.expirySec),
      resolvedAtSec: leg.resolvedAtSec === 0n ? null : Number(leg.resolvedAtSec),
      priceRaw: leg.priceRaw,
    })),
  };
}

/** The reserve's sheet and tunables in one multicall; null where no reserve is deployed. */
export async function getParlayReserveState(): Promise<Reading<ParlayReserveState | null>> {
  return withReading("parlayReserve", async () => {
    const deployment = getParlayDeployment();
    const contract = reserveContract();
    if (!deployment || !contract) return null;
    const [params, liquid, locked, supplyShares, paused] = await viem().multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: [
        { ...contract, functionName: "params" },
        { ...contract, functionName: "liquid" },
        { ...contract, functionName: "locked" },
        { ...contract, functionName: "supplyShares" },
        { ...contract, functionName: "paused" },
      ],
    });
    const totalValueBase = liquid + locked;
    return {
      deployment,
      params: toParlayParams(params as ParamsTuple),
      liquidBase: liquid,
      lockedBase: locked,
      totalValueBase,
      utilizationBps: totalValueBase === 0n ? 0 : Number((locked * BPS) / totalValueBase),
      supplyShares,
      paused,
      decimals: getCollateral().decimals,
    };
  });
}

async function ticketsByIds(ids: readonly bigint[]): Promise<ParlayTicket[]> {
  const contract = reserveContract();
  if (!contract || ids.length === 0) return [];
  const rows = await viem().multicall({
    multicallAddress: MULTICALL3_ADDRESS,
    allowFailure: false,
    contracts: ids.flatMap((id) => [
      { ...contract, functionName: "parlayOf", args: [id] } as const,
      { ...contract, functionName: "legsOf", args: [id] } as const,
    ]),
  });
  return ids.map((id, i) => toParlayTicket(id, rows[i * 2] as ParlayTuple, rows[i * 2 + 1] as readonly LegTuple[]));
}

const STATUS_RANK = { live: 0, won: 1, lost: 2, void: 2, claimed: 3 } as const;

/** One wallet's tickets: live first, then newest expiry — the reference's slip order; empty without a reserve. */
export async function listParlaysOf(wallet: Address): Promise<Reading<ParlayTicket[]>> {
  return withReading(`parlays:${wallet}`, async () => {
    const contract = reserveContract();
    if (!contract) return [];
    const client = viem();
    const total = Math.min(Number(await client.readContract({ ...contract, functionName: "parlayCountOf", args: [wallet] })), MAX_TICKETS);
    const ids: bigint[] = [];
    for (let offset = 0; offset < total; offset += PAGE) {
      const page = await client.readContract({ ...contract, functionName: "parlaysOf", args: [wallet, BigInt(offset), BigInt(Math.min(PAGE, total - offset))] });
      ids.push(...(page as readonly bigint[]));
    }
    const tickets = await ticketsByIds(ids);
    return tickets.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.lastExpirySec - a.lastExpirySec || Number(b.parlayId - a.parlayId));
  });
}

export async function getParlay(parlayId: bigint): Promise<Reading<ParlayTicket | null>> {
  return withReading(`parlay:${parlayId}`, async () => (await ticketsByIds([parlayId]))[0] ?? null);
}

/** A supplier's shares and what they are worth of the reserve's total value right now. */
export async function getParlaySharesOf(wallet: Address): Promise<Reading<{ shares: bigint; worthBase: bigint }>> {
  return withReading(`parlayShares:${wallet}`, async () => {
    const contract = reserveContract();
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

export interface ParlayPreview {
  stakeBase: bigint;
  combinedProbRaw: bigint;
  legPricesRaw: bigint[];
  expiriesSec: number[];
}

function legTuples(legs: readonly ParlayLegInput[]) {
  return legs.map((leg) => ({ marketId: leg.marketId as `0x${string}`, outcomeIdx: SIDE_TO_OUTCOME[leg.side] }));
}

/**
 * The contract's own answer for a ticket (`previewOpen`): the exact stake it would charge for this
 * payout right now, priced off the venue's books inside the call. A refusal is the error arm with the
 * reserve's reason — never a stale last-good quote for a ticket the reserve would not take.
 */
export async function previewParlayOpen(legs: readonly ParlayLegInput[], maxPayoutBase: bigint): Promise<Reading<ParlayPreview>> {
  const contract = reserveContract();
  if (!contract) return err(diagnosis("not-deployed", "ParlayReserve is not deployed on this network yet"));
  try {
    const [stake, combined, prices, expiries] = await viem().readContract({ ...contract, functionName: "previewOpen", args: [legTuples(legs), maxPayoutBase] });
    return ok({ stakeBase: stake, combinedProbRaw: combined, legPricesRaw: [...prices], expiriesSec: expiries.map(Number) }, nowMs());
  } catch (error) {
    return err(diagnoseParlay(error));
  }
}

function toQuote(preview: ParlayPreview, maxPayoutBase: bigint, one: bigint, decimals: number): ParlayQuote {
  return {
    legPricesRaw: preview.legPricesRaw,
    legProbBps: preview.legPricesRaw.map((price) => Number((price * BPS) / one)),
    combinedProbRaw: preview.combinedProbRaw,
    rawCombinedProbRaw: productProb(preview.legPricesRaw, one),
    correlated: hasSharedInstant(preview.expiriesSec),
    stakeBase: preview.stakeBase,
    maxPayoutBase,
    multiplierMilli: multiplierMilli(maxPayoutBase, preview.stakeBase),
    decimals,
    quotedAtMs: nowMs(),
  };
}

/**
 * A whole ticket quoted by the chain. "Set payout" is one call. "Set stake" is the inverse the
 * contract does not have: price over the floor depth, solve the payout that stake buys, then let the
 * contract price over that payout — and if the walk into deeper levels made the stake overshoot,
 * solve once more from those prices. The last preview is always over a depth no shallower than
 * the payout returned, so the chain can only charge less than the figure shown, never more.
 */
export async function quoteParlayOnchain(legs: readonly ParlayLegInput[], mode: ParlayMode, params: ParlayParams): Promise<Reading<ParlayQuote>> {
  const { decimals } = getCollateral();
  const one = oneUnit(decimals);
  if (mode.kind === "fixPayout") {
    const preview = await previewParlayOpen(legs, mode.maxPayoutBase);
    return preview.ok ? ok(toQuote(preview.value, mode.maxPayoutBase, one, decimals), preview.asOfMs) : preview;
  }
  const first = await previewParlayOpen(legs, params.priceDepthRaw);
  if (!first.ok) return first;
  const cap = params.maxPayoutCapBase;
  let payout = maxPayoutForStake(mode.stakeBase, first.value.combinedProbRaw, one, params.marginBps);
  if (payout > cap) payout = cap;
  if (payout === 0n) return err(diagnosis("outside-band", `Underpriced(${mode.stakeBase}, 0)`, { errorName: "Underpriced" }));
  let preview = await previewParlayOpen(legs, payout);
  if (!preview.ok) return preview;
  if (preview.value.stakeBase > mode.stakeBase) {
    payout = maxPayoutForStake(mode.stakeBase, preview.value.combinedProbRaw, one, params.marginBps);
    if (payout === 0n) return err(diagnosis("outside-band", `Underpriced(${mode.stakeBase}, 0)`, { errorName: "Underpriced" }));
    preview = await previewParlayOpen(legs, payout);
    if (!preview.ok) return preview;
  }
  // The floor the contract will apply over its own depth is what the surface displays, never the typed stake.
  const stakeBase = floorStake(payout, preview.value.combinedProbRaw, one, params.marginBps);
  return ok(toQuote({ ...preview.value, stakeBase }, payout, one, decimals), preview.asOfMs);
}
