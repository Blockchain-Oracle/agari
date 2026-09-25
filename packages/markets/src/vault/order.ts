/**
 * The order lane's vault routes (tap-trading.md §1.3; Masayume `vault/order.ts`): the same status gate, Daily-Stop
 * gate, fresh quote and headroom expiry as a wallet order, then the vault's own checks (Trading Balance funded, or the
 * grant's caps mirrored client-side), the Window's vault seat, and one IOC through agari-vault booked from its
 * `Executed` event. A delegated tap is sponsorable; a cap refusal sends nothing and asks no co-signer.
 */
import type { BookedOrder, OrderOutcome, OrderRequest, OrderRoute, PhaseListener } from "@agari/core/ports";
import { SIDE_TO_OUTCOME, diagnosis, type Address, type Diagnosis, type MarketId, type Side, type Signature } from "@agari/core/types";
import { formatCadence } from "@agari/core/copy";
import { formatBaseUnits, oneUnit } from "@agari/core/units";
import { capQuoteToGrant, VAULT_NOT_DEPLOYED, type VaultDeployment } from "@agari/core/vault";
import type { Address as KitAddress } from "@solana/kit";
import { readMarket, type SeriesFacts } from "../runtime/accounts";
import { ENGINE_CODE } from "../submitter/chain-failure";
import { OrderRefusedError, RequoteError, SimulationFailedError } from "../submitter/errors";
import { checkGas } from "../submitter/fees";
import type { OrderLaneContext } from "../submitter/order-lane";
import type { JsonTransaction } from "../submitter/events";
import type { Settled } from "../submitter/settle-write";
import { fetchLandedTransaction } from "../submitter/steps/book";
import { orderExpiry } from "../submitter/steps/expiry";
import { freshQuote, requoteAfterNoFill, type QuoteInput } from "../submitter/steps/quote";
import { statusGate } from "../submitter/steps/status-gate";
import { diagnose } from "../errors/error-map";
import { forgetVaultAccount, readGrantAccount, readVaultAccount, sideOf, slotOf, tickBaseOf, toVaultGrant } from "./accounts";
import { buildPaid, sendPaid, type PaidWrite } from "./cosign";
import { loadVaultDeployment } from "./deployment";
import { vaultFailureDiagnosis } from "./errors";
import { decodeVaultEvents, type VaultEvent } from "./events";
import { engineBlockOf, lotsOf, placeIx, ticksOf, type PlaceRoute } from "./instructions";
import { grantBuyRefusal } from "./refusal";
import { vaultSeatOn } from "./window";

export type VaultRoute = Exclude<OrderRoute, { kind: "wallet" }>;

const refused = (diag: Diagnosis): OrderOutcome => ({ status: "refused", diagnosis: diag });
const PAIR_BPS_PER_TICK = 10n;

function summarize({ side, market, stakeBase }: OrderRequest, route: VaultRoute): string {
  const via = route.kind === "vault-grant" ? `grant #${route.grantId}` : "the Trading Balance";
  return `${side === "up" ? "Up" : "Down"} on ${market.asset} (${formatCadence(market.intervalSec)} Window), ${formatBaseUnits(stakeBase, market.decimals)} staked via ${via}`;
}

/** Whose Trading Balance pays and who signs: the owner themselves, or the grant's actor for the grant's owner. */
export async function vaultOwnerOf(ctx: Pick<OrderLaneContext, "wallet">, route: VaultRoute): Promise<{ owner: Address; grant: Awaited<ReturnType<typeof readGrantAccount>> }> {
  if (route.kind === "vault") return { owner: ctx.wallet, grant: null };
  const grant = await readGrantAccount(route.grantId);
  if (!grant) throw new OrderRefusedError(diagnosis("grant-refused", `no grant #${route.grantId}`, { errorName: "NoSuchGrant" }));
  return { owner: grant.owner as string as Address, grant };
}

export function placeRouteOf(ctx: Pick<OrderLaneContext, "signer">, route: VaultRoute, owner: Address): PlaceRoute {
  return route.kind === "vault" ? { kind: "vault", owner: ctx.signer } : { kind: "vault-grant", actor: ctx.signer, owner: owner as string as KitAddress, grantId: route.grantId };
}

