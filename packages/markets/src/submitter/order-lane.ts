import { formatCadence } from "@agari/core/copy";
import type { AttributionHook, OrderOutcome, OrderRequest, PhaseListener, StopGate } from "@agari/core/ports";
import { diagnosis, type Diagnosis } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { diagnose } from "../errors/error-map";
import { readSeat } from "../runtime/accounts";
import { notDeployed } from "../stub/not-deployed";
import { ENGINE_CODE, failureDiagnosis } from "./chain-failure";
import { OrderRefusedError, RequoteError, SimulationFailedError } from "./errors";
import { assertFunded } from "./funding";
import { signSendConfirm, type WriteContext } from "./settle-write";
import { bookFromEvents, fetchWriteEvents } from "./steps/book";
import { buildOrder, type OrderBuildInput } from "./steps/build";
import { orderExpiry } from "./steps/expiry";
import type { BuiltWrite } from "./steps/message";
import { freshQuote, requoteAfterNoFill, type QuoteInput } from "./steps/quote";
import { statusGate } from "./steps/status-gate";

export interface OrderLaneContext extends WriteContext {
  stopGate: StopGate;
  attribution: AttributionHook;
}

const refused = (diag: Diagnosis): OrderOutcome => ({ status: "refused", diagnosis: diag });

/** The journal's one line about the order, read back to the user by recovery, so it is written for a person. */
function summarize({ side, market, stakeBase }: OrderRequest): string {
  return `${side === "up" ? "Up" : "Down"} on ${market.asset} (${formatCadence(market.intervalSec)} Window), ${formatBaseUnits(stakeBase, market.decimals)} staked`;
}

/** A write that never reached the chain: a requote, a refusal, or a simulation/preflight failure in the §3.1 table. */
async function notSentOutcome(error: unknown, quoteInput: QuoteInput | null, nowMs: number): Promise<OrderOutcome> {
  try {
    if (error instanceof SimulationFailedError && error.failure.engineCode === ENGINE_CODE.iocNoFill && quoteInput) {
      await requoteAfterNoFill(quoteInput, nowMs);
    }
  } catch (requoted) {
    error = requoted;
  }
  if (error instanceof RequoteError) return { status: "requote", quote: error.quote };
  if (error instanceof OrderRefusedError) return refused(error.diagnosis);
  if (error instanceof SimulationFailedError) return refused(failureDiagnosis(error.failure));
  return refused(diagnose(error));
}

/** Simulation `SeatMismatch` (6115): the seat changed since it was read. Re-read it and rebuild once (first-call.md §3.1). */
async function buildWithSeatRetry(ctx: OrderLaneContext, input: OrderBuildInput): Promise<BuiltWrite> {
  try {
    return await buildOrder(ctx.rpc, input);
  } catch (error) {
    if (!(error instanceof SimulationFailedError) || error.failure.engineCode !== ENGINE_CODE.seatMismatch) throw error;
    const seatRead = await readSeat(input.ledger, ctx.wallet);
    return buildOrder(ctx.rpc, { ...input, seatIndex: seatRead?.seat?.index ?? null });
  }
}

/**
 * AD-3's order lane on Solana, in Masayume's order (`submitter/order-lane.ts`): status gate → Daily-Stop gate → fresh
 * quote against the confirmed cap → headroom expiry → funding (seat bond + credit) → build IOC + simulate → journal →
 * sign → send → confirm → book from `OrderExecuted`. A send with no answer is journaled unknown and never retried.
 */
export async function submitOrder(ctx: OrderLaneContext, req: OrderRequest, onPhase?: PhaseListener): Promise<OrderOutcome> {
  if (req.route && req.route.kind !== "wallet") return refused(notDeployed("vault order routes arrive with the EventVault (S7)"));
  const { wallet } = ctx;
  const { market, side, stakeBase, displayedQuote } = req;
  let reservationId: string | null = null;
  let quoteInput: QuoteInput | null = null;
  try {
    const gate = await statusGate(market, ctx.nowMs());
    const stop = await ctx.stopGate.checkAndReserve(wallet, displayedQuote.maxCostBase);
    if (!stop.ok) return refused(diagnosis("daily-stop", stop.reason));
    reservationId = stop.reservationId;

    quoteInput = { market, series: gate.series, side, stakeBase };
    const quote = await freshQuote({ ...quoteInput, displayed: displayedQuote }, ctx.nowMs());
    const expireTs = orderExpiry(ctx.nowMs(), { lockAtSec: gate.onchain.lockAtSec, intervalSec: market.intervalSec });
    const funding = await assertFunded(wallet, gate.onchain, quote, ctx.rpc);
    if (!funding.ok) throw new OrderRefusedError(funding.diagnosis);
    const built = await buildWithSeatRetry(ctx, {
      signer: ctx.signer, market, ledger: gate.onchain.ledger, series: gate.series, side, quote, expireTs, seatIndex: funding.seatIndex,
    });

    const record = await ctx.journal.record({ kind: "order", wallet, summary: summarize(req), pool: market.poolAddress, marketId: market.marketId });
    onPhase?.("submitted");
    const settled = await signSendConfirm(ctx, record.id, built, onPhase);
    if (settled.kind === "not-sent") {
      onPhase?.("composing");
      return notSentOutcome(settled.error, quoteInput, ctx.nowMs());
    }
    const txHash = settled.signature;
    if (settled.kind === "unknown") {
      // An unknown send may still land, so its reservation stays until the journal is reconciled (AD-9).
      reservationId = null;
      onPhase?.("unknown");
      return { status: "unknown", diagnosis: diagnosis("send-unknown", `no confirmation (${settled.reason}); recovery will ask the chain`, { txHash }), txHash };
    }
    if (settled.kind === "landed-failed") {
      const diag = failureDiagnosis(settled.failure);
      await ctx.journal.markFailed(record.id, `landed: ${diag.technical}`);
      if (settled.failure.engineCode === ENGINE_CODE.iocNoFill) {
        // The IOC lost the race after preflight: the fee is paid, the stake was never taken.
        onPhase?.("confirmed", { txHash });
        return { status: "nothingFilled", txHash };
      }
      onPhase?.("reverted", { txHash });
      return { status: "reverted", diagnosis: diagnosis(diag.kind, diag.technical, { txHash }), txHash };
    }

    const events = await fetchWriteEvents(ctx.rpc, txHash);
    await ctx.journal.markConfirmed(record.id);
    if (!events) {
      reservationId = null;
      onPhase?.("unknown");
      return { status: "unknown", diagnosis: diagnosis("send-unknown", "the order landed but its fills are not readable yet", { txHash }), txHash };
    }
    const booked = bookFromEvents(events, { wallet, marketId: market.marketId, side, lotBase: gate.series.lotBase, txHash });
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
