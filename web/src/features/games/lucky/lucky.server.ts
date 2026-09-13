import {
  LUCKY_ASSETS,
  LUCKY_MULTIPLIERS,
  LUCKY_POLICY_VERSION,
  chooseLuckyWindow,
  eligibleLuckyWindows,
  luckyCandidatePreimage,
  mapLuckyDraw,
  type LuckyCandidate,
} from "@masayume/core/games";
import { phase } from "@masayume/core/lifecycle";
import { isOk } from "@masayume/core/schemas";
import { minStakeBase } from "@masayume/core/sizing";
import { toMarketId, type Address, type Bytes32, type EventMarket, type Quote, type Side } from "@masayume/core/types";
import { createLuckyDraw, gamesStoreConfigured, getLuckyDraw, revealLuckyDraw, type LuckyDrawRow } from "@masayume/db";
import { ensureMarkets, loadCollateral, marketsProvider, resolveVenueId } from "@masayume/markets";
import { keccak256 } from "viem";
import { gate, marketsEnvFromProcess } from "@/features/session/sponsor.server";
import { freshSeed, luckyDigest } from "./lucky-digest.server";
import type { LuckyCommitWire, LuckyDealWire, LuckyQuoteWire, LuckyWindowWire } from "./lucky-wire";

/**
 * The draw — server only. Nothing here may be imported by a component.
 *
 * The order is the whole mechanism (`06-game-architecture.md` §/games/lucky): commit a server seed before
 * the reels move; take the browser's seed after it has seen the commitment; derive the draw from both with
 * an HMAC nobody could have steered alone; then scan the venue for a live Window on the drawn side, quote
 * it for real, and hand every one of those facts back before anything is signed. The commitment proves
 * the draw was not changed; the candidate hash records what the chooser was allowed to pick from; the
 * quote on the wire is a snapshot the card replaces with the live one it actually places on.
 */

/** Spins are free to ask for, so they are rate-limited like the sponsor's top-ups: per address and per device, an hour at a time. */
const PER_ADDRESS_PER_HOUR = 120;
const PER_DEVICE_PER_HOUR = 240;

export type CommitOutcome = { ok: true; wire: LuckyCommitWire } | { ok: false; status: number; error: string };
export type RevealOutcome = { ok: true; wire: LuckyDealWire } | { ok: false; status: number; error: string };

const otherSide = (side: Side): Side => (side === "up" ? "down" : "up");

export async function commitDraw(input: { wallet: Address; stakeBase: bigint; device: string; nowMs: number }): Promise<CommitOutcome> {
  if (!gamesStoreConfigured()) return { ok: false, status: 503, error: "this deployment has no games store, so a draw has nowhere to keep its seed" };
  const byDevice = gate("device", input.device, PER_DEVICE_PER_HOUR, input.nowMs);
  if (!byDevice.ok) return { ok: false, status: 429, error: byDevice.reason };
  const byAddress = gate("address", input.wallet, PER_ADDRESS_PER_HOUR, input.nowMs);
  if (!byAddress.ok) return { ok: false, status: 429, error: byAddress.reason };

  ensureMarkets(marketsEnvFromProcess());
  const collateral = await loadCollateral();
  if (!isOk(collateral)) return { ok: false, status: 502, error: "the venue's collateral could not be read" };
  if (input.stakeBase < minStakeBase(collateral.value.decimals)) return { ok: false, status: 400, error: "that stake is under the venue's floor" };

  const serverSeed = freshSeed();
  const commitment = keccak256(serverSeed);
  const created = await createLuckyDraw({
    drawId: freshSeed(),
    wallet: input.wallet,
    policyVersion: LUCKY_POLICY_VERSION,
    stakeBase: input.stakeBase.toString(),
    commitment,
    serverSeed,
  });
  return {
    ok: true,
    wire: {
      drawId: created.drawId as Bytes32,
      wallet: input.wallet.toLowerCase() as Address,
      commitment,
      nonce: created.nonce,
      policyVersion: LUCKY_POLICY_VERSION,
      stakeBase: input.stakeBase.toString(),
    },
  };
}

