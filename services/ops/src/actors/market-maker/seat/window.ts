/** One Window's maker pass: pull, stop or (re)quote, merging paired inventory on the way (venue-ops.md §8.2–8.3). */
import { marketStatus, sendOps, OpsSendError, ENGINE_ERROR, type MarketView, type OpsClient, type SeriesView } from "@agari/markets/ops";
import {
  ANY_SEAT, cancelAllInstruction, MAKER_KIND, mergeSetInstruction, NORMAL, POST_ONLY, quoteInstruction, readBookTop, readLedger, readPlaceOutcome,
  type LedgerSeat, type VenueConfig,
} from "@agari/markets/ops/maker";
import type { TickerSymbol } from "@agari/core/market";
import type { SeatMakerEnv } from "./env";
import { fairYesTicks } from "./fair";
import type { LaneQuote } from "./lane-quote";
import { makerPhase, needsRequote, quoteExpirySec, quotePair, sizeLots, type Placed } from "./quote";

export interface WindowCtx {
  client: OpsClient;
  config: VenueConfig;
  env: SeatMakerEnv;
  dryRun: boolean;
  nowSec: number;
  inSession: boolean;
  closesAtSec: number | null;
  spotE8: bigint | null;
  log: (why: string) => void;
  /** A Gap or token Window's phase, fair and cap (`lane-quote.ts`); absent for a Regular Window. */
  lane?: LaneQuote | null;
}

export type WindowResult = { state: "quoting" | "resting" | "pulled" | "stopped" | "idle"; placed: Placed | null; note: string };

async function send(ctx: WindowCtx, label: string, build: () => Promise<Parameters<typeof sendOps>[1]>): Promise<string | null> {
  if (ctx.dryRun) {
    ctx.log(`DRY ${label}`);
    return null;
  }
  const { signature } = await sendOps(ctx.client, await build(), label);
  ctx.log(`${label} · ${signature}`);
  return signature;
}