/** The one `Executed` of this owner, Window, grant and side in the transaction, in the order's own terms. */
export function bookVaultEvents(events: readonly VaultEvent[], ctx: { owner: Address; marketId: MarketId; side: Side; grantId: bigint; isBuy: boolean; series: Pick<SeriesFacts, "lotBase" | "cashUnit">; txHash: Signature }): BookedOrder | null {
  const hit = events.find(
    (e) => e.name === "Executed" && e.data.owner === (ctx.owner as string) && e.data.market === (ctx.marketId as string) && e.data.grantId === ctx.grantId && e.data.outcome === SIDE_TO_OUTCOME[ctx.side] && e.data.isBuy === ctx.isBuy,
  );
  if (!hit || hit.name !== "Executed" || hit.data.lotsDelta === 0n) return null;
  const { cashDelta, lotsDelta, fills } = hit.data;
  // Cash is lots × own-side ticks × cash unit, so the average own price in ticks is cash / (lots × cu).
  const avgPriceBps = Number((cashDelta * PAIR_BPS_PER_TICK) / (lotsDelta * ctx.series.cashUnit));
  const booked = { marketId: ctx.marketId, side: ctx.side, contractsRaw: lotsDelta * ctx.series.lotBase, avgPriceBps, txHash: ctx.txHash, fillCount: fills };
  return ctx.isBuy ? { ...booked, costBase: cashDelta } : { ...booked, costBase: 0n, proceedsBase: cashDelta };
}

export type VaultSettledOutcome =
  | { status: "not-sent"; error: unknown }
  | { status: "unknown"; diagnosis: Diagnosis; txHash: Signature }
  | { status: "nothingFilled"; txHash: Signature }
  | { status: "reverted"; diagnosis: Diagnosis; txHash: Signature }
  /** `tx` null: it landed, but the transaction is not readable yet. */
  | { status: "landed"; txHash: Signature; tx: JsonTransaction | null };

/** The S4 landing table for an order or a sell: landed 6110 → nothing filled; other failures in the vault's words first. */
export async function landOrder(ctx: OrderLaneContext, recordId: string, settled: Settled): Promise<VaultSettledOutcome> {
  if (settled.kind === "not-sent") return { status: "not-sent", error: settled.error };
  const txHash = settled.signature;
  if (settled.kind === "unknown") return { status: "unknown", diagnosis: diagnosis("send-unknown", `no confirmation (${settled.reason}); recovery will ask the chain`, { txHash }), txHash };
  if (settled.kind === "landed-failed") {
    const diag = vaultFailureDiagnosis(settled.failure);
    await ctx.journal.markFailed(recordId, `landed: ${diag.technical}`);
    if (settled.failure.engineCode === ENGINE_CODE.iocNoFill) return { status: "nothingFilled", txHash };
    return { status: "reverted", diagnosis: { ...diag, txHash }, txHash };
  }
  await ctx.journal.markConfirmed(recordId);
  return { status: "landed", txHash, tx: await fetchLandedTransaction(ctx.rpc, txHash) };
}

/** A refusal before anything was sent, in the vault's words when the program said it in simulation. */
export function notSentVaultDiagnosis(error: unknown): Diagnosis {
  if (error instanceof OrderRefusedError) return error.diagnosis;
  if (error instanceof SimulationFailedError) return vaultFailureDiagnosis(error.failure);
  return diagnose(error);
}

async function notSentOutcome(error: unknown, quoteInput: QuoteInput | null, nowMs: number): Promise<OrderOutcome> {
  try {
    if (error instanceof SimulationFailedError && error.failure.engineCode === ENGINE_CODE.iocNoFill && quoteInput) await requoteAfterNoFill(quoteInput, nowMs);
  } catch (requoted) {
    error = requoted;
  }
  if (error instanceof RequoteError) return { status: "requote", quote: error.quote };
  return refused(notSentVaultDiagnosis(error));
}