export interface Scanned {
  candidateHash: Bytes32;
  candidateCount: number;
  /** How many eligible Windows the book actually answered for on the drawn side. Zero with candidates present is a read failure, not a thin book. */
  quotedCount: number;
  chosen: { market: EventMarket; quote: Quote; other: Quote | null } | null;
}

/**
 * Every live Window of the drawn asset the policy allows, quoted on both sides at the stake, and the one
 * the chooser takes. The other side's quote rides along so the card can show both odds on the Window it
 * was dealt — the choice itself is on the drawn side only.
 */
export async function scanLuckyWindows(asset: string, side: Side, multiplier: number, stakeBase: bigint): Promise<Scanned | null> {
  const env = marketsEnvFromProcess();
  ensureMarkets(env);
  const venue = await resolveVenueId(env.venueId);
  if (!isOk(venue) || !venue.value.venueId) return null;
  const lanes = await marketsProvider.listLiveLanes(venue.value.venueId);
  if (!isOk(lanes)) return null;
  const nowMs = marketsProvider.nowMs();
  const markets = lanes.value.lanes.flatMap((lane) => lane.markets);
  const byId = new Map(markets.map((m) => [m.marketId, m]));
  const candidates: LuckyCandidate[] = markets.map((m) => ({
    marketId: m.marketId,
    asset: m.asset,
    intervalSec: m.intervalSec,
    expirySec: m.expirySec,
    trading: phase(m, nowMs) === "trading",
  }));
  const eligible = eligibleLuckyWindows(candidates, asset, Math.floor(nowMs / 1_000));
  const candidateHash = keccak256(luckyCandidatePreimage(eligible.map((c) => c.marketId), LUCKY_POLICY_VERSION));

  const quoted = await Promise.all(
    eligible.map(async (c) => {
      const market = byId.get(c.marketId) as EventMarket;
      const target = { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals, intervalSec: market.intervalSec };
      const [mine, other] = await Promise.all([marketsProvider.freshQuoteStake(target, side, stakeBase), marketsProvider.freshQuoteStake(target, otherSide(side), stakeBase)]);
      // A read that failed is not a book that cannot fill: the two are kept apart so the refusal can say which.
      return { market, answered: isOk(mine), mine: isOk(mine) ? mine.value : null, other: isOk(other) ? other.value : null };
    }),
  );
  const fillable = quoted.filter((q): q is typeof q & { mine: Quote } => q.mine !== null).map((q) => ({ marketId: q.market.marketId, expirySec: q.market.expirySec, avgPriceBps: q.mine.avgPriceBps, partial: q.mine.partial, q }));
  const best = chooseLuckyWindow(fillable, multiplier);
  return {
    candidateHash,
    candidateCount: eligible.length,
    quotedCount: quoted.filter((q) => q.answered).length,
    chosen: best ? { market: best.q.market, quote: best.q.mine, other: best.q.other } : null,
  };
}

/** Why a scan dealt nothing: the venue could not be read at all, its books answered but none could fill, or it simply had no Window. */
export function scanRefusal(scanned: Scanned | null): "venue-unreadable" | "no-window" | null {
  if (scanned === null) return "venue-unreadable";
  if (scanned.chosen) return null;
  return scanned.candidateCount > 0 && scanned.quotedCount === 0 ? "venue-unreadable" : "no-window";
}

const toWindow = (m: EventMarket): LuckyWindowWire => ({ marketId: m.marketId, asset: m.asset, intervalSec: m.intervalSec, expirySec: m.expirySec, poolAddress: m.poolAddress, decimals: m.decimals });
const toQuote = (q: Quote): LuckyQuoteWire => ({ avgPriceBps: q.avgPriceBps, contractsRaw: q.contractsRaw.toString(), expectedCostBase: q.expectedCostBase.toString(), maxCostBase: q.maxCostBase.toString(), payoutIfRightBase: q.payoutIfRightBase.toString() });

