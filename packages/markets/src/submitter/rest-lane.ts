/**
 * The pre-open call's lane (D-088, AD-3): a post-only `user_place_order` at the user's own price on a Listed (or
 * Trading) Window, resting until it fills, is cancelled or expires — `trading_start + 90 s` by default, the lock on
 * request. Gate (Listed or Trading) → the resting quote re-sized on the chain grid → a book-top pre-check that refuses a
 * crossing price before anything is signed → expiry → funding (seat bond + credit) → build post-only + simulate →
 * journal → sign → send → confirm → `rested` from `OrderExecuted`. The wallet route only: the wallet signs its own call.
 */
import { formatCadence } from "@agari/core/copy";
import { topOfBook } from "@agari/core/market";
import { restExpirySec, restingQuote, TICKS_PER_CENT } from "@agari/core/orders";
import type { OrderOutcome, OrderRequest, PhaseListener, RestedOrder } from "@agari/core/ports";
import { diagnosis, type Diagnosis, type EventMarket, type Quote, type Side, type Signature } from "@agari/core/types";
import { formatBaseUnits, msToSec } from "@agari/core/units";
import { diagnose } from "../errors/error-map";
import { readBook, type SeriesFacts } from "../runtime/accounts";
import { bookFilter } from "../runtime/mappers";
import { ENGINE_CODE, failureDiagnosis } from "./chain-failure";
import { OrderRefusedError, RequoteError, SimulationFailedError } from "./errors";
import type { WriteEvent } from "./events";
import { assertFunded } from "./funding";
import { buildWithSeatRetry, type OrderLaneContext } from "./order-lane";
import { ORDER_KIND, ORDER_TYPE } from "./order-codes";
import { signSendConfirm } from "./settle-write";
import { bookFromEvents, fetchWriteEvents } from "./steps/book";
import { statusGate, type GateResult } from "./steps/status-gate";

const PAIR_TICKS = 1000n;

const refused = (diag: Diagnosis): OrderOutcome => ({ status: "refused", diagnosis: diag });

/** The journal's line, read back by recovery, so it is written for a person. */
function summarize({ side, market }: OrderRequest, quote: Quote): string {
  return `Schedule ${side === "up" ? "Up" : "Down"} on ${market.asset} (${formatCadence(market.intervalSec)} Window) at ${quote.oddsCents}¢, ${formatBaseUnits(quote.maxCostBase, market.decimals)} held`;
}

/** The confirmed quote re-sized on the chain's own grid: a bigger escrow is a requote, an unsizable stake a refusal. */
function sizeOnChain(series: SeriesFacts, req: OrderRequest, nowMs: number): Quote {
  const { side, stakeBase, displayedQuote: displayed, market } = req;
  const sized = restingQuote({ side, priceCents: displayed.oddsCents, stakeBase, grid: series, decimals: market.decimals, quotedAtMs: nowMs });
  if (!sized.ok) {
    if (sized.blocker === "no-price") throw new OrderRefusedError(diagnosis("invalid-price", `${displayed.oddsCents}¢ is off the 1..99¢ grid`));
    throw new OrderRefusedError(diagnosis("below-min-quantity", `${stakeBase} rests fewer than ${series.minLots} lots at ${displayed.oddsCents}¢ (floor ${sized.sizing?.minStakeBase ?? 0n})`));
  }
  if (sized.quote.maxCostBase > displayed.maxCostBase || sized.quote.limitPriceRaw !== displayed.limitPriceRaw) throw new RequoteError(sized.quote);
  return sized.quote;
}

/**
 * A post-only that would take is refused by the engine (6109) after the wallet has signed; the same check on a fresh
 * Book refuses before the popup. UP at `p` crosses a YES ask at or under `p`; DOWN at YES `p` crosses a YES bid at or over `p`.
 */
async function refuseCrossing(market: EventMarket, series: SeriesFacts, side: Side, quote: Quote, nowMs: number): Promise<void> {
  const book = await readBook(market.poolAddress);
  if (!book || book.market !== (market.marketId as string)) return;
  const yesTicks = Number(quote.limitPriceRaw / series.tickBase);
  const { bid, ask } = topOfBook(book.bids, book.asks, bookFilter(book, series, msToSec(nowMs)));
  const crossed = side === "up" ? (ask && ask[0] <= yesTicks ? ask[0] : null) : bid && bid[0] >= yesTicks ? bid[0] : null;
  if (crossed === null) return;
  throw new OrderRefusedError(diagnosis("post-only-would-cross", `the best ${side === "up" ? "ask" : "bid"} rests at ${crossed} YES ticks; a ${side} call at ${yesTicks} would take it`));
}

function restExpiry(nowMs: number, gate: GateResult, until: OrderRequest["restUntil"]): number {
  const expireSec = restExpirySec(msToSec(nowMs), { tradingStartSec: gate.tradingStartSec, lockAtSec: gate.onchain.lockAtSec }, until);
  if (expireSec === null) throw new OrderRefusedError(diagnosis("order-expired", "no time left to rest before the Window locks"));
  return expireSec;
}