async function prepareVaultBuy(ctx: OrderLaneContext, deployment: VaultDeployment, req: OrderRequest, route: VaultRoute, quoteInput: QuoteInput, gate: Awaited<ReturnType<typeof statusGate>>): Promise<{ paid: PaidWrite; owner: Address }> {
  const nowMs = ctx.nowMs();
  const fresh = await freshQuote({ ...quoteInput, displayed: req.displayedQuote }, nowMs);
  const expireTs = orderExpiry(nowMs, { lockAtSec: gate.onchain.lockAtSec, intervalSec: req.market.intervalSec });
  const { owner, grant } = await vaultOwnerOf(ctx, route);
  forgetVaultAccount(owner);
  const [account, market] = await Promise.all([readVaultAccount(owner), readMarket(req.market.marketId)]);
  if (!market) throw new OrderRefusedError(diagnosis("market-not-trading", `Window ${req.market.marketId} not found`));
  const tickBase = tickBaseOf(gate.venue.decimals);
  // A grant tap's limit sits at the grant's price cap rather than the cadence's cushion above it (core capQuoteToGrant).
  const quote = grant ? capQuoteToGrant(fresh, req.side, toVaultGrant(grant, tickBase).caps.maxPriceRaw, oneUnit(req.market.decimals), gate.series.tickBase) : fresh;
  if (grant) {
    const refusal = grantBuyRefusal({
      grant: toVaultGrant(grant, tickBase), actor: ctx.wallet, marketId: req.market.marketId, side: req.side, quote, decimals: req.market.decimals, nowSec: Math.floor(nowMs / 1000),
      held: sideOf(slotOf(account, req.market.marketId), SIDE_TO_OUTCOME[req.side]),
    });
    if (refusal) throw new OrderRefusedError(refusal);
  } else if ((account?.available ?? 0n) < quote.maxCostBase) {
    const held = formatBaseUnits(account?.available ?? 0n, req.market.decimals);
    throw new OrderRefusedError(diagnosis("insufficient-collateral", `the Trading Balance holds ${held} but the order escrows ${formatBaseUnits(quote.maxCostBase, req.market.decimals)}`, { errorName: "Insufficient" }));
  }
  const seat = await vaultSeatOn(deployment.seat, gate.onchain.ledger);
  if (!seat.ok) throw new OrderRefusedError(seat.diagnosis);
  const engine = engineBlockOf(market, deployment.collateral as string as KitAddress);
  const order = { outcome: SIDE_TO_OUTCOME[req.side], isBuy: true, priceTicks: ticksOf(quote.limitPriceRaw, gate.series.tickBase), lots: lotsOf(quote.contractsRaw, gate.series.lotBase), expireTs };
  const ix = await placeIx(placeRouteOf(ctx, route, owner), engine, order);
  const paid = await buildPaid(ctx, [ix], route.kind === "vault-grant");
  if (!paid.sponsor) {
    const gas = await checkGas(ctx.rpc, ctx.wallet, "vault-order");
    if (!gas.ok) throw new OrderRefusedError(gas.diagnosis);
  }
  return { paid, owner };
}

/** `submitOrder` for `route.kind` `vault` and `vault-grant`. */
export async function submitVaultOrder(ctx: OrderLaneContext, req: OrderRequest, route: VaultRoute, onPhase?: PhaseListener): Promise<OrderOutcome> {
  const { wallet } = ctx;
  let reservationId: string | null = null;
  let quoteInput: QuoteInput | null = null;
  try {
    const deployment = await loadVaultDeployment();
    if (!deployment) return refused(diagnosis("not-deployed", VAULT_NOT_DEPLOYED));
    const gate = await statusGate(req.market, ctx.nowMs());
    const stop = await ctx.stopGate.checkAndReserve(wallet, req.displayedQuote.maxCostBase);
    if (!stop.ok) return refused(diagnosis("daily-stop", stop.reason));
    reservationId = stop.reservationId;
    quoteInput = { market: req.market, series: gate.series, side: req.side, stakeBase: req.stakeBase };
    const { paid, owner } = await prepareVaultBuy(ctx, deployment, req, route, quoteInput, gate);

    const record = await ctx.journal.record({ kind: "order", wallet, summary: summarize(req, route), pool: req.market.poolAddress, marketId: req.market.marketId });
    onPhase?.("submitted");
    const landed = await landOrder(ctx, record.id, await sendPaid(ctx, record.id, paid, onPhase));
    forgetVaultAccount(owner);
    if (landed.status === "not-sent") {
      onPhase?.("composing");
      return notSentOutcome(landed.error, quoteInput, ctx.nowMs());
    }
    if (landed.status === "unknown") {
      reservationId = null;
      onPhase?.("unknown", { txHash: landed.txHash });
      return landed;
    }
    if (landed.status === "nothingFilled" || landed.status === "reverted") {
      onPhase?.(landed.status === "nothingFilled" ? "confirmed" : "reverted", { txHash: landed.txHash });
      return landed;
    }
    const { txHash } = landed;
    if (!landed.tx) {
      reservationId = null;
      onPhase?.("unknown", { txHash });
      return { status: "unknown", diagnosis: diagnosis("send-unknown", "the order landed but its fills are not readable yet", { txHash }), txHash };
    }
    const grantId = route.kind === "vault-grant" ? route.grantId : 0n;
    const booked = bookVaultEvents(await decodeVaultEvents(landed.tx), { owner, marketId: req.market.marketId, side: req.side, grantId, isBuy: true, series: gate.series, txHash });
    await ctx.stopGate.reconcile(reservationId, booked?.costBase ?? 0n);
    reservationId = null;
    onPhase?.("confirmed", { txHash });
    return booked ? { status: "confirmed", booked } : { status: "nothingFilled", txHash };
  } catch (error) {
    onPhase?.("composing");
    return notSentOutcome(error, quoteInput, ctx.nowMs());
  } finally {
    if (reservationId) await ctx.stopGate.reconcile(reservationId, 0n);
  }
}