/** A reveal asked for twice (a retried request) answers from the row rather than dealing again. */
async function dealFromRow(row: LuckyDrawRow): Promise<LuckyDealWire> {
  ensureMarkets(marketsEnvFromProcess());
  const market = row.marketId ? await marketsProvider.getMarket(toMarketId(row.marketId)) : null;
  const value = market && isOk(market) ? market.value : null;
  return {
    drawId: row.drawId as Bytes32,
    wallet: row.wallet as Address,
    nonce: row.nonce,
    policyVersion: row.policyVersion,
    stakeBase: row.stakeBase,
    commitment: row.commitment as Bytes32,
    serverSeed: row.serverSeed as Bytes32,
    clientSeed: row.clientSeed as Bytes32,
    assets: LUCKY_ASSETS,
    multipliers: LUCKY_MULTIPLIERS,
    draw: { asset: row.asset ?? "", side: row.side ?? "up", multiplier: row.multiplier ?? 0 },
    candidateHash: (row.candidateHash ?? "0x") as Bytes32,
    candidateCount: 0,
    window: value ? toWindow(value) : null,
    quote: null,
    otherSideBps: null,
    result: row.result === "refused" ? "refused" : "drawn",
    refusal: row.refusal,
  };
}

export async function revealDraw(input: { drawId: Bytes32; clientSeed: Bytes32 }): Promise<RevealOutcome> {
  const row = await getLuckyDraw(input.drawId);
  if (!row) return { ok: false, status: 404, error: "no draw by that id" };
  if (row.clientSeed !== null) {
    if (row.clientSeed !== input.clientSeed.toLowerCase()) return { ok: false, status: 409, error: "that draw was already revealed with another seed" };
    return { ok: true, wire: await dealFromRow(row) };
  }

  const wallet = row.wallet as Address;
  const digest = luckyDigest(row.serverSeed as Bytes32, { clientSeed: input.clientSeed, wallet, nonce: row.nonce, policyVersion: row.policyVersion });
  const draw = mapLuckyDraw(digest, { assets: LUCKY_ASSETS, multipliers: LUCKY_MULTIPLIERS });
  const scanned = await scanLuckyWindows(draw.asset, draw.side, draw.multiplier, BigInt(row.stakeBase));

  const chosen = scanned?.chosen ?? null;
  const refusal = scanRefusal(scanned);
  await revealLuckyDraw(row.drawId, {
    clientSeed: input.clientSeed,
    asset: draw.asset,
    side: draw.side,
    multiplier: draw.multiplier,
    candidateHash: scanned?.candidateHash ?? "0x",
    marketId: chosen?.market.marketId ?? null,
    quoteAvgPriceBps: chosen?.quote.avgPriceBps ?? null,
    quoteContractsRaw: chosen ? chosen.quote.contractsRaw.toString() : null,
    result: chosen ? "drawn" : "refused",
    refusal,
  });

  return {
    ok: true,
    wire: {
      drawId: row.drawId as Bytes32,
      wallet,
      nonce: row.nonce,
      policyVersion: row.policyVersion,
      stakeBase: row.stakeBase,
      commitment: row.commitment as Bytes32,
      serverSeed: row.serverSeed as Bytes32,
      clientSeed: input.clientSeed.toLowerCase() as Bytes32,
      assets: LUCKY_ASSETS,
      multipliers: LUCKY_MULTIPLIERS,
      draw,
      candidateHash: scanned?.candidateHash ?? ("0x" as Bytes32),
      candidateCount: scanned?.candidateCount ?? 0,
      window: chosen ? toWindow(chosen.market) : null,
      quote: chosen ? toQuote(chosen.quote) : null,
      otherSideBps: chosen?.other?.avgPriceBps ?? null,
      result: chosen ? "drawn" : "refused",
      refusal,
    },
  };
}