/** What rested, from the placement's own `OrderExecuted`; null when nothing rests (a taker's fills book instead). */
export function restedFromEvents(events: readonly WriteEvent[], ctx: { wallet: string; market: EventMarket; side: Side; series: SeriesFacts; txHash: Signature }): RestedOrder | null {
  const executed = events.find((e) => e.name === "OrderExecuted" && e.data.taker === ctx.wallet && e.data.market === (ctx.market.marketId as string));
  if (!executed || executed.name !== "OrderExecuted" || executed.data.restedLots === 0n) return null;
  const { data } = executed;
  const ownTicks = data.kind === ORDER_KIND.buyYes ? BigInt(data.limitPrice) : PAIR_TICKS - BigInt(data.limitPrice);
  return {
    marketId: ctx.market.marketId,
    side: ctx.side,
    txHash: ctx.txHash,
    node: data.rested.node,
    seq: data.rested.seq,
    lots: data.restedLots,
    priceTicks: data.limitPrice,
    contractsRaw: data.restedLots * ctx.series.lotBase,
    escrowBase: data.restedLots * ownTicks * ctx.series.cashUnit,
    expireSec: Number(data.expireTs),
  };
}

function notSentOutcome(error: unknown): OrderOutcome {
  if (error instanceof RequoteError) return { status: "requote", quote: error.quote };
  if (error instanceof OrderRefusedError) return refused(error.diagnosis);
  if (error instanceof SimulationFailedError) return refused(failureDiagnosis(error.failure));
  return refused(diagnose(error));
}

export async function submitRest(ctx: OrderLaneContext, req: OrderRequest, onPhase?: PhaseListener): Promise<OrderOutcome> {
  if (req.route && req.route.kind !== "wallet") return refused(diagnosis("grant-refused", "a scheduled call is signed by the wallet; the Trading Balance and its grants take at the open"));
  const { wallet } = ctx;
  const { market, side } = req;
  let reservationId: string | null = null;
  try {
    const gate = await statusGate(market, ctx.nowMs(), "listed-or-trading");
    const stop = await ctx.stopGate.checkAndReserve(wallet, req.displayedQuote.maxCostBase);
    if (!stop.ok) return refused(diagnosis("daily-stop", stop.reason));
    reservationId = stop.reservationId;

    const quote = sizeOnChain(gate.series, req, ctx.nowMs());
    await refuseCrossing(market, gate.series, side, quote, ctx.nowMs());
    const expireTs = restExpiry(ctx.nowMs(), gate, req.restUntil);
    const funding = await assertFunded(wallet, gate.onchain, quote, ctx.rpc);
    if (!funding.ok) throw new OrderRefusedError(funding.diagnosis);
    const built = await buildWithSeatRetry(ctx, {
      signer: ctx.signer, market, ledger: gate.onchain.ledger, series: gate.series, side, quote, expireTs, seatIndex: funding.seatIndex, orderType: ORDER_TYPE.postOnly,
    });

    const record = await ctx.journal.record({ kind: "order", wallet, summary: summarize(req, quote), pool: market.poolAddress, marketId: market.marketId });
    onPhase?.("submitted");
    const settled = await signSendConfirm(ctx, record.id, built, onPhase);
    if (settled.kind === "not-sent") {
      onPhase?.("composing");
      return notSentOutcome(settled.error);
    }
    const txHash = settled.signature;
    if (settled.kind === "unknown") {
      reservationId = null;
      onPhase?.("unknown");
      return { status: "unknown", diagnosis: diagnosis("send-unknown", `no confirmation (${settled.reason}); recovery will ask the chain`, { txHash }), txHash };
    }
    if (settled.kind === "landed-failed") {
      const diag = failureDiagnosis(settled.failure);
      await ctx.journal.markFailed(record.id, `landed: ${diag.technical}`);
      onPhase?.("reverted", { txHash });
      return { status: "reverted", diagnosis: diagnosis(diag.kind, diag.technical, { txHash }), txHash };
    }

    const events = await fetchWriteEvents(ctx.rpc, txHash);
    await ctx.journal.markConfirmed(record.id);
    if (!events) {
      reservationId = null;
      onPhase?.("unknown");
      return { status: "unknown", diagnosis: diagnosis("send-unknown", "the call landed but its placement is not readable yet", { txHash }), txHash };
    }
    const rested = restedFromEvents(events, { wallet, market, side, series: gate.series, txHash });
    await ctx.stopGate.reconcile(reservationId, rested?.escrowBase ?? 0n);
    reservationId = null;
    onPhase?.("confirmed", { txHash });
    if (rested) return { status: "resting", rested };
    // A post-only either rests or reverts; a landed placement with nothing resting is the Book's own answer.
    const booked = bookFromEvents(events, { wallet, marketId: market.marketId, side, lotBase: gate.series.lotBase, txHash });
    return booked ? { status: "confirmed", booked } : { status: "nothingFilled", txHash };
  } catch (error) {
    onPhase?.("composing");
    return notSentOutcome(error);
  } finally {
    if (reservationId) await ctx.stopGate.reconcile(reservationId, 0n);
  }
}

/** The engine codes a rest can land with, for callers that branch on them. */
export const REST_CODES = { wouldCross: ENGINE_CODE.postOnlyWouldCross, tooMany: ENGINE_CODE.tooManyOpenOrders, preOpenTaker: ENGINE_CODE.preOpenTakerRefused } as const;