export async function tendWindow(ctx: WindowCtx, series: SeriesView, symbol: TickerSymbol, m: MarketView, placed: Placed | null, label: string): Promise<WindowResult> {
  const d = m.data;
  const me = ctx.client.payer.address;
  const lockAtSec = Number(d.lockAt);
  if (marketStatus(d, ctx.nowSec) !== "trading") return { state: "idle", placed: null, note: "not trading" };
  const lane = ctx.lane ?? null;
  const phase = lane?.phase ?? makerPhase({ nowSec: ctx.nowSec, lockAtSec, inSession: ctx.inSession, closesAtSec: ctx.closesAtSec, spotFresh: ctx.spotE8 !== null });
  const fair =
    phase !== "quote" || d.open.source === 0
      ? null
      : lane
        ? lane.fairTicks
        : fairYesTicks({ spotE8: ctx.spotE8!, openE8: d.open.price, secondsLeft: Number(d.expiry) - ctx.nowSec, sigmaBps: ctx.env.sigmaBps(symbol), minTick: ctx.env.minTick });
  // A pair still inside its life and near the fair needs no reads at all: fills and expiries surface at the next requote.
  if (fair !== null && placed && !needsRequote({ placed, fairTicks: fair, nowSec: ctx.nowSec, requoteTicks: ctx.env.requoteTicks })) {
    return { state: "resting", placed, note: `fair ${fair}, resting` };
  }
  // Nothing of ours is known to rest: out-of-quote phases need no reads (any leftover expires by lock − 30, the settler sweeps).
  if (!placed && phase !== "quote") return { state: phase === "stop" ? "stopped" : "pulled", placed: null, note: phase };
  if (!placed && fair === null) return { state: "idle", placed: null, note: "waiting for the open print" };
  const ledger = await readLedger(ctx.client, d.ledger);
  const seat: LedgerSeat | undefined = ledger?.seats.find((s) => s.owner === me);
  const cancelAll = async (why: string) => {
    if (!seat || seat.openOrders === 0) return;
    await send(ctx, `cancel_all ${label} (${seat.openOrders} orders): ${why}`, async () => [await cancelAllInstruction(ctx.client, m, ctx.config, seat.index, true)]);
  };
  if (phase !== "quote") {
    await cancelAll(phase === "stop" ? "60 s before lock" : lane ? `lane: ${lane.why}` : ctx.spotE8 === null ? "spot stale" : "out of session, halted or near the close");
    return { state: phase === "stop" ? "stopped" : "pulled", placed: null, note: phase };
  }
  if (fair === null) {
    await cancelAll("no open print yet");
    return { state: "idle", placed: null, note: "waiting for the open print" };
  }
  if (seat && seat.yesFree > 0n && seat.noFree > 0n) {
    const lots = seat.yesFree < seat.noFree ? seat.yesFree : seat.noFree;
    await send(ctx, `merge ${lots} sets ${label}`, async () => [await mergeSetInstruction(ctx.client, m, ctx.config, seat.index, lots)]);
  }
  await cancelAll(placed ? `requote: fair ${placed.fairTicks} → ${fair}` : "unknown resting orders");
  const crossing = ctx.env.orderType === "limit";
  const top = await readBookTop(ctx.client, d.book);
  const pair = quotePair({
    fairTicks: fair, halfSpreadTicks: lane?.halfSpreadTicks ?? ctx.env.halfSpreadTicks, minTick: ctx.env.minTick,
    bestBidTicks: top?.bestBidTicks ?? null, bestAskTicks: top?.bestAskTicks ?? null, crossing,
  });
  const lots = sizeLots({ wantLots: ctx.env.quoteLots, pair, cu: series.data.cashUnit, budget: lane?.maxCashPerWindow ?? ctx.env.maxCashPerWindow, minLots: series.data.minLots });
  if (lots === 0n) return { state: "idle", placed: null, note: `fair ${fair}: no admissible size or side` };
  const expireSec = quoteExpirySec(ctx.nowSec, lockAtSec, ctx.env.quoteTtlSec);
  let seatHint = seat?.index ?? ANY_SEAT;
  let placedAny = false;
  const took: string[] = [];
  for (const [side, ticks] of [["bid", pair.bidTicks], ["ask", pair.askTicks]] as const) {
    if (ticks === null) continue;
    const kind = side === "bid" ? MAKER_KIND.buyYes : MAKER_KIND.buyNo;
    const orderType = crossing ? NORMAL : POST_ONLY;
    try {
      const sig = await send(ctx, `${crossing ? "limit" : "post"} ${side} ${lots} @ ${ticks} ${label} (fair ${fair}, expires ${expireSec})`, async () => [
        await quoteInstruction(ctx.client, m, ctx.config, { kind, priceTicks: ticks, lots, expireSec, seatHint, clientId: BigInt(ctx.nowSec), orderType }),
      ]);
      // A limit quote may fill instead of resting (a Normal order stopping on the fill cap cancels its remainder), so
      // what rests comes from the placement's own PlaceResult, never from the assumption that a quote always rests.
      if (sig && crossing) {
        const outcome = await readPlaceOutcome(ctx.client, sig);
        if (outcome && outcome.filledLots > 0n) took.push(`${side} filled ${outcome.filledLots}${outcome.cancelledLots > 0n ? `, cancelled ${outcome.cancelledLots} (stop ${outcome.stopReason})` : ""}`);
        placedAny ||= outcome === null ? false : outcome.restedLots > 0n;
      } else placedAny = true;
      // The first placement claims a seat; the second must name it (D-020).
      if (sig && seatHint === ANY_SEAT) seatHint = (await readLedger(ctx.client, d.ledger))?.seats.find((s) => s.owner === me)?.index ?? ANY_SEAT;
    } catch (error) {
      if (error instanceof OpsSendError && error.code === ENGINE_ERROR.postOnlyWouldCross) ctx.log(`${side} ${ticks} ${label} would cross: skipped this pass`);
      else throw error;
    }
  }
  const note = `fair ${fair} → ${pair.bidTicks ?? "-"} / ${pair.askTicks ?? "-"} × ${lots}${took.length ? ` · ${took.join("; ")}` : ""}`;
  return { state: "quoting", placed: placedAny ? { fairTicks: fair, expireSec } : null, note };
}
